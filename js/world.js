'use strict';
// ---------------------------------------------------------------------------
// Dünya: parçalar (chunk), arazi üretimi, biyomlar, mağaralar, ağaçlar, kayıt
// ---------------------------------------------------------------------------

const CS = 16, CH = 128, SEA = 48;
const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, MOUNTAIN: 4, BEACH: 5, OCEAN: 6 };
const BIOME_NAMES = ['Ova', 'Orman', 'Çöl', 'Karlı Tundra', 'Dağlar', 'Sahil', 'Okyanus'];

const bidx = (x, y, z) => (y * CS + z) * CS + x;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.key = ckey(cx, cz);
    this.blocks = new Uint8Array(CS * CS * CH);
    this.maxY = 0;
    this.dirty = true;     // yeniden mesh gerekli
    this.urgent = false;   // oyuncu düzenlemesi: hemen mesh
    this.gpu = null;       // renderer tarafından doldurulur
  }
}

class World {
  constructor(seedStr, edits) {
    this.seedStr = String(seedStr);
    this.seed = hashStr(seedStr);
    const s = this.seed;
    this.nCont = new Simplex(s + 1);
    this.nHill = new Simplex(s + 2);
    this.nMnt = new Simplex(s + 3);
    this.nRidge = new Simplex(s + 4);
    this.nTemp = new Simplex(s + 5);
    this.nHum = new Simplex(s + 6);
    this.nCaveA = new Simplex(s + 7);
    this.nCaveB = new Simplex(s + 8);
    this.nCavern = new Simplex(s + 9);
    this.chunks = new Map();
    this.edits = edits || {};   // chunkKey -> { blockIndex: id }
    this._lk = -1; this._lc = null;
    this.onBlockChange = null;
  }

  getChunk(cx, cz) {
    const k = ckey(cx, cz);
    if (k === this._lk) return this._lc;
    const c = this.chunks.get(k);
    if (c) { this._lk = k; this._lc = c; }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.blocks[bidx(x & 15, y, z & 15)];
  }

  isLoadedAt(x, z) { return !!this.getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4); }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CH) return false;
    const cx = x >> 4, cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return false;
    const i = bidx(x & 15, y, z & 15);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    if (id && y > c.maxY) c.maxY = y;
    let e = this.edits[c.key];
    if (!e) e = this.edits[c.key] = {};
    e[i] = id;
    c.dirty = true; c.urgent = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = this.getChunk(cx + dx, cz + dz);
      if (n) n.dirty = true;
    }
    if (this.onBlockChange) this.onBlockChange(x, y, z, old, id);
    return true;
  }

  // Bir sütunun yüksekliğini ve biyomunu hesapla (saf fonksiyon)
  column(wx, wz) {
    const cont = this.nCont.fbm2(wx * 0.0021, wz * 0.0021, 4);
    const hills = this.nHill.fbm2(wx * 0.011 + 300, wz * 0.011, 3);
    const mnt = this.nMnt.noise2D(wx * 0.0035, wz * 0.0035);
    const ridge = 1 - Math.abs(this.nRidge.fbm2(wx * 0.007, wz * 0.007, 2));
    const temp = this.nTemp.noise2D(wx * 0.0014, wz * 0.0014) + hills * 0.06;
    const hum = this.nHum.noise2D(wx * 0.0017 + 500, wz * 0.0017);

    let h = SEA + 4 + cont * 24 + hills * (4 + Math.max(0, cont) * 6);
    const mf = smoothstep(0.1, 0.55, mnt) * smoothstep(-0.25, 0.1, cont);
    h += mf * (ridge * ridge * 42 + 6);
    h = Math.floor(clamp(h, 6, CH - 22));

    let biome;
    if (h < SEA - 2) biome = BIOME.OCEAN;
    else if (h > SEA + 28) biome = BIOME.MOUNTAIN;
    else if (temp < -0.32) biome = BIOME.SNOW;
    else if (temp > 0.3 && hum < 0.15) biome = BIOME.DESERT;
    else if (h <= SEA + 1) biome = BIOME.BEACH;
    else if (hum > 0.12) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    this._h = h; this._b = biome; this._t = temp;
    return h;
  }

  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    const b = c.blocks, seed = this.seed;
    const bx = cx * CS, bz = cz * CS;
    const H = new Int16Array(256), BI = new Uint8Array(256), TP = new Float32Array(256);
    let maxY = 0;

    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z;
      const h = this.column(wx, wz), biome = this._b;
      H[z * 16 + x] = h; BI[z * 16 + x] = biome; TP[z * 16 + x] = this._t;
      let top, sub, deep = B.STONE;
      switch (biome) {
        case BIOME.DESERT: top = B.SAND; sub = B.SAND; deep = B.SANDSTONE; break;
        case BIOME.BEACH: top = B.SAND; sub = B.SAND; break;
        case BIOME.OCEAN: top = hash2(wx >> 2, wz >> 2, seed + 11) < 0.3 ? B.GRAVEL : B.SAND; sub = top === B.GRAVEL ? B.GRAVEL : B.SAND; break;
        case BIOME.SNOW: top = B.SNOWY_GRASS; sub = B.DIRT; break;
        case BIOME.MOUNTAIN:
          if (h > SEA + 46) { top = B.SNOW; sub = B.STONE; }
          else if (h > SEA + 36 || hash2(wx, wz, seed + 12) < 0.4) { top = B.STONE; sub = B.STONE; }
          else { top = B.GRASS; sub = B.DIRT; }
          break;
        default: top = B.GRASS; sub = B.DIRT;
      }
      b[bidx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y <= h; y++) {
        let id;
        if (y < 5 && hash3(wx, y, wz, seed) < (5 - y) * 0.22) id = B.BEDROCK;
        else if (y === h) id = top;
        else if (y > h - 4) id = sub;
        else if (y > h - 7 && deep === B.SANDSTONE) id = B.SANDSTONE;
        else id = B.STONE;
        b[bidx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) {
        b[bidx(x, y, z)] = (y === SEA && biome === BIOME.SNOW) ? B.ICE : B.WATER;
      }
      if (h > maxY) maxY = h;
      if (SEA > maxY && h < SEA) maxY = SEA;
    }

    // Mağaralar ve cevherler
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z, h = H[z * 16 + x];
      const nearWater = h <= SEA + 2;
      const yTop = nearWater ? h - 6 : h;
      for (let y = 1; y <= yTop; y++) {
        const i = bidx(x, y, z);
        const id = b[i];
        if (id === B.BEDROCK || id === B.WATER) continue;
        let cave = false;
        const a = this.nCaveA.noise3D(wx * 0.042, y * 0.075, wz * 0.042);
        if (Math.abs(a) < 0.12) {
          const bb = this.nCaveB.noise3D(wx * 0.042, y * 0.075 + 100, wz * 0.042);
          if (a * a + bb * bb < 0.0075 * (y < h - 8 ? 1.6 : 1)) cave = true;
        }
        if (!cave && y < 42 && y < h - 6) {
          const cv = this.nCavern.noise3D(wx * 0.016, y * 0.032, wz * 0.016);
          if (cv > 0.62 - (42 - y) * 0.003) cave = true;
        }
        if (cave) { b[i] = y <= 10 ? B.LAVA : 0; continue; }
        if (id === B.STONE) {
          const cr = hash3(wx >> 1, y >> 1, wz >> 1, seed + 99);
          if (cr < 0.024) {
            let ore = 0;
            if (cr < 0.0012) { if (y < 17) ore = B.DIAMOND; }
            else if (cr < 0.0032) { if (y < 34) ore = B.GOLD; }
            else if (cr < 0.0062) { if (y < 20) ore = B.REDSTONE; }
            else if (cr < 0.0072) { if (h > SEA + 20 && y < 60) ore = B.EMERALD; }
            else if (cr < 0.0132) { if (y < 64) ore = B.IRON; }
            else if (y < 100) ore = B.COAL;
            if (ore && hash3(wx, y, wz, seed + 7) < 0.6) b[i] = ore;
          }
        }
      }
    }

    // Ağaçlar (komşu sütunlardan taşan dallar dahil)
    const put = (wx, y, wz, id, onlyAir) => {
      const lx = wx - bx, lz = wz - bz;
      if (lx < 0 || lz < 0 || lx > 15 || lz > 15 || y < 0 || y >= CH) return;
      const i = bidx(lx, y, lz);
      const cur = b[i];
      if (onlyAir ? (cur !== 0 && RENDER[cur] !== R_CROSS) : (OPAQUE[cur] && cur !== B.LEAVES && cur !== B.BIRCH_LEAVES && cur !== B.SPRUCE_LEAVES)) return;
      b[i] = id;
      if (y > maxY) maxY = y;
    };
    for (let wz = bz - 3; wz < bz + 19; wz++) for (let wx = bx - 3; wx < bx + 19; wx++) {
      const r = hash2(wx, wz, seed + 1);
      if (r > 0.04) continue;
      const lx = wx - bx, lz = wz - bz;
      const inside = lx >= 0 && lz >= 0 && lx < 16 && lz < 16;
      let h, biome;
      if (inside) { h = H[lz * 16 + lx]; biome = BI[lz * 16 + lx]; }
      else { h = this.column(wx, wz); biome = this._b; }
      if (h <= SEA) continue;
      if (inside) {
        const s = b[bidx(lx, h, lz)];
        if (s !== B.GRASS && s !== B.SNOWY_GRASS && s !== B.SAND && s !== B.DIRT) continue;
      }
      const r2 = hash2(wx, wz, seed + 2);
      const th = 4 + Math.floor(r2 * 3);
      const y0 = h + 1;
      if (biome === BIOME.FOREST && r < 0.035) {
        if (r2 < 0.3) this.oakTree(put, wx, y0, wz, th + 1, B.BIRCH_LOG, B.BIRCH_LEAVES, seed);
        else this.oakTree(put, wx, y0, wz, th, B.LOG, B.LEAVES, seed);
      } else if (biome === BIOME.PLAINS && r < 0.0035) {
        this.oakTree(put, wx, y0, wz, th, B.LOG, B.LEAVES, seed);
      } else if (biome === BIOME.SNOW && r < 0.014) {
        this.spruceTree(put, wx, y0, wz, th + 2);
      } else if (biome === BIOME.MOUNTAIN && r < 0.004 && h < SEA + 40) {
        this.spruceTree(put, wx, y0, wz, th + 2);
      } else if (biome === BIOME.DESERT && r < 0.005 && inside) {
        const ch = 1 + Math.floor(r2 * 3);
        for (let k = 0; k < ch; k++) put(wx, y0 + k, wz, B.CACTUS, true);
      }
    }

    // Çiçekler, çimen, çalılar, balkabakları
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z, h = H[z * 16 + x], biome = BI[z * 16 + x];
      if (h <= SEA || h >= CH - 2) continue;
      const s = b[bidx(x, h, z)], above = bidx(x, h + 1, z);
      if (b[above] !== 0) continue;
      const r = hash2(wx, wz, seed + 77);
      if (s === B.GRASS) {
        const fl = (this.nHum.noise2D(wx * 0.05, wz * 0.05) > 0.4) ? 0.06 : 0.012;
        if (biome === BIOME.PLAINS && r < 0.12) b[above] = B.TALL_GRASS;
        else if (biome === BIOME.FOREST && r < 0.05) b[above] = B.TALL_GRASS;
        else if (r < 0.12 + fl) {
          const r3 = hash2(wx, wz, seed + 78);
          b[above] = r3 < 0.45 ? B.POPPY : r3 < 0.9 ? B.DANDELION : B.BLUE_FLOWER;
        } else if (biome === BIOME.PLAINS && r > 0.9985) b[above] = B.PUMPKIN;
      } else if (s === B.SAND && biome === BIOME.DESERT && r < 0.006) {
        b[above] = B.DEAD_BUSH;
      }
    }

    // Kayıtlı düzenlemeleri uygula
    const e = this.edits[c.key];
    if (e) {
      for (const k in e) {
        const i = k | 0, id = e[k];
        b[i] = id;
        const y = (i / 256) | 0;
        if (id && y > maxY) maxY = y;
      }
    }
    c.maxY = Math.min(CH - 1, maxY + 1);
    this.chunks.set(c.key, c);
    this._lk = -1;
    return c;
  }

  oakTree(put, x, y, z, th, log, leaves, seed) {
    for (let dy = th - 3; dy <= th; dy++) {
      const r = dy >= th - 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r) {
          if (dy === th || hash3(x + dx, y + dy, z + dz, seed + 5) < 0.5) continue;
        }
        if (dy === th && r === 1 && dx && dz) continue;
        put(x + dx, y + dy, z + dz, leaves, true);
      }
    }
    for (let k = 0; k < th; k++) put(x, y + k, z, log, false);
  }

  spruceTree(put, x, y, z, th) {
    const radii = [0, 1, 1, 2, 1, 2, 3, 2, 3];
    for (let k = 0; k <= th - 1; k++) {
      const yy = y + th - k;
      const r = radii[Math.min(k, radii.length - 1)];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (r >= 2 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
        if (r === 1 && dx && dz && k < 2) continue;
        put(x + dx, yy, z + dz, B.SPRUCE_LEAVES, true);
      }
    }
    put(x, y + th + 1, z, B.SPRUCE_LEAVES, true);
    for (let k = 0; k < th; k++) put(x, y + k, z, B.SPRUCE_LOG, false);
  }

  // Doğma noktası: (0,0) çevresinde karada uygun bir yer ara
  findSpawn() {
    for (let r = 0; r < 400; r += 8) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
        const h = this.column(x, z);
        if (h > SEA + 1 && this._b !== BIOME.OCEAN && this._b !== BIOME.MOUNTAIN) return [x + 0.5, h + 1, z + 0.5];
        if (r === 0) break;
      }
    }
    return [0.5, this.column(0, 0) + 2, 0.5];
  }

  // Yukarısı gökyüzüne açık mı? (varlık aydınlatması ve canavar doğurma için)
  skyLightAt(x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 1;
    for (let yy = Math.max(0, y); yy <= c.maxY; yy++) {
      const id = c.blocks[bidx(x & 15, yy, z & 15)];
      if (OPAQUE[id]) return 0;
    }
    return 1;
  }

  surfaceY(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return -1;
    for (let y = c.maxY; y > 0; y--) {
      const id = c.blocks[bidx(x & 15, y, z & 15)];
      if (SOLID[id] || RENDER[id] === R_LIQUID) return y;
    }
    return -1;
  }
}
