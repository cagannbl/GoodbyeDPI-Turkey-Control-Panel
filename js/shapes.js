'use strict';
// ---------------------------------------------------------------------------
// Tam küp olmayan blokların kutu modelleri (1/16 birim): yarım blok, basamak,
// kapı, tuzak kapı, çit, çit kapısı, cam panel, tırmanma merdiveni.
// Aynı kutular hem çizimde hem çarpışmada kullanılır (çitler 1.5 blok yüksek çarpışır).
// Yönler: 0 -z, 1 +x, 2 +z, 3 -x
// ---------------------------------------------------------------------------

const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Kutuyu blok merkezi etrafında f kez 90° döndür (-z → +x → +z → -x)
function rotBox(b, f) {
  for (let k = 0; k < (f & 3); k++) b = [16 - b[5], b[1], b[0], 16 - b[2], b[4], b[3]];
  return b;
}

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

// nb(d): d yönündeki komşu blok kimliği (sadece çit/panel için çağrılır)
function shapeOf(id, nb) {
  const kind = SHAPE[id];
  if (kind === 6 || kind === 8) {
    let mask = 0;
    for (let d = 0; d < 4; d++) if (connects(kind, nb(d))) mask |= 1 << d;
    return connectShape(kind, mask);
  }
  return SHAPE_CACHE[id] || (SHAPE_CACHE[id] = buildShape(kind, SHAPEF[id]));
}
