'use strict';
// ---------------------------------------------------------------------------
// Köyler: yollar, kuyu, evler, demirci, kütüphane, tarlalar, sokak lambaları;
// meslekli köylüler ve zümrütle ticaret (Minecraft'taki gibi stok ve yenilenme).
// Köy planı bölge (320x320 blok) başına tohumdan hesaplanır ve parça üretilirken uygulanır.
// ---------------------------------------------------------------------------

const VILLAGE_REGION = 320;

const PROFESSIONS = {
  farmer: { name: 'Çiftçi', robe: K(128, 92, 52), hat: K(205, 175, 95) },
  shepherd: { name: 'Çoban', robe: K(150, 110, 80), hat: K(240, 240, 235) },
  fletcher: { name: 'Okçu', robe: K(110, 130, 80) },
  butcher: { name: 'Kasap', robe: K(236, 236, 236), apron: K(200, 60, 50) },
  cleric: { name: 'Rahip', robe: K(120, 60, 140) },
  librarian: { name: 'Kütüphaneci', robe: K(225, 222, 210), hat: K(140, 40, 40) },
  armorer: { name: 'Zırhçı', robe: K(70, 70, 76) },
  toolsmith: { name: 'Alet Ustası', robe: K(105, 80, 55), apron: K(60, 60, 64) },
};

// Ticaretler: [verilen, (ikinci verilen), alınan], max kullanım
function villagerTrades(prof) {
  const E = I.EMERALD, t = (cost, out, cost2, max = 12) => ({ cost, cost2: cost2 || null, out, max });
  switch (prof) {
    case 'farmer': return [t([I.WHEAT, 20], [E, 1]), t([B.PUMPKIN, 6], [E, 1]), t([E, 1], [I.BREAD, 6]), t([E, 1], [I.APPLE, 4]), t([E, 3], [I.GOLDEN_APPLE, 1], [I.APPLE, 1], 4), t([E, 1], [I.WHEAT_SEEDS, 12])];
    case 'shepherd': return [t([B.WOOL_WHITE, 18], [E, 1]), t([E, 1], [B.WOOL_RED, 1]), t([E, 1], [B.WOOL_BLUE, 1]), t([E, 1], [B.WOOL_YELLOW, 1]), t([E, 2], [I.BED, 1])];
    case 'fletcher': return [t([I.STICK, 32], [E, 1]), t([I.STRING, 14], [E, 1]), t([E, 1], [I.ARROW, 16]), t([E, 2], [I.BOW, 1]), t([I.FEATHER, 24], [E, 1])];
    case 'butcher': return [t([I.CHICKEN, 14], [E, 1]), t([I.PORKCHOP, 7], [E, 1]), t([I.BEEF, 10], [E, 1]), t([E, 1], [I.COOKED_PORKCHOP, 5]), t([E, 1], [I.STEAK, 4])];
    case 'cleric': return [t([I.ROTTEN_FLESH, 32], [E, 1]), t([E, 1], [I.REDSTONE_DUST, 2]), t([E, 1], [I.LAPIS, 2]), t([E, 4], [B.GLOWSTONE, 1]), t([E, 5], [I.ENDER_PEARL, 1], null, 6), t([I.GOLD_INGOT, 3], [E, 1])];
    case 'librarian': return [t([E, 3], [B.BOOKSHELF, 1]), t([E, 1], [B.GLASS, 4]), t([E, 1], [B.TORCH, 8]), t([B.WOOL_WHITE, 4], [E, 1]), t([E, 5], [B.END_ROD, 4], null, 6)];
    case 'armorer': return [t([I.COAL, 15], [E, 1]), t([I.IRON_INGOT, 4], [E, 1]), t([E, 5], [I.IRON_HELMET, 1]), t([E, 9], [I.IRON_CHESTPLATE, 1]), t([E, 7], [I.IRON_LEGGINGS, 1]), t([E, 4], [I.IRON_BOOTS, 1]), t([E, 21], [I.DIAMOND_CHESTPLATE, 1], null, 3)];
    case 'toolsmith': return [t([I.COAL, 15], [E, 1]), t([E, 1], [I.STONE_PICKAXE, 1]), t([E, 1], [I.STONE_AXE, 1]), t([E, 3], [I.IRON_PICKAXE, 1]), t([E, 2], [I.IRON_SHOVEL, 1]), t([E, 17], [I.DIAMOND_PICKAXE, 1], null, 3), t([I.FLINT, 30], [E, 1])];
  }
  return [];
}

// --- Köylü modelleri (meslek başına renk) -------------------------------------
const VILLAGER_FACE = drawRows(['', '', '', 'dddddddd', '.wg..gw.', '', '', '', '', ''], { d: K(70, 45, 30), w: K(250, 250, 250), g: K(40, 140, 60) });
for (const key in PROFESSIONS) {
  const P = PROFESSIONS[key], skin = { c: K(190, 140, 110) }, robe = { c: P.robe, n: 0.06 };
  const parts = [
    part([-4, 24, -4, 4, 34, 4], HEAD(skin, VILLAGER_FACE), 'head', [0, 24, 0]),
    part([-1, 23, -6, 1, 27, -4], skin, 'head', [0, 24, 0]),
    part([-4, 12, -3, 4, 24, 3], P.apron ? Object.assign({}, robe, { faces: { front: (s, w, h) => { for (let y = 2; y < h; y++) for (let x = 1; x < w - 1; x++) s(x, y, P.apron); } } }) : robe),
    part([-4.3, 3, -3.3, 4.3, 12, 3.3], Object.assign({}, robe, { c: robe.c.map((v) => v * 0.9) })),
    part([-6, 15, -6, 6, 19, -2], skin),
    part([-6, 17, -5, -4, 23, -1], robe), part([4, 17, -5, 6, 23, -1], robe),
    part([-4, 0, -2, 0, 4, 2], { c: K(60, 50, 45) }, 'legA', [-2, 4, 0]),
    part([0, 0, -2, 4, 4, 2], { c: K(60, 50, 45) }, 'legB', [2, 4, 0]),
  ];
  if (P.hat) parts.push(part([-5, 33, -5, 5, 35, 5], { c: P.hat }, 'head', [0, 24, 0]));
  MOB_TYPES['vil_' + key] = { name: P.name, hw: 0.3, h: 1.95, health: 20, speed: 0.8, hostile: false, villager: key, sound: 'villager', parts };
}

// --- Köy planı ------------------------------------------------------------------
World.prototype.villageAt = function (rx, rz) {
  if (this.dim !== 'overworld') return null;
  if (!this.villageCache) this.villageCache = new Map();
  const key = rx + ',' + rz;
  if (this.villageCache.has(key)) return this.villageCache.get(key);
  let plan = null;
  const seed = this.seed;
  if (hash2(rx, rz, seed + 900) < 0.55) {
    const R = VILLAGE_REGION;
    const cx = rx * R + 64 + Math.floor(hash2(rx, rz, seed + 901) * (R - 128));
    const cz = rz * R + 64 + Math.floor(hash2(rx, rz, seed + 902) * (R - 128));
    const h = this.column(cx, cz), biome = this._b;
    if (h > SEA + 1 && h < SEA + 26 && (biome === BIOME.PLAINS || biome === BIOME.DESERT || biome === BIOME.SNOW)) plan = buildVillagePlan(this, key, cx, cz, h, biome, mulberry32(hashStr(key) ^ seed));
  }
  this.villageCache.set(key, plan);
  return plan;
};

// (wx, wz) çevresindeki köyler
World.prototype.villagesNear = function (wx, wz, margin = 0) {
  if (this.dim !== 'overworld') return [];
  const R = VILLAGE_REGION, rx = Math.floor(wx / R), rz = Math.floor(wz / R), out = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const v = this.villageAt(rx + dx, rz + dz);
    if (v && wx >= v.x0 - margin && wx <= v.x1 + margin && wz >= v.z0 - margin && wz <= v.z1 + margin) out.push(v);
  }
  return out;
};

// Parça üretilirken köy bloklarını yerleştir
World.prototype.applyVillages = function (c, maxY) {
  const bx = c.cx * CS, bz = c.cz * CS, b = c.blocks, k = ckey(c.cx, c.cz);
  for (const v of this.villagesNear(bx + 8, bz + 8, 16)) {
    const list = v.byChunk.get(k);
    if (!list) continue;
    for (let i = 0; i < list.length; i += 4) {
      const x = list[i] - bx, y = list[i + 1], z = list[i + 2] - bz;
      if (y < 1 || y >= CH) continue;
      b[bidx(x, y, z)] = list[i + 3];
      if (list[i + 3] && y > maxY) maxY = y;
    }
  }
  return maxY;
};

World.prototype.villageChestAt = function (x, y, z) {
  for (const v of this.villagesNear(x, z)) for (const ch of v.chests) if (ch[0] === x && ch[1] === y && ch[2] === z) return { v, loot: ch[3] };
  return null;
};

function buildVillagePlan(world, key, cx, cz, cy, biome, rng) {
  const desert = biome === BIOME.DESERT, snow = biome === BIOME.SNOW;
  const S = desert
    ? { wall: B.SANDSTONE, corner: B.SANDSTONE, floor: B.SANDSTONE, found: B.SANDSTONE, roof: null }
    : snow ? { wall: B.SPRUCE_PLANKS, corner: B.SPRUCE_LOG, floor: B.COBBLE, found: B.COBBLE, roof: B.STAIRS, ridge: B.SPRUCE_PLANKS }
      : { wall: B.PLANKS, corner: B.LOG, floor: B.COBBLE, found: B.COBBLE, roof: B.STAIRS, ridge: B.PLANKS };
  const blocks = new Map(), chests = [], residents = [], boxes = [];
  const set = (x, y, z, id) => blocks.set(x + ',' + y + ',' + z, id);
  const ground = (x, z) => world.column(x, z);
  const dirIdx = (dx, dz) => DIR4.findIndex(([a, b]) => a === dx && b === dz);

  // Meydan ve kuyu
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, z = cz + dz, h = ground(x, z);
    for (let y = Math.min(h, cy) + 1; y < cy; y++) set(x, y, z, B.DIRT);
    set(x, cy, z, B.DIRT_PATH);
    for (let y = cy + 1; y <= Math.max(h, cy) + 3; y++) set(x, y, z, 0);
  }
  for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 2; dx++) {
    const x = cx + dx, z = cz + dz, ring = dx === -1 || dx === 2 || dz === -1 || dz === 2;
    for (let y = cy - 4; y <= cy; y++) set(x, y, z, ring || y === cy - 4 ? B.COBBLE : B.WATER);
    if (ring) set(x, cy + 1, z, B.COBBLE);
    if ((dx === -1 || dx === 2) && (dz === -1 || dz === 2)) { set(x, cy + 2, z, B.FENCE); set(x, cy + 3, z, B.FENCE); }
    set(x, cy + 4, z, desert ? B.SANDSTONE : B.SLAB + 1);
  }
  boxes.push([cx - 5, cz - 5, cx + 6, cz + 6]);

  // Yollar ve binalar
  const kinds = ['blacksmith', 'library', 'farm', 'house', 'house', 'farm', 'house', 'house', 'house', 'farm', 'house', 'house'];
  let kindI = 0;
  const overlaps = (x0, z0, x1, z1) => boxes.some((b) => x0 <= b[2] && x1 >= b[0] && z0 <= b[3] && z1 >= b[1]);
  for (let d = 0; d < 4; d++) {
    const [rdx, rdz] = DIR4[d], [pdx, pdz] = DIR4[(d + 1) & 3];
    const len = 22 + Math.floor(rng() * 14);
    for (let t = 5; t <= len; t++) for (let w = -1; w <= 1; w++) {
      const x = cx + rdx * t + pdx * w, z = cz + rdz * t + pdz * w, h = ground(x, z);
      if (h <= SEA) continue;
      set(x, h, z, B.DIRT_PATH);
      for (let y = h + 1; y <= h + 3; y++) set(x, y, z, 0);
    }
    // Sokak lambası
    for (let t = 9; t <= len; t += 12) {
      const x = cx + rdx * t + pdx * 2, z = cz + rdz * t + pdz * 2, h = ground(x, z);
      if (h <= SEA) continue;
      set(x, h + 1, z, B.FENCE); set(x, h + 2, z, B.FENCE); set(x, h + 3, z, B.TORCH);
    }
    let side = rng() < 0.5 ? 1 : -1;
    for (let t = 11; t <= len - 2; t += 10) {
      side = -side;
      const kind = kinds[kindI % kinds.length];
      const W = kind === 'farm' ? 7 : kind === 'blacksmith' ? 7 : 5 + (rng() < 0.5 ? 1 : 0), D = kind === 'farm' ? 8 : 5 + (rng() < 0.4 ? 1 : 0);
      const sn = [pdx * side, pdz * side];
      // Yerel (u: yol boyunca, v: yoldan uzağa) → dünya
      const ox = cx + rdx * t + sn[0] * 3 - rdx * Math.floor(W / 2), oz = cz + rdz * t + sn[1] * 3 - rdz * Math.floor(W / 2);
      const L = (u, v) => [ox + rdx * u + sn[0] * v, oz + rdz * u + sn[1] * v];
      const c0 = L(-1, -1), c1 = L(W, D);
      const bx0 = Math.min(c0[0], c1[0]), bx1 = Math.max(c0[0], c1[0]), bz0 = Math.min(c0[1], c1[1]), bz1 = Math.max(c0[1], c1[1]);
      if (overlaps(bx0, bz0, bx1, bz1)) continue;
      const mid = L(W >> 1, D >> 1), y0 = ground(mid[0], mid[1]);
      let minH = 999, maxH = -999;
      for (const [u, v] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) { const p = L(u, v), hh = ground(p[0], p[1]); minH = Math.min(minH, hh); maxH = Math.max(maxH, hh); }
      if (y0 <= SEA || maxH - minH > 4) continue;
      boxes.push([bx0, bz0, bx1, bz1]);
      kindI++;
      // Zemin: temel doldur, üstünü temizle
      for (let v = -1; v <= D; v++) for (let u = -1; u <= W; u++) {
        const [x, z] = L(u, v), hh = ground(x, z);
        const inside = u >= 0 && u < W && v >= 0 && v < D;
        if (inside) for (let y = Math.min(hh, y0) - 1; y < y0; y++) set(x, y, z, kind === 'farm' ? B.DIRT : S.found);
        for (let y = y0 + 1; y <= Math.max(hh, y0) + 8; y++) set(x, y, z, 0);
        if (!inside) { if (hh < y0) for (let y = hh + 1; y <= y0; y++) set(x, y, z, B.DIRT); set(x, y0, z, desert ? B.SAND : snow ? B.SNOWY_GRASS : B.GRASS); }
      }
      // Kapıya giden yol
      for (let v = -2; v <= -1; v++) { const [x, z] = L(W >> 1, v); set(x, ground(x, z) <= y0 ? y0 : ground(x, z), z, B.DIRT_PATH); }
      if (kind === 'farm') {
        for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
          const [x, z] = L(u, v), edge = u === 0 || u === W - 1 || v === 0 || v === D - 1;
          if (edge) set(x, y0, z, snow ? B.SPRUCE_LOG : B.LOG);
          else if (u === W >> 1) set(x, y0, z, B.WATER);
          else { set(x, y0, z, B.FARMLAND_WET); set(x, y0 + 1, z, B.WHEAT_0 + 3 + Math.floor(rng() * 5)); }
        }
        const hp = L(-1, D - 1); set(hp[0], y0 + 1, hp[1], B.HAY);
        if (rng() < 0.6) { const hp2 = L(-1, D - 2); set(hp2[0], y0 + 1, hp2[1], B.HAY); }
        continue;
      }
      const wall = kind === 'blacksmith' ? (desert ? B.SANDSTONE : B.COBBLE) : S.wall;
      const corner = kind === 'blacksmith' ? (desert ? B.SANDSTONE : B.COBBLE) : S.corner;
      const H = 3;
      for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
        const [x, z] = L(u, v);
        set(x, y0, z, kind === 'library' ? S.wall : S.floor);
        const edgeU = u === 0 || u === W - 1, edgeV = v === 0 || v === D - 1;
        if (!edgeU && !edgeV) continue;
        for (let y = y0 + 1; y <= y0 + H; y++) {
          let id = edgeU && edgeV ? corner : wall;
          if (y === y0 + 2 && !(edgeU && edgeV) && ((edgeV && (u === 1 || u === W - 2)) || (edgeU && v === (D >> 1)))) id = B.GLASS_PANE;
          set(x, y, z, id);
        }
      }
      // Kapı
      const df = dirIdx(sn[0], sn[1]), dp = L(W >> 1, 0);
      set(dp[0], y0 + 1, dp[1], B.DOOR + df); set(dp[0], y0 + 2, dp[1], B.DOOR + 8 + df);
      // Çatı
      if (!S.roof) {
        for (let v = -1; v <= D; v++) for (let u = -1; u <= W; u++) { const [x, z] = L(u, v); set(x, y0 + H + 1, z, (u === -1 || u === W || v === -1 || v === D) ? B.SLAB + 2 : S.wall); }
      } else {
        const back = dirIdx(sn[0], sn[1]), front = dirIdx(-sn[0], -sn[1]);
        const half = D / 2;
        for (let v = -1; v <= D; v++) {
          const k = v < half - 0.5 ? v + 1 : D - v; // eğim basamağı
          for (let u = -1; u <= W; u++) {
            const [x, z] = L(u, v), y = y0 + H + 1 + Math.max(0, k);
            if (D % 2 === 1 && v === (D >> 1)) set(x, y, z, S.ridge);
            else set(x, y, z, S.roof + (v < half ? back : front));
            // Alınlık duvarı
            if ((u === 0 || u === W - 1) && v >= 0 && v < D) for (let yy = y0 + H + 1; yy < y; yy++) set(x, yy, z, S.wall);
          }
        }
      }
      // İç eşyalar
      const ins = (u, v, y, id) => { const [x, z] = L(u, v); set(x, y0 + y, z, id); return [x, y0 + y, z]; };
      ins(1, D - 2, 1, B.BED_FOOT); ins(1, D - 3 > 0 ? D - 3 : 1, 1, B.BED_HEAD);
      ins(W - 2, 1, 1, B.TORCH);
      let prof;
      if (kind === 'blacksmith') {
        ins(W - 2, D - 2, 1, B.FURNACE); ins(W - 3, D - 2, 1, B.FURNACE);
        chests.push(ins(W - 2, D - 3, 1, B.CHEST).concat(['blacksmith']));
        prof = rng() < 0.5 ? 'armorer' : 'toolsmith';
      } else if (kind === 'library') {
        for (let u = 1; u < W - 1; u++) { ins(u, D - 2, 1, B.BOOKSHELF); ins(u, D - 2, 2, B.BOOKSHELF); }
        ins(1, D - 2, 1, B.BED_FOOT);
        prof = 'librarian';
      } else {
        ins(W - 2, D - 2, 1, B.CRAFTING);
        if (rng() < 0.35) chests.push(ins(W - 2, D - 3, 1, B.CHEST).concat(['house']));
        prof = ['farmer', 'shepherd', 'fletcher', 'butcher', 'cleric', 'farmer'][Math.floor(rng() * 6)];
      }
      const home = L(W >> 1, D >> 1);
      residents.push({ prof, pos: [home[0] + 0.5, y0 + 1, home[1] + 0.5] });
    }
  }
  // Bloklar parça başına gruplanır
  const byChunk = new Map();
  let x0 = cx, x1 = cx, z0 = cz, z1 = cz;
  for (const [k, id] of blocks) {
    const [x, y, z] = k.split(',').map(Number);
    const ck = ckey(x >> 4, z >> 4);
    let l = byChunk.get(ck); if (!l) byChunk.set(ck, l = []);
    l.push(x, y, z, id);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { key, cx, cz, cy, x0, x1, z0, z1, byChunk, chests, residents, desert };
}

// Köy sandığı ganimeti
function villageLoot(kind, rng) {
  const out = [], add = (id, a, b, p = 1) => { if (rng() < p) out.push({ id, count: a + Math.floor(rng() * (b - a + 1)) }); };
  if (kind === 'blacksmith') {
    add(I.IRON_INGOT, 1, 5); add(I.BREAD, 1, 3, 0.7); add(I.APPLE, 1, 3, 0.6); add(B.OBSIDIAN, 1, 4, 0.4);
    add(I.IRON_PICKAXE, 1, 1, 0.3); add(I.IRON_SWORD, 1, 1, 0.3); add(I.IRON_CHESTPLATE, 1, 1, 0.15); add(I.DIAMOND, 1, 3, 0.15);
    add(B.OAK_SAPLING, 3, 7, 0.5); add(I.GOLD_INGOT, 1, 3, 0.4);
  } else {
    add(I.BREAD, 1, 4); add(I.WHEAT, 2, 8, 0.6); add(I.APPLE, 1, 4, 0.5); add(I.EMERALD, 1, 3, 0.35); add(B.TORCH, 2, 6, 0.4); add(I.WHEAT_SEEDS, 3, 10, 0.5);
  }
  return out;
}
