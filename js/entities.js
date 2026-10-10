'use strict';
// ---------------------------------------------------------------------------
// Canlılar (mob), kutu modelleri, yapay zekâ ve parçacık sistemi
// ---------------------------------------------------------------------------

const BOX_UV = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]]; // yüz başına (u ekseni, v ekseni)
const _bm = new Float32Array(16);
// Doku atlasında beyaz piksel: dokusuz kutular (oklar, ejderha, kristal) için
const SKIN_W = 512, SKIN_H = 512;
const WHITE_UV = [0.5 / SKIN_W, 0.5 / SKIN_H];

// Dönüştürülmüş kutuyu vertex dizisine ekle (24 vertex, her biri 9 float).
// rects: 6 yüzün atlas dikdörtgenleri [u0, v0, u1, v1] (yoksa düz renk), col: renk/ton çarpanı
function addBox(out, n, m, x0, y0, z0, x1, y1, z1, col, light, px = 16, rects = null) {
  for (let f = 0; f < 6; f++) {
    const nn = FACE_N[f];
    const wnx = m[0] * nn[0] + m[4] * nn[1] + m[8] * nn[2];
    const wny = m[1] * nn[0] + m[5] * nn[1] + m[9] * nn[2];
    const wnz = m[2] * nn[0] + m[6] * nn[1] + m[10] * nn[2];
    const shade = (wny >= 0 ? 0.8 + 0.2 * wny : 0.8 + 0.3 * wny) - 0.12 * Math.abs(wnx) + 0.02 * wnz;
    const cr = col[0] * shade, cg = col[1] * shade, cb = col[2] * shade;
    const R = rects && rects[f];
    for (let c = 0; c < 4; c++) {
      const C = FACE_CORNERS[f][c];
      const x = C[0] ? x1 : x0, y = C[1] ? y1 : y0, z = C[2] ? z1 : z0;
      const o = n * 9;
      out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[o + 3] = cr; out[o + 4] = cg; out[o + 5] = cb;
      if (R) {
        // Yüzü dışarıdan bakan için düz görünecek şekilde eşle (u sağa, v aşağı)
        let s, t;
        switch (f) {
          case 0: s = 1 - C[2]; t = 1 - C[1]; break;
          case 1: s = C[2]; t = 1 - C[1]; break;
          case 2: s = C[0]; t = C[2]; break;
          case 3: s = C[0]; t = 1 - C[2]; break;
          case 4: s = C[0]; t = 1 - C[1]; break;
          default: s = 1 - C[0]; t = 1 - C[1];
        }
        out[o + 6] = R[0] + (R[2] - R[0]) * s; out[o + 7] = R[1] + (R[3] - R[1]) * t;
      } else { out[o + 6] = WHITE_UV[0]; out[o + 7] = WHITE_UV[1]; }
      out[o + 8] = light;
      n++;
    }
  }
  return n;
}

const P16 = 1 / 16;
// skin: renk dizisi ya da { c: renk, pat: desen, n: gürültü, faces: { front|top|...: çizici } }
function part(box, skin, anim, pivot) {
  return { raw: box, box: box.map((v) => v * P16), skin: Array.isArray(skin) ? { c: skin } : skin, anim: anim || null, pivot: pivot ? pivot.map((v) => v * P16) : null, rects: null };
}

// --- Yüz çizicileri (8x8 kafa ön yüzü vb. için; w, h piksel boyutu) ----------
const FACE_NAMES = ['right', 'left', 'top', 'bottom', 'back', 'front'];
const K = (r, g, b) => [r / 255, g / 255, b / 255];
const drawRows = (rows, pal) => (set, w, h) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) set(x, y, c); } });
const FACE_ZOMBIE = drawRows(['', '', '', '.kk..kk.', '.ee..ee.', '...nn...', '..m..m..', '..mmmm..'], { k: K(30, 50, 25), e: K(10, 20, 10), n: K(70, 100, 55), m: K(55, 80, 45) });
const FACE_STEVE = drawRows(['hhhhhhhh', 'hhhhhhhh', 'h......h', '........', '.wb..bw.', '...nn...', '..mmmm..', '..m..m..'], { h: K(55, 38, 20), w: K(255, 255, 255), b: K(80, 60, 170), n: K(140, 95, 70), m: K(105, 65, 45) });
const FACE_CREEPER = drawRows(['', '', '.kk..kk.', '.kk..kk.', '...kk...', '..kkkk..', '..kkkk..', '..k..k..'], { k: K(12, 12, 12) });
const FACE_SKELETON = drawRows(['', '', '', '.kk..kk.', '.kk..kk.', '...kk...', '.ttttt..', '.t.t.t..'], { k: K(30, 30, 30), t: K(90, 90, 88) });
const FACE_PIG = drawRows(['', '', '', '.wk..kw.', '', '', '', ''], { w: K(255, 255, 255), k: K(20, 20, 20) });
const FACE_SNOUT = drawRows(['', '.kk..', ''].map((r) => r), { k: K(150, 80, 80) });
const FACE_COW = drawRows(['', '', 'w......w', 'k......k', '', '', '', ''], { w: K(240, 240, 240), k: K(15, 15, 15) });
const FACE_SHEEP = drawRows(['', 'wk..kw', '', '', '', ''], { w: K(240, 240, 240), k: K(20, 20, 20) });
const FACE_CHICKEN = drawRows(['', 'k..k', '', '', '', ''], { k: K(15, 15, 15) });
const FACE_SPIDER = drawRows(['', '', '.rr..rr.', '.r....r.', '..r..r..', '', '', ''], { r: K(220, 30, 25) });
const FACE_ENDER = drawRows(['', '', '', '', 'ppp..ppp', '', '', ''], { p: K(220, 120, 255) });
const FACE_PIGLIN = drawRows(['', '', '', '.wk...kw.', '', '', '..k...k..', ''], { w: K(255, 255, 255), k: K(30, 20, 20) });
const RIBS = (set, w, h) => { for (let y = 0; y < h; y++) if (y % 3 === 2) for (let x = 1; x < w - 1; x++) set(x, y, K(40, 40, 40)); for (let y = 0; y < h; y++) set(w >> 1, y, K(200, 200, 196)); };
const SHOE = (set, w, h) => { for (let x = 0; x < w; x++) for (let y = h - 2; y < h; y++) set(x, y, K(70, 70, 70)); };

const SKIN = { c: K(96, 150, 80), pat: 'rot' }, SHIRT = { c: K(0, 140, 150) }, PANTS = { c: K(70, 60, 160), faces: { front: SHOE, back: SHOE, left: SHOE, right: SHOE } };
const PINK = { c: K(240, 160, 158) };
const COWC = { c: K(84, 58, 38), pat: 'cow' };
const CREEP = { c: K(92, 184, 76), pat: 'creeper' }, WOOL = { c: K(236, 236, 232), pat: 'wool' }, SHEEPF = { c: K(200, 170, 145) };
const ENDER = { c: K(20, 14, 24), n: 0.12 };
const PIGSKIN = { c: K(225, 155, 145) }, ROT = { c: K(115, 160, 100), pat: 'rot' }, PIGPANTS = { c: K(110, 80, 52) };
const BONEC = { c: K(205, 205, 200), pat: 'bone' };
const SPID = { c: K(55, 47, 42), pat: 'spider' };
const CHICK = { c: K(245, 245, 240), pat: 'wool' }, BEAK = { c: K(240, 175, 50) }, WATTLE = { c: K(215, 30, 30) };
const BLACK = [0.08, 0.08, 0.08];
const HEAD = (c, front, extra) => Object.assign({}, c, { faces: Object.assign({ front }, extra || {}) });

// Örümcek bacakları: her iki yanda 4 bacak
function spiderLegs() {
  const legs = [];
  for (let k = 0; k < 4; k++) {
    const z = -3 + k * 2.2, anim = k % 2 ? 'spA' : 'spB';
    legs.push(part([4, 5, z - 1, 16, 7, z + 1], SPID, anim, [4, 6, z]));
    legs.push(part([-16, 5, z - 1, -4, 7, z + 1], SPID, anim === 'spA' ? 'spB' : 'spA', [-4, 6, z]));
  }
  return legs;
}

const MOB_TYPES = {
  player: {
    name: 'Oyuncu', hw: 0.3, h: 1.8, health: 20, speed: 0, hostile: false,
    parts: [
      part([-4, 24, -4, 4, 32, 4], HEAD({ c: K(198, 150, 115) }, FACE_STEVE, { top: (set, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, K(55, 38, 20)); }, back: (set, w, h) => { for (let y = 0; y < h - 2; y++) for (let x = 0; x < w; x++) set(x, y, K(55, 38, 20)); }, left: (set, w, h) => { for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) set(x, y, K(55, 38, 20)); }, right: (set, w, h) => { for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) set(x, y, K(55, 38, 20)); } }), 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], SHIRT),
      part([4, 12, -2, 8, 24, 2], { c: K(198, 150, 115), faces: { top: (set, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, K(0, 140, 150)); }, front: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, back: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, left: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, right: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); } } }, 'pArmR', [6, 22, 0]),
      part([-8, 12, -2, -4, 24, 2], { c: K(198, 150, 115), faces: { top: (set, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, K(0, 140, 150)); }, front: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, back: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, left: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, right: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); } } }, 'pArmL', [-6, 22, 0]),
      part([-4, 0, -2, 0, 12, 2], PANTS, 'legA', [-2, 12, 0]),
      part([0, 0, -2, 4, 12, 2], PANTS, 'legB', [2, 12, 0]),
    ],
  },
  enderman: {
    name: 'Enderman', hw: 0.3, h: 2.9, health: 40, speed: 3.2, hostile: false, neutral: true, dmg: 7, sound: 'enderman',
    parts: [
      part([-4, 40, -4, 4, 48, 4], HEAD(ENDER, FACE_ENDER), 'head', [0, 40, 0]),
      part([-4, 28, -2, 4, 40, 2], ENDER),
      part([4, 12, -1, 6, 40, 1], ENDER, 'legB', [5, 39, 0]),
      part([-6, 12, -1, -4, 40, 1], ENDER, 'legA', [-5, 39, 0]),
      part([-3, 0, -1, -1, 28, 1], ENDER, 'legA', [-2, 28, 0]),
      part([1, 0, -1, 3, 28, 1], ENDER, 'legB', [2, 28, 0]),
    ],
  },
  zpiglin: {
    name: 'Zombi Piglin', hw: 0.3, h: 1.95, health: 20, speed: 2.3, hostile: false, neutral: true, dmg: 5, sound: 'zpiglin',
    parts: [
      part([-5, 24, -4, 5, 32, 4], HEAD(PIGSKIN, FACE_PIGLIN), 'head', [0, 24, 0]),
      part([-2, 25, -5, 2, 28, -4], HEAD({ c: K(200, 120, 115) }, FACE_SNOUT), 'head', [0, 24, 0]),
      part([-6, 28, -1, -5, 31, 2], ROT, 'head', [0, 24, 0]),
      part([5, 28, -1, 6, 31, 2], PIGSKIN, 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], { c: K(225, 155, 145), pat: 'piglin' }),
      part([4, 12, -2, 8, 24, 2], PIGSKIN, 'legB', [6, 22, 0]),
      part([-8, 12, -2, -4, 24, 2], ROT, 'legA', [-6, 22, 0]),
      part([5, 10, -6, 7, 12.5, 6], { c: K(250, 214, 64) }, 'legB', [6, 22, 0]),
      part([-4, 0, -2, 0, 12, 2], PIGPANTS, 'legA', [-2, 12, 0]),
      part([0, 0, -2, 4, 12, 2], PIGPANTS, 'legB', [2, 12, 0]),
    ],
  },
  pig: {
    name: 'Domuz', hw: 0.45, h: 0.9, health: 10, speed: 1.3, hostile: false, sound: 'pig',
    parts: [
      part([-5, 6, -8, 5, 14, 8], PINK),
      part([-4, 8, -15, 4, 16, -7], HEAD(PINK, FACE_PIG), 'head', [0, 12, -8]),
      part([-2, 9, -16, 2, 12, -15], HEAD({ c: K(225, 140, 140) }, FACE_SNOUT), 'head', [0, 12, -8]),
      part([-5, 0, -7, -1, 6, -3], PINK, 'legA', [0, 6, -5]),
      part([1, 0, -7, 5, 6, -3], PINK, 'legB', [0, 6, -5]),
      part([-5, 0, 3, -1, 6, 7], PINK, 'legB', [0, 6, 5]),
      part([1, 0, 3, 5, 6, 7], PINK, 'legA', [0, 6, 5]),
    ],
  },
  cow: {
    name: 'İnek', hw: 0.45, h: 1.4, health: 10, speed: 1.1, hostile: false, sound: 'cow',
    parts: [
      part([-6, 12, -9, 6, 22, 9], COWC),
      part([-2, 10, 3, 2, 12, 7], { c: K(240, 170, 170) }),
      part([-4, 16, -15, 4, 24, -9], HEAD(COWC, FACE_COW), 'head', [0, 20, -9]),
      part([-3, 16, -16, 3, 19, -15], { c: K(200, 170, 160) }, 'head', [0, 20, -9]),
      part([-5, 22, -13, -4, 25, -12], { c: K(220, 215, 200) }, 'head', [0, 20, -9]),
      part([4, 22, -13, 5, 25, -12], { c: K(220, 215, 200) }, 'head', [0, 20, -9]),
      part([-6, 0, -8, -2, 12, -4], COWC, 'legA', [0, 12, -6]),
      part([2, 0, -8, 6, 12, -4], COWC, 'legB', [0, 12, -6]),
      part([-6, 0, 4, -2, 12, 8], COWC, 'legB', [0, 12, 6]),
      part([2, 0, 4, 6, 12, 8], COWC, 'legA', [0, 12, 6]),
    ],
  },
  sheep: {
    name: 'Koyun', hw: 0.45, h: 1.3, health: 8, speed: 1.1, hostile: false, sound: 'sheep',
    parts: [
      part([-6, 10, -9, 6, 20, 9], WOOL),
      part([-3, 14, -15, 3, 20, -7], HEAD(SHEEPF, FACE_SHEEP), 'head', [0, 17, -8]),
      // Yün kafayı üstten, yanlardan ve arkadan sarar; yüz açıkta kalır (Minecraft)
      part([-3.6, 15.5, -14.2, 3.6, 20.6, -7.6], WOOL, 'head', [0, 17, -8]),
      part([-5, 0, -7, -1, 10, -3], SHEEPF, 'legA', [0, 10, -5]),
      part([1, 0, -7, 5, 10, -3], SHEEPF, 'legB', [0, 10, -5]),
      part([-5, 0, 3, -1, 10, 7], SHEEPF, 'legB', [0, 10, 5]),
      part([1, 0, 3, 5, 10, 7], SHEEPF, 'legA', [0, 10, 5]),
      part([-5.5, 5, -7.5, -0.5, 10, -2.5], WOOL, 'legA', [0, 10, -5]),
      part([0.5, 5, -7.5, 5.5, 10, -2.5], WOOL, 'legB', [0, 10, -5]),
      part([-5.5, 5, 2.5, -0.5, 10, 7.5], WOOL, 'legB', [0, 10, 5]),
      part([0.5, 5, 2.5, 5.5, 10, 7.5], WOOL, 'legA', [0, 10, 5]),
    ],
  },
  zombie: {
    name: 'Zombi', hw: 0.3, h: 1.95, health: 20, speed: 2.4, hostile: true, sound: 'zombie',
    parts: [
      part([-4, 24, -4, 4, 32, 4], HEAD(SKIN, FACE_ZOMBIE), 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], SHIRT),
      part([4, 12, -2, 8, 24, 2], { c: K(96, 150, 80), pat: 'rot', faces: { top: (s, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, front: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, back: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, left: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, right: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); } } }, 'armR', [6, 22, 0]),
      part([-8, 12, -2, -4, 24, 2], { c: K(96, 150, 80), pat: 'rot', faces: { top: (s, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, front: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, back: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, left: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); }, right: (s, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) s(x, y, K(0, 140, 150)); } } }, 'armL', [-6, 22, 0]),
      part([-4, 0, -2, 0, 12, 2], PANTS, 'legA', [-2, 12, 0]),
      part([0, 0, -2, 4, 12, 2], PANTS, 'legB', [2, 12, 0]),
    ],
  },
  creeper: {
    name: 'Creeper', hw: 0.3, h: 1.7, health: 20, speed: 2.1, hostile: true, sound: 'creeper',
    parts: [
      part([-4, 18, -4, 4, 26, 4], HEAD(CREEP, FACE_CREEPER), 'head', [0, 18, 0]),
      part([-4, 6, -2, 4, 18, 2], CREEP),
      part([-4, 0, -6, 0, 6, -2], CREEP, 'legA', [0, 6, -2]),
      part([0, 0, -6, 4, 6, -2], CREEP, 'legB', [0, 6, -2]),
      part([-4, 0, 2, 0, 6, 6], CREEP, 'legB', [0, 6, 2]),
      part([0, 0, 2, 4, 6, 6], CREEP, 'legA', [0, 6, 2]),
    ],
  },
  skeleton: {
    name: 'İskelet', hw: 0.3, h: 1.99, health: 20, speed: 2.3, hostile: true, ranged: true, burns: true, dmg: 3, sound: 'skeleton',
    parts: [
      part([-4, 24, -4, 4, 32, 4], HEAD(BONEC, FACE_SKELETON), 'head', [0, 24, 0]),
      part([-4, 12, -2, 4, 24, 2], Object.assign({}, BONEC, { faces: { front: RIBS, back: RIBS } })),
      part([5, 12, -1, 7, 24, 1], BONEC, 'armR', [6, 22, 0]),
      part([-7, 12, -1, -5, 24, 1], BONEC, 'armL', [-6, 22, 0]),
      part([-7.5, 7, -7, -6.5, 10, 7], { c: K(120, 85, 45) }, 'armL', [-6, 22, 0]),
      part([-3, 0, -1, -1, 12, 1], BONEC, 'legA', [-2, 12, 0]),
      part([1, 0, -1, 3, 12, 1], BONEC, 'legB', [2, 12, 0]),
    ],
  },
  spider: {
    name: 'Örümcek', hw: 0.65, h: 0.9, health: 16, speed: 3.0, hostile: true, climb: true, dmg: 2, sound: 'spider',
    parts: [
      part([-5, 3, 0, 5, 11, 12], SPID),
      part([-3, 4, -3, 3, 10, 0], SPID),
      part([-4, 4, -11, 4, 12, -3], HEAD(SPID, FACE_SPIDER), 'head', [0, 8, -3]),
    ].concat(spiderLegs()),
  },
  chicken: {
    name: 'Tavuk', hw: 0.2, h: 0.7, health: 4, speed: 1.0, hostile: false, flutter: true, sound: 'chicken',
    parts: [
      part([-3, 4, -4, 3, 10, 4], CHICK),
      part([-4, 5, -3, -3, 9, 3], CHICK, 'wingL', [-3, 9, 0]), part([3, 5, -3, 4, 9, 3], CHICK, 'wingR', [3, 9, 0]),
      part([-2, 9, -6, 2, 15, -3], HEAD(CHICK, FACE_CHICKEN), 'head', [0, 9, -4]),
      part([-2, 12, -8, 2, 14, -6], BEAK, 'head', [0, 9, -4]),
      part([-1, 10, -7, 1, 12, -6], WATTLE, 'head', [0, 9, -4]),
      part([-2, 0, -1, -1, 4, 0], BEAK, 'legA', [-1.5, 4, -0.5]),
      part([1, 0, -1, 2, 4, 0], BEAK, 'legB', [1.5, 4, -0.5]),
    ],
  },
};

// --- Doku atlası: her parça yüzüne desen + ayrıntı çiz ------------------------
const SKIN_DATA = new Uint8ClampedArray(SKIN_W * SKIN_H * 4);
function buildSkinAtlas() {
  const D = SKIN_DATA;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const i = (y * SKIN_W + x) * 4; D[i] = D[i + 1] = D[i + 2] = D[i + 3] = 255; }
  let cx = 3, cy = 0, rowH = 0;
  const alloc = (w, h) => {
    if (cx + w > SKIN_W) { cx = 0; cy += rowH + 1; rowH = 0; }
    const r = [cx, cy]; cx += w + 1; rowH = Math.max(rowH, h);
    return r;
  };
  for (const type in MOB_TYPES) {
    const T = MOB_TYPES[type];
    T.parts.forEach((P, pi) => {
      const b = P.raw, rng = mulberry32(hashStr(type + ':' + pi));
      const w = Math.max(1, Math.round(b[3] - b[0])), h = Math.max(1, Math.round(b[4] - b[1])), d = Math.max(1, Math.round(b[5] - b[2]));
      const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      P.rects = sizes.map(([fw, fh], f) => {
        const [ax, ay] = alloc(fw, fh);
        if (ay + fh > SKIN_H) return null;
        const set = (x, y, c) => {
          if (x < 0 || y < 0 || x >= fw || y >= fh) return;
          const i = ((ay + y) * SKIN_W + ax + x) * 4;
          D[i] = c[0] * 255; D[i + 1] = c[1] * 255; D[i + 2] = c[2] * 255; D[i + 3] = 255;
        };
        paintSkinFace(P.skin, f, fw, fh, rng, set);
        return [ax / SKIN_W, ay / SKIN_H, (ax + fw) / SKIN_W, (ay + fh) / SKIN_H];
      });
    });
  }
}

function paintSkinFace(S, f, w, h, rng, set) {
  const c = S.c, n = S.n === undefined ? 0.07 : S.n;
  const cell = []; for (let i = 0; i < 64; i++) cell.push(rng());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cl = cell[((y >> 1) * 8 + (x >> 1)) & 63];
    let k = 1 + (rng() - 0.5) * 2 * n + (cl - 0.5) * n;
    let col = c;
    switch (S.pat) {
      case 'creeper': { const r = rng(); k = r < 0.18 ? 0.7 : r < 0.45 ? 0.86 : r < 0.85 ? 1 : 1.18; if (rng() < 0.06) col = K(200, 210, 190); break; }
      case 'wool': k = 0.9 + cl * 0.12 + (rng() - 0.5) * 0.06; break;
      case 'cow': if (Math.sin(x * 0.7 + f * 2.1) + Math.cos(y * 0.6 + f) + cl > 1.4) col = K(235, 232, 225); break;
      case 'bone': if (rng() < 0.06) k = 0.75; break;
      case 'spider': if (rng() < 0.1) col = K(90, 75, 65); break;
      case 'rot': if (cl > 0.8) k *= 0.85; break;
      case 'piglin': if (cl > 0.7) col = K(115, 160, 100); break;
    }
    set(x, y, [Math.min(1, col[0] * k), Math.min(1, col[1] * k), Math.min(1, col[2] * k)]);
  }
  const fn = S.faces && S.faces[FACE_NAMES[f]];
  if (fn) fn(set, w, h, rng);
}

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
    this.headPitch = 0; this.headYaw = 0; this.soundTimer = 4 + Math.random() * 8;
    this.anim = Math.random() * 10; this.lookT = 0; this.eatGrass = 0;
  }

  hit(dmg, fx, fz, kb = 1) {
    if (this.dead) return;
    this.health -= dmg;
    this.hurtTime = 0.4;
    const l = Math.hypot(fx, fz) || 1;
    this.vel[0] += (fx / l) * 7 * kb; this.vel[2] += (fz / l) * 7 * kb; this.vel[1] = 5.5;
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
          if (this.game) { this.game.particles.puff(this.pos[0], this.pos[1] + 1.4, this.pos[2], 10, 0.5); this.game.audio.play('teleport', this.pos); }
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
          if (this.fuse === 0) game.audio.play('creeperfuse', p);
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
          // Köylüler köyden uzaklaşmaz; gece evlerine döner
          if (this.home) {
            const hx = this.home[0] - p[0], hz = this.home[2] - p[2], hd = Math.hypot(hx, hz);
            const night = game.sunLevel < 0.35;
            if (hd > (night ? 1.5 : 26)) { this.targetYaw = Math.atan2(-hx, -hz) + (Math.random() - 0.5) * 0.6; this.moving = true; }
            else if (night) this.moving = false;
          }
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
    // Alev büyüsü / alevli ok: saniyede 1 hasar
    if (this.fireT > 0) {
      this.fireT -= dt;
      if (inWater) this.fireT = 0;
      if (Math.random() < dt * 14) game.particles.flame(p[0] + (Math.random() - 0.5) * this.hw * 2, p[1] + Math.random() * this.h, p[2] + (Math.random() - 0.5) * this.hw * 2);
      this.fireTick = (this.fireTick || 0) + dt;
      if (this.fireTick > 1) {
        this.fireTick = 0; this.health -= 1; this.hurtTime = 0.3;
        if (this.health <= 0 && !this.dead) { this.dead = true; this.deathTime = 0; if (performance.now() - (this.lastPlayerHit || -1e9) < 6000) game.mobDrops(this); }
      }
    }
    // Baş: yakındaki oyuncuya bakar (Minecraft'taki gibi), koyun ot yer
    this.anim += dt;
    let ty = 0, tp = 0;
    const dd = Math.hypot(dx, dy + pl.h * 0.8 - this.h * 0.8, dz);
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 2 + Math.random() * 4; this.looking = (hostile || this.angry) || Math.random() < 0.6; }
    if (!pl.dead && dd < (hostile || this.angry ? 20 : 8) && this.looking) {
      let a = Math.atan2(-dx, -dz) - this.yaw;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      ty = clamp(a, -1.2, 1.2);
      tp = clamp(Math.atan2(dy + 1.5 - this.h * 0.85, Math.hypot(dx, dz)), -0.8, 0.8);
    }
    if (this.type === 'sheep') {
      if (this.eatGrass > 0) {
        this.eatGrass -= dt; tp = -0.9; ty = 0;
        if (this.eatGrass <= 0) { const bx = Math.floor(p[0] - Math.sin(this.yaw) * 0.6), bz = Math.floor(p[2] - Math.cos(this.yaw) * 0.6), by = Math.floor(p[1]) - 1; if (world.getBlock(bx, by, bz) === B.GRASS) world.setBlock(bx, by, bz, B.DIRT); }
      } else if (speed === 0 && this.onGround && Math.random() < dt * 0.05) this.eatGrass = 2;
    }
    this.headYaw += (ty - this.headYaw) * Math.min(1, dt * 8);
    this.headPitch += (tp - this.headPitch) * Math.min(1, dt * 8);
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
    if (this.fuse > 0) { const sw = 1 + Math.min(this.fuse / 1.5, 1) * 0.15 + Math.sin(this.fuse * 20) * 0.02; M4.scale(t, sw, sw, sw); M4.mul(base, base, t); }
    const sw = Math.sin(this.walk) * 0.75 * this.walkAmt;
    const flashW = this.fuse > 0 && Math.floor(this.fuse * 8) % 2 === 0;
    // Hasar alınca kırmızı, creeper patlamadan önce beyaz yanıp söner
    const tint = this.hurtTime > 0 || this.dead ? [1, 0.45, 0.45] : flashW ? [1.7, 1.7, 1.7] : [1, 1, 1];
    const idle = Math.sin(this.anim * 1.1);
    for (const P of T.parts) {
      if (P.anim && P.pivot) {
        M4.translate(t, P.pivot[0], P.pivot[1], P.pivot[2]); M4.mul(m, base, t);
        switch (P.anim) {
          case 'head': M4.rotY(t, this.headYaw); M4.mul(m, m, t); M4.rotX(t, this.headPitch); M4.mul(m, m, t); break;
          case 'legA': M4.rotX(t, sw); M4.mul(m, m, t); break;
          case 'legB': M4.rotX(t, -sw); M4.mul(m, m, t); break;
          case 'armR': case 'armL': {
            // Zombi/iskelet: kollar ileri uzanmış, hafifçe sallanır
            const s2 = P.anim === 'armR' ? 1 : -1;
            M4.rotX(t, Math.PI / 2 + s2 * sw * 0.15 + idle * 0.05); M4.mul(m, m, t);
            M4.rotZ(t, s2 * (0.05 + Math.cos(this.anim * 0.9) * 0.04)); M4.mul(m, m, t);
            break;
          }
          case 'pArmR': case 'pArmL': {
            const s2 = P.anim === 'pArmR' ? 1 : -1;
            let ax = -s2 * sw * 0.9;
            if (P.anim === 'pArmR' && this.swing > 0) ax -= Math.sin(this.swing * Math.PI) * 1.4;
            if (P.anim === 'pArmR' && this.holding) ax -= 0.3;
            M4.rotX(t, ax); M4.mul(m, m, t);
            M4.rotZ(t, s2 * (0.05 + idle * 0.03)); M4.mul(m, m, t);
            break;
          }
          case 'spA': case 'spB': {
            const s2 = P.anim === 'spA' ? 1 : -1, side = P.pivot[0] > 0 ? 1 : -1;
            M4.rotY(t, Math.sin(this.walk * 1.4) * 0.45 * this.walkAmt * s2); M4.mul(m, m, t);
            M4.rotZ(t, side * (0.35 + Math.abs(Math.cos(this.walk * 1.4)) * 0.3 * this.walkAmt * (s2 > 0 ? 1 : 0.5))); M4.mul(m, m, t);
            break;
          }
          case 'rotX': M4.rotX(t, P.rx); M4.mul(m, m, t); break; // sabit eğim (köylünün kavuşturulmuş kolları)
          case 'wingL': case 'wingR': {
            const fl = this.onGround ? 0 : Math.abs(Math.sin(this.anim * 18)) * 1.1;
            M4.rotZ(t, (P.anim === 'wingL' ? -1 : 1) * fl); M4.mul(m, m, t);
            break;
          }
        }
        M4.translate(t, -P.pivot[0], -P.pivot[1], -P.pivot[2]); M4.mul(m, m, t);
      } else m.set(base);
      const b = P.box;
      n = addBox(out, n, m, b[0], b[1], b[2], b[3], b[4], b[5], tint, light, 16, P.rects);
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
    this.drops = [];
    this.orbs = [];
    this.spawnTimer = 2;
    this.verts = new Float32Array(9 * 24 * 12 * 40);
  }
  clear() { this.mobs.length = 0; this.arrows.length = 0; this.drops.length = 0; this.orbs.length = 0; }

  // Tecrübe küreleri (Minecraft boyutlarına bölünür)
  spawnXp(x, y, z, amount, spread = 1) {
    if (amount <= 0 || this.game.player.creative) return;
    for (const v of splitXp(amount)) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 1.6) * spread;
      this.orbs.push({ pos: [x, y, z], vel: [Math.cos(a) * sp, 2.5 + Math.random() * 2 * spread, Math.sin(a) * sp], hw: 0.125, h: 0.25, value: v, age: 0, onGround: false, seed: Math.random() * 10 });
    }
  }
  updateOrbs(dt) {
    const g = this.game, w = g.world, pl = g.player;
    pl.xpCd = Math.max(0, (pl.xpCd || 0) - dt);
    for (const o of this.orbs) {
      o.age += dt;
      if (!w.isLoadedAt(o.pos[0], o.pos[2])) continue;
      const v = o.vel;
      const dx = pl.pos[0] - o.pos[0], dy = pl.pos[1] + 0.9 - o.pos[1], dz = pl.pos[2] - o.pos[2], d = Math.hypot(dx, dy, dz);
      // Oyuncu 8 blok içindeyse ona doğru süzülür
      const pull = !pl.dead && d < 8 && d > 0.01 && !pl.creative && o.age > 0.3;
      if (pull) {
        const f = (0.25 + (1 - d / 8) ** 2) * 90 * dt;
        v[0] += (dx / d) * f; v[1] += (dy / d) * f; v[2] += (dz / d) * f;
        const k = Math.pow(0.08, dt);
        v[0] *= k; v[1] *= k; v[2] *= k;
      } else {
        const inWater = isWater(w.getBlock(Math.floor(o.pos[0]), Math.floor(o.pos[1]), Math.floor(o.pos[2])));
        if (inWater) v[1] += (1 - v[1]) * Math.min(1, dt * 3);
        else v[1] -= 11 * dt;
        const k = Math.pow(o.onGround ? 0.05 : 0.4, dt);
        v[0] *= k; v[2] *= k;
      }
      if (boxHitsSolid(w, o.pos[0] - o.hw, o.pos[1] + 0.01, o.pos[2] - o.hw, o.pos[0] + o.hw, o.pos[1] + o.h, o.pos[2] + o.hw)) o.pos[1] += dt * 4;
      o.onGround = moveEntity(w, o, dt, false).ground;
      // Toplama: aynı anda tek küre (Minecraft gibi peş peşe "tın" sesi)
      if (!pl.dead && d < 1.25 && o.age > 0.3 && pl.xpCd <= 0) { pl.xpCd = 0.05; g.collectXp(o.value); o.age = 1e9; }
    }
    // Yakın küreleri birleştir
    if (this.orbs.length > 60) {
      for (let i = 0; i < this.orbs.length; i++) {
        const a = this.orbs[i];
        if (a.age > 300) continue;
        for (let j = i + 1; j < this.orbs.length; j++) {
          const b = this.orbs[j];
          if (b.age <= 300 && Math.abs(a.pos[0] - b.pos[0]) < 1 && Math.abs(a.pos[1] - b.pos[1]) < 1 && Math.abs(a.pos[2] - b.pos[2]) < 1) { a.value += b.value; b.age = 1e9; }
        }
      }
    }
    this.orbs = this.orbs.filter((o) => o.age < 300);
  }

  // Yere düşen eşya (Minecraft'taki gibi döner, toplanır, birleşir, 5 dakikada kaybolur)
  spawnDrop(stack, x, y, z, vx, vy, vz, delay = 0.5) {
    if (!stack || stack.count <= 0) return;
    if (vx === undefined) { vx = (Math.random() - 0.5) * 2.4; vy = 3 + Math.random() * 1.5; vz = (Math.random() - 0.5) * 2.4; }
    this.drops.push({ stack: Object.assign({}, stack), pos: [x, y, z], vel: [vx, vy, vz], hw: 0.125, h: 0.25, age: 0, delay, spin: Math.random() * 6, onGround: false });
    if (this.drops.length > 300) this.drops.shift();
  }

  updateDrops(dt) {
    const g = this.game, w = g.world, pl = g.player;
    for (const d of this.drops) {
      d.age += dt;
      if (!w.isLoadedAt(d.pos[0], d.pos[2])) continue;
      const v = d.vel;
      const inWater = isWater(w.getBlock(Math.floor(d.pos[0]), Math.floor(d.pos[1] + 0.1), Math.floor(d.pos[2])));
      if (inWater) { v[1] += (1.2 - v[1]) * Math.min(1, dt * 3); v[0] *= 0.95; v[2] *= 0.95; }
      else v[1] -= 18 * dt;
      const k = Math.pow(d.onGround ? 0.02 : 0.6, dt);
      v[0] *= k; v[2] *= k;
      if (boxHitsSolid(w, d.pos[0] - d.hw, d.pos[1] + 0.01, d.pos[2] - d.hw, d.pos[0] + d.hw, d.pos[1] + d.h, d.pos[2] + d.hw)) d.pos[1] += dt * 4; // bloğun içinde kaldıysa yukarı it
      const r = moveEntity(w, d, dt, false);
      d.onGround = r.ground;
      if (isLava(w.getBlock(Math.floor(d.pos[0]), Math.floor(d.pos[1]), Math.floor(d.pos[2])))) { d.age = 1e9; g.particles.puff(d.pos[0], d.pos[1] + 0.3, d.pos[2], 4); }
      // Toplama
      if (d.age > d.delay && !pl.dead && Math.abs(pl.pos[0] - d.pos[0]) < 1.3 && Math.abs(pl.pos[2] - d.pos[2]) < 1.3 && d.pos[1] > pl.pos[1] - 0.8 && d.pos[1] < pl.pos[1] + 2.2) {
        if (g.pickup(d.stack)) d.age = 1e9;
      }
    }
    // Yakın aynı eşyaları birleştir
    for (let i = 0; i < this.drops.length; i++) {
      const a = this.drops[i];
      if (a.age > 300 || toolOf(a.stack)) continue;
      for (let j = i + 1; j < this.drops.length; j++) {
        const b = this.drops[j];
        if (b.age > 300 || b.stack.id !== a.stack.id || toolOf(b.stack)) continue;
        if (Math.abs(a.pos[0] - b.pos[0]) < 0.6 && Math.abs(a.pos[1] - b.pos[1]) < 0.6 && Math.abs(a.pos[2] - b.pos[2]) < 0.6 && a.stack.count + b.stack.count <= maxStack(a.stack.id)) {
          a.stack.count += b.stack.count; b.age = 1e9; a.delay = Math.max(a.delay, b.delay);
        }
      }
    }
    this.drops = this.drops.filter((d) => d.age < 300);
  }
  get dragon() { return this.mobs.find((m) => m.type === 'dragon') || null; }

  // Ok fırlat (Minecraft: yerçekimi 20 b/s², tik başına %1 sürtünme)
  shoot(pos, vel, owner, dmg) {
    const a = { pos: pos.slice(), vel: vel.slice(), dir: vel.slice(), owner, dmg, stuck: false, life: 60, age: 0 };
    this.arrows.push(a);
    return a;
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
          if (a.noPick) a.life = 0;
          else if (g.pickup({ id: I.ARROW, count: 1 })) a.life = 0;
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
              m.lastPlayerHit = performance.now();
              if (a.fire && !m.dead && m.type !== 'zpiglin') m.fireT = Math.max(m.fireT || 0, 5);
              g.audio.play(m.dead ? 'mobdeath' : 'mobhurt', m.pos, m.type);
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
    this.updateDrops(dt);
    this.updateOrbs(dt);
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
    for (const m of this.mobs) if (!m.T.boss && !m.T.villager) (m.T.hostile || m.T.neutral) ? hostile++ : passive++;
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
    // Köylüler: köyün yanındayken eksik olan sakinleri evlerinde doğur
    for (const v of w.villagesNear(pl.pos[0], pl.pos[2], 80)) {
      v.residents.forEach((r, i) => {
        if (this.mobs.some((m) => m.village === v && m.resIdx === i)) return;
        if (!w.isLoadedAt(r.pos[0], r.pos[2])) return;
        const m = new Mob('vil_' + r.prof, r.pos[0], r.pos[1], r.pos[2]);
        m.village = v; m.resIdx = i; m.home = r.pos;
        this.mobs.push(m);
      });
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
    let boxes = this.arrows.length * 3 + 2 + 12 + (g.enchTables ? g.enchTables.length * 8 : 0);
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
    if (g.thirdPerson && g.playerModel && !g.player.dead) {
      const p = g.player;
      const sky = g.world.dim === 'overworld' ? g.world.skyLightAt(Math.floor(p.pos[0]), Math.floor(p.pos[1] + 1), Math.floor(p.pos[2])) : 0;
      n = g.playerModel.buildMesh(this.verts, n, cam, g.world.dim === 'overworld' ? Math.max(0.15, sky ? g.sunLevel : 0.3) : 0.7);
    }
    if (g.enchTables) for (const T of g.enchTables) n = bookMesh(this.verts, n, T, cam, g);
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

// Büyü masasındaki süzülen kitap: iki kapak omurga etrafında açılır, sayfalar çevrilir
const _bkM = M4.create(), _bkT = M4.create(), _bkC = M4.create();
function bookMesh(out, n, T, cam, g) {
  const light = Math.max(0.6, g.world.dim === 'overworld' && g.world.skyLightAt(T.x, T.y + 1, T.z) ? g.sunLevel : 0.6);
  M4.translate(_bkM, T.x + 0.5 - cam[0], T.y + 1.05 + Math.sin(T.t * 1.6) * 0.04 - cam[1], T.z + 0.5 - cam[2]);
  M4.rotY(_bkT, T.rot); M4.mul(_bkM, _bkM, _bkT);
  M4.rotX(_bkT, -0.35 * T.open); M4.mul(_bkM, _bkM, _bkT);
  const spread = 0.12 + T.open * 2.0, L = 0.3, H = 0.21;
  const COVER = [0.42, 0.2, 0.1], PAGE = [0.93, 0.9, 0.8], SPINE = [0.36, 0.17, 0.08];
  n = addBox(out, n, _bkM, -0.025, -H, -0.03, 0.025, H, 0.0, SPINE, light);
  // Kapaklar: sağ -π/2 + s/2, sol -π/2 - s/2 (izleyici +z tarafında)
  for (const side of [1, -1]) {
    const th = -Math.PI / 2 + side * spread / 2;
    _bkC.set(_bkM);
    M4.rotY(_bkT, -th); M4.mul(_bkC, _bkC, _bkT);
    n = addBox(out, n, _bkC, 0, -H, -0.012, L, H, 0.012, COVER, light);
    // Sayfa destesi kapağın iç yüzünde
    const z0 = side > 0 ? 0.012 : -0.05, z1 = side > 0 ? 0.05 : -0.012;
    n = addBox(out, n, _bkC, 0.01, -H + 0.02, z0, L - 0.025, H - 0.02, z1, PAGE, light);
  }
  // Çevrilen sayfa
  if (T.open > 0.3) {
    const f = (T.flip % 1), th = -Math.PI / 2 + spread / 2 - f * spread;
    _bkC.set(_bkM);
    M4.rotY(_bkT, -th); M4.mul(_bkC, _bkC, _bkT);
    n = addBox(out, n, _bkC, 0.005, -H + 0.03, -0.004, L - 0.03, H - 0.03, 0.004, PAGE, light);
  }
  return n;
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
  // Keskinlik vuruşu: mavi kıvılcımlar
  enchHit(x, y, z) {
    for (let i = 0; i < 14; i++) {
      this.list.push({ x, y, z, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 5, life: 0.4 + Math.random() * 0.3, layer: -2, u: 0.45, v: 0.85, light: 1, size: 0.06, g: 6 });
    }
  }
  // Büyü masasına kitaplıktan uçan rün
  glyph(fx, fy, fz, tx, ty, tz) {
    const T = 1.4 + Math.random() * 0.6;
    this.list.push({ x: fx, y: fy, z: fz, vx: (tx - fx) / T, vy: (ty - fy) / T + 0.6, vz: (tz - fz) / T, life: T, layer: -3, u: Math.random() * 10, v: 0, light: 1, size: 0.09, g: 0.85 });
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

  fill(cam, sun, orbs) {
    let d = this.data;
    const need = (this.list.length + (orbs ? orbs.length : 0)) * 8;
    if (d.length < need) d = this.data = new Float32Array(need * 2);
    let n = 0;
    // Tecrübe küreleri: yeşil-sarı arası yanıp söner (Minecraft renk döngüsü)
    if (orbs) for (const b of orbs) {
      const o = n * 8, t = b.age * 9 + b.seed;
      d[o] = b.pos[0] - cam[0]; d[o + 1] = b.pos[1] + 0.12 - cam[1]; d[o + 2] = b.pos[2] - cam[2];
      d[o + 3] = -4; d[o + 4] = (Math.sin(t) + 1) * 0.5; d[o + 5] = 1; d[o + 6] = (Math.sin(t + 4.19) + 1) * 0.1;
      d[o + 7] = 0.12 + Math.min(0.14, Math.log2(b.value + 1) * 0.022);
      n++;
    }
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
