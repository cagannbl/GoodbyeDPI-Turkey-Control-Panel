'use strict';
// ---------------------------------------------------------------------------
// Eşyalar (id >= 256): aletler, malzemeler, yiyecekler; Minecraft tarifleri,
// fırın tarifleri, yakıtlar, blok düşürme ve kazma süresi kuralları
// ---------------------------------------------------------------------------

const I = {};
const ITEMS = [];
const ITEM_LAYER = [];  // eşya id -> doku katmanı (elde tutma için)

// Alet seviyeleri: hasat seviyesi, kazma hızı, dayanıklılık, renk
const TIERS = {
  wood: { name: 'Tahta', tier: 1, speed: 2, dur: 59, dmg: 0, col: [154, 118, 64] },
  stone: { name: 'Taş', tier: 2, speed: 4, dur: 131, dmg: 1, col: [128, 128, 128] },
  iron: { name: 'Demir', tier: 3, speed: 6, dur: 250, dmg: 2, col: [222, 222, 222] },
  gold: { name: 'Altın', tier: 1, speed: 12, dur: 32, dmg: 0, col: [250, 214, 64] },
  diamond: { name: 'Elmas', tier: 4, speed: 8, dur: 1561, dmg: 3, col: [84, 228, 216] },
  netherite: { name: 'Netherit', tier: 5, speed: 9, dur: 2031, dmg: 4, col: [76, 66, 72] },
};
const TOOL_KINDS = {
  pickaxe: { name: 'Kazma', block: 'pick', dmg: 2 },
  axe: { name: 'Balta', block: 'axe', dmg: 6 },
  shovel: { name: 'Kürek', block: 'shovel', dmg: 2.5 },
  sword: { name: 'Kılıç', block: null, dmg: 4 },
  hoe: { name: 'Çapa', block: null, dmg: 1 },
};
// Zırh malzemeleri: dayanıklılık çarpanı, parça başına koruma, sertlik (Minecraft değerleri)
const ARMOR_MATS = {
  leather: { name: 'Deri', dur: 5, def: [1, 3, 2, 1], tough: 0, col: [150, 92, 52] },
  gold: { name: 'Altın', dur: 7, def: [2, 5, 3, 1], tough: 0, col: [250, 214, 64] },
  iron: { name: 'Demir', dur: 15, def: [2, 6, 5, 2], tough: 0, col: [212, 212, 212] },
  diamond: { name: 'Elmas', dur: 33, def: [3, 8, 6, 3], tough: 2, col: [84, 228, 216] },
  netherite: { name: 'Netherit', dur: 37, def: [3, 8, 6, 3], tough: 3, col: [86, 74, 80] },
};
const ARMOR_SLOTS = [
  { key: 'HELMET', name: 'Miğfer', mult: 11 }, { key: 'CHESTPLATE', name: 'Göğüslük', mult: 16 },
  { key: 'LEGGINGS', name: 'Pantolon', mult: 15 }, { key: 'BOOTS', name: 'Botlar', mult: 13 },
];

// --- Sprite çizim yardımcıları ------------------------------------------
function clearTile(d) { for (let i = 0; i < 1024; i += 4) d[i + 3] = 0; }
function alphaAt(d, x, y) { return x < 0 || y < 0 || x > 15 || y > 15 ? 0 : d[(y * 16 + x) * 4 + 3]; }
function outlineTile(d, col) {
  const m = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (alphaAt(d, x, y)) continue;
    if (alphaAt(d, x - 1, y) || alphaAt(d, x + 1, y) || alphaAt(d, x, y - 1) || alphaAt(d, x, y + 1)) m.push([x, y]);
  }
  for (const [x, y] of m) px(d, x, y, col[0], col[1], col[2]);
}
function pattern(d, rows, pal) {
  clearTile(d);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) px(d, x, y, c[0], c[1], c[2], c[3] === undefined ? 255 : c[3]); } });
}
const sh = (c, f) => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];
function blob(d, rng, cx, cy, rx, ry, col, jitter = 0.15) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const r = dx * dx + dy * dy;
    if (r > 1 + (rng() - 0.5) * jitter) continue;
    const f = (1.15 - 0.35 * (dx + dy + 1) * 0.5) * (0.9 + rng() * 0.15);
    px(d, x, y, col[0] * f, col[1] * f, col[2] * f);
  }
}
// Sapa göre hizalanmış koordinatlarla alet çizimi (u: sap boyunca, v: dik)
function toolSprite(d, rng, kind, head) {
  clearTile(d);
  const hand = [112, 80, 42];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = x + 0.5 - 1.5, Y = y + 0.5 - 14.5;
    const u = (X - Y) / Math.SQRT2, v = (X + Y) / Math.SQRT2;
    let c = null;
    if (kind === 'sword') {
      if (u >= 4.6 && u <= 16.6 && Math.abs(v) <= Math.min(1.1, (16.8 - u) * 0.7)) c = sh(head, v < -0.3 ? 1.18 : v > 0.3 ? 0.82 : 1);
      else if (u >= 3.4 && u < 4.6 && Math.abs(v) <= 2.7) c = sh(head, 0.7);
      else if (u >= 0.3 && u < 3.4 && Math.abs(v) <= 0.75) c = sh(hand, v < 0 ? 1.15 : 0.85);
    } else {
      let inHead = false;
      if (kind === 'pickaxe') inHead = Math.abs(u - (13.1 - 0.075 * v * v)) <= 0.95 && Math.abs(v) <= 6.4;
      else if (kind === 'axe') inHead = u >= 9.8 && u <= 15.3 && v <= 0.9 && v >= -2.1 - (u - 9.8) * 0.55;
      else if (kind === 'shovel') { const a = (u - 13.3) / 2.6, b = v / 2.1; inHead = a * a + b * b <= 1; }
      else if (kind === 'hoe') inHead = u >= 11.6 && u <= 13.4 && v <= 0.9 && v >= -5.2;
      if (inHead) c = sh(head, v < -0.4 ? 1.18 : v > 0.4 ? 0.8 : 1);
      else if (u >= 0 && u <= (kind === 'shovel' ? 11.2 : 13) && Math.abs(v) <= 0.75) c = sh(hand, v < 0 ? 1.15 : 0.85);
    }
    if (c) { const f = 0.94 + rng() * 0.1; px(d, x, y, c[0] * f, c[1] * f, c[2] * f); }
  }
  outlineTile(d, sh(head, 0.28));
}
function ingotSprite(d, rng, c) {
  pattern(d, [
    '................', '................', '................', '................',
    '......aaaaaa....', '....aabbbbbbaa..', '..aabbbbbbbbcca.', '.abbbbbbbbbccca.',
    '.acbbbbbbbbccca.', '.adccbbbbbccda..', '..aadddccccda...', '....aaaddddaa...',
    '......aaaaa.....', '................', '................', '................',
  ], { a: sh(c, 0.35), b: sh(c, 1.15), c: c, d: sh(c, 0.72) });
}
function gemSprite(d, rng, c) {
  pattern(d, [
    '................', '................', '.....aaaaaa.....', '....abbwbcca....',
    '...abwbbbccca...', '..abwbbbbcccca..', '.abbbbbbbccccda.', '.adbbbbbbcccdda.',
    '..adbbbbcccdda..', '...adbbbccdda...', '....adbbcdda....', '.....adbcda.....',
    '......adda......', '.......aa.......', '................', '................',
  ], { a: sh(c, 0.3), b: sh(c, 1.12), c: c, d: sh(c, 0.7), w: [255, 255, 255] });
}
function dustSprite(d, rng, c) {
  clearTile(d);
  for (let i = 0; i < 70; i++) {
    const x = 3 + Math.floor(rng() * 10), y = 6 + Math.floor(rng() * 8);
    if (Math.abs(x - 7.5) > 6 - (13 - y) * 0.6) continue;
    const f = 0.7 + rng() * 0.5; px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
  }
}
function bucketSprite(d, rng, fill) {
  clearTile(d);
  for (let y = 3; y < 14; y++) {
    const half = 6 - (y - 3) * 0.25;
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      if (Math.abs(dx) > half) continue;
      let c = [180, 180, 185];
      if (y === 3) c = [210, 210, 215];
      else if (y <= 5 && Math.abs(dx) < half - 1) c = fill || [60, 60, 66];
      const f = (dx < 0 ? 1.1 : 0.85) * (0.95 + rng() * 0.08);
      px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
  }
  outlineTile(d, [40, 40, 44]);
}
function appleSprite(d, rng, c, leaf) {
  clearTile(d);
  blob(d, rng, 8, 9.5, 5, 4.6, c, 0.05);
  px(d, 8, 4, 90, 60, 30); px(d, 8, 3, 90, 60, 30); px(d, 9, 3, leaf[0], leaf[1], leaf[2]); px(d, 10, 3, leaf[0], leaf[1], leaf[2]); px(d, 10, 2, leaf[0], leaf[1], leaf[2]);
  px(d, 6, 7, 255, 255, 255);
  outlineTile(d, sh(c, 0.3));
}
function meatSprite(d, rng, c, fat) {
  clearTile(d);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = (x + 0.5 - 8), Y = (y + 0.5 - 8.5);
    const u = (X + Y) / Math.SQRT2, v = (X - Y) / Math.SQRT2;
    const r = (u / 6.5) ** 2 + (v / 3.8) ** 2;
    if (r > 1) continue;
    const isFat = r > 0.62 || Math.abs(v - 1) < 0.5;
    const col = isFat ? fat : c;
    const f = 0.9 + rng() * 0.18; px(d, x, y, col[0] * f, col[1] * f, col[2] * f);
  }
  outlineTile(d, sh(c, 0.35));
}
// Zırh parçaları: 0 miğfer, 1 göğüslük, 2 pantolon, 3 botlar
const ARMOR_ROWS = [
  ['', '', '', '....aaaaaaaa....', '...abbbbbbbbca..', '..abbbbbbbbbcca.', '..abbaaaaaabcca.', '..aba......aca..', '..aba......aca..', '...a........a...'],
  ['', '..aaa....aaa....', '.abbba..abbcca..', '.abbbbaabbbcca..', '.aabbbbbbbccaa..', '..aabbbbbbcca...', '...abbbbbbcca...', '...abbbbbbcca...', '...abbbbbbcca...', '...abbbbbbcca...', '...abbbbbbcca...', '...aabbbbbcaa...', '....aaaaaaaa....'],
  ['', '', '...aaaaaaaaaa...', '...abbbbbbbcca..', '...abbbbbbbcca..', '...abbbaabbcca..', '...abbba.abcca..', '...abbba.abcca..', '...abbba.abcca..', '...abbba.abcca..', '...abbba.abcca..', '...abbba.abcca..', '...aaaaa.aaaaa..'],
  ['', '', '', '', '', '', '...aaa....aaa...', '...aba....aca...', '...aba....aca...', '..abba....acca..', '.abbba....accca.', '.abbba....accca.', '.aaaaa....aaaaa.'],
];
function armorSprite(d, rng, slot, c) {
  pattern(d, ARMOR_ROWS[slot], { a: sh(c, 0.35), b: sh(c, 1.1), c: sh(c, 0.75) });
  for (let i = 0; i < 1024; i += 4) if (d[i + 3] && rng() < 0.25) { d[i] *= 0.93; d[i + 1] *= 0.93; d[i + 2] *= 0.93; }
}
function bowSprite(d, rng, pull) {
  clearTile(d);
  const A = [2.5, 3.5], Z = [12.5, 13.5], n = [0.7071, -0.7071], wood = [126, 88, 46];
  const pt = (t, b) => [A[0] + (Z[0] - A[0]) * t + n[0] * b, A[1] + (Z[1] - A[1]) * t + n[1] * b];
  const pb = pull * 2.6;
  for (let k = 0; k <= 60; k++) {
    const t = k / 60, [x, y] = pt(t, -pb * (1 - Math.abs(2 * t - 1)));
    px(d, Math.floor(x), Math.floor(y), 225, 225, 225);
  }
  if (pull) {
    const [mx, my] = pt(0.5, -pb);
    for (let k = 0; k < 10; k++) px(d, Math.floor(mx + n[0] * k), Math.floor(my + n[1] * k), 140, 100, 60);
    px(d, Math.floor(mx + n[0] * 10), Math.floor(my + n[1] * 10), 210, 210, 215);
  }
  for (let k = 0; k <= 60; k++) {
    const t = k / 60, [x, y] = pt(t, 4.2 * Math.sin(Math.PI * t));
    const c = Math.abs(t - 0.5) < 0.09 ? [72, 50, 30] : wood, f = 0.85 + rng() * 0.25;
    px(d, Math.floor(x), Math.floor(y), c[0] * f, c[1] * f, c[2] * f);
  }
  outlineTile(d, [40, 28, 14]);
}
function arrowSprite(d, rng) {
  clearTile(d);
  for (let k = 0; k < 11; k++) px(d, 3 + k, 12 - k, 130, 96, 56);
  for (const [x, y] of [[13, 2], [12, 2], [13, 3], [14, 1], [11, 2], [13, 4]]) px(d, x, y, 200, 200, 205);
  for (const [x, y] of [[2, 12], [3, 13], [2, 13], [1, 13], [2, 14], [3, 14], [1, 12]]) px(d, x, y, 235, 235, 235);
  outlineTile(d, [40, 30, 20]);
}
function featherSprite(d, rng) {
  clearTile(d);
  for (let k = 0; k < 13; k++) {
    const x = 2 + k, y = 14 - k;
    px(d, x, y, 200, 200, 200);
    if (k > 2 && k < 12) for (let w = 1; w <= Math.min(3, 12 - k); w++) { px(d, x - w, y - w, 245, 245, 245); px(d, x + w, y + w, 228, 228, 228); }
  }
  outlineTile(d, [110, 110, 110]);
}
function stickSprite(d, rng) {
  clearTile(d);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = x + 0.5 - 2, Y = y + 0.5 - 14;
    const u = (X - Y) / Math.SQRT2, v = (X + Y) / Math.SQRT2;
    if (u >= 0 && u <= 15 && Math.abs(v) <= 0.75) { const f = v < 0 ? 1.15 : 0.85; px(d, x, y, 120 * f, 86 * f, 46 * f); }
  }
  outlineTile(d, [50, 34, 16]);
}

// --- Eşya tanımları --------------------------------------------------------
let nextItemId = 256;
function item(key, name, draw, o = {}) {
  const id = nextItemId++;
  I[key] = id;
  makeTex('item_' + key, draw);
  ITEM_LAYER[id] = TEX['item_' + key];
  ITEMS[id] = Object.assign({ id, key, name, stack: 64 }, o);
  return id;
}

function defineItems() {
  item('STICK', 'Çubuk', (d, r) => stickSprite(d, r), { fuel: 2.5 });
  item('COAL', 'Kömür', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 5, 4.5, [38, 38, 40], 0.4); outlineTile(d, [12, 12, 12]); }, { fuel: 40 });
  item('CHARCOAL', 'Odun Kömürü', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 5, 4.5, [52, 42, 32], 0.4); outlineTile(d, [16, 12, 8]); }, { fuel: 40 });
  item('IRON_INGOT', 'Demir Külçesi', (d, r) => ingotSprite(d, r, [215, 215, 215]));
  item('GOLD_INGOT', 'Altın Külçesi', (d, r) => ingotSprite(d, r, [250, 210, 50]));
  item('NETHERITE_SCRAP', 'Netherit Hurdası', (d, r) => { clearTile(d); blob(d, r, 8, 9, 5.5, 4, [100, 74, 66], 0.5); outlineTile(d, [40, 28, 26]); });
  item('NETHERITE_INGOT', 'Netherit Külçesi', (d, r) => ingotSprite(d, r, [78, 68, 74]));
  item('DIAMOND', 'Elmas', (d, r) => gemSprite(d, r, [90, 230, 220]));
  item('EMERALD', 'Zümrüt', (d, r) => gemSprite(d, r, [40, 210, 100]));
  item('LAPIS', 'Lapis Lazuli', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 4.5, 5, [40, 80, 200], 0.4); outlineTile(d, [14, 26, 70]); });
  item('REDSTONE_DUST', 'Kızıltaş Tozu', (d, r) => dustSprite(d, r, [210, 20, 15]));
  item('QUARTZ', 'Nether Kuvarsı', (d, r) => gemSprite(d, r, [236, 228, 220]));
  item('FLINT', 'Çakmaktaşı', (d, r) => { clearTile(d); blob(d, r, 8, 9, 4, 5, [70, 70, 74], 0.3); outlineTile(d, [20, 20, 22]); });
  item('GUNPOWDER', 'Barut', (d, r) => dustSprite(d, r, [110, 110, 110]));
  item('NETHER_BRICK', 'Nether Tuğlası (Eşya)', (d, r) => {
    pattern(d, ['', '', '', '', '', '...aaaaaaaaaa...', '..abbbbbbbbbba..', '..abbbbbbbbcca..', '..accccccccdda..', '...aaaaaaaaaa...'], { a: [30, 14, 16], b: [96, 44, 52], c: [74, 34, 40], d: [54, 24, 28] });
  });
  item('ENDER_PEARL', 'Ender İncisi', (d, r) => { clearTile(d); blob(d, r, 8, 8, 5, 5, [30, 110, 100], 0.05); px(d, 6, 6, 160, 240, 220); px(d, 7, 6, 120, 210, 190); outlineTile(d, [10, 40, 36]); }, { stack: 16 });
  item('ENDER_EYE', 'Sonveren Gözü', (d, r) => {
    clearTile(d); blob(d, r, 8, 8, 5, 5, [60, 150, 90], 0.05);
    for (let y = 6; y < 11; y++) for (let x = 7; x < 9; x++) px(d, x, y, 20, 40, 25);
    px(d, 6, 6, 200, 240, 200); outlineTile(d, [14, 40, 20]);
  });
  item('CHORUS_FRUIT', 'Koro Meyvesi', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 5, 5, [140, 90, 140], 0.4); outlineTile(d, [50, 30, 50]); }, { food: { h: 4, s: 2.4, always: true, teleport: true } });
  item('POPPED_CHORUS', 'Patlamış Koro Meyvesi', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 5, 5, [190, 150, 195], 0.4); outlineTile(d, [70, 50, 75]); });
  item('APPLE', 'Elma', (d, r) => appleSprite(d, r, [215, 30, 30], [60, 150, 40]), { food: { h: 4, s: 2.4 } });
  item('GOLDEN_APPLE', 'Altın Elma', (d, r) => appleSprite(d, r, [250, 205, 50], [250, 240, 120]), { food: { h: 4, s: 9.6, always: true, regen: 5 } });
  item('PORKCHOP', 'Çiğ Domuz Eti', (d, r) => meatSprite(d, r, [230, 120, 120], [250, 210, 200]), { food: { h: 3, s: 1.8 } });
  item('COOKED_PORKCHOP', 'Pişmiş Domuz Eti', (d, r) => meatSprite(d, r, [180, 110, 60], [230, 200, 150]), { food: { h: 8, s: 12.8 } });
  item('BEEF', 'Çiğ Sığır Eti', (d, r) => meatSprite(d, r, [200, 50, 45], [240, 190, 180]), { food: { h: 3, s: 1.8 } });
  item('STEAK', 'Biftek', (d, r) => meatSprite(d, r, [120, 70, 40], [200, 160, 110]), { food: { h: 8, s: 12.8 } });
  item('ROTTEN_FLESH', 'Çürük Et', (d, r) => meatSprite(d, r, [140, 110, 60], [110, 140, 70]), { food: { h: 4, s: 0.8, hunger: 0.8 } });
  item('CHICKEN', 'Çiğ Tavuk', (d, r) => meatSprite(d, r, [240, 190, 170], [250, 225, 210]), { food: { h: 2, s: 1.2, hunger: 0.3 } });
  item('COOKED_CHICKEN', 'Pişmiş Tavuk', (d, r) => meatSprite(d, r, [200, 140, 70], [230, 190, 130]), { food: { h: 6, s: 7.2 } });
  item('BREAD', 'Ekmek', (d, r) => {
    clearTile(d);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const X = x + 0.5 - 8, Y = y + 0.5 - 8.5, u = (X - Y) / Math.SQRT2, v = (X + Y) / Math.SQRT2;
      if ((u / 7) ** 2 + (v / 3.4) ** 2 > 1) continue;
      const crust = v < -0.6 && Math.abs(Math.sin(u * 1.1)) < 0.35;
      const c = crust ? [230, 190, 120] : v < 0 ? [190, 120, 50] : [150, 90, 40];
      const f = 0.92 + r() * 0.12; px(d, x, y, c[0] * f, c[1] * f, c[2] * f);
    }
    outlineTile(d, [70, 40, 15]);
  }, { food: { h: 5, s: 6 } });
  item('WHEAT_SEEDS', 'Buğday Tohumu', (d, r) => {
    clearTile(d);
    for (const [x, y] of [[5, 6], [8, 5], [10, 8], [6, 9], [9, 11], [4, 11], [11, 4], [7, 13]]) {
      px(d, x, y, 90, 150, 50); px(d, x + 1, y, 60, 120, 40); px(d, x, y + 1, 70, 130, 40);
    }
  });
  item('WHEAT', 'Buğday', (d, r) => {
    clearTile(d);
    for (const o of [-2, 0, 2]) for (let k = 0; k < 13; k++) {
      const x = 3 + k + o, y = 14 - k;
      const head = k > 6;
      const c = head ? [220, 186, 90] : [170, 150, 60];
      px(d, x, y, c[0], c[1], c[2]);
      if (head && k % 2) px(d, x - 1, y, 200, 165, 70);
    }
    outlineTile(d, [90, 70, 20]);
  });
  item('BONE', 'Kemik', (d, r) => {
    clearTile(d);
    for (let k = 0; k < 10; k++) { px(d, 4 + k, 11 - k, 235, 232, 220); px(d, 5 + k, 11 - k, 210, 206, 192); }
    for (const [x, y] of [[2, 12], [3, 13], [3, 11], [4, 14], [2, 13], [13, 2], [12, 1], [14, 3], [14, 2], [13, 1]]) px(d, x, y, 240, 238, 228);
    outlineTile(d, [80, 78, 70]);
  });
  item('BONE_MEAL', 'Kemik Tozu', (d, r) => dustSprite(d, r, [235, 235, 240]));
  item('LEATHER', 'Deri', (d, r) => { clearTile(d); blob(d, r, 8, 8.5, 5.5, 5, [150, 90, 50], 0.5); outlineTile(d, [60, 34, 16]); });
  item('STRING', 'İp', (d, r) => {
    clearTile(d);
    for (let a = 0; a < 60; a++) { const t = a / 60; px(d, Math.round(3 + t * 10 + Math.sin(t * 9) * 1.5), Math.round(12 - t * 9 + Math.cos(t * 7) * 1.5), 240, 240, 240); }
    outlineTile(d, [90, 90, 90]);
  });
  item('FEATHER', 'Tüy', (d, r) => featherSprite(d, r));
  item('ARROW', 'Ok', (d, r) => arrowSprite(d, r));
  item('BOW', 'Yay', (d, r) => bowSprite(d, r, 0), { stack: 1, tool: { kind: 'bow', dur: 384 }, fuel: 0 });
  item('BOW_PULL', 'Yay', (d, r) => bowSprite(d, r, 1), { stack: 1, hidden: true });
  item('BED', 'Yatak', (d, r) => {
    pattern(d, ['', '', '', '', '', '..aaaaaaaaaaaa..', '.awwwrrrrrrrrrra.', '.awwwrrrrrrrrrra.', '.abbbbbbbbbbbbba.', '.abbbbbbbbbbbbba.', '.ab.aaaaaaaa.ba.', '.aa..........aa.'],
      { a: [50, 30, 18], w: [236, 236, 236], r: [176, 36, 36], b: [160, 120, 70] });
  }, { stack: 1 });
  item('BUCKET', 'Kova', (d, r) => bucketSprite(d, r, null), { stack: 16 });
  item('WATER_BUCKET', 'Su Kovası', (d, r) => bucketSprite(d, r, [50, 90, 220]), { stack: 1, places: B.WATER });
  item('LAVA_BUCKET', 'Lav Kovası', (d, r) => bucketSprite(d, r, [240, 110, 20]), { stack: 1, places: B.LAVA, fuel: 500 });
  item('FLINT_STEEL', 'Çakmak', (d, r) => {
    clearTile(d);
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 1.5 - 0.3; px(d, Math.round(9 + Math.cos(t) * 4), Math.round(6 + Math.sin(t) * 4), 200, 200, 205); }
    blob(d, r, 5, 11, 3, 3, [70, 70, 74], 0.2);
    outlineTile(d, [30, 30, 32]);
  }, { stack: 1, tool: { kind: 'flint', dur: 64 } });

  for (const t in TIERS) {
    for (const k in TOOL_KINDS) {
      const T = TIERS[t], K = TOOL_KINDS[k];
      item(t.toUpperCase() + '_' + k.toUpperCase(), `${T.name} ${K.name}`, (d, r) => toolSprite(d, r, k, T.col), {
        stack: 1,
        tool: { kind: k, block: K.block, tier: T.tier, speed: T.speed, dur: T.dur, dmg: K.dmg + T.dmg, mat: t },
        fuel: t === 'wood' ? 5 : 0,
      });
    }
  }
  for (const m in ARMOR_MATS) {
    const M = ARMOR_MATS[m];
    ARMOR_SLOTS.forEach((S, k) => {
      item(m.toUpperCase() + '_' + S.key, `${M.name} ${S.name}`, (d, r) => armorSprite(d, r, k, M.col), {
        stack: 1, tool: { kind: 'armor', dur: M.dur * S.mult }, armor: { slot: k, def: M.def[k], tough: M.tough, mat: m },
      });
    });
  }
}

// --- Ortak eşya bilgileri ----------------------------------------------------
function itemDef(id) { return id < 256 ? BLOCKS[id] : ITEMS[id]; }
function itemName(id) { const d = itemDef(id); return d ? d.name : '?'; }
function maxStack(id) { return id < 256 ? 64 : (ITEMS[id] ? ITEMS[id].stack : 64); }
function armorOf(stack) { return stack && stack.id >= 256 && ITEMS[stack.id] ? ITEMS[stack.id].armor || null : null; }
function toolOf(stack) { return stack && stack.id >= 256 && ITEMS[stack.id] ? ITEMS[stack.id].tool || null : null; }
function heldLayer(id) { return id >= 256 ? ITEM_LAYER[id] : TEXF[id * 6 + 2]; }
function isPlaceable(id) { return id > 0 && id < 256; }

function canHarvest(blockId, tool) {
  const b = BLOCKS[blockId];
  if (!b) return false;
  if (!b.tier) return true;
  return !!tool && tool.block === b.tool && tool.tier >= b.tier;
}

// Saniye cinsinden kazma süresi (Minecraft formülü)
function mineTime(blockId, tool) {
  const b = BLOCKS[blockId];
  if (!b || b.hardness < 0) return Infinity;
  if (b.hardness === 0) return 0.05;
  let speed = tool && tool.block && tool.block === b.tool ? tool.speed : 1;
  if (tool && tool.kind === 'sword' && (blockId === B.LEAVES || blockId === B.BIRCH_LEAVES || blockId === B.SPRUCE_LEAVES)) speed = 1.5;
  return b.hardness * (canHarvest(blockId, tool) ? 1.5 : 5) / speed;
}

function blockDrops(blockId, tool) {
  if (!canHarvest(blockId, tool)) return [];
  const r = Math.random();
  switch (blockId) {
    case B.COAL: return [[I.COAL, 1]];
    case B.DIAMOND: return [[I.DIAMOND, 1]];
    case B.EMERALD: return [[I.EMERALD, 1]];
    case B.REDSTONE: return [[I.REDSTONE_DUST, 4 + (r < 0.5 ? 1 : 0)]];
    case B.LAPIS_ORE: return [[I.LAPIS, 4 + Math.floor(r * 5)]];
    case B.QUARTZ_ORE: return [[I.QUARTZ, 1]];
    case B.GRAVEL: return [[r < 0.1 ? I.FLINT : B.GRAVEL, 1]];
    case B.LEAVES: return r < 0.06 ? [[B.OAK_SAPLING, 1]] : r < 0.075 ? [[I.APPLE, 1]] : [];
    case B.BIRCH_LEAVES: return r < 0.06 ? [[B.BIRCH_SAPLING, 1]] : [];
    case B.SPRUCE_LEAVES: return r < 0.06 ? [[B.SPRUCE_SAPLING, 1]] : [];
    case B.CHORUS_PLANT: return r < 0.5 ? [[I.CHORUS_FRUIT, 1]] : [];
    case B.TALL_GRASS: return r < 0.125 ? [[I.WHEAT_SEEDS, 1]] : [];
    case B.BED_FOOT: case B.BED_HEAD: return [[I.BED, 1]];
    case B.WHEAT_7: return [[I.WHEAT, 1], [I.WHEAT_SEEDS, 1 + Math.floor(Math.random() * 3)]];
  }
  if (isWheat(blockId)) return [[I.WHEAT_SEEDS, 1]];
  const d = BLOCKS[blockId].drop;
  return d ? [[d, 1]] : [];
}

// --- Tarifler ------------------------------------------------------------------
const GROUPS = {};
const RECIPES = [];
const groupHas = (g, id) => (typeof g === 'number' ? g === id : GROUPS[g].includes(id));
const groupIcon = (g) => (typeof g === 'number' ? g : GROUPS[g][0]);

function shaped(rows, key, out, n = 1) {
  const w = Math.max(...rows.map((r) => r.length));
  const cells = rows.map((r) => r.padEnd(w, ' ').split('').map((c) => (c === ' ' ? null : key[c])));
  RECIPES.push({ type: 'shaped', w, h: rows.length, cells, out, n });
}
function shapeless(ings, out, n = 1) { RECIPES.push({ type: 'shapeless', ings, out, n }); }

const SMELT = {};
const SMELT_TIME = 5;

function defineRecipes() {
  GROUPS['#planks'] = [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS, B.CRIMSON_PLANKS, B.WARPED_PLANKS];
  GROUPS['#logs'] = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.CRIMSON_STEM, B.WARPED_STEM];
  GROUPS['#stone'] = [B.COBBLE, B.BLACKSTONE];
  GROUPS['#coal'] = [I.COAL, I.CHARCOAL];
  GROUPS['#leaves'] = [B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES];
  GROUPS['#wool'] = [B.WOOL_WHITE, B.WOOL_RED, B.WOOL_ORANGE, B.WOOL_YELLOW, B.WOOL_LIME, B.WOOL_BLUE, B.WOOL_PURPLE, B.WOOL_BLACK];

  shapeless([B.LOG], B.PLANKS, 4);
  shapeless([B.BIRCH_LOG], B.BIRCH_PLANKS, 4);
  shapeless([B.SPRUCE_LOG], B.SPRUCE_PLANKS, 4);
  shapeless([B.CRIMSON_STEM], B.CRIMSON_PLANKS, 4);
  shapeless([B.WARPED_STEM], B.WARPED_PLANKS, 4);
  shaped(['#', '#'], { '#': '#planks' }, I.STICK, 4);
  shaped(['##', '##'], { '#': '#planks' }, B.CRAFTING);
  shaped(['C', 'S'], { C: '#coal', S: I.STICK }, B.TORCH, 4);
  shaped(['###', '# #', '###'], { '#': '#stone' }, B.FURNACE);
  shaped(['###', '# #', '###'], { '#': '#planks' }, B.CHEST);

  const mats = { wood: '#planks', stone: '#stone', iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND };
  for (const t in mats) {
    const T = t.toUpperCase(), key = { X: mats[t], S: I.STICK };
    shaped(['XXX', ' S ', ' S '], key, I[T + '_PICKAXE']);
    shaped(['XX', 'XS', ' S'], key, I[T + '_AXE']);
    shaped(['X', 'S', 'S'], key, I[T + '_SHOVEL']);
    shaped(['X', 'X', 'S'], key, I[T + '_SWORD']);
    shaped(['XX', ' S', ' S'], key, I[T + '_HOE']);
  }
  for (const k of ['PICKAXE', 'AXE', 'SHOVEL', 'SWORD', 'HOE']) shapeless([I['DIAMOND_' + k], I.NETHERITE_INGOT], I['NETHERITE_' + k]);
  const amats = { leather: I.LEATHER, gold: I.GOLD_INGOT, iron: I.IRON_INGOT, diamond: I.DIAMOND };
  for (const m in amats) {
    const M = m.toUpperCase(), key = { X: amats[m] };
    shaped(['XXX', 'X X'], key, I[M + '_HELMET']);
    shaped(['X X', 'XXX', 'XXX'], key, I[M + '_CHESTPLATE']);
    shaped(['XXX', 'X X', 'X X'], key, I[M + '_LEGGINGS']);
    shaped(['X X', 'X X'], key, I[M + '_BOOTS']);
  }
  for (const S of ARMOR_SLOTS) shapeless([I['DIAMOND_' + S.key], I.NETHERITE_INGOT], I['NETHERITE_' + S.key]);
  shaped(['WWW'], { W: I.WHEAT }, I.BREAD);
  shaped(['WWW', 'WWW', 'WWW'], { W: I.WHEAT }, B.HAY);
  shapeless([B.HAY], I.WHEAT, 9);
  shapeless([I.BONE], I.BONE_MEAL, 3);
  shaped([' SX', 'S X', ' SX'], { S: I.STICK, X: I.STRING }, I.BOW);
  shaped(['F', 'S', 'E'], { F: I.FLINT, S: I.STICK, E: I.FEATHER }, I.ARROW, 4);
  shaped(['WWW', 'PPP'], { W: '#wool', P: '#planks' }, I.BED);
  shaped(['SS', 'SS'], { S: I.STRING }, B.WOOL_WHITE);
  const matKey = (m) => (m === 'PLANKS' ? '#planks' : B[m]);
  SLAB_MATS.forEach((m, k) => shaped(['XXX'], { X: matKey(m) }, B.SLAB + k, 6));
  STAIR_MATS.forEach((m, k) => shaped(['X  ', 'XX ', 'XXX'], { X: matKey(m) }, B.STAIRS + k * 4, 4));
  shaped(['PP', 'PP', 'PP'], { P: '#planks' }, B.DOOR, 3);
  shaped(['PPP', 'PPP'], { P: '#planks' }, B.TRAPDOOR, 2);
  shaped(['PSP', 'PSP'], { P: '#planks', S: I.STICK }, B.FENCE, 3);
  shaped(['SPS', 'SPS'], { P: '#planks', S: I.STICK }, B.GATE);
  shaped(['GGG', 'GGG'], { G: B.GLASS }, B.GLASS_PANE, 16);
  shaped(['S S', 'SSS', 'S S'], { S: I.STICK }, B.LADDER, 3);
  shapeless([I.NETHERITE_SCRAP, I.NETHERITE_SCRAP, I.NETHERITE_SCRAP, I.NETHERITE_SCRAP, I.GOLD_INGOT, I.GOLD_INGOT, I.GOLD_INGOT, I.GOLD_INGOT], I.NETHERITE_INGOT);

  const storage = [[I.IRON_INGOT, B.IRON_BLOCK], [I.GOLD_INGOT, B.GOLD_BLOCK], [I.DIAMOND, B.DIAMOND_BLOCK], [I.EMERALD, B.EMERALD_BLOCK],
    [I.COAL, B.COAL_BLOCK], [I.REDSTONE_DUST, B.REDSTONE_BLOCK], [I.LAPIS, B.LAPIS_BLOCK], [I.NETHERITE_INGOT, B.NETHERITE_BLOCK]];
  for (const [it, bl] of storage) { shaped(['XXX', 'XXX', 'XXX'], { X: it }, bl); shapeless([bl], it, 9); }

  shaped(['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: B.SAND }, B.TNT);
  shaped(['##', '##'], { '#': B.STONE }, B.STONE_BRICKS, 4);
  shaped(['##', '##'], { '#': B.SAND }, B.SANDSTONE);
  shaped(['##', '##'], { '#': I.NETHER_BRICK }, B.NETHER_BRICKS);
  shaped(['##', '##'], { '#': I.QUARTZ }, B.QUARTZ_BLOCK);
  shaped(['##', '##'], { '#': B.END_STONE }, B.END_STONE_BRICKS, 4);
  shaped(['##', '##'], { '#': I.POPPED_CHORUS }, B.PURPUR, 4);
  shaped(['#', '#'], { '#': B.PURPUR }, B.PURPUR_PILLAR, 2);
  shaped(['###', 'SSS', '###'], { '#': '#planks', S: I.STICK }, B.BOOKSHELF);
  shaped(['P', 'T'], { P: B.PUMPKIN, T: B.TORCH }, B.JACK);
  shaped(['I I', ' I '], { I: I.IRON_INGOT }, I.BUCKET);
  shapeless([I.IRON_INGOT, I.FLINT], I.FLINT_STEEL);
  shapeless([I.ENDER_PEARL, B.GLOWSTONE], I.ENDER_EYE);
  shaped(['NNN', 'NON', 'NNN'], { N: B.NETHER_BRICKS, O: B.OBSIDIAN }, B.END_FRAME);
  shaped(['GGG', 'GAG', 'GGG'], { G: I.GOLD_INGOT, A: I.APPLE }, I.GOLDEN_APPLE);
  shaped(['Q', 'C'], { Q: I.QUARTZ, C: I.POPPED_CHORUS }, B.END_ROD, 4);
  shaped(['RR', 'RR'], { R: I.REDSTONE_DUST }, B.GLOWSTONE);
  shapeless([B.COBBLE, '#leaves'], B.MOSSY_COBBLE);
  shapeless([B.WOOL_WHITE, B.POPPY], B.WOOL_RED);
  shapeless([B.WOOL_WHITE, B.DANDELION], B.WOOL_YELLOW);
  shapeless([B.WOOL_WHITE, B.BLUE_FLOWER], B.WOOL_BLUE);
  shapeless([B.WOOL_WHITE, I.LAPIS], B.WOOL_BLUE);
  shapeless([B.WOOL_RED, B.WOOL_YELLOW], B.WOOL_ORANGE, 2);
  shapeless([B.WOOL_RED, B.WOOL_BLUE], B.WOOL_PURPLE, 2);
  shapeless([B.WOOL_YELLOW, '#leaves'], B.WOOL_LIME);
  shapeless([B.WOOL_WHITE, '#coal'], B.WOOL_BLACK);

  // Fırın
  const sm = (from, to) => { SMELT[from] = to; };
  sm(B.SAND, B.GLASS); sm(B.COBBLE, B.STONE); sm(B.IRON, I.IRON_INGOT); sm(B.GOLD, I.GOLD_INGOT);
  sm(B.NETHER_GOLD_ORE, I.GOLD_INGOT); sm(B.ANCIENT_DEBRIS, I.NETHERITE_SCRAP); sm(B.NETHERRACK, I.NETHER_BRICK);
  for (const l of GROUPS['#logs']) sm(l, I.CHARCOAL);
  sm(I.PORKCHOP, I.COOKED_PORKCHOP); sm(I.BEEF, I.STEAK); sm(I.CHICKEN, I.COOKED_CHICKEN); sm(I.CHORUS_FRUIT, I.POPPED_CHORUS);
  sm(B.COAL, I.COAL); sm(B.DIAMOND, I.DIAMOND); sm(B.EMERALD, I.EMERALD); sm(B.QUARTZ_ORE, I.QUARTZ);
  sm(B.REDSTONE, I.REDSTONE_DUST); sm(B.LAPIS_ORE, I.LAPIS); sm(B.CACTUS, B.WOOL_LIME); sm(B.DIRT, B.BRICKS);
}

function fuelTime(id) {
  if (id >= 256) return ITEMS[id] ? ITEMS[id].fuel || 0 : 0;
  if (id === B.COAL_BLOCK) return 400;
  if (GROUPS['#planks'].includes(id) || GROUPS['#logs'].includes(id)) return 7.5;
  if (id === B.CRAFTING || id === B.CHEST || id === B.BOOKSHELF) return 7.5;
  if (isSapling(id)) return 2.5;
  return 0;
}

// Izgaradaki eşyalardan (genişlik gw) eşleşen tarifi bul
function matchRecipe(grid, gw) {
  const gh = grid.length / gw;
  let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
  const ids = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const s = grid[y * gw + x];
    if (!s) continue;
    ids.push(s.id);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (!ids.length) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.type === 'shapeless') {
      if (r.ings.length !== ids.length) continue;
      const left = ids.slice();
      let ok = true;
      for (const g of r.ings) {
        const k = left.findIndex((id) => groupHas(g, id));
        if (k < 0) { ok = false; break; }
        left.splice(k, 1);
      }
      if (ok) return r;
      continue;
    }
    if (r.w !== w || r.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const need = r.cells[y][mirror ? w - 1 - x : x];
        const s = grid[(y0 + y) * gw + x0 + x];
        if (!need) { if (s) ok = false; }
        else if (!s || !groupHas(need, s.id)) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}

// Yaratıcı mod sekmeleri
const CREATIVE_TABS = [];
function defineCreativeTabs() {
  const build = [B.STONE, B.COBBLE, B.MOSSY_COBBLE, B.STONE_BRICKS, B.BRICKS, B.SANDSTONE, B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS,
    B.CRIMSON_PLANKS, B.WARPED_PLANKS, B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.CRIMSON_STEM, B.WARPED_STEM, B.GLASS, B.QUARTZ_BLOCK,
    B.NETHER_BRICKS, B.BLACKSTONE, B.BASALT, B.END_STONE_BRICKS, B.PURPUR, B.PURPUR_PILLAR, B.IRON_BLOCK, B.GOLD_BLOCK,
    B.DIAMOND_BLOCK, B.EMERALD_BLOCK, B.LAPIS_BLOCK, B.REDSTONE_BLOCK, B.COAL_BLOCK, B.NETHERITE_BLOCK, B.OBSIDIAN, B.CRYING_OBSIDIAN,
    B.WOOL_WHITE, B.WOOL_RED, B.WOOL_ORANGE, B.WOOL_YELLOW, B.WOOL_LIME, B.WOOL_BLUE, B.WOOL_PURPLE, B.WOOL_BLACK, B.BEDROCK,
    ...SLAB_MATS.map((m, k) => B.SLAB + k), ...STAIR_MATS.map((m, k) => B.STAIRS + k * 4), B.FENCE, B.GATE, B.GLASS_PANE];
  const nature = [B.GRASS, B.DIRT, B.SAND, B.GRAVEL, B.SNOW, B.SNOWY_GRASS, B.ICE, B.CACTUS, B.PUMPKIN, B.LEAVES, B.BIRCH_LEAVES,
    B.SPRUCE_LEAVES, B.POPPY, B.DANDELION, B.BLUE_FLOWER, B.TALL_GRASS, B.DEAD_BUSH, B.COAL, B.IRON, B.LAPIS_ORE, B.GOLD, B.REDSTONE,
    B.DIAMOND, B.EMERALD, B.WATER, B.LAVA, B.NETHERRACK, B.CRIMSON_NYLIUM, B.WARPED_NYLIUM, B.SOUL_SAND, B.SOUL_SOIL, B.QUARTZ_ORE,
    B.NETHER_GOLD_ORE, B.ANCIENT_DEBRIS, B.MAGMA, B.NETHER_WART_BLOCK, B.WARPED_WART_BLOCK, B.SHROOMLIGHT, B.CRIMSON_FUNGUS,
    B.WARPED_FUNGUS, B.END_STONE, B.CHORUS_PLANT, B.CHORUS_FLOWER, B.DRAGON_EGG, B.OAK_SAPLING, B.BIRCH_SAPLING, B.SPRUCE_SAPLING, B.FARMLAND, B.DIRT_PATH, B.HAY];
  const func = [B.CRAFTING, B.FURNACE, B.CHEST, I.BED, B.DOOR, B.TRAPDOOR, B.LADDER, B.TORCH, B.END_ROD, B.GLOWSTONE, B.JACK, B.BOOKSHELF, B.TNT, B.END_FRAME];
  const tools = [];
  for (const t in TIERS) for (const k in TOOL_KINDS) tools.push(I[t.toUpperCase() + '_' + k.toUpperCase()]);
  tools.push(I.BOW, I.ARROW);
  for (const m in ARMOR_MATS) for (const S of ARMOR_SLOTS) tools.push(I[m.toUpperCase() + '_' + S.key]);
  tools.push(I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.ENDER_PEARL, I.ENDER_EYE, I.BONE_MEAL);
  const mats = [I.STICK, I.COAL, I.CHARCOAL, I.IRON_INGOT, I.GOLD_INGOT, I.DIAMOND, I.EMERALD, I.LAPIS, I.REDSTONE_DUST, I.QUARTZ,
    I.NETHERITE_SCRAP, I.NETHERITE_INGOT, I.FLINT, I.GUNPOWDER, I.NETHER_BRICK, I.CHORUS_FRUIT, I.POPPED_CHORUS, I.APPLE,
    I.GOLDEN_APPLE, I.PORKCHOP, I.COOKED_PORKCHOP, I.BEEF, I.STEAK, I.CHICKEN, I.COOKED_CHICKEN, I.BREAD, I.ROTTEN_FLESH,
    I.WHEAT_SEEDS, I.WHEAT, I.BONE, I.LEATHER, I.STRING, I.FEATHER];
  CREATIVE_TABS.push(
    { name: 'Yapı Blokları', icon: B.BRICKS, items: build },
    { name: 'Doğal Bloklar', icon: B.GRASS, items: nature },
    { name: 'İşlevsel Bloklar', icon: B.CRAFTING, items: func },
    { name: 'Aletler, Silahlar ve Zırh', icon: I.DIAMOND_PICKAXE, items: tools },
    { name: 'Yiyecek ve Malzemeler', icon: I.APPLE, items: mats },
    { name: 'Ara', icon: I.ENDER_EYE, items: null },
  );
}

function buildItemIcons() {
  const S = 48;
  for (const it of ITEMS) {
    if (!it) continue;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tileCanvas(ITEM_LAYER[it.id]), 0, 0, S, S);
    ICONS[it.id] = c.toDataURL();
  }
}
