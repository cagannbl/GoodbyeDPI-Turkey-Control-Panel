'use strict';
// ---------------------------------------------------------------------------
// Ender Ejderhası ve End kristalleri
// - Ejderha adanın etrafında daire çizer, ara sıra oyuncuya dalış yapar ya da
//   çıkış geçidinin üstüne konar. Yakındaki sağlam kristaller onu iyileştirir.
// - Kristaller ok ya da vuruşla patlar.
// - Ejderha ölünce çıkış geçidi açılır ve ejderha yumurtası belirir.
// ---------------------------------------------------------------------------

const DRAGON_C = [0.1, 0.12, 0.2], DRAGON_SPINE = [0.25, 0.42, 0.5], DRAGON_WING = [0.14, 0.18, 0.3], DRAGON_EYE = [0.35, 0.9, 1];
MOB_TYPES.dragon = { name: 'Boşluk Ejderhası', hw: 2.2, h: 2.6, health: 200, speed: 0, hostile: true, boss: true, boxes: 40, sound: 'roar', parts: [] };
MOB_TYPES.crystal = { name: 'Boşluk Kristali', hw: 0.6, h: 1.6, health: 1, speed: 0, hostile: false, boss: true, boxes: 4, sound: 'pop', parts: [] };

const DRAGON_PROTECTED = new Set([B.END_STONE, B.OBSIDIAN, B.BEDROCK, B.END_PORTAL, B.END_FRAME, B.END_FRAME_EYE, B.DRAGON_EGG, B.CRYING_OBSIDIAN]);

class Dragon extends Mob {
  constructor(x, y, z) {
    super('dragon', x, y, z);
    this.state = 'circle'; this.timer = 10; this.ang = Math.atan2(z, x);
    this.flap = 0; this.pitch = 0; this.flapSnd = 0; this.roarT = 6; this.breakT = 0;
    this.healFrom = null;
  }

  hit(dmg) {
    if (this.dead) return;
    this.health -= dmg;
    this.hurtTime = 0.4;
    if (this.state === 'perch' && Math.random() < 0.3) { this.state = 'circle'; this.timer = 6; }
    if (this.health <= 0) { this.health = 0; this.dead = true; this.deathTime = 0; }
  }

  update(dt, game) {
    this.game = game;
    const p = this.pos, v = this.vel, pl = game.player;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.flap += dt * (this.state === 'perch' ? 2.5 : 5.5);
    if (this.dead) {
      this.deathTime += dt;
      p[1] += dt * 1.5;
      if (Math.random() < dt * 30) game.particles.explosion(p[0] + (Math.random() - 0.5) * 6, p[1] + Math.random() * 3, p[2] + (Math.random() - 0.5) * 6, 0.6);
      if (this.deathTime > 4.5) { this.remove = true; game.onDragonDeath(); }
      return;
    }
    // Kristal iyileştirmesi
    this.healFrom = null;
    let bd = 64;
    for (const m of game.entities.mobs) {
      if (m.type !== 'crystal' || m.dead) continue;
      const d = Math.hypot(m.pos[0] - p[0], m.pos[1] - p[1], m.pos[2] - p[2]);
      if (d < bd) { bd = d; this.healFrom = m; }
    }
    if (this.healFrom && this.health < this.T.health) this.health = Math.min(this.T.health, this.health + dt * 2);

    // Durumlar
    this.timer -= dt;
    let tgt, speed;
    const R = 46;
    const canAttack = !pl.dead && !pl.creative && game.dim === 'end';
    if (this.state === 'circle') {
      this.ang += dt * 14 / R;
      tgt = [Math.cos(this.ang) * R, 74 + Math.sin(this.ang * 2) * 6, Math.sin(this.ang) * R];
      speed = 14;
      if (this.timer <= 0) {
        const r = Math.random();
        if (canAttack && r < 0.6) { this.state = 'charge'; this.timer = 5; game.audio.play('roar', p); }
        else if (r < 0.85) { this.state = 'perch'; this.timer = 14; }
        else this.timer = 8;
      }
    } else if (this.state === 'charge') {
      tgt = [pl.pos[0], pl.pos[1] + 1, pl.pos[2]];
      speed = 19;
      if (!canAttack || this.timer <= 0) { this.state = 'circle'; this.timer = 8 + Math.random() * 6; this.ang = Math.atan2(p[2], p[0]); }
    } else {
      // Çıkış geçidinin üstüne kon
      tgt = [0, 67, 0];
      const d = Math.hypot(p[0], p[1] - 67, p[2]);
      speed = d > 6 ? 12 : d * 2;
      if (this.timer <= 0) { this.state = 'circle'; this.timer = 10; this.ang = Math.atan2(p[2], p[0]); }
    }
    const dx = tgt[0] - p[0], dy = tgt[1] - p[1], dz = tgt[2] - p[2], dl = Math.hypot(dx, dy, dz) || 1;
    const k = 1 - Math.exp(-dt * 1.6);
    v[0] += ((dx / dl) * speed - v[0]) * k; v[1] += ((dy / dl) * speed - v[1]) * k; v[2] += ((dz / dl) * speed - v[2]) * k;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    const hs = Math.hypot(v[0], v[2]);
    if (hs > 0.5) {
      let dyaw = Math.atan2(-v[0], -v[2]) - this.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      this.yaw += dyaw * Math.min(1, dt * 3);
    }
    this.pitch += (clamp(Math.atan2(v[1], hs + 0.01), -0.6, 0.6) - this.pitch) * Math.min(1, dt * 3);

    // Oyuncuya çarpma
    this.attackCd -= dt;
    const px = pl.pos[0] - p[0], py = pl.pos[1] + 0.9 - (p[1] + 1.3), pz = pl.pos[2] - p[2];
    const pd = Math.hypot(px, py, pz);
    if (canAttack && pd < 4.2 && this.attackCd <= 0) {
      this.attackCd = 1.2;
      const hl = Math.hypot(px, pz) || 1;
      pl.hurt(game.difficultyDmg(10), (px / hl) * 14, (pz / hl) * 14, 'mob');
      pl.vel[1] = 9;
      if (this.state === 'charge') { this.state = 'circle'; this.timer = 8; this.ang = Math.atan2(p[2], p[0]); }
    }
    // İçinden geçtiği blokları kır (End taşı, obsidyen, ana kaya hariç)
    this.breakT -= dt;
    if (this.breakT <= 0) {
      this.breakT = 0.15;
      const w = game.world;
      for (let y = Math.floor(p[1]); y <= Math.floor(p[1] + 2.5); y++) for (let z = Math.floor(p[2] - 2); z <= Math.floor(p[2] + 2); z++) for (let x = Math.floor(p[0] - 2); x <= Math.floor(p[0] + 2); x++) {
        const id = w.getBlock(x, y, z);
        if (id && !DRAGON_PROTECTED.has(id) && BLOCKS[id].hardness >= 0) { w.setBlock(x, y, z, 0); if (Math.random() < 0.3) game.particles.blockBreak(x, y, z, id, 4); }
      }
    }
    // Sesler
    this.flapSnd -= dt;
    if (this.flapSnd <= 0) { this.flapSnd = this.state === 'perch' ? 1.6 : 0.9; game.audio.play('flap', p); }
    this.roarT -= dt;
    if (this.roarT <= 0) { this.roarT = 8 + Math.random() * 10; game.audio.play('roar', p); }
  }

  buildMesh(out, n, cam) {
    const base = M4.create(), t = M4.create(), m = M4.create();
    M4.translate(base, this.pos[0] - cam[0], this.pos[1] - cam[1] + 1.2, this.pos[2] - cam[2]);
    M4.rotY(t, this.yaw); M4.mul(base, base, t);
    M4.rotX(t, this.pitch); M4.mul(base, base, t);
    if (this.dead) { M4.rotZ(t, Math.sin(this.deathTime * 20) * 0.05); M4.mul(base, base, t); }
    const hurt = this.hurtTime > 0;
    const C = (c) => (hurt ? [Math.min(1, c[0] + 0.5), c[1] * 0.5, c[2] * 0.5] : c);
    const L = 0.75;
    const box = (mm, b, c, light = L) => { n = addBox(out, n, mm, b[0], b[1], b[2], b[3], b[4], b[5], C(c), light); };
    // Gövde
    box(base, [-1.2, -0.9, -2.2, 1.2, 0.9, 2.4], DRAGON_C);
    for (let i = 0; i < 4; i++) box(base, [-0.15, 0.9, -1.8 + i * 1.1, 0.15, 1.4, -1.3 + i * 1.1], DRAGON_SPINE);
    // Boyun ve baş (hafif dalgalanır)
    const wave = Math.sin(this.flap * 0.5) * 0.08;
    m.set(base);
    M4.translate(t, 0, 0.15, -2.2); M4.mul(m, m, t);
    for (let i = 0; i < 4; i++) {
      M4.rotX(t, wave + (this.state === 'perch' ? -0.12 : 0.03)); M4.mul(m, m, t);
      box(m, [-0.45, -0.4, -0.9, 0.45, 0.45, 0], DRAGON_C);
      box(m, [-0.1, 0.45, -0.7, 0.1, 0.75, -0.3], DRAGON_SPINE);
      M4.translate(t, 0, 0, -0.9); M4.mul(m, m, t);
    }
    box(m, [-0.75, -0.5, -1.9, 0.75, 0.55, 0], DRAGON_C);
    box(m, [-0.6, -0.75, -1.8, 0.6, -0.5, -0.2], DRAGON_SPINE);
    box(m, [-0.6, 0.15, -0.55, -0.25, 0.35, -0.5 + 0.0], DRAGON_EYE, 1.2);
    box(m, [0.25, 0.15, -0.55, 0.6, 0.35, -0.5], DRAGON_EYE, 1.2);
    box(m, [-0.6, 0.15, -0.56, -0.25, 0.35, -0.54], DRAGON_EYE, 1.2);
    box(m, [0.25, 0.15, -0.56, 0.6, 0.35, -0.54], DRAGON_EYE, 1.2);
    box(m, [-0.5, 0.55, -0.4, -0.3, 0.9, -0.1], DRAGON_SPINE);
    box(m, [0.3, 0.55, -0.4, 0.5, 0.9, -0.1], DRAGON_SPINE);
    // Kuyruk
    m.set(base);
    M4.translate(t, 0, 0, 2.4); M4.mul(m, m, t);
    for (let i = 0; i < 8; i++) {
      M4.rotX(t, -0.04 + Math.sin(this.flap * 0.6 + i * 0.5) * 0.05); M4.mul(m, m, t);
      M4.rotY(t, Math.sin(this.flap * 0.4 + i * 0.6) * 0.06); M4.mul(m, m, t);
      const s = 0.45 - i * 0.03;
      box(m, [-s, -s, 0, s, s, 0.9], DRAGON_C);
      box(m, [-0.08, s, 0.2, 0.08, s + 0.3, 0.6], DRAGON_SPINE);
      M4.translate(t, 0, 0, 0.9); M4.mul(m, m, t);
    }
    // Kanatlar
    const fl = Math.sin(this.flap) * (this.state === 'perch' ? 0.25 : 0.7);
    for (const side of [1, -1]) {
      m.set(base);
      M4.translate(t, side * 1.2, 0.6, -1); M4.mul(m, m, t);
      M4.rotZ(t, side * fl); M4.mul(m, m, t);
      box(m, side > 0 ? [0, -0.15, -0.3, 4.5, 0.15, 0.3] : [-4.5, -0.15, -0.3, 0, 0.15, 0.3], DRAGON_SPINE);
      box(m, side > 0 ? [0, -0.05, 0.3, 4.5, 0.05, 3.6] : [-4.5, -0.05, 0.3, 0, 0.05, 3.6], DRAGON_WING);
      M4.translate(t, side * 4.5, 0, 0); M4.mul(m, m, t);
      M4.rotZ(t, side * fl * 0.9); M4.mul(m, m, t);
      box(m, side > 0 ? [0, -0.12, -0.25, 4.5, 0.12, 0.25] : [-4.5, -0.12, -0.25, 0, 0.12, 0.25], DRAGON_SPINE);
      box(m, side > 0 ? [0, -0.04, 0.25, 4.5, 0.04, 3.2] : [-4.5, -0.04, 0.25, 0, 0.04, 3.2], DRAGON_WING);
    }
    // Bacaklar
    for (const [x, z] of [[-1, -1.5], [1, -1.5], [-1, 1.6], [1, 1.6]]) box(base, [x - 0.3, -2, z - 0.3, x + 0.3, -0.9, z + 0.3], DRAGON_C);
    return n;
  }
}

class EndCrystal extends Mob {
  constructor(x, y, z, idx) {
    super('crystal', x, y, z);
    this.idx = idx; this.spin = Math.random() * 6;
  }
  hit() {
    if (this.dead || !this.game) return;
    this.dead = true; this.remove = true;
    const g = this.game;
    if (g.dims && g.dims.end) (g.dims.end.crystals || (g.dims.end.crystals = {}))[this.idx] = false;
    g.explode(this.pos[0], this.pos[1] + 0.8, this.pos[2], 6);
  }
  update(dt, game) { this.game = game; this.spin += dt * 2; }
  buildMesh(out, n, cam) {
    const m = M4.create(), t = M4.create();
    const bob = Math.sin(this.spin * 1.3) * 0.15;
    M4.translate(m, this.pos[0] - cam[0], this.pos[1] - cam[1] + 0.9 + bob, this.pos[2] - cam[2]);
    M4.rotY(t, this.spin); M4.mul(m, m, t);
    M4.rotX(t, 0.6); M4.mul(m, m, t);
    n = addBox(out, n, m, -0.3, -0.3, -0.3, 0.3, 0.3, 0.3, [1, 0.45, 0.85], 1.4);
    M4.rotZ(t, this.spin * 0.7); M4.mul(m, m, t);
    n = addBox(out, n, m, -0.45, -0.45, -0.45, 0.45, 0.45, 0.45, [0.75, 0.75, 0.85], 0.9);
    const b = M4.create();
    M4.translate(b, this.pos[0] - cam[0], this.pos[1] - cam[1], this.pos[2] - cam[2]);
    n = addBox(out, n, b, -0.5, -0.05, -0.5, 0.5, 0.1, 0.5, [0.15, 0.15, 0.18], 0.7);
    return n;
  }
}

// Kristalden ejderhaya ışın
function beamMesh(out, n, from, to, cam) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], len = Math.hypot(dx, dy, dz);
  const m = M4.create(), t = M4.create();
  M4.translate(m, from[0] - cam[0], from[1] - cam[1], from[2] - cam[2]);
  M4.rotY(t, Math.atan2(-dx, -dz)); M4.mul(m, m, t);
  M4.rotX(t, Math.atan2(dy, Math.hypot(dx, dz))); M4.mul(m, m, t);
  return addBox(out, n, m, -0.06, -0.06, -len, 0.06, 0.06, 0, [0.5, 0.95, 1], 1.5);
}
