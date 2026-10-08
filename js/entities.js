'use strict';
// ---------------------------------------------------------------------------
// Canlılar (mob), kutu modelleri, yapay zekâ ve parçacık sistemi
// ---------------------------------------------------------------------------

const BOX_UV = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]]; // yüz başına (u ekseni, v ekseni)
const _bm = new Float32Array(16);

// Dönüştürülmüş kutuyu vertex dizisine ekle (24 vertex, her biri 9 float)
function addBox(out, n, m, x0, y0, z0, x1, y1, z1, col, light, px = 16) {
  const lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let f = 0; f < 6; f++) {
    const nn = FACE_N[f];
    const wnx = m[0] * nn[0] + m[4] * nn[1] + m[8] * nn[2];
    const wny = m[1] * nn[0] + m[5] * nn[1] + m[9] * nn[2];
    const wnz = m[2] * nn[0] + m[6] * nn[1] + m[10] * nn[2];
    const shade = (wny >= 0 ? 0.78 + 0.22 * wny : 0.78 + 0.3 * wny) - 0.1 * Math.abs(wnx) + 0.02 * wnz;
    const ua = BOX_UV[f][0], va = BOX_UV[f][1];
    const us = (hi[ua] - lo[ua]) * px, vs = (hi[va] - lo[va]) * px;
    const cr = col[0] * shade, cg = col[1] * shade, cb = col[2] * shade;
    for (let c = 0; c < 4; c++) {
      const C = FACE_CORNERS[f][c];
      const x = C[0] ? x1 : x0, y = C[1] ? y1 : y0, z = C[2] ? z1 : z0;
      const o = n * 9;
      out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[o + 3] = cr; out[o + 4] = cg; out[o + 5] = cb;
      out[o + 6] = C[ua] * us; out[o + 7] = C[va] * vs; out[o + 8] = light;
      n++;
    }
  }
  return n;
}

const P16 = 1 / 16;
function part(box, color, anim, pivot) { return { box: box.map((v) => v * P16), color, anim: anim || null, pivot: pivot ? pivot.map((v) => v * P16) : null }; }

const SKIN = [0.38, 0.6, 0.32], SHIRT = [0.0, 0.55, 0.6], PANTS = [0.27, 0.24, 0.62];
const PINK = [0.95, 0.63, 0.62], PINK2 = [0.85, 0.48, 0.5];
const COW = [0.33, 0.23, 0.15], WHITE = [0.92, 0.92, 0.9], BLACK = [0.08, 0.08, 0.08];
const CREEP = [0.36, 0.72, 0.3], WOOLC = [0.93, 0.93, 0.9], SHEEPF = [0.78, 0.66, 0.56];

const MOB_TYPES = {
  pig: {
    name: 'Domuz', hw: 0.45, h: 0.9, health: 10, speed: 1.3, hostile: false, sound: 'pig',
    parts: [
      part([-5, 6, -8, 5, 14, 8], PINK),
      part([-4, 8, -15, 4, 16, -7], PINK, 'head', [0, 12, -8]),
      part([-2, 9, -16, 2, 12, -15], PINK2, 'head', [0, 12, -8]),
      part([-3, 13, -15.2, -1, 14, -15], BLACK, 'head', [0, 12, -8]),
      part([1, 13, -15.2, 3, 14, -15], BLACK, 'head', [0, 12, -8]),
      part([-5, 0, -7, -1, 6, -3], PINK, 'legA', [0, 6, -5]),
      part([1, 0, -7, 5, 6, -3], PINK, 'legB', [0, 6, -5]),
      part([-5, 0, 3, -1, 6, 7], PINK, 'legB', [0, 6, 5]),
      part([1, 0, 3, 5, 6, 7], PINK, 'legA', [0, 6, 5]),
    ],
  },
  cow: {
    name: 'İnek', hw: 0.45, h: 1.4, health: 10, speed: 1.1, hostile: false, sound: 'cow',
    parts: [
      part([-6, 12, -9, 6, 22, 9], COW),
      part([-6.1, 14, -2, 6.1, 20, 4], WHITE),
      part([-4, 16, -15, 4, 24, -9], COW, 'head', [0, 20, -9]),
      part([-3, 16, -16, 3, 20, -15], [0.7, 0.62, 0.6], 'head', [0, 20, -9]),
      part([-6, 22, -13, -4, 25, -12], [0.85, 0.85, 0.8], 'head', [0, 20, -9]),
      part([4, 22, -13, 6, 25, -12], [0.85, 0.85, 0.8], 'head', [0, 20, -9]),
      part([-3, 21, -15.2, -1, 22, -15], BLACK, 'head', [0, 20, -9]),
      part([1, 21, -15.2, 3, 22, -15], BLACK, 'head', [0, 20, -9]),
      part([-6, 0, -8, -2, 12, -4], COW, 'legA', [0, 12, -6]),
      part([2, 0, -8, 6, 12, -4], COW, 'legB', [0, 12, -6]),
      part([-6, 0, 4, -2, 12, 8], COW, 'legB', [0, 12, 6]),
      part([2, 0, 4, 6, 12, 8], COW, 'legA', [0, 12, 6]),
    ],
  },
  sheep: {
    name: 'Koyun', hw: 0.45, h: 1.3, health: 8, speed: 1.1, hostile: false, sound: 'sheep',
    parts: [
      part([-6, 10, -9, 6, 20, 9], WOOLC),
      part([-3, 14, -15, 3, 20, -7], SHEEPF, 'head', [0, 17, -8]),
      part([-3.5, 18, -14, 3.5, 21, -8], WOOLC, 'head', [0, 17, -8]),
      part([-2.5, 17, -15.2, -1, 18, -15], BLACK, 'head', [0, 17, -8]),
      part([1, 17, -15.2, 2.5, 18, -15], BLACK, 'head', [0, 17, -8]),
      part([-5, 0, -7, -1, 10, -3], SHEEPF, 'legA', [0, 10, -5]),
      part([1, 0, -7, 5, 10, -3], SHEEPF, 'legB', [0, 10, -5]),
      part([-5, 0, 3, -1, 10, 7], SHEEPF, 'legB', [0, 10, 5]),
      part([1, 0, 3, 5, 10, 7], SHEEPF, 'legA', [0, 10, 5]),
    ],
  },
  zombie: {
    name: 'Zombi', hw: 0.3, h: 1.95, health: 20, speed: 2.4, hostile: true, sound: 'zombie',
    parts: [
      part([-4, 24, -4, 4, 32, 4], SKIN, 'head', [0, 24, 0]),
      part([-3, 27, -4.2, -1, 28, -4], BLACK, 'head', [0, 24, 0]),
      part([1, 27, -4.2, 3, 28, -4], BLACK, 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], SHIRT),
      part([4, 12, -2, 8, 24, 2], SKIN, 'armR', [6, 22, 0]),
      part([-8, 12, -2, -4, 24, 2], SKIN, 'armL', [-6, 22, 0]),
      part([4, 20, -2.1, 8, 24, 2.1], SHIRT, 'armR', [6, 22, 0]),
      part([-8, 20, -2.1, -4, 24, 2.1], SHIRT, 'armL', [-6, 22, 0]),
      part([-4, 0, -2, 0, 12, 2], PANTS, 'legA', [-2, 12, 0]),
      part([0, 0, -2, 4, 12, 2], PANTS, 'legB', [2, 12, 0]),
    ],
  },
  creeper: {
    name: 'Creeper', hw: 0.3, h: 1.7, health: 20, speed: 2.1, hostile: true, sound: 'creeper',
    parts: [
      part([-4, 18, -4, 4, 26, 4], CREEP, 'head', [0, 18, 0]),
      part([-3, 22, -4.2, -1, 24, -4], BLACK, 'head', [0, 18, 0]),
      part([1, 22, -4.2, 3, 24, -4], BLACK, 'head', [0, 18, 0]),
      part([-1, 19, -4.2, 1, 22, -4], BLACK, 'head', [0, 18, 0]),
      part([-2, 18.5, -4.2, -1, 21, -4], BLACK, 'head', [0, 18, 0]),
      part([1, 18.5, -4.2, 2, 21, -4], BLACK, 'head', [0, 18, 0]),
      part([-4, 6, -2, 4, 18, 2], CREEP),
      part([-4, 0, -6, 0, 6, -2], CREEP, 'legA', [0, 6, -2]),
      part([0, 0, -6, 4, 6, -2], CREEP, 'legB', [0, 6, -2]),
      part([-4, 0, 2, 0, 6, 6], CREEP, 'legB', [0, 6, 2]),
      part([0, 0, 2, 4, 6, 6], CREEP, 'legA', [0, 6, 2]),
    ],
  },
};

class Mob {
  constructor(type, x, y, z) {
    this.type = type;
    this.T = MOB_TYPES[type];
    this.pos = [x, y, z];
    this.vel = [0, 0, 0];
    this.hw = this.T.hw; this.h = this.T.h;
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.health = this.T.health;
    this.onGround = false;
    this.walk = 0; this.walkAmt = 0;
    this.aiTimer = Math.random() * 3; this.moving = false; this.panic = 0;
    this.hurtTime = 0; this.deathTime = 0; this.dead = false; this.remove = false;
    this.attackCd = 0; this.fuse = 0; this.burnTimer = 0;
    this.headPitch = 0; this.soundTimer = 4 + Math.random() * 8;
  }

  hit(dmg, fx, fz) {
    if (this.dead) return;
    this.health -= dmg;
    this.hurtTime = 0.4;
    const l = Math.hypot(fx, fz) || 1;
    this.vel[0] += (fx / l) * 7; this.vel[2] += (fz / l) * 7; this.vel[1] = 5.5;
    if (!this.T.hostile) { this.panic = 4; this.aiTimer = 0; }
    if (this.health <= 0) { this.dead = true; this.deathTime = 0; }
  }

  update(dt, game) {
    const world = game.world, pl = game.player, p = this.pos, v = this.vel;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    if (this.dead) {
      this.deathTime += dt;
      v[0] *= 0.9; v[2] *= 0.9; v[1] -= 30 * dt;
      moveEntity(world, this, dt, false);
      if (this.deathTime > 0.8) { this.remove = true; game.particles.puff(p[0], p[1] + this.h / 2, p[2], 14, 0.8); }
      return;
    }
    if (!world.isLoadedAt(p[0], p[2])) return;
    const dx = pl.pos[0] - p[0], dz = pl.pos[2] - p[2], dy = pl.pos[1] - p[1];
    const dist = Math.hypot(dx, dz);
    let speed = 0;

    if (this.T.hostile && !pl.dead && !pl.creative && dist < 22 && Math.abs(dy) < 12) {
      this.targetYaw = Math.atan2(-dx, -dz);
      speed = this.T.speed;
      if (this.type === 'zombie') {
        this.attackCd -= dt;
        if (dist < 1.1 && Math.abs(dy) < 1.6 && this.attackCd <= 0) {
          this.attackCd = 1;
          pl.hurt(game.difficultyDmg(3), (dx / (dist || 1)) * 6, (dz / (dist || 1)) * 6);
        }
        if (dist < 0.8) speed = 0;
      } else if (this.type === 'creeper') {
        if (dist < 3 && Math.abs(dy) < 3) {
          if (this.fuse === 0) game.audio.play('fuse', p);
          this.fuse += dt; speed = 0;
          if (this.fuse > 1.5) {
            this.remove = true;
            game.explode(p[0], p[1] + 0.8, p[2], 3.2);
            return;
          }
        } else if (dist > 6) this.fuse = Math.max(0, this.fuse - dt);
        else this.fuse = Math.max(0, this.fuse - dt * 0.5);
      }
    } else {
      // Gezinme
      this.aiTimer -= dt;
      if (this.panic > 0) {
        this.panic -= dt;
        if (this.aiTimer <= 0) { this.targetYaw = Math.random() * Math.PI * 2; this.aiTimer = 0.8 + Math.random(); }
        speed = this.T.speed * 2.2;
      } else {
        if (this.aiTimer <= 0) {
          this.moving = Math.random() < 0.55;
          this.targetYaw = Math.random() * Math.PI * 2;
          this.aiTimer = 2 + Math.random() * 4;
        }
        if (this.moving) speed = this.T.speed;
      }
      if (this.fuse > 0) this.fuse = Math.max(0, this.fuse - dt);
    }

    // Uçurumdan kaçın (sakin canlılar)
    let dyaw = this.targetYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * 6);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    if (speed > 0 && !this.T.hostile && this.onGround) {
      const ax = Math.floor(p[0] + fx * 0.9), az = Math.floor(p[2] + fz * 0.9), ay = Math.floor(p[1]);
      const below = world.getBlock(ax, ay - 1, az), below2 = world.getBlock(ax, ay - 2, az);
      if ((!SOLID[below] && !SOLID[below2]) || below === B.WATER || below === B.LAVA) { this.targetYaw += Math.PI; speed = 0; this.aiTimer = 1; }
    }

    const inWater = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2])) === B.WATER;
    const k = 1 - Math.exp(-dt * (this.onGround ? 10 : 2));
    v[0] += (fx * speed - v[0]) * k; v[2] += (fz * speed - v[2]) * k;
    if (inWater) { v[1] += (2 - v[1]) * Math.min(1, dt * 4); }
    else v[1] -= 30 * dt;
    if (v[1] < -50) v[1] = -50;
    const res = moveEntity(world, this, dt, false);
    this.onGround = res.ground;
    if (res.wall && (this.onGround || inWater) && speed > 0) v[1] = 8.6;
    if (p[1] < -20) this.remove = true;

    const hs = Math.hypot(v[0], v[2]);
    this.walk += hs * dt * 4.5;
    this.walkAmt += (Math.min(1, hs / 1.5) - this.walkAmt) * Math.min(1, dt * 8);

    // Gün ışığında zombi yanar
    if (this.type === 'zombie' && game.sunLevel > 0.6 && !inWater) {
      if (world.skyLightAt(Math.floor(p[0]), Math.floor(p[1] + 1.8), Math.floor(p[2]))) {
        this.burnTimer += dt;
        if (Math.random() < dt * 12) game.particles.flame(p[0] + (Math.random() - 0.5) * 0.6, p[1] + Math.random() * 1.9, p[2] + (Math.random() - 0.5) * 0.6);
        if (this.burnTimer > 1) { this.burnTimer = 0; this.health -= 2; this.hurtTime = 0.3; if (this.health <= 0) { this.dead = true; } }
      }
    }
    // Ses
    this.soundTimer -= dt;
    if (this.soundTimer <= 0) {
      this.soundTimer = 6 + Math.random() * 12;
      if (dist < 20) game.audio.play(this.T.sound, p);
    }
  }

  buildMesh(out, n, cam, light) {
    const T = this.T;
    const base = M4.create(), t = M4.create(), m = M4.create();
    M4.translate(base, this.pos[0] - cam[0], this.pos[1] - cam[1], this.pos[2] - cam[2]);
    M4.rotY(t, this.yaw); M4.mul(base, base, t);
    if (this.dead) { M4.rotZ(t, Math.min(1, this.deathTime / 0.5) * Math.PI / 2); M4.mul(base, base, t); }
    let swell = 1;
    if (this.fuse > 0) { swell = 1 + Math.min(this.fuse / 1.5, 1) * 0.15 + Math.sin(this.fuse * 20) * 0.02; M4.scale(t, swell, swell, swell); M4.mul(base, base, t); }
    const sw = Math.sin(this.walk) * 0.7 * this.walkAmt;
    const flashW = this.fuse > 0 && Math.floor(this.fuse * 8) % 2 === 0;
    for (const P of T.parts) {
      let col = P.color;
      if (this.hurtTime > 0 || this.dead) col = [Math.min(1, col[0] * 0.6 + 0.5), col[1] * 0.45, col[2] * 0.45];
      else if (flashW) col = [Math.min(1, col[0] + 0.5), Math.min(1, col[1] + 0.5), Math.min(1, col[2] + 0.5)];
      if (P.anim && P.pivot) {
        let ang = 0;
        if (P.anim === 'legA') ang = sw;
        else if (P.anim === 'legB') ang = -sw;
        else if (P.anim === 'armR' || P.anim === 'armL') ang = Math.PI / 2 + (P.anim === 'armR' ? sw : -sw) * 0.15;
        M4.translate(t, P.pivot[0], P.pivot[1], P.pivot[2]); M4.mul(m, base, t);
        M4.rotX(t, ang); M4.mul(m, m, t);
        M4.translate(t, -P.pivot[0], -P.pivot[1], -P.pivot[2]); M4.mul(m, m, t);
      } else m.set(base);
      const b = P.box;
      n = addBox(out, n, m, b[0], b[1], b[2], b[3], b[4], b[5], col, light);
    }
    return n;
  }
}

// Işın - AABB kesişimi (slab yöntemi)
function rayAABB(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1e9;
  const lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return -1; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

class EntityManager {
  constructor(game) {
    this.game = game;
    this.mobs = [];
    this.spawnTimer = 2;
    this.verts = new Float32Array(9 * 24 * 12 * 40);
  }
  clear() { this.mobs.length = 0; }

  update(dt) {
    const g = this.game;
    for (const m of this.mobs) {
      m.update(dt, g);
      const d = Math.hypot(m.pos[0] - g.player.pos[0], m.pos[2] - g.player.pos[2]);
      if (d > 110) m.remove = true;
      if (m.T.hostile && g.player.creative && d > 40) m.remove = true;
    }
    this.mobs = this.mobs.filter((m) => !m.remove);
    // Mob'lar birbirini itsin
    for (let i = 0; i < this.mobs.length; i++) for (let j = i + 1; j < this.mobs.length; j++) {
      const a = this.mobs[i], b = this.mobs[j];
      const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2], dd = dx * dx + dz * dz, r = a.hw + b.hw;
      if (dd < r * r && dd > 1e-6 && Math.abs(a.pos[1] - b.pos[1]) < 1.5) {
        const l = Math.sqrt(dd), push = (r - l) * 2;
        a.vel[0] -= (dx / l) * push; a.vel[2] -= (dz / l) * push;
        b.vel[0] += (dx / l) * push; b.vel[2] += (dz / l) * push;
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && g.settings.mobs) { this.spawnTimer = 1.5; this.trySpawn(); }
  }

  trySpawn() {
    const g = this.game, w = g.world, pl = g.player;
    let passive = 0, hostile = 0;
    for (const m of this.mobs) m.T.hostile ? hostile++ : passive++;
    const ang = Math.random() * Math.PI * 2;
    if (passive < 10 && Math.random() < 0.5) {
      const r = 24 + Math.random() * 40;
      const x = Math.floor(pl.pos[0] + Math.cos(ang) * r), z = Math.floor(pl.pos[2] + Math.sin(ang) * r);
      if (!w.isLoadedAt(x, z)) return;
      const y = w.surfaceY(x, z);
      if (y < 0 || w.getBlock(x, y, z) !== B.GRASS) return;
      const types = ['pig', 'cow', 'sheep'];
      const type = types[Math.floor(Math.random() * 3)];
      const cnt = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cnt; i++) {
        const sx = x + (i ? Math.floor(Math.random() * 3) - 1 : 0), sz = z + (i ? Math.floor(Math.random() * 3) - 1 : 0);
        const sy = w.surfaceY(sx, sz);
        if (sy < 0 || SOLID[w.getBlock(sx, sy + 1, sz)] || !SOLID[w.getBlock(sx, sy, sz)]) continue;
        this.mobs.push(new Mob(type, sx + 0.5, sy + 1, sz + 0.5));
      }
      return;
    }
    if (pl.creative || hostile >= 10) return;
    const night = g.sunLevel < 0.35;
    // Yüzeyde gece
    if (night && Math.random() < 0.6) {
      const r = 22 + Math.random() * 26;
      const x = Math.floor(pl.pos[0] + Math.cos(ang) * r), z = Math.floor(pl.pos[2] + Math.sin(ang) * r);
      if (!w.isLoadedAt(x, z)) return;
      const y = w.surfaceY(x, z);
      const top = w.getBlock(x, y, z);
      if (y < 0 || !SOLID[top] || top === B.LEAVES || SOLID[w.getBlock(x, y + 1, z)] || SOLID[w.getBlock(x, y + 2, z)]) return;
      this.mobs.push(new Mob(Math.random() < 0.65 ? 'zombie' : 'creeper', x + 0.5, y + 1, z + 0.5));
      return;
    }
    // Mağaralarda karanlık yerler
    const r = 14 + Math.random() * 16;
    const x = Math.floor(pl.pos[0] + Math.cos(ang) * r), z = Math.floor(pl.pos[2] + Math.sin(ang) * r);
    const y = Math.floor(pl.pos[1] + (Math.random() - 0.5) * 20);
    if (y < 2 || !w.isLoadedAt(x, z)) return;
    if (!SOLID[w.getBlock(x, y - 1, z)] || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) return;
    if (w.skyLightAt(x, y, z)) return;
    for (let dz = -6; dz <= 6; dz++) for (let dyy = -4; dyy <= 4; dyy++) for (let dx = -6; dx <= 6; dx++) {
      if (EMIT[w.getBlock(x + dx, y + dyy, z + dz)]) return;
    }
    this.mobs.push(new Mob(Math.random() < 0.65 ? 'zombie' : 'creeper', x + 0.5, y, z + 0.5));
  }

  raycast(o, d, maxDist) {
    let best = null, bt = maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const t = rayAABB(o, d, m.pos[0] - m.hw, m.pos[1], m.pos[2] - m.hw, m.pos[0] + m.hw, m.pos[1] + m.h, m.pos[2] + m.hw);
      if (t >= 0 && t < bt) { bt = t; best = m; }
    }
    return best ? { mob: best, dist: bt } : null;
  }

  buildMesh(cam) {
    const g = this.game;
    let n = 0;
    const need = this.mobs.length * 12 * 24 * 9;
    if (this.verts.length < need) this.verts = new Float32Array(need * 2);
    for (const m of this.mobs) {
      const d = Math.hypot(m.pos[0] - cam[0], m.pos[2] - cam[2]);
      if (d > g.settings.renderDist * 16) continue;
      const sky = g.world.skyLightAt(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 1), Math.floor(m.pos[2]));
      const light = Math.max(0.12, sky ? g.sunLevel : 0.25);
      n = m.buildMesh(this.verts, n, cam, light);
    }
    return n;
  }
}

// --- Parçacıklar ----------------------------------------------------------
class Particles {
  constructor() { this.list = []; this.data = new Float32Array(8 * 4000); }
  clear() { this.list.length = 0; }

  blockBreak(x, y, z, id, n = 22) {
    const layer = TEXF[id * 6 + 0];
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + 0.15 + Math.random() * 0.7, y: y + 0.15 + Math.random() * 0.7, z: z + 0.15 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4 + 1, vz: (Math.random() - 0.5) * 4,
        life: 0.5 + Math.random() * 0.7, layer, u: Math.floor(Math.random() * 12) / 16, v: Math.floor(Math.random() * 12) / 16,
        size: 0.09 + Math.random() * 0.05, light: 1, g: 18,
      });
    }
  }
  hitBits(x, y, z, id) { this.blockBreak(x, y, z, id, 3); }
  puff(x, y, z, n, light = 1) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, z: z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 2,
        life: 0.6 + Math.random() * 0.6, layer: -1, u: 0, v: 0, size: 0.25 + Math.random() * 0.2, light: 0.75 * light, g: -1,
      });
    }
  }
  explosion(x, y, z, r) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = Math.random() * r * 2.5;
      this.list.push({
        x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 1, vz: Math.sin(a) * Math.cos(b) * s,
        life: 0.5 + Math.random() * 1.2, layer: -1, u: 0, v: 0, size: 0.5 + Math.random() * 0.8, light: 0.5 + Math.random() * 0.5, g: -0.5,
      });
    }
  }
  flame(x, y, z) {
    this.list.push({ x, y, z, vx: 0, vy: 1.2, vz: 0, life: 0.4, layer: TEX.lava, u: 0.3, v: 0.3, size: 0.12, light: 1.4, g: -1 });
  }
  bubble(x, y, z) {
    this.list.push({ x, y, z, vx: (Math.random() - 0.5) * 0.4, vy: 1.5, vz: (Math.random() - 0.5) * 0.4, life: 0.8, layer: -1, u: 0, v: 0, size: 0.08, light: 0.9, g: -2 });
  }

  update(dt, world) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy -= p.g * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (p.g > 0 && SOLID[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
        p.vx *= 0.3; p.vz *= 0.3; p.vy = 0;
      } else { p.x = nx; p.y = ny; p.z = nz; }
      if (p.g <= 0) { p.vx *= 0.96; p.vz *= 0.96; }
    }
    if (L.length > 3500) L.splice(0, L.length - 3500);
  }

  fill(cam, sun) {
    const d = this.data;
    let n = 0;
    for (const p of this.list) {
      const o = n * 8;
      d[o] = p.x - cam[0]; d[o + 1] = p.y - cam[1]; d[o + 2] = p.z - cam[2];
      d[o + 3] = p.layer; d[o + 4] = p.u; d[o + 5] = p.v; d[o + 6] = p.light * (p.layer >= 0 && p.light <= 1 ? Math.max(0.25, sun) : 1);
      d[o + 7] = p.size;
      n++;
    }
    return n;
  }
}
