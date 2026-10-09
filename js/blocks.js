'use strict';
// ---------------------------------------------------------------------------
// Blok tanımları + tamamen kodla üretilen 16x16 piksel-art dokular
// ---------------------------------------------------------------------------

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANKS: 5, LOG: 6, LEAVES: 7, SAND: 8, WATER: 9,
  GLASS: 10, BEDROCK: 11, COAL: 12, IRON: 13, GOLD: 14, DIAMOND: 15, REDSTONE: 16, BRICKS: 17,
  SNOW: 18, SNOWY_GRASS: 19, GRAVEL: 20, GLOWSTONE: 21, BIRCH_LOG: 22, BIRCH_LEAVES: 23,
  SPRUCE_LOG: 24, SPRUCE_LEAVES: 25, CACTUS: 26, STONE_BRICKS: 27, BOOKSHELF: 28, CRAFTING: 29,
  FURNACE: 30, TNT: 31, OBSIDIAN: 32, PUMPKIN: 33, JACK: 34, LAVA: 35, ICE: 36, POPPY: 37,
  DANDELION: 38, TALL_GRASS: 39, TORCH: 40, WOOL_WHITE: 41, WOOL_RED: 42, WOOL_ORANGE: 43,
  WOOL_YELLOW: 44, WOOL_LIME: 45, WOOL_BLUE: 46, WOOL_PURPLE: 47, WOOL_BLACK: 48, SANDSTONE: 49,
  DEAD_BUSH: 50, MOSSY_COBBLE: 51, BIRCH_PLANKS: 52, SPRUCE_PLANKS: 53, EMERALD: 54, BLUE_FLOWER: 55,
  NETHERRACK: 56, SOUL_SAND: 57, SOUL_SOIL: 58, QUARTZ_ORE: 59, NETHER_GOLD_ORE: 60, ANCIENT_DEBRIS: 61,
  MAGMA: 62, NETHER_BRICKS: 63, BASALT: 64, BLACKSTONE: 65, CRIMSON_NYLIUM: 66, WARPED_NYLIUM: 67,
  CRIMSON_STEM: 68, WARPED_STEM: 69, NETHER_WART_BLOCK: 70, WARPED_WART_BLOCK: 71, SHROOMLIGHT: 72,
  CRIMSON_FUNGUS: 73, WARPED_FUNGUS: 74, CRIMSON_PLANKS: 75, WARPED_PLANKS: 76, NETHER_PORTAL: 77,
  NETHERITE_BLOCK: 78, QUARTZ_BLOCK: 79, END_STONE: 80, END_STONE_BRICKS: 81, PURPUR: 82, PURPUR_PILLAR: 83,
  END_FRAME: 84, END_FRAME_EYE: 85, END_PORTAL: 86, DRAGON_EGG: 87, CHORUS_PLANT: 88, CHORUS_FLOWER: 89,
  CRYING_OBSIDIAN: 90, IRON_BLOCK: 91, GOLD_BLOCK: 92, DIAMOND_BLOCK: 93, EMERALD_BLOCK: 94, COAL_BLOCK: 95,
  REDSTONE_BLOCK: 96, LAPIS_ORE: 97, LAPIS_BLOCK: 98, CHEST: 99, END_ROD: 100,
  FARMLAND: 101, FARMLAND_WET: 102, WHEAT_0: 103, WHEAT_7: 110, OAK_SAPLING: 111, BIRCH_SAPLING: 112,
  SPRUCE_SAPLING: 113, BED_FOOT: 114, BED_HEAD: 115,
  WATER_1: 116, WATER_FALL: 123, LAVA_1: 124, LAVA_FALL: 131,
  SLAB: 132, SLAB_TOP: 137, STAIRS: 142, DOOR: 158, TRAPDOOR: 174, TRAPDOOR_OPEN: 175,
  FENCE: 179, GATE: 180, GLASS_PANE: 184, LADDER: 185,
};
// Sıvılar: kaynak (seviye 0), akan 1-7, düşen (8)
const isWater = (id) => id === B.WATER || (id >= B.WATER_1 && id <= B.WATER_FALL);
const isLava = (id) => id === B.LAVA || (id >= B.LAVA_1 && id <= B.LAVA_FALL);
const isLiquid = (id) => isWater(id) || isLava(id);
const isSource = (id) => id === B.WATER || id === B.LAVA;
const liquidLevel = (id) => (isSource(id) ? 0 : id === B.WATER_FALL || id === B.LAVA_FALL ? 8 : isWater(id) ? id - B.WATER_1 + 1 : id - B.LAVA_1 + 1);
const liquidId = (lava, lvl) => (lvl === 0 ? (lava ? B.LAVA : B.WATER) : lvl === 8 ? (lava ? B.LAVA_FALL : B.WATER_FALL) : (lava ? B.LAVA_1 : B.WATER_1) + lvl - 1);
const sameLiquid = (a, b) => (isWater(a) && isWater(b)) || (isLava(a) && isLava(b));
// Şekilli bloklar: yarım blok/basamak malzemeleri
const SLAB_MATS = ['PLANKS', 'COBBLE', 'STONE', 'STONE_BRICKS', 'BRICKS'];
const STAIR_MATS = ['PLANKS', 'COBBLE', 'STONE_BRICKS', 'BRICKS'];
const isDoor = (id) => id >= B.DOOR && id < B.DOOR + 16;
const isLadder = (id) => id >= B.LADDER && id < B.LADDER + 4;
// WHEAT_0..WHEAT_7 ardışık 8 büyüme evresidir
const isWheat = (id) => id >= B.WHEAT_0 && id <= B.WHEAT_7;
const isSapling = (id) => id >= B.OAK_SAPLING && id <= B.SPRUCE_SAPLING;
const isBed = (id) => id === B.BED_FOOT || id === B.BED_HEAD;

// Render tipleri
const R_NONE = 0, R_CUBE = 1, R_CROSS = 2, R_LIQUID = 3, R_SHAPE = 4;

const BLOCKS = [];
const OPAQUE = new Uint8Array(256);   // ışığı keser + komşu yüzleri gizler
const SOLID = new Uint8Array(256);    // çarpışma
const FILTER = new Uint8Array(256);   // ışığı ekstra zayıflatma
const EMIT = new Uint8Array(256);     // ışık yayma (0-15)
const RENDER = new Uint8Array(256);
const PASS = new Uint8Array(256);     // 0: opak/kesik, 1: yarı saydam
const CULLSAME = new Uint8Array(256); // aynı bloğa komşu yüzleri çizme
const TEXF = new Uint8Array(256 * 6); // yüz başına doku katmanı
const HGT = new Uint8Array(256).fill(16); // blok yüksekliği (1/16 birim): yatak, tarla
const SHAPE = new Uint8Array(256);   // şekil türü (shapes.js), 0: yok
const SHAPEF = new Uint8Array(256);  // şekil parametresi: yön (0 -z, 1 +x, 2 +z, 3 -x) ve bayraklar
const FLAT = new Uint8Array(256);    // elde/ikonda düz resim olarak gösterilir
const LIQH = new Uint8Array(256);    // sıvı yüzey yüksekliği (1/16)

// --- Doku üretimi --------------------------------------------------------
const TEX = {};
const texLayers = [];

function px(d, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x > 15 || y > 15) return;
  const i = (y * 16 + x) * 4;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
}
function getPx(d, x, y) { const i = (y * 16 + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
function mulPx(d, x, y, f) {
  if (x < 0 || y < 0 || x > 15 || y > 15) return;
  const i = (y * 16 + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
}
function noiseFill(d, rng, c, v, a = 255) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const f = 1 + (rng() - 0.5) * v;
    px(d, x, y, c[0] * f, c[1] * f, c[2] * f, a);
  }
}
function copyTex(d, name) { d.set(texLayers[TEX[name]]); }

function makeTex(name, fn) {
  const d = new Uint8ClampedArray(16 * 16 * 4);
  const rng = mulberry32(hashStr(name) ^ 0x9e3779b9);
  fn(d, rng);
  // Saydam piksellerin rengini ortalamaya çek (mipmap kenar kararmasını önler)
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < 1024; i += 4) if (d[i + 3] > 0) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  if (n) for (let i = 0; i < 1024; i += 4) if (d[i + 3] === 0) { d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n; }
  TEX[name] = texLayers.length;
  texLayers.push(d);
}

// Minecraft tarzı: sınırlı paletten seçilen, kümelenmiş (2-4 piksellik) gürültü
function clumpNoise(rng) {
  const L = (s) => { const g = []; for (let i = 0; i < (16 / s) * (16 / s); i++) g.push(rng()); return (x, y) => g[Math.floor(y / s) * (16 / s) + Math.floor(x / s)]; };
  const a = L(4), b = L(2), c = L(1);
  const out = new Float32Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out[y * 16 + x] = a(x, y) * 0.25 + b(x, y) * 0.35 + c(x, y) * 0.4;
  return out;
}
function paletteFill(d, rng, pal) {
  const n = clumpNoise(rng);
  for (let i = 0; i < 256; i++) {
    const v = clamp((n[i] - 0.5) * 1.6 + 0.5, 0, 0.999);
    const c = pal[Math.floor(v * pal.length)];
    px(d, i & 15, i >> 4, c[0], c[1], c[2]);
  }
}

function cobbleTex(d, rng, base, mortar) {
  const pts = [];
  for (let i = 0; i < 15; i++) pts.push([rng() * 16, rng() * 16, 0.75 + rng() * 0.45]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const dx = x + 0.5 - pts[i][0] - ox, dy = y + 0.5 - pts[i][1] - oy;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < d1) { d2 = d1; d1 = dd; best = i; } else if (dd < d2) d2 = dd;
      }
    }
    if (d2 - d1 < 0.9) { const f = 0.9 + rng() * 0.15; px(d, x, y, mortar[0] * f, mortar[1] * f, mortar[2] * f); }
    else {
      // Taşların sol üst kenarı açık, sağ alt kenarı koyu (kabartma etkisi)
      const ex = x + 0.5 - pts[best][0], ey = y + 0.5 - pts[best][1];
      const rim = d2 - d1 < 2.2 ? (ex + ey < 0 ? 1.12 : 0.88) : 1;
      const f = (0.8 + pts[best][2] * 0.25) * rim * (0.95 + rng() * 0.1);
      px(d, x, y, base[0] * f, base[1] * f, base[2] * f);
    }
  }
}

function planksTex(d, rng, c) {
  // 4 tahta sırası; her sırada damar çizgileri, koyu alt çizgi ve kaydırılmış ek yeri
  for (let y = 0; y < 16; y++) {
    const row = y >> 2, ly = y & 3, rf = 0.94 + ((row * 37) % 5) * 0.025;
    for (let x = 0; x < 16; x++) {
      let f = rf;
      if (ly === 3) f *= 0.62;
      else if (ly === 0) f *= 1.06;
      const seam = [3, 11, 7, 15][row];
      if (x === seam && ly !== 3) f *= 0.66;
      if (x === (seam + 1) % 16 && ly !== 3) f *= 1.08;
      px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
    // Damarlar
    if ((y & 3) !== 3) for (let k = 0; k < 2; k++) {
      const x0 = Math.floor(rng() * 16), l = 2 + Math.floor(rng() * 5), f = rng() < 0.6 ? 0.88 : 1.07;
      for (let i = 0; i < l; i++) mulPx(d, (x0 + i) & 15, y, f);
    }
  }
}

function logSide(d, rng, c, dark) {
  const cols = [];
  for (let x = 0; x < 16; x++) cols.push(0.82 + rng() * 0.3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let f = cols[x] * (0.92 + rng() * 0.14);
    px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 16), y0 = Math.floor(rng() * 16), len = 2 + Math.floor(rng() * 5);
    for (let y = y0; y < y0 + len; y++) px(d, x, y & 15, dark[0], dark[1], dark[2]);
  }
}

function logTop(d, rng, bark, inner) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (r > 6.6) { const f = 0.85 + rng() * 0.25; px(d, x, y, bark[0] * f, bark[1] * f, bark[2] * f); }
    else {
      const ring = Math.floor(r) % 2 === 0 ? 1 : 0.84;
      const f = ring * (0.94 + rng() * 0.1);
      px(d, x, y, inner[0] * f, inner[1] * f, inner[2] * f);
    }
  }
}

function leavesTex(d, rng, c) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (rng() < 0.16) { px(d, x, y, 0, 0, 0, 0); continue; }
    const f = 0.68 + rng() * 0.5;
    px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
  }
}

function oreTex(d, rng, col, hi, base = 'stone') {
  copyTex(d, base);
  const n = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const cx = 2 + Math.floor(rng() * 12), cy = 2 + Math.floor(rng() * 12);
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    for (const [ox, oy] of pts) {
      if (rng() < 0.75) {
        const h = (ox + oy) <= 0 ? hi : col;
        px(d, cx + ox, cy + oy, h[0], h[1], h[2]);
      }
    }
  }
}

function woolTex(d, rng, c) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let f = 0.93 + rng() * 0.1;
    if (((x + y * 3) % 5) === 0) f *= 0.9;
    if (((x * 2 + y) % 7) === 0) f *= 1.06;
    px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
  }
}

function crossFlower(d, rng, petal, center) {
  for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
  for (let y = 7; y < 16; y++) px(d, 7, y, 50, 120 + y * 3, 30);
  px(d, 6, 11, 60, 140, 35); px(d, 5, 10, 60, 140, 35); px(d, 8, 13, 60, 140, 35); px(d, 9, 12, 60, 140, 35);
  const P = [[6, 4], [7, 4], [8, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [5, 6], [6, 6], [8, 6], [9, 6], [6, 7], [7, 7], [8, 7], [7, 3]];
  for (const [x, y] of P) { const f = 0.85 + rng() * 0.25; px(d, x, y, petal[0] * f, petal[1] * f, petal[2] * f); }
  px(d, 7, 6, center[0], center[1], center[2]);
}

const FONT3x5 = { T: ['111', '010', '010', '010', '010'], N: ['101', '111', '111', '111', '101'] };

function buildTextures() {
  makeTex('stone', (d, r) => {
    paletteFill(d, r, [[112, 112, 112], [120, 120, 120], [126, 126, 126], [126, 126, 126], [133, 133, 133], [141, 141, 141]]);
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), l = 2 + Math.floor(r() * 3), f = r() < 0.55 ? 0.86 : 1.1;
      for (let k = 0; k < l; k++) mulPx(d, (x + k) & 15, y, f);
    }
  });
  makeTex('dirt', (d, r) => {
    paletteFill(d, r, [[94, 66, 44], [115, 81, 55], [128, 91, 63], [128, 91, 63], [142, 102, 70], [160, 117, 82]]);
    for (let i = 0; i < 10; i++) px(d, Math.floor(r() * 16), Math.floor(r() * 16), 150, 140, 130);
  });
  const GRASS = [[78, 124, 46], [89, 140, 52], [98, 152, 57], [98, 152, 57], [108, 164, 63], [120, 176, 72]];
  makeTex('grass_top', (d, r) => paletteFill(d, r, GRASS));
  makeTex('grass_side', (d, r) => {
    copyTex(d, 'dirt');
    // Kenardan sarkan, düzensiz çimen saçağı
    for (let x = 0; x < 16; x++) {
      let depth = 2 + (r() < 0.6 ? 1 : 0) + (r() < 0.35 ? 1 : 0) + (r() < 0.12 ? 2 : 0);
      for (let y = 0; y < depth; y++) { const c = GRASS[Math.floor(r() * GRASS.length)]; px(d, x, y, c[0], c[1], c[2]); }
      mulPx(d, x, depth, 0.8);
    }
  });
  makeTex('snow', (d, r) => noiseFill(d, r, [240, 247, 250], 0.07));
  makeTex('snowy_grass_side', (d, r) => {
    copyTex(d, 'dirt');
    for (let x = 0; x < 16; x++) {
      const depth = 3 + (r() < 0.5 ? 1 : 0);
      for (let y = 0; y < depth; y++) { const f = 0.94 + r() * 0.08; px(d, x, y, 240 * f, 247 * f, 250 * f); }
    }
  });
  makeTex('sand', (d, r) => {
    paletteFill(d, r, [[201, 188, 140], [212, 199, 152], [219, 207, 163], [219, 207, 163], [226, 215, 172], [232, 223, 183]]);
    for (let i = 0; i < 14; i++) mulPx(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? 0.86 : 1.06);
  });
  makeTex('sandstone_side', (d, r) => {
    noiseFill(d, r, [216, 201, 150], 0.08);
    for (let x = 0; x < 16; x++) { mulPx(d, x, 3, 0.86); mulPx(d, x, 4, 0.92); mulPx(d, x, 0, 1.06); mulPx(d, x, 15, 0.85); }
    for (let i = 0; i < 18; i++) mulPx(d, Math.floor(r() * 16), 5 + Math.floor(r() * 10), 0.9);
  });
  makeTex('sandstone_top', (d, r) => noiseFill(d, r, [220, 206, 156], 0.07));
  makeTex('gravel', (d, r) => {
    const cols = [[128, 122, 120], [155, 150, 146], [100, 95, 93], [136, 118, 105], [170, 165, 160]];
    for (let by = 0; by < 16; by += 2) for (let bx = 0; bx < 16; bx += 2) {
      const c = cols[Math.floor(r() * cols.length)];
      for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) {
        const f = 0.9 + r() * 0.15; px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
      }
    }
  });
  makeTex('cobble', (d, r) => cobbleTex(d, r, [142, 142, 142], [78, 78, 78]));
  makeTex('mossy_cobble', (d, r) => {
    copyTex(d, 'cobble');
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 16), f = 0.8 + r() * 0.4;
      px(d, x, y, 70 * f, 120 * f, 45 * f);
    }
  });
  makeTex('stone_bricks', (d, r) => {
    noiseFill(d, r, [122, 122, 122], 0.12);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 3, ly = y & 7;
      const sx = row === 0 ? 15 : 7;
      if (ly === 7 || x === sx) px(d, x, y, 72, 72, 72);
      else if (ly === 0 || x === (sx + 1) % 16) mulPx(d, x, y, 1.12);
    }
  });
  makeTex('bricks', (d, r) => {
    for (let y = 0; y < 16; y++) {
      const row = y >> 2, off = (row % 2) * 4;
      for (let x = 0; x < 16; x++) {
        const isM = (y & 3) === 3 || ((x + off) & 7) === 7;
        if (isM) { const f = 0.9 + r() * 0.15; px(d, x, y, 175 * f, 168 * f, 160 * f); }
        else {
          const bid = row * 3 + (((x + off) >> 3) & 1);
          const bf = 0.85 + ((bid * 53) % 7) * 0.04;
          const f = bf * (0.9 + r() * 0.16);
          px(d, x, y, 152 * f, 72 * f, 56 * f);
        }
      }
    }
  });
  makeTex('planks', (d, r) => planksTex(d, r, [178, 142, 88]));
  makeTex('birch_planks', (d, r) => planksTex(d, r, [196, 178, 123]));
  makeTex('spruce_planks', (d, r) => planksTex(d, r, [115, 85, 49]));
  makeTex('log_side', (d, r) => logSide(d, r, [104, 82, 50], [62, 48, 28]));
  makeTex('log_top', (d, r) => logTop(d, r, [104, 82, 50], [178, 143, 88]));
  makeTex('birch_side', (d, r) => {
    noiseFill(d, r, [216, 215, 205], 0.08);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * 14), y = Math.floor(r() * 16), l = 2 + Math.floor(r() * 3);
      for (let k = 0; k < l; k++) px(d, x + k, y, 45, 45, 40);
    }
  });
  makeTex('birch_top', (d, r) => logTop(d, r, [216, 215, 205], [196, 176, 120]));
  makeTex('spruce_side', (d, r) => logSide(d, r, [62, 44, 25], [38, 26, 14]));
  makeTex('spruce_top', (d, r) => logTop(d, r, [62, 44, 25], [118, 88, 52]));
  makeTex('leaves', (d, r) => leavesTex(d, r, [58, 130, 36]));
  makeTex('birch_leaves', (d, r) => leavesTex(d, r, [100, 150, 64]));
  makeTex('spruce_leaves', (d, r) => leavesTex(d, r, [44, 92, 58]));
  makeTex('water', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = 0.85 + 0.12 * Math.sin((x + y * 2) * 0.8) + r() * 0.08;
      px(d, x, y, 44 * f, 90 * f, 210 * f, 175);
    }
  });
  makeTex('lava', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) * 0.5 + 0.5;
      const f = 0.85 + r() * 0.2;
      px(d, x, y, (200 + w * 55) * f, (70 + w * 110) * f, (10 + w * 30) * f);
    }
  });
  makeTex('glass', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let i = 0; i < 16; i++) {
      px(d, i, 0, 215, 235, 240); px(d, i, 15, 190, 215, 225); px(d, 0, i, 215, 235, 240); px(d, 15, i, 190, 215, 225);
    }
    for (let k = 0; k < 4; k++) px(d, 3 + k, 6 - k, 235, 245, 250, 230);
    for (let k = 0; k < 2; k++) px(d, 3 + k, 8 - k, 235, 245, 250, 230);
    for (let k = 0; k < 3; k++) px(d, 10 + k, 12 - k, 235, 245, 250, 200);
  });
  makeTex('ice', (d, r) => {
    noiseFill(d, r, [150, 190, 250], 0.08, 190);
    for (let k = 0; k < 6; k++) { px(d, 2 + k, 9 - k, 220, 235, 255, 200); px(d, 9 + (k >> 1), 14 - k, 220, 235, 255, 200); }
  });
  makeTex('bedrock', (d, r) => {
    const cols = [[45, 45, 45], [85, 85, 85], [115, 115, 115], [62, 62, 62], [30, 30, 30]];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = cols[Math.floor(r() * cols.length)]; px(d, x, y, c[0], c[1], c[2]); }
  });
  makeTex('coal_ore', (d, r) => oreTex(d, r, [35, 35, 35], [60, 60, 60]));
  makeTex('iron_ore', (d, r) => oreTex(d, r, [210, 170, 140], [235, 205, 180]));
  makeTex('gold_ore', (d, r) => oreTex(d, r, [250, 220, 60], [255, 250, 170]));
  makeTex('diamond_ore', (d, r) => oreTex(d, r, [80, 220, 230], [200, 255, 255]));
  makeTex('redstone_ore', (d, r) => oreTex(d, r, [190, 10, 10], [255, 60, 60]));
  makeTex('emerald_ore', (d, r) => oreTex(d, r, [30, 200, 90], [150, 255, 170]));
  makeTex('glowstone', (d, r) => {
    noiseFill(d, r, [200, 150, 80], 0.25);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * 15), y = Math.floor(r() * 15);
      px(d, x, y, 255, 236, 160); px(d, x + 1, y, 255, 220, 130);
    }
    for (let i = 0; i < 12; i++) px(d, Math.floor(r() * 16), Math.floor(r() * 16), 130, 90, 45);
  });
  makeTex('obsidian', (d, r) => {
    noiseFill(d, r, [22, 16, 34], 0.4);
    for (let i = 0; i < 18; i++) px(d, Math.floor(r() * 16), Math.floor(r() * 16), 65, 45, 100);
  });
  const WOOL = { white: [234, 236, 236], red: [160, 39, 34], orange: [240, 118, 19], yellow: [248, 198, 39], lime: [112, 185, 25], blue: [53, 57, 157], purple: [121, 42, 172], black: [25, 25, 29] };
  for (const k in WOOL) makeTex('wool_' + k, (d, r) => woolTex(d, r, WOOL[k]));
  makeTex('bookshelf', (d, r) => {
    planksTex(d, r, [162, 130, 78]);
    const BC = [[150, 40, 40], [40, 80, 150], [50, 120, 50], [140, 110, 40], [100, 50, 120], [180, 160, 120]];
    for (const y0 of [2, 9]) {
      let x = 1;
      while (x < 15) {
        const w = 1 + (r() < 0.4 ? 1 : 0), c = BC[Math.floor(r() * BC.length)], h = 4 + (r() < 0.5 ? 1 : 0);
        for (let xx = x; xx < Math.min(15, x + w); xx++) for (let y = y0 + 5 - h; y < y0 + 5; y++) {
          const f = 0.85 + r() * 0.2; px(d, xx, y, c[0] * f, c[1] * f, c[2] * f);
        }
        for (let y = y0; y < y0 + 5 - h; y++) for (let xx = x; xx < Math.min(15, x + w); xx++) px(d, xx, y, 50, 36, 20);
        x += w + (r() < 0.2 ? 1 : 0);
      }
    }
  });
  makeTex('crafting_top', (d, r) => {
    planksTex(d, r, [168, 128, 76]);
    for (let i = 0; i < 16; i++) { px(d, i, 0, 90, 64, 34); px(d, i, 15, 90, 64, 34); px(d, 0, i, 90, 64, 34); px(d, 15, i, 90, 64, 34); }
    for (let i = 2; i < 14; i++) { px(d, i, 5, 110, 80, 45); px(d, i, 10, 110, 80, 45); px(d, 5, i, 110, 80, 45); px(d, 10, i, 110, 80, 45); }
  });
  makeTex('crafting_side', (d, r) => {
    planksTex(d, r, [150, 112, 66]);
    for (let x = 0; x < 16; x++) { px(d, x, 0, 100, 72, 40); px(d, x, 1, 120, 88, 50); }
    // testere ve çekiç
    for (let x = 2; x < 7; x++) px(d, x, 5, 150, 150, 155);
    for (let x = 2; x < 7; x++) if (x % 2) px(d, x, 6, 120, 120, 125);
    px(d, 7, 5, 90, 60, 30); px(d, 8, 5, 90, 60, 30);
    for (let y = 5; y < 12; y++) px(d, 11, y, 90, 60, 30);
    for (let x = 9; x < 14; x++) { px(d, x, 4, 120, 120, 125); px(d, x, 5, 150, 150, 155); }
  });
  makeTex('furnace_side', (d, r) => {
    noiseFill(d, r, [120, 120, 120], 0.15);
    for (let i = 0; i < 16; i++) { mulPx(d, i, 0, 1.15); mulPx(d, 0, i, 1.15); mulPx(d, i, 15, 0.7); mulPx(d, 15, i, 0.7); }
  });
  makeTex('furnace_front', (d, r) => {
    copyTex(d, 'furnace_side');
    for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) px(d, x, y, 25, 22, 22);
    for (let x = 3; x < 13; x++) px(d, x, 7, 80, 80, 80);
    for (let x = 4; x < 12; x++) px(d, x, 3, 70, 70, 70);
  });
  makeTex('furnace_top', (d, r) => {
    noiseFill(d, r, [110, 110, 110], 0.15);
    for (let i = 0; i < 16; i++) { mulPx(d, i, 0, 0.75); mulPx(d, 0, i, 0.75); mulPx(d, i, 15, 0.75); mulPx(d, 15, i, 0.75); }
  });
  makeTex('tnt_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = 0.88 + r() * 0.16;
      if (x % 4 === 3) f *= 0.8;
      px(d, x, y, 200 * f, 50 * f, 35 * f);
    }
    for (let y = 5; y < 11; y++) for (let x = 0; x < 16; x++) { const f = 0.94 + r() * 0.06; px(d, x, y, 236 * f, 232 * f, 225 * f); }
    const word = ['T', 'N', 'T'];
    word.forEach((ch, i) => {
      const g = FONT3x5[ch], ox = 2 + i * 4;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') px(d, ox + xx, 6 + yy, 30, 30, 30);
    });
  });
  makeTex('tnt_top', (d, r) => {
    noiseFill(d, r, [190, 50, 35], 0.15);
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(d, x, y, 150, 150, 150);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(d, x, y, 80, 80, 80);
    px(d, 7, 7, 40, 40, 40); px(d, 8, 8, 40, 40, 40);
  });
  makeTex('cactus_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = 0.88 + r() * 0.14;
      if (x === 0 || x === 15) { px(d, x, y, 0, 0, 0, 0); continue; }
      if (x % 4 === 2) f *= 0.8;
      px(d, x, y, 75 * f, 135 * f, 45 * f);
    }
    for (let i = 0; i < 10; i++) px(d, 1 + Math.floor(r() * 14), Math.floor(r() * 16), 220, 230, 190);
  });
  makeTex('cactus_top', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x === 0 || x === 15 || y === 0 || y === 15) { px(d, x, y, 0, 0, 0, 0); continue; }
      const rr = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const f = (Math.floor(rr) % 2 ? 0.85 : 1) * (0.92 + r() * 0.12);
      px(d, x, y, 90 * f, 150 * f, 55 * f);
    }
  });
  makeTex('pumpkin_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = 0.9 + r() * 0.14;
      if (x % 4 === 0) f *= 0.78;
      if (y === 0 || y === 15) f *= 0.85;
      px(d, x, y, 222 * f, 130 * f, 28 * f);
    }
  });
  makeTex('pumpkin_top', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rr = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const f = (Math.floor(rr) % 3 === 0 ? 0.85 : 1) * (0.9 + r() * 0.14);
      px(d, x, y, 215 * f, 125 * f, 25 * f);
    }
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(d, x, y, 90, 70, 30);
  });
  const face = (d, c) => {
    const P = [[3, 4], [4, 4], [3, 5], [4, 5], [5, 5], [11, 4], [12, 4], [10, 5], [11, 5], [12, 5],
      [3, 9], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 9], [5, 11], [6, 11], [8, 11], [9, 11], [10, 11], [7, 9]];
    for (const [x, y] of P) px(d, x, y, c[0], c[1], c[2]);
  };
  makeTex('pumpkin_face', (d, r) => { copyTex(d, 'pumpkin_side'); face(d, [40, 20, 5]); });
  makeTex('jack_face', (d, r) => { copyTex(d, 'pumpkin_side'); face(d, [255, 220, 90]); });
  makeTex('poppy', (d, r) => crossFlower(d, r, [210, 30, 25], [40, 30, 20]));
  makeTex('dandelion', (d, r) => crossFlower(d, r, [250, 220, 40], [230, 160, 20]));
  makeTex('blue_flower', (d, r) => crossFlower(d, r, [70, 130, 230], [230, 230, 120]));
  makeTex('tall_grass', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let k = 0; k < 9; k++) {
      let x = 1 + Math.floor(r() * 14);
      const h = 5 + Math.floor(r() * 9);
      for (let y = 15; y > 15 - h; y--) {
        const f = 0.7 + r() * 0.4 + (15 - y) * 0.02;
        px(d, x, y, 80 * f, 145 * f, 50 * f);
        if (r() < 0.15) x += r() < 0.5 ? -1 : 1;
      }
    }
  });
  makeTex('dead_bush', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    const br = (x, y, dx, n) => { for (let i = 0; i < n; i++) { px(d, x, y, 120, 82, 40); y--; if (i % 2) x += dx; } };
    br(7, 15, 0, 5); br(7, 11, -1, 6); br(8, 11, 1, 6); br(7, 9, 1, 4); br(6, 12, -1, 3);
  });
  makeTex('torch', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let y = 7; y < 16; y++) { px(d, 7, y, 120, 85, 45); px(d, 8, y, 95, 65, 32); }
    px(d, 7, 6, 255, 230, 120); px(d, 8, 6, 255, 200, 80); px(d, 7, 5, 255, 250, 200); px(d, 8, 5, 255, 220, 110);
    px(d, 7, 4, 255, 180, 60);
  });
  buildTexturesNetherEnd();
  buildTexturesFarm();
  // Kırılma çatlakları (10 aşama)
  const crackRng = mulberry32(1337);
  const path = [];
  for (let w = 0; w < 7; w++) {
    let x = 7 + Math.floor(crackRng() * 3) - 1, y = 7 + Math.floor(crackRng() * 3) - 1;
    const ang = (w / 7) * Math.PI * 2 + crackRng();
    for (let s = 0; s < 14; s++) {
      path.push([x, y]);
      x += Math.round(Math.cos(ang) + (crackRng() - 0.5) * 1.2);
      y += Math.round(Math.sin(ang) + (crackRng() - 0.5) * 1.2);
    }
  }
  for (let st = 0; st < 10; st++) {
    makeTex('crack' + st, (d) => {
      for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
      const n = Math.floor(((st + 1) / 10) * path.length);
      for (let i = 0; i < n; i++) {
        const w = Math.floor(i / 14), s = i % 14;
        if (s < Math.ceil((st + 1) * 1.4)) px(d, path[i][0], path[i][1], 20, 20, 20, 210);
      }
    });
  }
}

function brickTex(d, rng, brick, mortar, bh = 4, bw = 8) {
  for (let y = 0; y < 16; y++) {
    const row = Math.floor(y / bh), off = (row % 2) * (bw / 2);
    for (let x = 0; x < 16; x++) {
      const isM = (y % bh) === bh - 1 || ((x + off) % bw) === bw - 1;
      const c = isM ? mortar : brick;
      const bid = row * 7 + Math.floor((x + off) / bw);
      const f = (isM ? 1 : 0.9 + ((bid * 37) % 5) * 0.04) * (0.9 + rng() * 0.16);
      px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
  }
}
function metalBlock(d, rng, c) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let f = 0.96 + rng() * 0.06;
    if (x === 0 || y === 0) f = 1.22; else if (x === 15 || y === 15) f = 0.7;
    else if (x === 1 || y === 1) f = 1.08;
    if ((x + y) % 7 === 0 && x > 2 && y > 2 && x < 13 && y < 13) f *= 1.06;
    px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
  }
}
function crossFungus(d, rng, cap, stem, dots) {
  for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
  for (let y = 9; y < 16; y++) { px(d, 7, y, stem[0], stem[1], stem[2]); px(d, 8, y, stem[0] * 0.8, stem[1] * 0.8, stem[2] * 0.8); }
  for (let y = 4; y < 9; y++) {
    const w = y === 4 ? 2 : y < 7 ? 4 : 5;
    for (let x = 8 - w; x < 8 + w; x++) { const f = 0.85 + rng() * 0.3; px(d, x, y, cap[0] * f, cap[1] * f, cap[2] * f); }
  }
  for (let i = 0; i < 4; i++) px(d, 4 + Math.floor(rng() * 8), 5 + Math.floor(rng() * 3), dots[0], dots[1], dots[2]);
}

function buildTexturesNetherEnd() {
  makeTex('netherrack', (d, r) => {
    noiseFill(d, r, [112, 42, 42], 0.32);
    for (let i = 0; i < 30; i++) mulPx(d, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.6 ? 0.72 : 1.2);
  });
  makeTex('soul_sand', (d, r) => {
    noiseFill(d, r, [84, 64, 51], 0.25);
    for (let k = 0; k < 4; k++) {
      const cx = 2 + Math.floor(r() * 11), cy = 2 + Math.floor(r() * 11);
      px(d, cx, cy, 45, 32, 25); px(d, cx + 2, cy, 45, 32, 25); px(d, cx + 1, cy + 2, 40, 28, 22); px(d, cx, cy + 2, 55, 40, 30);
    }
  });
  makeTex('soul_soil', (d, r) => {
    noiseFill(d, r, [76, 58, 47], 0.3);
    for (let i = 0; i < 20; i++) mulPx(d, Math.floor(r() * 16), Math.floor(r() * 16), 0.7);
  });
  makeTex('quartz_ore', (d, r) => oreTex(d, r, [230, 222, 214], [255, 255, 255], 'netherrack'));
  makeTex('nether_gold_ore', (d, r) => oreTex(d, r, [250, 200, 50], [255, 240, 140], 'netherrack'));
  makeTex('debris_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin((x + Math.sin(y * 0.8) * 2) * 1.1) * 0.5 + 0.5;
      const f = (0.75 + w * 0.35) * (0.9 + r() * 0.15);
      px(d, x, y, 98 * f, 72 * f, 66 * f);
    }
    for (let i = 0; i < 16; i++) { mulPx(d, i, 0, 0.7); mulPx(d, i, 15, 0.7); }
  });
  makeTex('debris_top', (d, r) => logTop(d, r, [80, 60, 56], [120, 90, 80]));
  makeTex('magma', (d, r) => {
    noiseFill(d, r, [60, 20, 10], 0.4);
    for (let i = 0; i < 5; i++) {
      let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      for (let k = 0; k < 6; k++) { px(d, x, y, 255, 120 + r() * 60, 20); x = (x + (r() < 0.5 ? 1 : 0)) & 15; y = (y + (r() < 0.5 ? 1 : -1)) & 15; }
    }
  });
  makeTex('nether_bricks', (d, r) => brickTex(d, r, [58, 28, 34], [28, 14, 17], 4, 8));
  makeTex('basalt_side', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = (x % 4 === 0 ? 0.75 : 1) * (0.88 + r() * 0.2);
      px(d, x, y, 76 * f, 76 * f, 82 * f);
    }
  });
  makeTex('basalt_top', (d, r) => logTop(d, r, [60, 60, 66], [88, 88, 94]));
  makeTex('blackstone', (d, r) => {
    noiseFill(d, r, [42, 36, 44], 0.35);
    for (let i = 0; i < 16; i++) mulPx(d, Math.floor(r() * 16), Math.floor(r() * 16), 1.4);
  });
  makeTex('crimson_nylium', (d, r) => noiseFill(d, r, [140, 24, 26], 0.35));
  makeTex('crimson_nylium_side', (d, r) => {
    copyTex(d, 'netherrack');
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) { const f = 0.8 + r() * 0.4; px(d, x, y, 140 * f, 24 * f, 26 * f); } }
  });
  makeTex('warped_nylium', (d, r) => noiseFill(d, r, [40, 120, 110], 0.32));
  makeTex('warped_nylium_side', (d, r) => {
    copyTex(d, 'netherrack');
    for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(r() * 3); for (let y = 0; y < h; y++) { const f = 0.8 + r() * 0.4; px(d, x, y, 40 * f, 120 * f, 110 * f); } }
  });
  makeTex('crimson_stem', (d, r) => logSide(d, r, [112, 42, 62], [160, 70, 90]));
  makeTex('crimson_stem_top', (d, r) => logTop(d, r, [112, 42, 62], [150, 60, 70]));
  makeTex('warped_stem', (d, r) => logSide(d, r, [56, 90, 98], [40, 170, 150]));
  makeTex('warped_stem_top', (d, r) => logTop(d, r, [56, 90, 98], [60, 140, 130]));
  makeTex('nether_wart_block', (d, r) => noiseFill(d, r, [120, 12, 12], 0.45));
  makeTex('warped_wart_block', (d, r) => noiseFill(d, r, [22, 130, 120], 0.4));
  makeTex('shroomlight', (d, r) => {
    noiseFill(d, r, [238, 146, 72], 0.2);
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); px(d, x, y, 255, 230, 140); px(d, x + 1, y, 255, 210, 120); }
  });
  makeTex('crimson_fungus', (d, r) => crossFungus(d, r, [170, 30, 30], [220, 160, 120], [255, 160, 60]));
  makeTex('warped_fungus', (d, r) => crossFungus(d, r, [30, 150, 130], [220, 160, 120], [255, 140, 40]));
  makeTex('crimson_planks', (d, r) => planksTex(d, r, [106, 52, 74]));
  makeTex('warped_planks', (d, r) => planksTex(d, r, [44, 106, 100]));
  makeTex('nether_portal', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const w = Math.sin(x * 0.9 + Math.sin(y * 0.6) * 3) * 0.5 + 0.5;
      const f = 0.7 + w * 0.5 + r() * 0.1;
      px(d, x, y, 110 * f, 30 * f, 200 * f, 190);
    }
  });
  makeTex('netherite_block', (d, r) => {
    metalBlock(d, r, [66, 60, 63]);
    for (let i = 3; i < 13; i++) { mulPx(d, i, 5, 1.25); mulPx(d, i, 10, 0.8); }
  });
  makeTex('quartz_block', (d, r) => noiseFill(d, r, [236, 230, 222], 0.05));
  makeTex('end_stone', (d, r) => {
    noiseFill(d, r, [221, 223, 160], 0.12);
    for (let i = 0; i < 12; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); mulPx(d, x, y, 0.8); mulPx(d, x + 1, y, 0.85); }
  });
  makeTex('end_stone_bricks', (d, r) => brickTex(d, r, [224, 226, 164], [170, 170, 120], 8, 16));
  makeTex('purpur', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = 0.92 + r() * 0.1;
      if (x % 8 === 0 || y % 8 === 0) f = 1.12; else if (x % 8 === 7 || y % 8 === 7) f = 0.78;
      px(d, x, y, 170 * f, 124 * f, 170 * f);
    }
  });
  makeTex('purpur_pillar', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = (x % 4 === 0 ? 0.82 : x % 4 === 1 ? 1.1 : 1) * (0.94 + r() * 0.08);
      px(d, x, y, 172 * f, 126 * f, 172 * f);
    }
  });
  makeTex('purpur_pillar_top', (d, r) => logTop(d, r, [150, 105, 150], [175, 130, 175]));
  makeTex('end_frame_side', (d, r) => {
    noiseFill(d, r, [62, 92, 82], 0.25);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { const f = 0.9 + r() * 0.15; px(d, x, y, 215 * f, 218 * f, 155 * f); }
  });
  makeTex('end_frame_top', (d, r) => {
    noiseFill(d, r, [210, 214, 150], 0.12);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) px(d, x, y, 40, 70, 62);
  });
  makeTex('end_frame_eye', (d, r) => {
    copyTex(d, 'end_frame_top');
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
      const dd = Math.hypot(x - 7.5, y - 7.5);
      if (dd < 3.8) px(d, x, y, 40 + (3.8 - dd) * 30, 140 + (3.8 - dd) * 20, 90);
      if (dd < 1.3) px(d, x, y, 15, 25, 20);
    }
  });
  makeTex('end_portal', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const s = r();
      if (s > 0.93) { const c = [[120, 200, 190], [80, 120, 220], [200, 230, 255], [120, 90, 200]][Math.floor(r() * 4)]; px(d, x, y, c[0], c[1], c[2]); }
      else px(d, x, y, 8 + s * 10, 12 + s * 12, 20 + s * 16);
    }
  });
  makeTex('dragon_egg', (d, r) => {
    noiseFill(d, r, [14, 8, 18], 0.4);
    for (let i = 0; i < 20; i++) px(d, Math.floor(r() * 16), Math.floor(r() * 16), 70, 30, 90);
  });
  makeTex('chorus_plant', (d, r) => {
    noiseFill(d, r, [94, 60, 94], 0.3);
    for (let i = 0; i < 10; i++) px(d, Math.floor(r() * 16), Math.floor(r() * 16), 140, 100, 140);
  });
  makeTex('chorus_flower', (d, r) => {
    noiseFill(d, r, [150, 110, 150], 0.2);
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if ((x + y) % 3 === 0) px(d, x, y, 200, 170, 205);
  });
  makeTex('crying_obsidian', (d, r) => {
    copyTex(d, 'obsidian');
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * 16); let y = Math.floor(r() * 10);
      for (let k = 0; k < 4; k++) px(d, x, y + k, 130 + k * 20, 40, 230);
    }
  });
  const METALS = { iron_block: [218, 218, 218], gold_block: [250, 212, 56], diamond_block: [98, 226, 220], emerald_block: [42, 196, 92], coal_block: [26, 26, 28], redstone_block: [176, 18, 10], lapis_block: [32, 64, 168] };
  for (const k in METALS) makeTex(k, (d, r) => metalBlock(d, r, METALS[k]));
  makeTex('lapis_ore', (d, r) => oreTex(d, r, [30, 70, 180], [90, 130, 230]));
  makeTex('chest_side', (d, r) => {
    planksTex(d, r, [160, 112, 52]);
    for (let i = 0; i < 16; i++) { px(d, i, 0, 70, 45, 20); px(d, i, 15, 70, 45, 20); px(d, 0, i, 70, 45, 20); px(d, 15, i, 70, 45, 20); px(d, i, 5, 70, 45, 20); }
  });
  makeTex('chest_front', (d, r) => {
    copyTex(d, 'chest_side');
    for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) px(d, x, y, 200, 200, 210);
    px(d, 7, 7, 60, 60, 60);
  });
  makeTex('chest_top', (d, r) => {
    planksTex(d, r, [168, 118, 56]);
    for (let i = 0; i < 16; i++) { px(d, i, 0, 70, 45, 20); px(d, i, 15, 70, 45, 20); px(d, 0, i, 70, 45, 20); px(d, 15, i, 70, 45, 20); }
  });
  makeTex('end_rod', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let y = 1; y < 14; y++) { px(d, 7, y, 250, 245, 235); px(d, 8, y, 225, 220, 210); }
    for (let x = 5; x < 11; x++) { px(d, x, 14, 200, 180, 150); px(d, x, 15, 170, 150, 120); }
  });
}

// Tarım ve yatak dokuları
function buildTexturesFarm() {
  const farm = (d, r, wet) => {
    copyTex(d, 'dirt');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let f = wet ? 0.55 : 0.8;
      if (y % 4 === 0) f *= 0.72; else if (y % 4 === 1) f *= 1.12;
      mulPx(d, x, y, f);
    }
  };
  makeTex('farmland', (d, r) => farm(d, r, false));
  makeTex('farmland_wet', (d, r) => farm(d, r, true));
  // Buğday: 5 görsel evre (yeşil filizden altın başaklara)
  for (let s = 0; s < 5; s++) {
    makeTex('wheat_' + s, (d, r) => {
      for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
      const h = 3 + s * 3 - (s === 4 ? 1 : 0);
      for (const x of [1, 4, 6, 9, 11, 14]) {
        const hh = h - Math.floor(r() * 3);
        for (let y = 15; y > 15 - hh && y >= 0; y--) {
          const top = 15 - y > hh - 4;
          let c = s < 3 ? [70, 150 - s * 10, 40] : s === 3 ? [130, 150, 50] : [200, 170, 70];
          if (s >= 3 && top) c = s === 4 ? [220, 190, 90] : [150, 160, 60];
          const f = 0.8 + r() * 0.3;
          px(d, x + (y % 3 === 0 && top ? 1 : 0), y, c[0] * f, c[1] * f, c[2] * f);
          if (s === 4 && top) px(d, x - 1, y, c[0] * 0.85, c[1] * 0.85, c[2] * 0.8);
        }
      }
    });
  }
  const sapling = (d, r, leaf, stem, cone) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let y = 9; y < 16; y++) px(d, 7, y, stem[0], stem[1], stem[2]);
    for (let y = 1; y < 12; y++) for (let x = 2; x < 14; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - (cone ? 7 : 6);
      const inside = cone ? Math.abs(dx) < (y - 0.5) * 0.55 && y < 12 : dx * dx * 0.9 + dy * dy < 22;
      if (!inside || r() < 0.18) continue;
      const f = 0.7 + r() * 0.45; px(d, x, y, leaf[0] * f, leaf[1] * f, leaf[2] * f);
    }
  };
  makeTex('oak_sapling', (d, r) => sapling(d, r, [60, 140, 40], [100, 72, 40], false));
  makeTex('birch_sapling', (d, r) => sapling(d, r, [110, 165, 70], [210, 210, 200], false));
  makeTex('spruce_sapling', (d, r) => sapling(d, r, [40, 90, 50], [80, 55, 30], true));
  // Yatak: yüzlerin sadece alt 9 pikseli görünür
  const RED = [176, 36, 36], WOOD = [160, 120, 70];
  const bedSide = (d, r, head) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let y = 7; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = null;
      if (y < 10) c = head && x > 1 && x < 14 && y === 7 ? [235, 235, 235] : RED;
      else if (y < 13) c = WOOD;
      else if (x < 3 || x > 12) c = sh(WOOD, 0.8);
      if (!c) continue;
      const f = 0.9 + r() * 0.15; px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
  };
  // Kapı, tuzak kapı ve tırmanma merdiveni
  const W = [150, 112, 64];
  const doorTex = (d, r, top) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || x > 13 || (top ? y < 2 : y > 13) || (!top && (y === 6 || y === 7));
      const win = top && !frame && y >= 3 && y <= 12 && x !== 7 && x !== 8 && y !== 7 && y !== 8;
      if (win) { px(d, x, y, 0, 0, 0, 0); continue; }
      const plank = (x >> 2) % 2 ? 0.92 : 1.04;
      const f = (frame ? 0.82 : plank) * (0.9 + r() * 0.14);
      px(d, x, y, W[0] * f, W[1] * f, W[2] * f);
    }
    if (!top) { px(d, 12, 2, 60, 50, 40); px(d, 12, 3, 60, 50, 40); }
  };
  makeTex('door_top', (d, r) => doorTex(d, r, true));
  makeTex('door_bottom', (d, r) => doorTex(d, r, false));
  makeTex('trapdoor', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || x > 13 || y < 2 || y > 13;
      const hole = !frame && (x === 5 || x === 10) && y > 3 && y < 12;
      if (hole) { px(d, x, y, 0, 0, 0, 0); continue; }
      const f = (frame ? 0.82 : 1) * (0.9 + r() * 0.14);
      px(d, x, y, W[0] * f, W[1] * f, W[2] * f);
    }
  });
  makeTex('ladder', (d, r) => {
    for (let i = 0; i < 1024; i += 4) d[i + 3] = 0;
    for (let y = 0; y < 16; y++) for (const x of [2, 3, 12, 13]) { const f = 0.85 + r() * 0.2; px(d, x, y, W[0] * f * 0.9, W[1] * f * 0.9, W[2] * f * 0.9); }
    for (const yy of [1, 5, 9, 13]) for (let x = 4; x < 12; x++) for (let k = 0; k < 2; k++) { const f = 0.9 + r() * 0.2; px(d, x, yy + k, W[0] * f, W[1] * f, W[2] * f); }
  });
  makeTex('bed_side_head', (d, r) => bedSide(d, r, true));
  makeTex('bed_side_foot', (d, r) => bedSide(d, r, false));
  makeTex('bed_top_head', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      const pillow = x > 2 && x < 13 && y > 2 && y < 11;
      const c = edge ? RED : pillow ? [236, 236, 236] : RED;
      const f = 0.9 + r() * 0.12 - (pillow && (x === 3 || y === 10) ? 0.15 : 0);
      px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
  });
  makeTex('bed_top_foot', (d, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = (0.9 + r() * 0.12) * (y === 13 || x === 0 || x === 15 ? 0.8 : 1);
      px(d, x, y, RED[0] * f, RED[1] * f, RED[2] * f);
    }
  });
}

// --- Blok tanımları -------------------------------------------------------
function def(id, name, tex, o = {}) {
  const t = typeof tex === 'string' ? { top: tex, bottom: tex, side: tex } : tex;
  BLOCKS[id] = Object.assign({
    id, name, tex: t, solid: true, opaque: true, render: R_CUBE, pass: 0, liquid: false, filter: 0, emit: 0,
    hardness: 1, drop: id, cullSame: false, sound: 'stone', creative: true, tool: null, tier: 0,
  }, o);
}

// tool: doğru alet türü (hızlı kazar), tier: düşmesi için gereken en düşük alet seviyesi
// (1 tahta/altın, 2 taş, 3 demir, 4 elmas). Sertlik değerleri Minecraft ile aynıdır.
function defineBlocks() {
  const P = (tier, o = {}) => Object.assign({ tool: 'pick', tier }, o);
  const AX = (o = {}) => Object.assign({ tool: 'axe', sound: 'wood' }, o);
  const SH = (o = {}) => Object.assign({ tool: 'shovel' }, o);
  def(B.GRASS, 'Çimen Bloğu', { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, SH({ hardness: 0.6, drop: B.DIRT, sound: 'grass' }));
  def(B.DIRT, 'Toprak', 'dirt', SH({ hardness: 0.5, sound: 'gravel' }));
  def(B.STONE, 'Taş', 'stone', P(1, { hardness: 1.5, drop: B.COBBLE }));
  def(B.COBBLE, 'Kırık Taş', 'cobble', P(1, { hardness: 2 }));
  def(B.MOSSY_COBBLE, 'Yosunlu Kırık Taş', 'mossy_cobble', P(1, { hardness: 2 }));
  def(B.STONE_BRICKS, 'Taş Tuğla', 'stone_bricks', P(1, { hardness: 1.5 }));
  def(B.BRICKS, 'Tuğla', 'bricks', P(1, { hardness: 2 }));
  def(B.PLANKS, 'Meşe Kalası', 'planks', AX({ hardness: 2 }));
  def(B.BIRCH_PLANKS, 'Huş Kalası', 'birch_planks', AX({ hardness: 2 }));
  def(B.SPRUCE_PLANKS, 'Ladin Kalası', 'spruce_planks', AX({ hardness: 2 }));
  def(B.CRIMSON_PLANKS, 'Kızıl Kalas', 'crimson_planks', AX({ hardness: 2 }));
  def(B.WARPED_PLANKS, 'Çarpık Kalas', 'warped_planks', AX({ hardness: 2 }));
  def(B.LOG, 'Meşe Kütüğü', { top: 'log_top', bottom: 'log_top', side: 'log_side' }, AX({ hardness: 2 }));
  def(B.BIRCH_LOG, 'Huş Kütüğü', { top: 'birch_top', bottom: 'birch_top', side: 'birch_side' }, AX({ hardness: 2 }));
  def(B.SPRUCE_LOG, 'Ladin Kütüğü', { top: 'spruce_top', bottom: 'spruce_top', side: 'spruce_side' }, AX({ hardness: 2 }));
  def(B.CRIMSON_STEM, 'Kızıl Gövde', { top: 'crimson_stem_top', bottom: 'crimson_stem_top', side: 'crimson_stem' }, AX({ hardness: 2 }));
  def(B.WARPED_STEM, 'Çarpık Gövde', { top: 'warped_stem_top', bottom: 'warped_stem_top', side: 'warped_stem' }, AX({ hardness: 2 }));
  const leaf = { opaque: false, filter: 1, cullSame: true, hardness: 0.2, drop: 0, sound: 'grass' };
  def(B.LEAVES, 'Meşe Yaprağı', 'leaves', leaf);
  def(B.BIRCH_LEAVES, 'Huş Yaprağı', 'birch_leaves', leaf);
  def(B.SPRUCE_LEAVES, 'Ladin Yaprağı', 'spruce_leaves', leaf);
  def(B.SAND, 'Kum', 'sand', SH({ hardness: 0.5, sound: 'sand' }));
  def(B.SANDSTONE, 'Kumtaşı', { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, P(1, { hardness: 0.8 }));
  def(B.GRAVEL, 'Çakıl', 'gravel', SH({ hardness: 0.6, sound: 'gravel' }));
  def(B.SNOW, 'Kar Bloğu', 'snow', SH({ hardness: 0.2, sound: 'snow' }));
  def(B.SNOWY_GRASS, 'Karlı Çimen', { top: 'snow', bottom: 'dirt', side: 'snowy_grass_side' }, SH({ hardness: 0.6, drop: B.DIRT, sound: 'snow' }));
  def(B.ICE, 'Buz', 'ice', { opaque: false, pass: 1, cullSame: true, hardness: 0.5, drop: 0, sound: 'glass', tool: 'pick' });
  def(B.WATER, 'Su', 'water', { solid: false, opaque: false, render: R_LIQUID, pass: 1, liquid: true, filter: 2, cullSame: true, hardness: -1, drop: 0, sound: 'water' });
  def(B.LAVA, 'Lav', 'lava', { solid: false, opaque: false, render: R_LIQUID, liquid: true, emit: 15, cullSame: true, hardness: -1, drop: 0, sound: 'water' });
  def(B.GLASS, 'Cam', 'glass', { opaque: false, cullSame: true, hardness: 0.3, drop: 0, sound: 'glass' });
  def(B.BEDROCK, 'Ana Kaya', 'bedrock', { hardness: -1 });
  def(B.OBSIDIAN, 'Obsidyen', 'obsidian', P(4, { hardness: 50 }));
  def(B.CRYING_OBSIDIAN, 'Ağlayan Obsidyen', 'crying_obsidian', P(4, { hardness: 50, emit: 10 }));
  def(B.COAL, 'Kömür Cevheri', 'coal_ore', P(1, { hardness: 3 }));
  def(B.IRON, 'Demir Cevheri', 'iron_ore', P(2, { hardness: 3 }));
  def(B.LAPIS_ORE, 'Lapis Lazuli Cevheri', 'lapis_ore', P(2, { hardness: 3 }));
  def(B.GOLD, 'Altın Cevheri', 'gold_ore', P(3, { hardness: 3 }));
  def(B.REDSTONE, 'Kızıltaş Cevheri', 'redstone_ore', P(3, { hardness: 3 }));
  def(B.DIAMOND, 'Elmas Cevheri', 'diamond_ore', P(3, { hardness: 3 }));
  def(B.EMERALD, 'Zümrüt Cevheri', 'emerald_ore', P(3, { hardness: 3 }));
  def(B.COAL_BLOCK, 'Kömür Bloğu', 'coal_block', P(1, { hardness: 5 }));
  def(B.IRON_BLOCK, 'Demir Bloğu', 'iron_block', P(2, { hardness: 5 }));
  def(B.LAPIS_BLOCK, 'Lapis Lazuli Bloğu', 'lapis_block', P(2, { hardness: 3 }));
  def(B.GOLD_BLOCK, 'Altın Bloğu', 'gold_block', P(3, { hardness: 3 }));
  def(B.REDSTONE_BLOCK, 'Kızıltaş Bloğu', 'redstone_block', P(1, { hardness: 5, emit: 7 }));
  def(B.DIAMOND_BLOCK, 'Elmas Bloğu', 'diamond_block', P(3, { hardness: 5 }));
  def(B.EMERALD_BLOCK, 'Zümrüt Bloğu', 'emerald_block', P(3, { hardness: 5 }));
  def(B.NETHERITE_BLOCK, 'Netherit Bloğu', 'netherite_block', P(4, { hardness: 50 }));
  def(B.GLOWSTONE, 'Işıktaşı', 'glowstone', { emit: 15, hardness: 0.3, sound: 'glass' });
  def(B.BOOKSHELF, 'Kitaplık', { top: 'planks', bottom: 'planks', side: 'bookshelf' }, AX({ hardness: 1.5 }));
  def(B.CRAFTING, 'Çalışma Masası', { top: 'crafting_top', bottom: 'planks', side: 'crafting_side' }, AX({ hardness: 2.5 }));
  def(B.FURNACE, 'Fırın', { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, P(1, { hardness: 3.5 }));
  def(B.CHEST, 'Sandık', { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, AX({ hardness: 2.5 }));
  def(B.TNT, 'TNT', { top: 'tnt_top', bottom: 'tnt_top', side: 'tnt_side' }, { hardness: 0, sound: 'grass' });
  def(B.PUMPKIN, 'Balkabağı', { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, AX({ hardness: 1 }));
  def(B.JACK, 'Fener Balkabağı', { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_face' }, AX({ hardness: 1, emit: 15 }));
  def(B.CACTUS, 'Kaktüs', { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, { opaque: false, hardness: 0.4, sound: 'cloth' });
  const plant = { solid: false, opaque: false, render: R_CROSS, hardness: 0, sound: 'grass' };
  def(B.POPPY, 'Gelincik', 'poppy', plant);
  def(B.DANDELION, 'Karahindiba', 'dandelion', plant);
  def(B.BLUE_FLOWER, 'Mavi Orkide', 'blue_flower', plant);
  def(B.TALL_GRASS, 'Uzun Çimen', 'tall_grass', Object.assign({}, plant, { drop: 0 }));
  def(B.DEAD_BUSH, 'Kuru Çalı', 'dead_bush', Object.assign({}, plant, { drop: 0 }));
  def(B.TORCH, 'Meşale', 'torch', Object.assign({}, plant, { emit: 14, sound: 'wood' }));
  def(B.END_ROD, 'End Çubuğu', 'end_rod', Object.assign({}, plant, { emit: 14, sound: 'glass' }));
  def(B.CRIMSON_FUNGUS, 'Kızıl Mantar', 'crimson_fungus', plant);
  def(B.WARPED_FUNGUS, 'Çarpık Mantar', 'warped_fungus', plant);
  const WN = { WHITE: 'Beyaz', RED: 'Kırmızı', ORANGE: 'Turuncu', YELLOW: 'Sarı', LIME: 'Açık Yeşil', BLUE: 'Mavi', PURPLE: 'Mor', BLACK: 'Siyah' };
  for (const k in WN) def(B['WOOL_' + k], WN[k] + ' Yün', 'wool_' + k.toLowerCase(), { hardness: 0.8, sound: 'cloth' });

  // Nether
  def(B.NETHERRACK, 'Nether Taşı', 'netherrack', P(1, { hardness: 0.4 }));
  def(B.SOUL_SAND, 'Ruh Kumu', 'soul_sand', SH({ hardness: 0.5, sound: 'sand' }));
  def(B.SOUL_SOIL, 'Ruh Toprağı', 'soul_soil', SH({ hardness: 0.5, sound: 'sand' }));
  def(B.QUARTZ_ORE, 'Nether Kuvars Cevheri', 'quartz_ore', P(1, { hardness: 3 }));
  def(B.NETHER_GOLD_ORE, 'Nether Altın Cevheri', 'nether_gold_ore', P(1, { hardness: 3 }));
  def(B.ANCIENT_DEBRIS, 'Kadim Kalıntı', { top: 'debris_top', bottom: 'debris_top', side: 'debris_side' }, P(4, { hardness: 30 }));
  def(B.MAGMA, 'Magma Bloğu', 'magma', P(1, { hardness: 0.5, emit: 3 }));
  def(B.NETHER_BRICKS, 'Nether Tuğlası', 'nether_bricks', P(1, { hardness: 2 }));
  def(B.BASALT, 'Bazalt', { top: 'basalt_top', bottom: 'basalt_top', side: 'basalt_side' }, P(1, { hardness: 1.25 }));
  def(B.BLACKSTONE, 'Karataş', 'blackstone', P(1, { hardness: 1.5 }));
  def(B.CRIMSON_NYLIUM, 'Kızıl Nilyum', { top: 'crimson_nylium', bottom: 'netherrack', side: 'crimson_nylium_side' }, P(1, { hardness: 0.4, drop: B.NETHERRACK }));
  def(B.WARPED_NYLIUM, 'Çarpık Nilyum', { top: 'warped_nylium', bottom: 'netherrack', side: 'warped_nylium_side' }, P(1, { hardness: 0.4, drop: B.NETHERRACK }));
  def(B.NETHER_WART_BLOCK, 'Nether Siğili Bloğu', 'nether_wart_block', { hardness: 1, sound: 'grass' });
  def(B.WARPED_WART_BLOCK, 'Çarpık Siğil Bloğu', 'warped_wart_block', { hardness: 1, sound: 'grass' });
  def(B.SHROOMLIGHT, 'Mantar Işığı', 'shroomlight', { hardness: 1, emit: 15, sound: 'grass' });
  def(B.QUARTZ_BLOCK, 'Kuvars Bloğu', 'quartz_block', P(1, { hardness: 0.8 }));
  def(B.NETHER_PORTAL, 'Nether Geçidi', 'nether_portal', { solid: false, opaque: false, pass: 1, cullSame: true, emit: 11, hardness: 0, drop: 0, sound: 'glass', creative: false });

  // End
  def(B.END_STONE, 'End Taşı', 'end_stone', P(1, { hardness: 3 }));
  def(B.END_STONE_BRICKS, 'End Taşı Tuğlası', 'end_stone_bricks', P(1, { hardness: 3 }));
  def(B.PURPUR, 'Purpur Bloğu', 'purpur', P(1, { hardness: 1.5 }));
  def(B.PURPUR_PILLAR, 'Purpur Sütunu', { top: 'purpur_pillar_top', bottom: 'purpur_pillar_top', side: 'purpur_pillar' }, P(1, { hardness: 1.5 }));
  def(B.END_FRAME, 'End Geçidi Çerçevesi', { top: 'end_frame_top', bottom: 'end_stone', side: 'end_frame_side' }, P(1, { hardness: 3 }));
  def(B.END_FRAME_EYE, 'Gözlü End Çerçevesi', { top: 'end_frame_eye', bottom: 'end_stone', side: 'end_frame_side' }, P(1, { hardness: 3, emit: 1, drop: B.END_FRAME, creative: false }));
  def(B.END_PORTAL, 'End Geçidi', 'end_portal', { solid: false, opaque: false, render: R_LIQUID, emit: 15, cullSame: true, hardness: -1, drop: 0, creative: false, portalSurface: true });
  def(B.DRAGON_EGG, 'Ejderha Yumurtası', 'dragon_egg', { hardness: 3, emit: 1 });
  def(B.CHORUS_PLANT, 'Koro Bitkisi', 'chorus_plant', AX({ hardness: 0.4, opaque: false, drop: 0 }));
  def(B.CHORUS_FLOWER, 'Koro Çiçeği', 'chorus_flower', AX({ hardness: 0.4, opaque: false }));

  // Tarım
  def(B.FARMLAND, 'Tarla', { top: 'farmland', bottom: 'dirt', side: 'dirt' }, SH({ hardness: 0.6, drop: B.DIRT, sound: 'gravel', opaque: false, height: 15 }));
  def(B.FARMLAND_WET, 'Islak Tarla', { top: 'farmland_wet', bottom: 'dirt', side: 'dirt' }, SH({ hardness: 0.6, drop: B.DIRT, sound: 'gravel', opaque: false, height: 15, creative: false }));
  const wheatTex = [0, 0, 1, 1, 2, 2, 3, 4];
  for (let k = 0; k < 8; k++) def(B.WHEAT_0 + k, 'Buğday', 'wheat_' + wheatTex[k], Object.assign({}, plant, { creative: false }));
  def(B.OAK_SAPLING, 'Meşe Fidanı', 'oak_sapling', plant);
  def(B.BIRCH_SAPLING, 'Huş Fidanı', 'birch_sapling', plant);
  def(B.SPRUCE_SAPLING, 'Ladin Fidanı', 'spruce_sapling', plant);
  const bed = { hardness: 0.2, opaque: false, height: 9, sound: 'cloth', creative: false };
  def(B.BED_FOOT, 'Yatak', { top: 'bed_top_foot', bottom: 'planks', side: 'bed_side_foot' }, bed);
  def(B.BED_HEAD, 'Yatak', { top: 'bed_top_head', bottom: 'planks', side: 'bed_side_head' }, bed);

  // Akan sıvılar (kaynak blokları WATER/LAVA)
  const flowO = (b) => { const o = Object.assign({}, b, { creative: false }); delete o.id; delete o.name; delete o.tex; return o; };
  for (let k = 0; k < 8; k++) {
    def(B.WATER_1 + k, 'Su', 'water', flowO(BLOCKS[B.WATER]));
    def(B.LAVA_1 + k, 'Lav', 'lava', flowO(BLOCKS[B.LAVA]));
  }
  // Yarım bloklar ve basamaklar: malzemenin dokusunu ve kazma kurallarını kullanır
  const MAT = (m) => { const b = BLOCKS[B[m]]; return { tex: b.tex, o: { hardness: b.hardness, tool: b.tool, tier: b.tier, sound: b.sound } }; };
  const shapeO = (o, extra) => Object.assign({}, o, { opaque: false, render: R_SHAPE }, extra);
  SLAB_MATS.forEach((m, k) => {
    const M = MAT(m), nm = BLOCKS[B[m]].name;
    def(B.SLAB + k, nm + ' Yarım Blok', M.tex, shapeO(M.o, { shape: 1, full: B[m], drop: B.SLAB + k }));
    def(B.SLAB_TOP + k, nm + ' Yarım Blok', M.tex, shapeO(M.o, { shape: 2, full: B[m], drop: B.SLAB + k, creative: false }));
  });
  STAIR_MATS.forEach((m, k) => {
    const M = MAT(m), nm = BLOCKS[B[m]].name;
    for (let f = 0; f < 4; f++) def(B.STAIRS + k * 4 + f, nm + ' Basamak', M.tex, shapeO(M.o, { shape: 3, sf: f, drop: B.STAIRS + k * 4, creative: f === 0 }));
  });
  const wood = AX({ hardness: 3 });
  for (let k = 0; k < 16; k++) {
    // k = yön + açık*4 + üst*8
    def(B.DOOR + k, 'Meşe Kapı', k & 8 ? 'door_top' : 'door_bottom', shapeO(wood, { shape: 4, sf: k & 7, flat: true, drop: B.DOOR, creative: k === 0, upper: !!(k & 8) }));
  }
  def(B.TRAPDOOR, 'Tuzak Kapı', 'trapdoor', shapeO(wood, { shape: 5, sf: 8, flat: true }));
  for (let f = 0; f < 4; f++) def(B.TRAPDOOR_OPEN + f, 'Tuzak Kapı', 'trapdoor', shapeO(wood, { shape: 5, sf: f, flat: true, drop: B.TRAPDOOR, creative: false }));
  def(B.FENCE, 'Meşe Çit', 'planks', shapeO(AX({ hardness: 2 }), { shape: 6, flat: true }));
  for (let k = 0; k < 4; k++) def(B.GATE + k, 'Meşe Çit Kapısı', 'planks', shapeO(AX({ hardness: 2 }), { shape: 7, sf: k, flat: true, drop: B.GATE, creative: k === 0 }));
  def(B.GLASS_PANE, 'Cam Panel', 'glass', shapeO({ hardness: 0.3, sound: 'glass' }, { shape: 8, flat: true, drop: 0 }));
  for (let f = 0; f < 4; f++) def(B.LADDER + f, 'Merdiven', 'ladder', shapeO(AX({ hardness: 0.4 }), { shape: 9, sf: f, flat: true, solid: false, drop: B.LADDER, creative: f === 0 }));

  BLOCKS[0] = { id: 0, name: 'Hava', solid: false, opaque: false, render: R_NONE, emit: 0, filter: 0, pass: 0, cullSame: false, creative: false };

  for (let id = 0; id < BLOCKS.length; id++) {
    const b = BLOCKS[id];
    if (!b) continue;
    OPAQUE[id] = b.opaque ? 1 : 0;
    SOLID[id] = b.solid ? 1 : 0;
    FILTER[id] = b.filter;
    EMIT[id] = b.emit;
    RENDER[id] = b.render;
    PASS[id] = b.pass;
    CULLSAME[id] = b.cullSame ? 1 : 0;
    HGT[id] = b.height || 16;
    SHAPE[id] = b.shape || 0;
    SHAPEF[id] = b.sf || 0;
    FLAT[id] = b.flat ? 1 : 0;
    if (b.liquid) LIQH[id] = isSource(id) ? 14 : Math.round(16 * (8 - liquidLevel(id)) / 9);
    if (b.tex) {
      const t = b.tex;
      const side = TEX[t.side];
      // Yüz sırası: +x, -x, +y, -y, +z, -z
      TEXF[id * 6 + 0] = side; TEXF[id * 6 + 1] = side;
      TEXF[id * 6 + 2] = TEX[t.top]; TEXF[id * 6 + 3] = TEX[t.bottom];
      TEXF[id * 6 + 4] = t.front ? TEX[t.front] : side; TEXF[id * 6 + 5] = side;
      for (const k of ['side', 'top', 'bottom']) if (TEX[t[k]] === undefined) console.warn('Doku yok:', t[k]);
    }
  }
}

// --- Arayüz için izometrik blok ikonları ---------------------------------
const ICONS = [];
function tileCanvas(layer) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(16, 16);
  img.data.set(texLayers[layer]);
  // Saydamlık için ortalama renk düzeltmesini geri al
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildIcons() {
  const tiles = texLayers.map((_, i) => tileCanvas(i));
  const S = 48;
  for (let id = 1; id < BLOCKS.length; id++) {
    const b = BLOCKS[id];
    if (!b) continue;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const T = (i) => tiles[TEXF[i * 6 + 2]];
    if (b.render === R_CROSS) {
      ctx.drawImage(tiles[TEXF[id * 6 + 2]], 4, 4, S - 8, S - 8);
    } else if (b.flat) {
      // Düz simgeler: kapı, çit, panel, merdiven
      const t = T(id);
      if (isDoor(id)) { ctx.drawImage(T(B.DOOR + 8), 12, 0, 24, 24); ctx.drawImage(T(B.DOOR), 12, 24, 24, 24); }
      else if (b.shape === 6 || b.shape === 7) {
        const posts = b.shape === 6 ? [[6, 4], [34, 4]] : [[2, 10], [40, 10]];
        for (const [x, y] of posts) ctx.drawImage(t, 0, 0, 4, 16, x, y, 8, 44 - y);
        for (const y of [12, 28]) ctx.drawImage(t, 0, 0, 16, 3, b.shape === 6 ? 6 : 2, y, b.shape === 6 ? 36 : 46, 6);
      } else if (b.shape === 8) { ctx.drawImage(t, 4, 4, S - 8, S - 8); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, S - 10, S - 10); }
      else ctx.drawImage(t, 4, 4, S - 8, S - 8);
    } else {
      const k = S / 32;
      const top = tiles[TEXF[id * 6 + 2]], left = tiles[TEXF[id * 6 + 4]], right = tiles[TEXF[id * 6 + 0]];
      const draw = (img, m, dark) => {
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(img, 0, 0);
        if (dark) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(0,0,0,${dark})`;
          ctx.fillRect(0, 0, 16, 16);
          ctx.globalCompositeOperation = 'source-over';
        }
      };
      const h = b.liquid ? 0.12 : b.shape === 1 ? 0.5 : (16 - (b.height || 16)) / 16;
      draw(left, [k, k * 0.5, 0, k * (1 - h), 0, S * 0.25 + S * h * 0.5], 0.28);
      draw(right, [k, -k * 0.5, 0, k * (1 - h), S / 2, S * 0.5 + S * h * 0.5], 0.45);
      draw(top, [k, k * 0.5, -k, k * 0.5, S / 2, S * h], 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ICONS[id] = c.toDataURL();
  }
}

function initBlocks() {
  buildTextures();
  defineBlocks();
  defineItems();
  if (texLayers.length > 255) throw new Error('Doku katmanı sınırı aşıldı: ' + texLayers.length);
  buildIcons();
  buildItemIcons();
  defineRecipes();
  defineCreativeTabs();
}
