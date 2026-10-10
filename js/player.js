'use strict';
// ---------------------------------------------------------------------------
// Fizik (AABB-blok çarpışması), ışın izleme ve oyuncu
// ---------------------------------------------------------------------------

// Bloğun çarpışma kutuları (1/16 birim) ya da null
const FULL_BOX = [[0, 0, 0, 16, 16, 16]];
const _lowBox = [[0, 0, 0, 16, 16, 16]];
function blockColl(world, x, y, z, id) {
  if (SHAPE[id]) return SOLID[id] ? shapeOf(id, (d) => world.getBlock(x + DIR4[d][0], y, z + DIR4[d][1])).coll : null;
  if (!SOLID[id]) return null;
  if (HGT[id] < 16) { _lowBox[0][4] = HGT[id]; return _lowBox; }
  return FULL_BOX;
}

function boxHitsSolid(world, x0, y0, z0, x1, y1, z1) {
  const ax = Math.floor(x0), bx = Math.floor(x1), ay = Math.floor(y0) - 1, by = Math.floor(y1), az = Math.floor(z0), bz = Math.floor(z1);
  for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
    const bs = blockColl(world, x, y, z, world.getBlock(x, y, z));
    if (!bs) continue;
    for (const b of bs) {
      if (x0 < x + b[3] / 16 && x1 > x + b[0] / 16 && y0 < y + b[4] / 16 && y1 > y + b[1] / 16 && z0 < z + b[5] / 16 && z1 > z + b[2] / 16) return true;
    }
  }
  return false;
}

// Nokta katı bir kutunun içinde mi? (oklar)
function pointInSolid(world, px, py, pz) {
  const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
  const bs = blockColl(world, x, y, z, world.getBlock(x, y, z));
  if (!bs) return false;
  const fx = (px - x) * 16, fy = (py - y) * 16, fz = (pz - z) * 16;
  for (const b of bs) if (fx >= b[0] && fx <= b[3] && fy >= b[1] && fy <= b[4] && fz >= b[2] && fz <= b[5]) return true;
  return false;
}

// Bir eksen boyunca hareket et; çarpışmada sınırda dur. Çarpışma olduysa true.
function sweepAxis(world, p, hw, h, axis, d) {
  if (d === 0) return false;
  const E = 1e-4;
  p[axis] += d;
  const x0 = p[0] - hw, x1 = p[0] + hw - E, y0 = p[1], y1 = p[1] + h - E, z0 = p[2] - hw, z1 = p[2] + hw - E;
  const ax = Math.floor(x0), bx = Math.floor(x1), ay = Math.floor(y0) - 1, by = Math.floor(y1), az = Math.floor(z0), bz = Math.floor(z1);
  let hit = false;
  for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
    const bs = blockColl(world, x, y, z, world.getBlock(x, y, z));
    if (!bs) continue;
    for (const b of bs) {
      const bx0 = x + b[0] / 16, bx1 = x + b[3] / 16, by0 = y + b[1] / 16, by1 = y + b[4] / 16, bz0 = z + b[2] / 16, bz1 = z + b[5] / 16;
      if (!(x0 < bx1 && x1 > bx0 && y0 < by1 && y1 > by0 && z0 < bz1 && z1 > bz0)) continue;
      hit = true;
      if (axis === 0) p[0] = d > 0 ? Math.min(p[0], bx0 - hw - E) : Math.max(p[0], bx1 + hw + E);
      else if (axis === 1) p[1] = d > 0 ? Math.min(p[1], by0 - h - E) : Math.max(p[1], by1 + E);
      else p[2] = d > 0 ? Math.min(p[2], bz0 - hw - E) : Math.max(p[2], bz1 + hw + E);
    }
  }
  return hit;
}

// Önündeki alçak engelin (yarım blok, basamak, yatak) üst yüksekliği; çıkılamıyorsa -1
function stepTop(world, x0, z0, x1, z1, ylo, yhi) {
  let top = -1;
  for (let z = Math.floor(z0); z <= Math.floor(z1); z++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
    for (let y = Math.floor(ylo) - 1; y <= Math.floor(yhi); y++) {
      const bs = blockColl(world, x, y, z, world.getBlock(x, y, z));
      if (!bs) continue;
      for (const b of bs) {
        if (!(x0 < x + b[3] / 16 && x1 > x + b[0] / 16 && z0 < z + b[5] / 16 && z1 > z + b[2] / 16)) continue;
        const t = y + b[4] / 16;
        if (t > ylo + 1e-3 && t <= yhi) top = Math.max(top, t);
      }
    }
  }
  return top;
}

// Akan suyun itme yönü
function flowAt(world, x, y, z) {
  const id = world.getBlock(x, y, z);
  if (!isWater(id) || isSource(id)) return null;
  const lv = liquidLevel(id);
  let fx = 0, fz = 0;
  for (const [dx, dz] of DIR4) {
    const n = world.getBlock(x + dx, y, z + dz);
    if (isWater(n)) { const nl = liquidLevel(n); if (nl > lv && nl !== 8) { fx += dx; fz += dz; } else if (nl < lv) { fx -= dx * 0.5; fz -= dz * 0.5; } }
    else if (!SOLID[n]) { fx += dx; fz += dz; }
  }
  const l = Math.hypot(fx, fz);
  return l > 0 ? [fx / l, fz / l] : null;
}

// Genel hareket: e = {pos, vel, hw, h}. Dönüş: {ground, ceil, wallX, wallZ}
const _mres = { ground: false, ceil: false, wall: false };
function moveEntity(world, e, dt, sneakGuard) {
  const p = e.pos, v = e.vel;
  _mres.ground = false; _mres.ceil = false; _mres.wall = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.4));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    if (sweepAxis(world, p, e.hw, e.h, 1, v[1] * sdt)) {
      if (v[1] < 0) _mres.ground = true; else _mres.ceil = true;
      v[1] = 0;
    }
    for (const ax of [0, 2]) {
      const d = v[ax] * sdt;
      if (!d) continue;
      const old = p[ax];
      if (sweepAxis(world, p, e.hw, e.h, ax, d)) { v[ax] = 0; _mres.wall = true; }
      // Eğilirken kenardan düşmeyi engelle
      if (sneakGuard && e.onGround && !boxHitsSolid(world, p[0] - e.hw + 0.05, p[1] - 0.6, p[2] - e.hw + 0.05, p[0] + e.hw - 0.05, p[1] - 0.01, p[2] + e.hw - 0.05)) {
        p[ax] = old; v[ax] = 0;
      }
    }
  }
  return _mres;
}

// DDA ışın izleme: ilk hedeflenebilir blok
function raycast(world, o, d, maxDist, liquids) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
  let tx = sx > 0 ? (x + 1 - o[0]) * tdx : sx < 0 ? (o[0] - x) * tdx : Infinity;
  let ty = sy > 0 ? (y + 1 - o[1]) * tdy : sy < 0 ? (o[1] - y) * tdy : Infinity;
  let tz = sz > 0 ? (z + 1 - o[2]) * tdz : sz < 0 ? (o[2] - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id && (RENDER[id] !== R_LIQUID || (liquids && isLiquid(id)))) return { x, y, z, nx, ny, nz, dist: t, id };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}

class Player {
  constructor() {
    this.pos = [0, 80, 0];
    this.vel = [0, 0, 0];
    this.yaw = 0; this.pitch = 0;
    this.hw = 0.3; this.h = 1.8;
    this.onGround = false;
    this.flying = false;
    this.creative = false;
    this.health = 20; this.maxHealth = 20;
    this.air = 10;
    this.hurtTime = 0; this.lastHurt = 0; this.regenTimer = 0;
    this.drownTimer = 0; this.lavaTimer = 0;
    this.fallStart = null;
    this.inWater = false; this.eyeInWater = false; this.inLava = false;
    this.sprinting = false; this.sneaking = false;
    this.walkDist = 0; this.bob = 0; this.stepAcc = 0;
    this.dead = false;
    this.fovBoost = 0;
    this.spawn = [0, 80, 0];
    this.bed = null;
    // Açlık (Minecraft kuralları): yemek 0-20, doygunluk, yorgunluk
    this.food = 20; this.sat = 5; this.exh = 0; this.foodTimer = 0;
    this.regen = 0; this.hungerEff = 0; this.starveFloor = 1;
    this.onReduce = null;
    this.onHurt = null; this.onStep = null; this.onDeath = null; this.onSplash = null;
  }

  get eyeHeight() { return this.sneaking && !this.flying ? 1.5 : 1.62; }
  eye() { return [this.pos[0], this.pos[1] + this.eyeHeight, this.pos[2]]; }
  lookDir() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  // type: mob, arrow, explosion, fall, drown, lava, starve, void, pearl
  hurt(amount, kx = 0, kz = 0, type = 'generic') {
    if (this.creative || this.dead || amount <= 0) return;
    if (this.hurtTime > 0.35 && amount < 6) return; // kısa dokunulmazlık
    if (this.onReduce) amount = this.onReduce(amount, type);
    this.exh += 0.1;
    this.health = Math.max(0, this.health - amount);
    this.hurtTime = 0.5; this.lastHurt = 0;
    if (kx || kz) { this.vel[0] += kx; this.vel[2] += kz; this.vel[1] = Math.max(this.vel[1], 5); }
    if (this.onHurt) this.onHurt(amount);
    if (this.health <= 0) { this.dead = true; if (this.onDeath) this.onDeath(); }
  }

  update(dt, inp, world) {
    if (this.dead) return;
    const p = this.pos, v = this.vel;
    const feet = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.3), Math.floor(p[2]));
    const eyeB = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + this.eyeHeight), Math.floor(p[2]));
    const wasInWater = this.inWater;
    this.inWater = isWater(feet);
    this.inLava = isLava(feet);
    this.eyeInWater = isWater(eyeB);
    this.eyeInLava = isLava(eyeB);
    const fb = (dy) => world.getBlock(Math.floor(p[0]), Math.floor(p[1] + dy), Math.floor(p[2]));
    const onLadder = isLadder(fb(0.1)) || isLadder(fb(1));
    if (this.inWater && !wasInWater && v[1] < -6 && this.onSplash) this.onSplash();

    this.sneaking = inp.sneak && !this.flying;
    if (inp.sprint && inp.f > 0 && !this.sneaking && (this.creative || this.food > 6)) this.sprinting = true;
    if (!this.creative && this.food <= 6) this.sprinting = false;
    if (inp.f <= 0 || this.sneaking || (inp.sprintCollide)) this.sprinting = false;

    const fwd = inp.f - inp.b, str = inp.r - inp.l;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const liquid = this.inWater || this.inLava;

    if (this.flying) {
      const sp = this.sprinting ? 21 : 10.9;
      const k = 1 - Math.exp(-dt * 10);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      const ty = inp.jump ? 8 : inp.sneak ? -8 : 0;
      v[1] += (ty - v[1]) * k;
    } else if (liquid) {
      const sp = this.inLava ? 1.6 : (this.sprinting ? 3.2 : 2.4);
      const k = 1 - Math.exp(-dt * 6);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      v[1] -= 10 * dt;
      if (inp.jump) v[1] = Math.min(v[1] + 34 * dt, 3.6);
      v[1] *= Math.exp(-dt * 2.5);
      if (v[1] < -5) v[1] = -5;
      if (this.inWater) {
        const fl = flowAt(world, Math.floor(p[0]), Math.floor(p[1] + 0.3), Math.floor(p[2]));
        if (fl) { v[0] += fl[0] * 14 * dt; v[2] += fl[1] * 14 * dt; }
      }
    } else {
      const sp = this.sneaking ? 1.31 : this.sprinting ? 5.61 : 4.32;
      const k = 1 - Math.exp(-dt * (this.onGround ? 16 : 3.2));
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      v[1] -= 30 * dt;
      if (v[1] < -60) v[1] = -60;
      if (onLadder) {
        // Merdiven: yavaş in, zıplayınca ya da duvara yürüyünce tırman, eğilince tutun
        this.fallStart = null;
        if (inp.jump || (this.lastWall && wl > 0)) v[1] = 2.35;
        else if (this.sneaking) v[1] = 0;
        else if (v[1] < -3) v[1] = -3;
      } else if (inp.jump && this.onGround) {
        v[1] = 8.9;
        this.exh += this.sprinting ? 0.2 : 0.05;
        if (this.sprinting) { v[0] += wx * 1.5; v[2] += wz * 1.5; }
      }
    }

    const oldY = p[1];
    const res = moveEntity(world, this, dt, this.sneaking);
    const wasGround = this.onGround;
    this.onGround = res.ground;
    if (this.flying && this.onGround && !this.creativeFlyLock) this.flying = false;
    // Su kenarından çıkış: sıvıdayken duvara çarpıp zıplamak
    if (liquid && res.wall && inp.jump) v[1] = 4.5;
    // Otomatik zıplama (dokunmatik)
    if (inp.autoJump && res.wall && this.onGround && wl > 0) {
      const fx = Math.floor(p[0] + wx * 0.6), fz = Math.floor(p[2] + wz * 0.6), fy = Math.floor(p[1]);
      if (SOLID[world.getBlock(fx, fy, fz)] && !SOLID[world.getBlock(fx, fy + 1, fz)] && !SOLID[world.getBlock(fx, fy + 2, fz)]) v[1] = 8.9;
    }
    // Alçak bloklara (yarım blok, basamak, yatak) kendiliğinden çık
    this.lastWall = res.wall;
    if (res.wall && wasGround && !this.flying && !liquid && wl > 0) {
      const nx = p[0] + wx * 0.15, nz = p[2] + wz * 0.15, hw = this.hw;
      const top = stepTop(world, nx - hw, nz - hw, nx + hw - 1e-4, nz + hw - 1e-4, p[1], p[1] + 0.6);
      if (top > 0 && !boxHitsSolid(world, nx - hw, top + 1e-3, nz - hw, nx + hw - 1e-4, top + this.h, nz + hw - 1e-4)) {
        p[1] = top + 1e-3; p[0] = nx; p[2] = nz; this.onGround = true;
      }
    }
    if (res.wall) this.sprinting = false;

    // Düşme hasarı
    if (this.onGround || liquid || this.flying) {
      if (this.fallStart !== null && this.onGround && !liquid) {
        const dist = this.fallStart - p[1];
        if (dist > 3.4) this.hurt(Math.floor(dist - 3), 0, 0, 'fall');
        if (!wasGround && dist > 0.6 && this.onStep) this.onStep(true);
      }
      this.fallStart = null;
    } else {
      if (this.fallStart === null || p[1] > this.fallStart) this.fallStart = p[1];
    }

    // Adım sesleri ve kamera sallanması
    const hs = Math.hypot(v[0], v[2]);
    if (this.onGround && !this.flying) {
      this.walkDist += hs * dt;
      this.stepAcc += hs * dt;
      if (this.stepAcc > (this.sprinting ? 2.2 : 1.8)) { this.stepAcc = 0; if (this.onStep) this.onStep(false); }
      this.bob += (Math.min(1, hs / 4.3) - this.bob) * Math.min(1, dt * 10);
    } else this.bob += (0 - this.bob) * Math.min(1, dt * 6);

    // Hasar zamanlayıcıları
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.lastHurt += dt;
    if (!this.creative) {
      if (this.eyeInWater) {
        this.air -= dt;
        if (this.air < 0) { this.drownTimer += dt; if (this.drownTimer > 1) { this.drownTimer = 0; this.hurt(2, 0, 0, 'drown'); } }
      } else this.air = Math.min(10, this.air + dt * 4);
      if (this.inLava) { this.lavaTimer += dt; if (this.lavaTimer > 0.5) { this.lavaTimer = 0; this.hurt(4, 0, 0, 'lava'); } }
      if (p[1] < -40) this.hurt(4, 0, 0, 'void');
      // Yorgunluk: koşmak, yüzmek
      if (this.sprinting && this.onGround) this.exh += 0.1 * hs * dt;
      else if (liquid) this.exh += 0.01 * hs * dt;
      this.updateHunger(dt);
    } else { this.air = 10; this.health = this.maxHealth; this.food = 20; }
    this.fovBoost += ((this.sprinting ? 1 : 0) - this.fovBoost) * Math.min(1, dt * 8);
    return oldY;
  }

  // Açlık barı, doygunluk ve doğal iyileşme (Minecraft 1.11+ kuralları)
  updateHunger(dt) {
    if (this.hungerEff > 0) { this.hungerEff -= dt; this.exh += 0.1 * dt; }
    while (this.exh >= 4) {
      this.exh -= 4;
      if (this.sat > 0) this.sat = Math.max(0, this.sat - 1);
      else this.food = Math.max(0, this.food - 1);
    }
    if (this.regen > 0) {
      this.regen -= dt; this.regenAcc = (this.regenAcc || 0) + dt;
      if (this.regenAcc >= 1.25) { this.regenAcc = 0; this.health = Math.min(this.maxHealth, this.health + 1); }
    }
    const hurtOk = this.health < this.maxHealth;
    if (this.food >= 20 && this.sat > 0 && hurtOk) {
      this.foodTimer += dt;
      if (this.foodTimer >= 0.5) {
        this.foodTimer = 0;
        const s = Math.min(this.sat, 6);
        this.health = Math.min(this.maxHealth, this.health + s / 6);
        this.exh += s;
      }
    } else if (this.food >= 18 && hurtOk) {
      this.foodTimer += dt;
      if (this.foodTimer >= 4) { this.foodTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.exh += 6; }
    } else if (this.food <= 0) {
      this.foodTimer += dt;
      if (this.foodTimer >= 4) {
        this.foodTimer = 0;
        if (this.health > this.starveFloor) this.hurt(1, 0, 0, 'starve');
      }
    } else this.foodTimer = 0;
  }

  eat(food) {
    this.food = Math.min(20, this.food + food.h);
    this.sat = Math.min(this.food, this.sat + food.s);
  }
}
