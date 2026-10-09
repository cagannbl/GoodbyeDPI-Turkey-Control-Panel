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

const ENDER = [0.07, 0.05, 0.09], ENDEYE = [0.85, 0.45, 1.0];
const PIGSKIN = [0.88, 0.6, 0.56], PIGSNOUT = [0.75, 0.45, 0.45], ROT = [0.45, 0.62, 0.38], PIGPANTS = [0.42, 0.3, 0.2], GOLDC = [0.98, 0.84, 0.25];

const BONEC = [0.8, 0.8, 0.78], BONED = [0.6, 0.6, 0.58], BOWC = [0.45, 0.32, 0.18];
const SPID = [0.22, 0.19, 0.17], SPID2 = [0.3, 0.26, 0.23], SPEYE = [0.9, 0.12, 0.1];
const CHICK = [0.96, 0.96, 0.94], BEAK = [0.95, 0.7, 0.2], WATTLE = [0.85, 0.12, 0.12];

// Örümcek bacakları: her iki yanda 4 bacak
function spiderLegs() {
  const legs = [];
  for (let k = 0; k < 4; k++) {
    const z = -3 + k * 2.2, anim = k % 2 ? 'legA' : 'legB';
    legs.push(part([4, 5, z - 0.5, 15, 6.5, z + 0.5], SPID, anim, [4, 6, z]));
    legs.push(part([-15, 5, z - 0.5, -4, 6.5, z + 0.5], SPID, anim === 'legA' ? 'legB' : 'legA', [-4, 6, z]));
  }
  return legs;
}

const MOB_TYPES = {
  skeleton: {
    name: 'İskelet', hw: 0.3, h: 1.99, health: 20, speed: 2.3, hostile: true, ranged: true, burns: true, dmg: 3, sound: 'skeleton',
    parts: [
      part([-4, 24, -4, 4, 32, 4], BONEC, 'head', [0, 24, 0]),
      part([-3, 27, -4.2, -1, 29, -4], BLACK, 'head', [0, 24, 0]),
      part([1, 27, -4.2, 3, 29, -4], BLACK, 'head', [0, 24, 0]),
      part([-1, 25.5, -4.2, 1, 26.5, -4], BONED, 'head', [0, 24, 0]),
      part([-4, 12, -1.5, 4, 24, 1.5], BONED),
      part([-3.5, 20, -1.7, 3.5, 21, 1.7], BONEC), part([-3.5, 17, -1.7, 3.5, 18, 1.7], BONEC),
      part([5, 12, -1, 7, 24, 1], BONEC, 'armR', [6, 22, 0]),
      part([-7, 12, -1, -5, 24, 1], BONEC, 'armL', [-6, 22, 0]),
      part([-7.5, 8, -6, -6.5, 10, 6], BOWC, 'armL', [-6, 22, 0]),
      part([-3, 0, -1, -1, 12, 1], BONEC, 'legA', [-2, 12, 0]),
      part([1, 0, -1, 3, 12, 1], BONEC, 'legB', [2, 12, 0]),
    ],
  },
  spider: {
    name: 'Örümcek', hw: 0.65, h: 0.9, health: 16, speed: 3.0, hostile: true, climb: true, dmg: 2, sound: 'spider',
    parts: [
      part([-5, 3, 0, 5, 11, 12], SPID2),
      part([-3, 4, -3, 3, 10, 0], SPID),
      part([-4, 4, -11, 4, 12, -3], SPID, 'head', [0, 8, -3]),
      part([-3, 9, -11.2, -1, 10, -11], SPEYE, 'head', [0, 8, -3]),
      part([1, 9, -11.2, 3, 10, -11], SPEYE, 'head', [0, 8, -3]),
      part([-2, 7, -11.2, -1, 8, -11], SPEYE, 'head', [0, 8, -3]),
      part([1, 7, -11.2, 2, 8, -11], SPEYE, 'head', [0, 8, -3]),
    ].concat(spiderLegs()),
  },
  chicken: {
    name: 'Tavuk', hw: 0.2, h: 0.7, health: 4, speed: 1.0, hostile: false, flutter: true, sound: 'chicken',
    parts: [
      part([-3, 4, -4, 3, 10, 4], CHICK),
      part([-3.2, 5, -3, -3, 9, 3], CHICK), part([3, 5, -3, 3.2, 9, 3], CHICK),
      part([-2, 9, -6, 2, 15, -3], CHICK, 'head', [0, 9, -4]),
      part([-2, 12, -8, 2, 14, -6], BEAK, 'head', [0, 9, -4]),
      part([-1, 10, -7, 1, 12, -6], WATTLE, 'head', [0, 9, -4]),
      part([-2, 13, -6.2, -1, 14, -6], BLACK, 'head', [0, 9, -4]),
      part([1, 13, -6.2, 2, 14, -6], BLACK, 'head', [0, 9, -4]),
      part([-2, 0, -1, -1, 4, 0], BEAK, 'legA', [-1.5, 4, -0.5]),
      part([1, 0, -1, 2, 4, 0], BEAK, 'legB', [1.5, 4, -0.5]),
    ],
  },
  enderman: {
    name: 'Enderman', hw: 0.3, h: 2.9, health: 40, speed: 3.2, hostile: false, neutral: true, dmg: 7, sound: 'zombie',
    parts: [
      part([-4, 40, -4, 4, 48, 4], ENDER, 'head', [0, 40, 0]),
      part([-3, 43, -4.2, -1, 44, -4], ENDEYE, 'head', [0, 40, 0]),
      part([1, 43, -4.2, 3, 44, -4], ENDEYE, 'head', [0, 40, 0]),
      part([-4, 28, -2, 4, 40, 2], ENDER),
      part([4, 12, -1, 6, 40, 1], ENDER, 'legB', [5, 39, 0]),
      part([-6, 12, -1, -4, 40, 1], ENDER, 'legA', [-5, 39, 0]),
      part([-3, 0, -1, -1, 28, 1], ENDER, 'legA', [-2, 28, 0]),
      part([1, 0, -1, 3, 28, 1], ENDER, 'legB', [2, 28, 0]),
    ],
  },
  zpiglin: {
    name: 'Zombi Piglin', hw: 0.3, h: 1.95, health: 20, speed: 2.3, hostile: false, neutral: true, dmg: 5, sound: 'pig',
    parts: [
      part([-4.5, 24, -4, 4.5, 32, 4], PIGSKIN, 'head', [0, 24, 0]),
      part([-2, 25, -5, 2, 28, -4], PIGSNOUT, 'head', [0, 24, 0]),
      part([-3, 28, -4.2, -1.5, 29, -4], BLACK, 'head', [0, 24, 0]),
      part([1.5, 28, -4.2, 3, 29, -4], BLACK, 'head', [0, 24, 0]),
      part([-4.6, 30, -1, -4.4, 32, 1], ROT, 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], PIGSKIN),
      part([0, 14, -2.1, 4, 20, 2.1], ROT),
      part([4, 12, -2, 8, 24, 2], PIGSKIN, 'legB', [6, 22, 0]),
      part([-8, 12, -2, -4, 24, 2], ROT, 'legA', [-6, 22, 0]),
      part([5, 10, -6, 7, 12.5, 6], GOLDC, 'legB', [6, 22, 0]),
      part([-4, 0, -2, 0, 12, 2], PIGPANTS, 'legA', [-2, 12, 0]),
      part([0, 0, -2, 4, 12, 2], PIGPANTS, 'legB', [2, 12, 0]),
    ],
  },
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
    if (this.T.neutral || this.type === 'spider') this.angry = true;
    else if (!this.T.hostile) { this.panic = 4; this.aiTimer = 0; }
    if (this.health <= 0) { this.dead = true; this.deathTime = 0; }
    else if (this.type === 'enderman' && this.game && Math.random() < 0.6) this.teleportAway(this.game.world);
  }

  teleportAway(world) {
    for (let k = 0; k < 12; k++) {
      const x = Math.floor(this.pos[0] + (Math.random() - 0.5) * 24), z = Math.floor(this.pos[2] + (Math.random() - 0.5) * 24);
      if (!world.isLoadedAt(x, z)) continue;
      for (let y = Math.floor(this.pos[1]) + 8; y > Math.floor(this.pos[1]) - 8; y--) {
        if (SOLID[world.getBlock(x, y - 1, z)] && !world.getBlock(x, y, z) && !world.getBlock(x, y + 1, z) && !world.getBlock(x, y + 2, z)) {
          if (this.game) { this.game.particles.puff(this.pos[0], this.pos[1] + 1.4, this.pos[2], 10, 0.5); this.game.audio.play('pop', this.pos); }
          this.pos = [x + 0.5, y, z + 0.5]; this.vel = [0, 0, 0];
          return;
        }
      }
    }
  }

  update(dt, game) {
    this.game = game;
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

    // Örümcekler gün ışığında barışçıl
    let hostile = this.T.hostile;
    if (this.type === 'spider' && game.sunLevel > 0.6 && world.skyLightAt(Math.floor(p[0]), Math.floor(p[1] + 1), Math.floor(p[2]))) hostile = false;
    this.drawT = Math.max(0, (this.drawT || 0) - dt);
    if ((hostile || this.angry) && !pl.dead && !pl.creative && dist < (this.angry ? 40 : 22) && Math.abs(dy) < 12) {
      this.targetYaw = Math.atan2(-dx, -dz);
      speed = this.T.speed * (this.angry ? 1.3 : 1);
      if (this.T.ranged) {
        // İskelet: menzilde kal, görüş varsa ok at
        const eye = [p[0], p[1] + 1.6, p[2]], tgt = [pl.pos[0], pl.pos[1] + 1.1, pl.pos[2]];
        const sees = dist < 16 && hasLOS(world, eye, tgt);
        if (sees) {
          speed = dist < 5 ? -this.T.speed * 0.8 : dist > 11 ? this.T.speed : 0;
          this.attackCd -= dt;
          if (this.attackCd < 0.8) this.drawT = 0.2;
          if (this.attackCd <= 0) {
            this.attackCd = (game.diffMult > 1 ? 1.5 : 2.2) + Math.random() * 0.6;
            game.entities.shootAt(eye, tgt, game.difficultyDmg(this.T.dmg + Math.floor(Math.random() * 2)));
          }
        } else this.attackCd = Math.max(this.attackCd, 0.6);
      } else if (this.type !== 'creeper') {
        if (this.T.climb && this.onGround && dist > 2 && dist < 4 && this.attackCd <= 0.2 && Math.random() < dt * 2) {
          v[1] = 6.5; v[0] += (dx / dist) * 4; v[2] += (dz / dist) * 4; // atılma
        }
        this.attackCd -= dt;
        if (dist < 0.8 + this.hw && Math.abs(dy) < 2 && this.attackCd <= 0) {
          this.attackCd = 1;
          pl.hurt(game.difficultyDmg(this.T.dmg || 3), (dx / (dist || 1)) * 6, (dz / (dist || 1)) * 6, 'mob');
        }
        if (dist < 0.4 + this.hw) speed = 0;
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
    if (speed > 0 && !hostile && !this.angry && this.onGround) {
      const ax = Math.floor(p[0] + fx * 0.9), az = Math.floor(p[2] + fz * 0.9), ay = Math.floor(p[1]);
      const below = world.getBlock(ax, ay - 1, az), below2 = world.getBlock(ax, ay - 2, az);
      if ((!SOLID[below] && !SOLID[below2]) || isLiquid(below)) { this.targetYaw += Math.PI; speed = 0; this.aiTimer = 1; }
    }

    const inWater = isWater(world.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2])));
    const k = 1 - Math.exp(-dt * (this.onGround ? 10 : 2));
    v[0] += (fx * speed - v[0]) * k; v[2] += (fz * speed - v[2]) * k;
    if (inWater) { v[1] += (2 - v[1]) * Math.min(1, dt * 4); }
    else v[1] -= 30 * dt;
    if (v[1] < -50) v[1] = -50;
    const res = moveEntity(world, this, dt, false);
    this.onGround = res.ground;
    if (res.wall && speed > 0) {
      if (this.T.climb) v[1] = 3.6;               // örümcek duvara tırmanır
      else if (this.onGround || inWater) v[1] = 8.6;
    }
    if (this.T.flutter && !this.onGround && v[1] < -3) v[1] = -3; // tavuk süzülür
    if (p[1] < -20) this.remove = true;

    const hs = Math.hypot(v[0], v[2]);
    this.walk += hs * dt * 4.5;
    this.walkAmt += (Math.min(1, hs / 1.5) - this.walkAmt) * Math.min(1, dt * 8);

    // Gün ışığında zombi ve iskelet yanar
    if ((this.type === 'zombie' || this.T.burns) && game.sunLevel > 0.6 && !inWater && world.dim === 'overworld') {
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

// İki nokta arasında katı blok var mı?
function hasLOS(world, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const d = Math.hypot(dx, dy, dz), n = Math.ceil(d / 0.3);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (OPAQUE[world.getBlock(Math.floor(a[0] + dx * t), Math.floor(a[1] + dy * t), Math.floor(a[2] + dz * t))]) return false;
  }
  return true;
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
    this.arrows = [];
    this.spawnTimer = 2;
    this.verts = new Float32Array(9 * 24 * 12 * 40);
  }
  clear() { this.mobs.length = 0; this.arrows.length = 0; }
  get dragon() { return this.mobs.find((m) => m.type === 'dragon') || null; }

  // Ok fırlat (Minecraft: yerçekimi 20 b/s², tik başına %1 sürtünme)
  shoot(pos, vel, owner, dmg) {
    this.arrows.push({ pos: pos.slice(), vel: vel.slice(), dir: vel.slice(), owner, dmg, stuck: false, life: 60, age: 0 });
  }
  // İskelet: hedefe balistik nişan al
  shootAt(from, to, dmg) {
    const V = 30, G = 20;
    const dx = to[0] - from[0], dz = to[2] - from[2], dh = Math.hypot(dx, dz), t = dh / V;
    const dy = to[1] - from[1] + 0.5 * G * t * t;
    const l = Math.hypot(dx, dy, dz) || 1, err = 0.06 / (this.game.diffMult || 1);
    const v = [dx / l + (Math.random() - 0.5) * err, dy / l + (Math.random() - 0.5) * err, dz / l + (Math.random() - 0.5) * err].map((k) => k * V);
    this.shoot([from[0] + (dx / l) * 0.5, from[1], from[2] + (dz / l) * 0.5], v, 'mob', dmg);
    this.game.audio.play('bow', from);
  }

  updateArrows(dt) {
    const g = this.game, w = g.world, pl = g.player;
    for (const a of this.arrows) {
      a.age += dt;
      if (a.stuck) {
        a.life -= dt;
        if (a.owner === 'player' && !pl.creative && a.age > 0.4 && Math.hypot(pl.pos[0] - a.pos[0], pl.pos[1] + 0.9 - a.pos[1], pl.pos[2] - a.pos[2]) < 1.6) {
          if (g.addItem(I.ARROW, 1)) { g.audio.play('pop'); a.life = 0; }
        }
        // Takıldığı blok kırıldıysa düş
        if (!pointInSolid(w, a.pos[0] + a.dir[0] * 0.08, a.pos[1] + a.dir[1] * 0.08, a.pos[2] + a.dir[2] * 0.08)) { a.stuck = false; a.vel = [0, 0, 0]; }
        continue;
      }
      a.life -= dt;
      a.vel[1] -= 20 * dt;
      const drag = Math.pow(0.99, dt * 20);
      a.vel[0] *= drag; a.vel[1] *= drag; a.vel[2] *= drag;
      const sp = Math.hypot(a.vel[0], a.vel[1], a.vel[2]);
      if (sp > 0.5) a.dir = a.vel.slice();
      const n = Math.max(1, Math.ceil(sp * dt / 0.2)), sdt = dt / n;
      for (let k = 0; k < n && !a.stuck && a.life > 0; k++) {
        const x = a.pos[0] + a.vel[0] * sdt, y = a.pos[1] + a.vel[1] * sdt, z = a.pos[2] + a.vel[2] * sdt;
        if (a.owner === 'player') {
          for (const m of this.mobs) {
            if (m.dead) continue;
            if (Math.abs(x - m.pos[0]) < m.hw + 0.15 && Math.abs(z - m.pos[2]) < m.hw + 0.15 && y > m.pos[1] - 0.1 && y < m.pos[1] + m.h + 0.1) {
              m.hit(a.dmg, a.vel[0], a.vel[2]);
              g.audio.play('mobhurt', m.pos);
              if (m.dead) g.mobDrops(m);
              a.life = 0; break;
            }
          }
        } else if (!pl.dead && Math.abs(x - pl.pos[0]) < pl.hw + 0.1 && Math.abs(z - pl.pos[2]) < pl.hw + 0.1 && y > pl.pos[1] && y < pl.pos[1] + pl.h) {
          const l = Math.hypot(a.vel[0], a.vel[2]) || 1;
          pl.hurt(a.dmg, (a.vel[0] / l) * 4, (a.vel[2] / l) * 4, 'arrow');
          a.life = 0;
        }
        if (a.life <= 0) break;
        if (pointInSolid(w, x, y, z)) {
          a.stuck = true; a.life = a.owner === 'player' ? 60 : 10; a.vel = [0, 0, 0];
          g.audio.play('arrowhit', a.pos);
        } else { a.pos[0] = x; a.pos[1] = y; a.pos[2] = z; }
      }
      if (a.pos[1] < -20) a.life = 0;
    }
    this.arrows = this.arrows.filter((a) => a.life > 0 && Math.hypot(a.pos[0] - pl.pos[0], a.pos[2] - pl.pos[2]) < 120);
  }

  arrowMesh(out, n, a, cam, light) {
    const m = M4.create(), t = M4.create();
    const d = a.dir, hl = Math.hypot(d[0], d[2]);
    M4.translate(m, a.pos[0] - cam[0], a.pos[1] - cam[1], a.pos[2] - cam[2]);
    M4.rotY(t, Math.atan2(-d[0], -d[2])); M4.mul(m, m, t);
    M4.rotX(t, Math.atan2(d[1], hl)); M4.mul(m, m, t);
    n = addBox(out, n, m, -0.025, -0.025, -0.05, 0.025, 0.025, 0.42, [0.5, 0.36, 0.22], light);
    n = addBox(out, n, m, -0.045, -0.045, -0.12, 0.045, 0.045, -0.04, [0.72, 0.72, 0.74], light);
    n = addBox(out, n, m, -0.07, -0.005, 0.3, 0.07, 0.005, 0.44, [0.95, 0.95, 0.95], light);
    return n;
  }

  update(dt) {
    const g = this.game;
    for (const m of this.mobs) {
      m.update(dt, g);
      if (m.T.boss) continue;
      const d = Math.hypot(m.pos[0] - g.player.pos[0], m.pos[2] - g.player.pos[2]);
      if (d > 110) m.remove = true;
      if ((m.T.hostile || m.T.neutral) && g.player.creative && d > 40) m.remove = true;
    }
    this.mobs = this.mobs.filter((m) => !m.remove);
    this.updateArrows(dt);
    // Mob'lar birbirini itsin
    for (let i = 0; i < this.mobs.length; i++) for (let j = i + 1; j < this.mobs.length; j++) {
      const a = this.mobs[i], b = this.mobs[j];
      if (a.T.boss || b.T.boss) continue;
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
    for (const m of this.mobs) if (!m.T.boss) (m.T.hostile || m.T.neutral) ? hostile++ : passive++;
    const ang = Math.random() * Math.PI * 2;
    if (w.dim !== 'overworld') {
      if (hostile >= (w.dim === 'end' ? 12 : 10)) return;
      const r = 16 + Math.random() * 30;
      const x = Math.floor(pl.pos[0] + Math.cos(ang) * r), z = Math.floor(pl.pos[2] + Math.sin(ang) * r);
      if (!w.isLoadedAt(x, z)) return;
      for (let y = Math.floor(pl.pos[1]) + 12; y > Math.floor(pl.pos[1]) - 12; y--) {
        const fl = w.getBlock(x, y - 1, z);
        if (SOLID[fl] && fl !== B.BEDROCK && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z) && !w.getBlock(x, y + 2, z)) {
          let type = 'enderman';
          if (w.dim === 'nether') type = fl === B.WARPED_NYLIUM && Math.random() < 0.6 ? 'enderman' : 'zpiglin';
          this.mobs.push(new Mob(type, x + 0.5, y, z + 0.5));
          return;
        }
      }
      return;
    }
    if (passive < 10 && Math.random() < 0.5) {
      const r = 24 + Math.random() * 40;
      const x = Math.floor(pl.pos[0] + Math.cos(ang) * r), z = Math.floor(pl.pos[2] + Math.sin(ang) * r);
      if (!w.isLoadedAt(x, z)) return;
      const y = w.surfaceY(x, z);
      if (y < 0 || w.getBlock(x, y, z) !== B.GRASS) return;
      const types = ['pig', 'cow', 'sheep', 'chicken'];
      const type = types[Math.floor(Math.random() * 4)];
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
      const rr = Math.random();
      const type = rr < 0.08 ? 'enderman' : rr < 0.43 ? 'zombie' : rr < 0.66 ? 'skeleton' : rr < 0.84 ? 'spider' : 'creeper';
      if (type === 'spider' && (SOLID[w.getBlock(x + 1, y + 1, z)] || SOLID[w.getBlock(x, y + 1, z + 1)])) return;
      this.mobs.push(new Mob(type, x + 0.5, y + 1, z + 0.5));
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
    const rr = Math.random();
    this.mobs.push(new Mob(rr < 0.38 ? 'zombie' : rr < 0.7 ? 'skeleton' : rr < 0.82 ? 'spider' : 'creeper', x + 0.5, y, z + 0.5));
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
    let boxes = this.arrows.length * 3 + 2;
    for (const m of this.mobs) boxes += m.T.boxes || 16;
    const need = boxes * 24 * 9;
    if (this.verts.length < need) this.verts = new Float32Array(need * 2);
    for (const m of this.mobs) {
      const d = Math.hypot(m.pos[0] - cam[0], m.pos[2] - cam[2]);
      if (d > g.settings.renderDist * 16 + (m.T.boss ? 64 : 0)) continue;
      let light;
      if (g.world.dim === 'nether') light = 0.6;
      else if (g.world.dim === 'end') light = 0.7;
      else {
        const sky = g.world.skyLightAt(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 1), Math.floor(m.pos[2]));
        light = Math.max(0.12, sky ? g.sunLevel : 0.25);
      }
      n = m.buildMesh(this.verts, n, cam, light);
    }
    const dr = this.dragon;
    if (dr && dr.healFrom && !dr.dead) n = beamMesh(this.verts, n, [dr.healFrom.pos[0], dr.healFrom.pos[1] + 0.9, dr.healFrom.pos[2]], [dr.pos[0], dr.pos[1] + 1.2, dr.pos[2]], cam);
    for (const a of this.arrows) {
      let light = 0.7;
      if (g.world.dim === 'overworld') light = Math.max(0.15, g.world.skyLightAt(Math.floor(a.pos[0]), Math.floor(a.pos[1]), Math.floor(a.pos[2])) ? g.sunLevel : 0.3);
      n = this.arrowMesh(this.verts, n, a, cam, light);
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
  itemBits(x, y, z, layer, n) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x, y, z, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5,
        life: 0.4 + Math.random() * 0.3, layer, u: (4 + Math.floor(Math.random() * 8)) / 16, v: (4 + Math.floor(Math.random() * 8)) / 16,
        size: 0.06, light: 1, g: 14,
      });
    }
  }
  sparkle(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 1.2, y: y + Math.random() * 0.8, z: z + (Math.random() - 0.5) * 1.2,
        vx: 0, vy: 0.5, vz: 0, life: 0.7 + Math.random() * 0.6, layer: TEX.leaves, u: 0.4, v: 0.4, size: 0.07, light: 1.3, g: -0.3,
      });
    }
  }
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
