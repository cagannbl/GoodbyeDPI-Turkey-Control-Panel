'use strict';
// ---------------------------------------------------------------------------
// Tam küp olmayan blokların kutu modelleri (1/16 birim): yarım blok, basamak,
// kapı, tuzak kapı, çit, çit kapısı, cam panel, tırmanma merdiveni, örs.
// Aynı kutular hem çizimde hem çarpışmada kullanılır (çitler 1.5 blok yüksek çarpışır).
// Yönler: 0 -z, 1 +x, 2 +z, 3 -x
// ---------------------------------------------------------------------------

const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Kutuyu blok merkezi etrafında f kez 90° döndür (-z → +x → +z → -x)
// 7. eleman (varsa) bu kutuya özel doku katmanıdır
function rotBox(b, f) {
  const L = b[6];
  for (let k = 0; k < (f & 3); k++) b = [16 - b[5], b[1], b[0], 16 - b[2], b[4], b[3]];
  if (L !== undefined) b[6] = L;
  return b;
}
// 6 yöne çevir (DIR6): model önü -z (z = 0) tarafında
function orient6(b, fc) {
  if (fc < 4) return rotBox(b.slice(), fc);
  const L = b[6];
  // yukarı: (x, y, z) -> (x, 16 - z, y); aşağı: (x, y, z) -> (x, z, 16 - y)
  const r = fc === 4 ? [b[0], 16 - b[5], b[1], b[3], 16 - b[2], b[4]] : [b[0], b[2], 16 - b[4], b[3], b[5], 16 - b[1]];
  if (L !== undefined) r[6] = L;
  return r;
}
// Kızıltaş tozunun görsel olarak bağlandığı bloklar
const wireConnects = (n) => isWire(n) || isRTorch(n) || isLever(n) || isButton(n) || isPlate(n) || isRepeater(n) || n === B.REDSTONE_BLOCK;

const SHAPE_CACHE = [];   // id -> { draw, coll }
const CONNECT_CACHE = {}; // tür:maske -> { draw, coll }

function connects(kind, nid) {
  if (!nid) return false;
  if (OPAQUE[nid] && SOLID[nid]) return true;
  if (kind === 6) return SHAPE[nid] === 6 || SHAPE[nid] === 7;
  return SHAPE[nid] === 8 || nid === B.GLASS;
}

function buildShape(kind, f) {
  const draw = [], coll = [];
  const both = (b) => { draw.push(b); coll.push(b); };
  switch (kind) {
    case 1: both([0, 0, 0, 16, 8, 16]); break;
    case 2: both([0, 8, 0, 16, 16, 16]); break;
    case 3: both([0, 0, 0, 16, 8, 16]); both(rotBox([0, 8, 0, 16, 16, 8], f)); break;
    case 4: both(rotBox(f & 4 ? [0, 0, 0, 3, 16, 16] : [0, 0, 0, 16, 16, 3], f)); break;
    case 5: both(f === 8 ? [0, 0, 0, 16, 3, 16] : rotBox([0, 0, 13, 16, 16, 16], f)); break;
    case 7: {
      const rails = f & 1
        ? [[0, 6, 9, 2, 9, 15], [0, 12, 9, 2, 15, 15], [14, 6, 9, 16, 9, 15], [14, 12, 9, 16, 15, 15]]
        : [[2, 6, 7, 14, 9, 9], [2, 12, 7, 14, 15, 9], [6, 9, 7, 10, 12, 9]];
      const r = f & 2 ? 1 : 0;
      for (const b of [[0, 5, 7, 2, 16, 9], [14, 5, 7, 16, 16, 9]].concat(rails)) draw.push(rotBox(b, r));
      if (!(f & 1)) coll.push(rotBox([0, 0, 6, 16, 24, 10], r));
      break;
    }
    case 9: draw.push(rotBox([0, 0, 0, 16, 16, 1], f)); break;
    case 10: // örs (Minecraft modeli): taban, boyun, gövde, üst
      for (const b of [[2, 0, 2, 14, 4, 14], [4, 4, 3, 12, 5, 13], [6, 5, 4, 10, 10, 12], [3, 10, 0, 13, 16, 16]]) both(rotBox(b, f));
      break;
    case 12: { // yineleyici: ince taş levha + iki meşale (çıkış yönü f&3)
      const torch = TEX[f & 4 ? 'rtorch_on' : 'rtorch_off'];
      both([0, 0, 0, 16, 2, 16]);
      for (const b of [[7, 2, 2, 9, 7, 4, torch], [7, 2, 11, 9, 7, 13, torch]]) draw.push(rotBox(b, f & 3));
      break;
    }
    case 13: { // şalter: taş taban + tahta kol (konum f>>1: 0-3 duvar, 4 zemin; f&1 açık)
      const pos = f >> 1, on = f & 1, wood = TEX.planks;
      if (pos === 4) {
        draw.push([4, 0, 5, 12, 3, 11], on ? [7, 3, 9, 9, 10, 11, wood] : [7, 3, 5, 9, 10, 7, wood]);
      } else {
        draw.push(rotBox([5, 4, 0, 11, 12, 3], pos), rotBox(on ? [7, 8, 3, 9, 13, 6, wood] : [7, 3, 3, 9, 8, 6, wood], pos));
      }
      break;
    }
    case 14: draw.push(rotBox([5, 6, 0, 11, 10, f & 1 ? 1 : 2], f >> 1)); break; // düğme
    case 15: draw.push([1, 0, 1, 15, 1, 15]); break; // basınç plakası
    case 16: both(orient6([0, 0, 4, 16, 16, 16], f)); break; // uzamış piston gövdesi
    case 17: both(orient6([0, 0, 0, 16, 16, 4], f)); both(orient6([6, 6, 4, 10, 10, 16], f)); break; // piston başı
  }
  return { draw, coll };
}

function connectShape(kind, mask) {
  const key = kind * 16 + mask;
  if (CONNECT_CACHE[key]) return CONNECT_CACHE[key];
  const draw = [], coll = [];
  if (kind === 6) {
    draw.push([6, 0, 6, 10, 16, 10]); coll.push([6, 0, 6, 10, 24, 10]);
    for (let d = 0; d < 4; d++) if (mask & (1 << d)) {
      draw.push(rotBox([7, 12, 0, 9, 15, 6], d), rotBox([7, 6, 0, 9, 9, 6], d));
      coll.push(rotBox([6, 0, 0, 10, 24, 6], d));
    }
  } else {
    const c = [7, 0, 7, 9, 16, 9];
    draw.push(c); coll.push(c);
    for (let d = 0; d < 4; d++) if (mask & (1 << d)) { const b = rotBox([7, 0, 0, 9, 16, 7], d); draw.push(b); coll.push(b); }
  }
  return (CONNECT_CACHE[key] = { draw, coll });
}

// Kızıltaş tozu: düz çizgiler + duvara tırmanan şeritler. mask: 0-3 bağlantı, 4-7 yukarı tırmanma
function wireShape(mask) {
  const key = 1000 + mask;
  if (CONNECT_CACHE[key]) return CONNECT_CACHE[key];
  const draw = [];
  let conn = mask & 15;
  if (!conn) draw.push([5, 0, 5, 11, 1, 11]);
  else {
    // Tek bağlantıda çizgi karşı tarafa da uzar (Minecraft)
    if ((conn & (conn - 1)) === 0) conn |= 1 << ((Math.log2(conn) + 2) & 3);
    draw.push([6, 0, 6, 10, 1, 10]);
    for (let d = 0; d < 4; d++) if (conn & (1 << d)) draw.push(rotBox([6, 0, 0, 10, 1, 6], d));
  }
  for (let d = 0; d < 4; d++) if (mask & (16 << d)) draw.push(rotBox([6, 1, 0, 10, 16, 1], d));
  return (CONNECT_CACHE[key] = { draw, coll: [] });
}
// Tozun bağlantı maskesi. nb(d, dy): d yönündeki (d = -1: kendi sütunu) dy yükseklikteki blok
function wireMask(nb) {
  let mask = 0;
  const upFree = !OPAQUE[nb(-1, 1)];
  for (let d = 0; d < 4; d++) {
    const side = nb(d, 0);
    if (wireConnects(side)) mask |= 1 << d;
    else if (upFree && isWire(nb(d, 1)) && OPAQUE[side]) mask |= (1 << d) | (16 << d);
    else if (!OPAQUE[side] && isWire(nb(d, -1))) mask |= 1 << d;
  }
  return mask;
}

// nb(d, dy): d yönündeki komşu blok kimliği (çit/panel/toz için çağrılır)
function shapeOf(id, nb) {
  const kind = SHAPE[id];
  if (kind === 11) return wireShape(wireMask(nb));
  if (kind === 6 || kind === 8) {
    let mask = 0;
    for (let d = 0; d < 4; d++) if (connects(kind, nb(d))) mask |= 1 << d;
    return connectShape(kind, mask);
  }
  return SHAPE_CACHE[id] || (SHAPE_CACHE[id] = buildShape(kind, SHAPEF[id]));
}
