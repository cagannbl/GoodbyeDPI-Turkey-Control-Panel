'use strict';
// ---------------------------------------------------------------------------
// Dünya: parçalar (chunk), arazi üretimi, biyomlar, mağaralar, ağaçlar, kayıt
// ---------------------------------------------------------------------------

const CS = 16, CH = 128, SEA = 48;
const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, MOUNTAIN: 4, BEACH: 5, OCEAN: 6, RIVER: 7, TAIGA: 8 };
const BIOME_NAMES = ['Ova', 'Orman', 'Çöl', 'Karlı Tundra', 'Dağlar', 'Sahil', 'Okyanus', 'Nehir', 'Tayga'];

const bidx = (x, y, z) => (y * CS + z) * CS + x;
const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

const growable = (id) => isWheat(id) || isSapling(id) || id === B.FARMLAND || id === B.FARMLAND_WET || id === B.SUGAR_CANE;

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
  constructor(seedStr, edits, dim = 'overworld', opts = {}) {
    this.dim = dim;
    this.dragonKilled = !!opts.dragonKilled;
    // Arazi sürümü: 1 eski dünyalar (kayıtlar bozulmasın), 2 yeni arazi (nehirler, tayga, sarp dağlar)
    this.gen = opts.gen || 1;
    this.hasSky = dim !== 'nether';
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
    this.nBiome = new Simplex(s + 10);
    this.nWarp = new Simplex(s + 11);
    this.nRiver = new Simplex(s + 12);
    if (dim === 'end') {
      this.pillars = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.pillars.push({ x: Math.round(Math.cos(a) * 42), z: Math.round(Math.sin(a) * 42), r: 2 + (i % 3), h: 76 + Math.floor(hash2(i, 7, s) * 28) });
      }
    }
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

  setBlock(x, y, z, id, urgent = true) {
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
    c.dirty = true; if (urgent) c.urgent = true;
    if (growable(id)) c.plants.add(i); else if (growable(old)) c.plants.delete(i);
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
    if (this.gen >= 2) return this.column2(wx, wz);
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

  // Arazi 2: bükülmüş gürültüyle doğal kıyılar, kıyıdan iç bölgeye yükselen kıtalar, sırt şeklinde sarp dağlar,
  // kıvrılan nehirler; sıcaklık kuşakları (kar - tayga - ılıman - çöl) birbirine yumuşak geçer.
  column2(wx, wz) {
    const wpx = this.nWarp.noise2D(wx * 0.004, wz * 0.004) * 36, wpz = this.nWarp.noise2D(wx * 0.004 + 71, wz * 0.004 - 33) * 36;
    const ux = wx + wpx, uz = wz + wpz;
    const cont = this.nCont.fbm2(ux * 0.0017, uz * 0.0017, 5) + 0.2; // kara ağırlıklı (~%30 su)
    const ero = this.nMnt.fbm2(ux * 0.0026, uz * 0.0026, 2);
    const hills = this.nHill.fbm2(wx * 0.012 + 300, wz * 0.012, 3);
    const ridge = 1 - Math.abs(this.nRidge.fbm2(ux * 0.0065, uz * 0.0065, 3));
    const temp = this.nTemp.fbm2(ux * 0.0011, uz * 0.0011, 2) * 1.25 + this.nHum.noise2D(wx * 0.03, wz * 0.03) * 0.025;
    const hum = this.nHum.fbm2(ux * 0.0014 + 500, uz * 0.0014, 2) * 1.25;
    // Kıta profili: derin okyanus -> kıyı -> iç bölge
    let base;
    if (cont < -0.3) base = SEA - 22 + (cont + 1) * 18;           // okyanus tabanı
    else if (cont < 0.02) base = SEA - 9.4 + (cont + 0.3) * 33;   // kıyı yamacı (~SEA+1'e çıkar)
    else base = SEA + 1 + Math.min(1, (cont - 0.02) / 0.5) * 14;  // iç bölge
    // Biyoma göre tepe yüksekliği (sürekli geçiş): ova düz, orman/tayga engebeli
    const rough = 2.5 + smoothstep(-0.1, 0.45, hum) * 5 + smoothstep(-0.2, -0.5, temp) * 3;
    let h = base + hills * rough * smoothstep(-0.25, 0.1, cont);
    // Dağlar: iç bölgede, sırt gürültüsüyle keskin zirveler
    const mf = smoothstep(0.12, 0.55, ero) * smoothstep(0.0, 0.3, cont);
    h += mf * (Math.pow(ridge, 2.4) * 58 + 6);
    // Nehirler: bükülmüş gürültünün sıfır çizgisi. Yatağın iki yanında geniş, yumuşak eğimli bir vadi açılır
    // (yaklaşık 2 blokta 1 blok yükselir); arazi vadi tabanına yumuşakça karışır, kanyon oluşmaz.
    // Dağların içinde yatak yavaşça yükselir; nehir orada kuru, yayvan bir vadiye dönüşür.
    const RF = 0.0021, rn = this.nRiver.fbm2(ux * RF, uz * RF, 2), rv = Math.abs(rn);
    const rs = smoothstep(-0.25, -0.1, cont);
    let river = false;
    if (rs > 0 && rv < 0.5) {
      // Nehir çizgisine blok cinsinden uzaklık (gürültünün eğimiyle), böylece vadi her yerde aynı eğimde olur
      const gx = this.nRiver.fbm2((ux + 1) * RF, uz * RF, 2) - rn, gz = this.nRiver.fbm2(ux * RF, (uz + 1) * RF, 2) - rn;
      const dist = rv / Math.max(1e-4, Math.hypot(gx, gz));
      const hw = 3.5 + 2.5 * (1 - mf); // yatağın yarı genişliği
      let floor = dist < hw ? SEA - 1 - (1 - (dist / hw) ** 2) * 2.5 : SEA + (dist - hw) * (0.5 + 0.5 * mf);
      // dağlarda yatak yükselir (kuru vadi), kıyıdan uzaklaştıkça vadi kaybolur
      floor += smoothstep(0.3, 1, mf) * 30 + (1 - rs) * 40 + smoothstep(0.2, 0.5, rv) * 120;
      if (floor < h) {
        // yumuşak minimum: vadi kenarı araziye köşesiz bağlanır
        const k = 5, q = Math.max(0, k - (h - floor)) / k;
        h = floor - q * q * k * 0.25;
        river = dist < hw && h < SEA;
      } else if (floor - h < 5) {
        const q = (5 - (floor - h)) / 5;
        h -= q * q * 5 * 0.25;
      }
    }
    h = Math.floor(clamp(h, 6, CH - 14));
    let biome;
    if (river) biome = BIOME.RIVER;
    else if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (mf > 0.35 && h > SEA + 26) biome = BIOME.MOUNTAIN;
    else if (h <= SEA + 1 && cont < 0.06) biome = BIOME.BEACH;
    else if (temp < -0.38) biome = BIOME.SNOW;
    else if (temp < -0.16) biome = BIOME.TAIGA;
    else if (temp > 0.32 && hum < 0.2) biome = BIOME.DESERT;
    else if (hum > 0.1) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    this._h = h; this._b = biome; this._t = temp;
    return h;
  }

  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    let maxY = this.dim === 'nether' ? this.genNether(c) : this.dim === 'end' ? this.genEnd(c) : this.genOverworld(c);
    const b = c.blocks;
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
    // Büyüyen bloklar (ekin, fidan, tarla) sadece oyuncu düzenlemelerinden gelir
    c.plants = new Set();
    if (e) for (const k in e) {
      const id = e[k], i = k | 0;
      if (growable(id)) c.plants.add(i);
      // Kayıtta yarım kalmış akışlar yeniden başlasın
      if (isLiquid(id) && !isSource(id)) (this.pendingFluids || (this.pendingFluids = [])).push([c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)]);
      // Kızıltaş devreleri yüklenince yeniden değerlendirilir (saatler, basılı düğmeler devam eder)
      if (isRedstoneRelated(id)) (this.pendingRS || (this.pendingRS = [])).push([c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)]);
    }
    this.chunks.set(c.key, c);
    this._lk = -1;
    return c;
  }

  genOverworld(c) {
    const cx = c.cx, cz = c.cz;
    const b = c.blocks, seed = this.seed;
    const bx = cx * CS, bz = cz * CS;
    const H = new Int16Array(256), BI = new Uint8Array(256), TP = new Float32Array(256);
    let maxY = 0;

    // Arazi 2: eğim için bir sütun kenar payıyla yükseklikler
    const g2 = this.gen >= 2;
    let HE = null;
    if (g2) {
      HE = new Int16Array(18 * 18);
      for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) {
        HE[(z + 1) * 18 + x + 1] = this.column(bx + x, bz + z);
        if (x >= 0 && z >= 0 && x < 16 && z < 16) { BI[z * 16 + x] = this._b; TP[z * 16 + x] = this._t; }
      }
    }
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z;
      let h, biome;
      if (g2) { h = HE[(z + 1) * 18 + x + 1]; biome = BI[z * 16 + x]; this._t = TP[z * 16 + x]; }
      else { h = this.column(wx, wz); biome = this._b; BI[z * 16 + x] = biome; TP[z * 16 + x] = this._t; }
      H[z * 16 + x] = h;
      let top, sub, deep = B.STONE;
      if (g2) {
        const e = (z + 1) * 18 + x + 1;
        const slope = Math.max(Math.abs(HE[e - 1] - h), Math.abs(HE[e + 1] - h), Math.abs(HE[e - 18] - h), Math.abs(HE[e + 18] - h));
        const cold = this._t < -0.16;
        switch (biome) {
          case BIOME.DESERT: top = B.SAND; sub = B.SAND; deep = B.SANDSTONE; if (slope >= 4) top = sub = B.SANDSTONE; break;
          case BIOME.BEACH: top = B.SAND; sub = B.SAND; if (cold && hash2(wx >> 1, wz >> 1, seed + 13) < 0.5) top = sub = B.GRAVEL; break;
          case BIOME.OCEAN: top = hash2(wx >> 2, wz >> 2, seed + 11) < 0.3 ? B.GRAVEL : B.SAND; sub = top === B.GRAVEL ? B.GRAVEL : B.SAND; break;
          case BIOME.RIVER: top = hash2(wx >> 1, wz >> 1, seed + 14) < 0.35 ? B.GRAVEL : B.SAND; sub = top; break;
          case BIOME.MOUNTAIN:
            if (h > SEA + 44 - Math.floor(hash2(wx, wz, seed + 15) * 4)) { top = slope >= 5 ? B.STONE : B.SNOW; sub = B.STONE; }
            else if (slope >= 4 || h > SEA + 38) { top = B.STONE; sub = B.STONE; }
            else { top = cold ? B.SNOWY_GRASS : B.GRASS; sub = B.DIRT; }
            break;
          case BIOME.SNOW: top = slope >= 6 ? B.STONE : B.SNOWY_GRASS; sub = slope >= 6 ? B.STONE : B.DIRT; break;
          default:
            // Sarp yamaçlar çıplak taş (yarlar), kıyı yamaçlarında toprak
            if (slope >= 6 && h > SEA + 6) { top = B.STONE; sub = B.STONE; }
            else if (slope >= 4 && h > SEA + 3 && hash2(wx, wz, seed + 16) < 0.5) { top = B.DIRT; sub = B.DIRT; }
            else { top = B.GRASS; sub = B.DIRT; }
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
        // Soğukta nehir/göl yüzeyi donar
        for (let y = h + 1; y <= SEA; y++) b[bidx(x, y, z)] = (y === SEA && this._t < -0.3) ? B.ICE : B.WATER;
        if (h > maxY) maxY = h;
        if (SEA > maxY && h < SEA) maxY = SEA;
        continue;
      }
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
        if (cave) { b[i] = y <= 10 ? (y === 10 && hash3(wx, y, wz, seed + 3) < 0.2 ? B.OBSIDIAN : B.LAVA) : 0; continue; }
        if (id === B.STONE) {
          const cr = hash3(wx >> 1, y >> 1, wz >> 1, seed + 99);
          if (cr < 0.024) {
            let ore = 0;
            if (cr < 0.0012) { if (y < 17) ore = B.DIAMOND; }
            else if (cr < 0.0032) { if (y < 34) ore = B.GOLD; }
            else if (cr < 0.0062) { if (y < 20) ore = B.REDSTONE; }
            else if (cr < 0.0072) { if (h > SEA + 20 && y < 60) ore = B.EMERALD; }
            else if (cr < 0.0132) { if (y < 64) ore = B.IRON; }
            else if (cr < 0.0150) { if (y < 32) ore = B.LAPIS_ORE; }
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
    const vills = this.villagesNear(bx + 8, bz + 8, 24);
    for (let wz = bz - 3; wz < bz + 19; wz++) for (let wx = bx - 3; wx < bx + 19; wx++) {
      const r = hash2(wx, wz, seed + 1);
      if (r > 0.04) continue;
      if (vills.some((v) => wx >= v.x0 - 3 && wx <= v.x1 + 3 && wz >= v.z0 - 3 && wz <= v.z1 + 3)) continue; // köyde ağaç yok
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
      } else if (biome === BIOME.TAIGA && r < 0.03) {
        this.spruceTree(put, wx, y0, wz, th + 2 + Math.floor(r2 * 3));
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
        if ((biome === BIOME.PLAINS && r < 0.12) || (biome === BIOME.TAIGA && r < 0.08)) b[above] = B.TALL_GRASS;
        else if (biome === BIOME.FOREST && r < 0.05) b[above] = B.TALL_GRASS;
        else if (r < 0.12 + fl) {
          const r3 = hash2(wx, wz, seed + 78);
          b[above] = r3 < 0.45 ? B.POPPY : r3 < 0.9 ? B.DANDELION : B.BLUE_FLOWER;
        } else if (biome === BIOME.PLAINS && r > 0.9985) b[above] = B.PUMPKIN;
      } else if (s === B.SAND && biome === BIOME.DESERT && r < 0.006) {
        b[above] = B.DEAD_BUSH;
      }
    }
    // Şeker kamışı: suyun hemen yanındaki kum/çimen/toprak üstünde 1-3 blok
    for (let z = 1; z < CS - 1; z++) for (let x = 1; x < CS - 1; x++) {
      const h = H[z * 16 + x];
      if (h < SEA || h > SEA + 2 || h >= CH - 4) continue;
      const s = b[bidx(x, h, z)];
      if ((s !== B.GRASS && s !== B.SAND && s !== B.DIRT) || b[bidx(x, h + 1, z)] !== 0) continue;
      if (!DIR4.some(([dx, dz]) => isWater(b[bidx(x + dx, h, z + dz)]))) continue;
      const r = hash2(bx + x, bz + z, seed + 91);
      if (r > 0.16) continue;
      const n = 1 + Math.floor(hash2(bx + x, bz + z, seed + 92) * 3);
      for (let k = 1; k <= n && !b[bidx(x, h + k, z)]; k++) b[bidx(x, h + k, z)] = B.SUGAR_CANE;
    }

    // Düzeltmeler: altı boş kum kumtaşı olur (Minecraft gibi, mağara tavanından kum yağmasın);
    // desteksiz kalan çiçek/ot kaldırılır
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) for (let y = 1; y <= maxY + 1 && y < CH; y++) {
      const i = bidx(x, y, z), id = b[i];
      if (!id) continue;
      const below = b[bidx(x, y - 1, z)];
      if (id === B.SAND && below === 0 && b[bidx(x, y + 1, z)] !== B.CACTUS) b[i] = B.SANDSTONE;
      else if ((id === B.POPPY || id === B.DANDELION || id === B.BLUE_FLOWER || id === B.TALL_GRASS || id === B.DEAD_BUSH) && below !== B.GRASS && below !== B.SAND && below !== B.DIRT) b[i] = 0;
    }
    // Yıkık Nether geçidi (obsidyen kaynağı): 24x24 parçalık bölge başına en çok bir tane (~384 blok),
    // köyde ve dik yamaçta oluşmaz, altı temelle doldurulur
    const RG = 24, rx = Math.floor(cx / RG), rz = Math.floor(cz / RG);
    const pcx = rx * RG + Math.floor(hash2(rx, rz, seed + 504) * RG), pcz = rz * RG + Math.floor(hash2(rz, rx, seed + 505) * RG);
    const cols = [4, 5, 6, 7].map((x) => H[8 * 16 + x]);
    if (cx === pcx && cz === pcz && hash2(rx, rz, seed + 500) < 0.6 && Math.max(...cols) - Math.min(...cols) <= 3 &&
      !vills.some((v) => bx + 16 > v.x0 - 8 && bx < v.x1 + 8 && bz + 16 > v.z0 - 8 && bz < v.z1 + 8)) {
      const h = Math.max(...cols);
      if (h > SEA && h < CH - 10) {
        for (let x = 4; x <= 7; x++) for (let y = H[8 * 16 + x] + 1; y <= h; y++) b[bidx(x, y, 8)] = B.NETHERRACK;
        for (let y = h + 1; y <= h + 5; y++) for (let x = 4; x <= 7; x++) {
          const frame = x === 4 || x === 7 || y === h + 1 || y === h + 5;
          const i = bidx(x, y, 8);
          if (!frame) { b[i] = 0; continue; }
          const r = hash3(x, y, cx * 31 + cz, seed + 501);
          b[i] = r < 0.3 ? 0 : r < 0.48 ? B.CRYING_OBSIDIAN : B.OBSIDIAN;
        }
        for (let k = 0; k < 10; k++) {
          const x = 2 + Math.floor(hash2(k, cx, seed + 502) * 8), z = 5 + Math.floor(hash2(k, cz, seed + 503) * 7);
          const hh = H[z * 16 + x];
          b[bidx(x, hh, z)] = k % 3 ? B.NETHERRACK : B.MAGMA;
          if (RENDER[b[bidx(x, hh + 1, z)]] === R_CROSS) b[bidx(x, hh + 1, z)] = 0;
        }
        maxY = Math.max(maxY, h + 5);
      }
    }
    return this.applyVillages(c, maxY);
  }

  netherBiome(wx, wz) {
    const n = this.nBiome.noise2D(wx * 0.006, wz * 0.006), m = this.nTemp.noise2D(wx * 0.005 + 99, wz * 0.005);
    if (n > 0.35) return 1;          // kızıl orman
    if (n < -0.35) return 2;         // çarpık orman
    if (m > 0.4) return 3;           // ruh kumu vadisi
    return 0;                        // Nether çorak toprakları
  }

  genNether(c) {
    const b = c.blocks, seed = this.seed, bx = c.cx * CS, bz = c.cz * CS;
    const dens = new Float32Array(33);
    const BI = new Uint8Array(256);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z;
      BI[z * 16 + x] = this.netherBiome(wx, wz);
      for (let k = 0; k <= 32; k++) {
        const y = k * 4;
        let d = this.nCaveA.noise3D(wx * 0.021, y * 0.042, wz * 0.021) + this.nCaveB.noise3D(wx * 0.06, y * 0.1, wz * 0.06) * 0.35;
        if (y < 38) d += (38 - y) / 38 * 1.1;
        if (y > 94) d += (y - 94) / 30 * 1.3;
        dens[k] = d;
      }
      for (let y = 0; y < CH; y++) {
        let id;
        if (y === 0 || y === CH - 1 || (y < 5 && hash3(wx, y, wz, seed) < (5 - y) * 0.22) || (y > CH - 6 && hash3(wx, y, wz, seed) < (y - CH + 6) * 0.22)) id = B.BEDROCK;
        else {
          const k = y >> 2, t = (y & 3) / 4;
          const d = dens[k] + (dens[Math.min(32, k + 1)] - dens[k]) * t;
          if (d > 0.18) {
            id = B.NETHERRACK;
            const r = hash3(wx, y, wz, seed + 31);
            if (r < 0.012) id = B.QUARTZ_ORE;
            else if (r < 0.018) id = B.NETHER_GOLD_ORE;
            else if (r < 0.0192 && y >= 8 && y <= 22) id = B.ANCIENT_DEBRIS;
            else if (y < 12 && r < 0.4) id = B.BLACKSTONE;
          } else id = y <= 31 ? B.LAVA : 0;
        }
        b[bidx(x, y, z)] = id;
      }
    }
    // Yüzeyler, magma, ışıktaşı, bitkiler
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z, bio = BI[z * 16 + x];
      for (let y = CH - 3; y > 1; y--) {
        const i = bidx(x, y, z), id = b[i];
        if (id !== B.NETHERRACK) continue;
        const above = b[i + 256], below = b[i - 256];
        if (above === B.LAVA && hash3(wx, y, wz, seed + 40) < 0.35) { b[i] = B.MAGMA; continue; }
        if (above === 0) {
          if (bio === 1) b[i] = B.CRIMSON_NYLIUM;
          else if (bio === 2) b[i] = B.WARPED_NYLIUM;
          else if (bio === 3 || (y <= 35 && this.nHill.noise2D(wx * 0.05, wz * 0.05) > 0.2)) {
            b[i] = hash2(wx, wz, seed + 41) < 0.6 ? B.SOUL_SAND : B.SOUL_SOIL;
            if (b[i - 256] === B.NETHERRACK) b[i - 256] = B.SOUL_SOIL;
          }
          const r = hash3(wx, y, wz, seed + 42);
          if ((bio === 1 || bio === 2) && y < CH - 12) {
            const inner = x >= 3 && x <= 12 && z >= 3 && z <= 12;
            if (inner && r < 0.018) this.hugeFungus(b, x, y + 1, z, bio === 1, wx, wz);
            else if (r < 0.1) b[i + 256] = bio === 1 ? B.CRIMSON_FUNGUS : B.WARPED_FUNGUS;
          }
        } else if (below === 0 && y > 60 && hash3(wx, y, wz, seed + 43) < 0.01) {
          // Tavandan sarkan ışıktaşı
          for (let k = 1; k <= 4; k++) {
            if (y - k < 2) break;
            const j = bidx(x, y - k, z);
            if (b[j] === 0 && hash3(wx, y - k, wz, seed + 44) < 0.85) b[j] = B.GLOWSTONE; else break;
          }
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx > 15 || nz > 15) continue;
            const j = bidx(nx, y - 1, nz);
            if (b[j] === 0 && hash3(nx, y, nz, seed + 45) < 0.6) b[j] = B.GLOWSTONE;
          }
        }
      }
    }
    return CH - 1;
  }

  hugeFungus(b, x, y, z, crimson, wx, wz) {
    const h = 4 + Math.floor(hash2(wx, wz, this.seed + 46) * 4);
    const stem = crimson ? B.CRIMSON_STEM : B.WARPED_STEM, wart = crimson ? B.NETHER_WART_BLOCK : B.WARPED_WART_BLOCK;
    const set = (xx, yy, zz, id) => { if (xx >= 0 && zz >= 0 && xx < 16 && zz < 16 && yy < CH - 1) { const i = bidx(xx, yy, zz); if (b[i] === 0 || b[i] === B.CRIMSON_FUNGUS || b[i] === B.WARPED_FUNGUS) b[i] = id; } };
    for (let k = -2; k <= 0; k++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const r = k === 0 ? 1 : 2;
      if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      const edge = Math.abs(dx) === r || Math.abs(dz) === r || k === 0;
      if (!edge && k < 0) continue;
      set(x + dx, y + h + k, z + dz, hash3(x + dx, y + h + k, z + dz, this.seed + 47) < 0.08 ? B.SHROOMLIGHT : wart);
    }
    for (let k = 0; k < h; k++) set(x, y + k, z, stem);
  }

  genEnd(c) {
    const b = c.blocks, seed = this.seed, bx = c.cx * CS, bz = c.cz * CS;
    let maxY = 0;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = bx + x, wz = bz + z;
      const d = Math.hypot(wx, wz);
      let top = -1, bot = 0;
      if (d < 96) {
        const n = this.nHill.noise2D(wx * 0.03, wz * 0.03), f = d / 96;
        top = Math.floor(60 + n * 3 - f * f * 8);
        bot = Math.floor(60 - (1 - f * f) * (30 + n * 8));
      } else if (d > 200) {
        const n = this.nCont.fbm2(wx * 0.012, wz * 0.012, 3);
        if (n > 0.3) { top = Math.floor(56 + (n - 0.3) * 24); bot = Math.floor(top - (n - 0.3) * 80); }
      }
      for (let y = Math.max(1, bot); y <= top; y++) b[bidx(x, y, z)] = B.END_STONE;
      if (top > maxY) maxY = top;
      for (const P of this.pillars) {
        if (Math.hypot(wx - P.x, wz - P.z) <= P.r + 0.5) {
          for (let y = 40; y <= P.h; y++) b[bidx(x, y, z)] = B.OBSIDIAN;
          if (wx === P.x && wz === P.z) b[bidx(x, P.h + 1, z)] = B.BEDROCK;
          if (P.h + 1 > maxY) maxY = P.h + 1;
        }
      }
      // Çıkış geçidi (merkez)
      const dd = Math.hypot(wx, wz);
      if (dd <= 3.6) {
        const ty = 61;
        for (let y = ty + 1; y < ty + 7; y++) b[bidx(x, y, z)] = 0;
        b[bidx(x, ty - 1, z)] = B.BEDROCK;
        // Geçit ejderha ölünce açılır; yumurta ölümde yerleştirilir
        b[bidx(x, ty, z)] = dd > 2.6 ? B.BEDROCK : this.dragonKilled ? B.END_PORTAL : 0;
        if (wx === 0 && wz === 0) for (let y = ty; y <= ty + 3; y++) b[bidx(x, y, z)] = B.BEDROCK;
        maxY = Math.max(maxY, ty + 4);
      }
      // Koro bitkileri (dış adalar)
      if (d > 200 && top > 0 && x >= 2 && x <= 13 && z >= 2 && z <= 13 && hash2(wx, wz, seed + 60) < 0.012) {
        const h = 3 + Math.floor(hash2(wx, wz, seed + 61) * 5);
        for (let k = 1; k <= h; k++) b[bidx(x, top + k, z)] = B.CHORUS_PLANT;
        b[bidx(x, top + h + 1, z)] = B.CHORUS_FLOWER;
        const bxo = hash2(wx, wz, seed + 62) < 0.5 ? 1 : -1, by = top + 2 + Math.floor(h / 2);
        b[bidx(x + bxo, by, z)] = B.CHORUS_PLANT; b[bidx(x + bxo, by + 1, z)] = B.CHORUS_FLOWER;
        maxY = Math.max(maxY, top + h + 1);
      }
    }
    return maxY;
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
