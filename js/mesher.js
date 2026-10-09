'use strict';
// ---------------------------------------------------------------------------
// Mesh üretici: komşu parçalarla birlikte bölgesel ışık hesabı (gökyüzü + blok
// ışığı), yumuşak aydınlatma, ambient occlusion ve görünür yüz ayıklama.
// Vertex formatı (12 bayt): u16 x*16, y*16, z*16, (katman | ao<<8 | yüz<<10)
//                           u8  u, v, gökIşığı, blokIşığı
// ---------------------------------------------------------------------------

const MARGIN = 14;
const RW = CS + MARGIN * 2;          // 44
const RMAXH = CH + 2;
const RSIZE = RW * RW * RMAXH;
const DX = 1, DZ = RW, DY = RW * RW;

const rIds = new Uint8Array(RSIZE);
const rSky = new Uint8Array(RSIZE);
const rBlk = new Uint8Array(RSIZE);
const colTop = new Int16Array(RW * RW);
const buckets = [];
for (let i = 0; i < 16; i++) buckets.push([]);

// Yüz tabloları
const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FACE_OFF = [DX, -DX, DY, -DY, DZ, -DZ];
const FACE_CORNERS = [
  [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]],
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
];
const AXIS_OFF = [DX, DY, DZ];
function faceUV(f, c) {
  const [x, y, z] = c;
  switch (f) {
    case 0: return [1 - z, 1 - y];
    case 1: return [z, 1 - y];
    case 2: return [x, z];
    case 3: return [x, 1 - z];
    case 4: return [x, 1 - y];
    default: return [1 - x, 1 - y];
  }
}
// Sarım yönünü (CCW) otomatik düzelt ve köşe başına AO ofsetlerini hazırla
const FACES = FACE_CORNERS.map((corners, f) => {
  const n = FACE_N[f];
  const c = corners.slice();
  const a = c[0], b = c[1], d = c[2];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) c.reverse();
  const normAxis = n[0] ? 0 : n[1] ? 1 : 2;
  const axes = [0, 1, 2].filter((k) => k !== normAxis);
  return c.map((corner) => {
    const t1 = (corner[axes[0]] ? 1 : -1) * AXIS_OFF[axes[0]];
    const t2 = (corner[axes[1]] ? 1 : -1) * AXIS_OFF[axes[1]];
    const uv = faceUV(f, corner);
    return { x: corner[0], y: corner[1], z: corner[2], t1, t2, u: Math.round(uv[0] * 16), v: Math.round(uv[1] * 16) };
  });
});

// Büyüyebilen vertex tamponu
class VBuf {
  constructor(cap) { this.alloc(cap); this.n = 0; }
  alloc(cap) {
    const old = this.ab;
    this.cap = cap;
    this.ab = new ArrayBuffer(cap * 12);
    this.u16 = new Uint16Array(this.ab);
    this.u8 = new Uint8Array(this.ab);
    if (old) this.u8.set(new Uint8Array(old, 0, this.n * 12));
  }
  ensure(k) { if (this.n + k > this.cap) this.alloc(this.cap * 2); }
  push(x, y, z, w, u, v, s, l) {
    const n = this.n++;
    const o = n * 6;
    this.u16[o] = x; this.u16[o + 1] = y; this.u16[o + 2] = z; this.u16[o + 3] = w;
    const p = n * 12 + 8;
    this.u8[p] = u; this.u8[p + 1] = v; this.u8[p + 2] = s; this.u8[p + 3] = l;
  }
  take() { return this.u8.slice(0, this.n * 12); }
}
const bufOpaque = new VBuf(65536);
const bufTrans = new VBuf(16384);

function computeLight(H, hasSky) {
  // H: bölge yüksekliği (y = 0..H-1 gerçek), katman = y+1
  const LH = H + 2;
  const total = RW * RW * LH;
  rSky.fill(0, 0, total);
  rBlk.fill(0, 0, total);
  for (let i = 0; i < 16; i++) buckets[i].length = 0;

  // Doğrudan güneş ışığı sütunları
  if (hasSky) for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
    let i = (LH - 1) * DY + z * DZ + x;
    let y = LH - 1;
    while (y > 0) {
      const id = rIds[i];
      if (OPAQUE[id] || FILTER[id]) break;
      rSky[i] = 15;
      i -= DY; y--;
    }
    colTop[z * RW + x] = y + 1;
  }
  const b15 = buckets[15];
  if (hasSky) for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
    const t = colTop[z * RW + x];
    let m = t;
    if (x > 0) m = Math.max(m, colTop[z * RW + x - 1]);
    if (x < RW - 1) m = Math.max(m, colTop[z * RW + x + 1]);
    if (z > 0) m = Math.max(m, colTop[(z - 1) * RW + x]);
    if (z < RW - 1) m = Math.max(m, colTop[(z + 1) * RW + x]);
    const top = Math.min(m, LH - 1);
    for (let y = t; y <= top; y++) b15.push(y * DY + z * DZ + x);
  }
  if (hasSky) propagate(rSky, LH);

  // Blok ışığı kaynakları
  for (let i = 0; i < 16; i++) buckets[i].length = 0;
  let any = false;
  for (let i = DY; i < total - DY; i++) {
    const e = EMIT[rIds[i]];
    if (e) { rBlk[i] = e; buckets[e].push(i); any = true; }
  }
  if (any) propagate(rBlk, LH);
}

function propagate(L, LH) {
  for (let lv = 15; lv > 1; lv--) {
    const q = buckets[lv];
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      if (L[i] !== lv) continue;
      const x = i % RW, z = ((i / RW) | 0) % RW, y = (i / DY) | 0;
      for (let f = 0; f < 6; f++) {
        if (f === 0 && x === RW - 1) continue;
        if (f === 1 && x === 0) continue;
        if (f === 2 && y === LH - 1) continue;
        if (f === 3 && y <= 1) continue;
        if (f === 4 && z === RW - 1) continue;
        if (f === 5 && z === 0) continue;
        const n = i + FACE_OFF[f];
        const id = rIds[n];
        if (OPAQUE[id]) continue;
        const nl = lv - 1 - FILTER[id];
        if (nl > L[n]) { L[n] = nl; if (nl > 1) buckets[nl].push(n); }
      }
    }
    q.length = 0;
  }
}

function faceVisible(id, nid) {
  if (nid === 0) return true;
  if (OPAQUE[nid]) return false;
  if (nid === id && CULLSAME[id]) return false;
  if (sameLiquid(id, nid)) return false;
  if (RENDER[id] === R_LIQUID && RENDER[nid] !== R_LIQUID && SOLID[nid] && nid !== B.GLASS && nid !== B.ICE && nid !== B.LEAVES) return false;
  return true;
}

const ao4 = [0, 0, 0, 0], sk4 = [0, 0, 0, 0], bl4 = [0, 0, 0, 0];

function emitFace(buf, lx, ly, lz, f, layer, ri, liquidTop, hgt = 16, ch = null) {
  const fr = ri + FACE_OFF[f];
  const F = FACES[f];
  for (let c = 0; c < 4; c++) {
    const C = F[c];
    const a = fr + C.t1, b = fr + C.t2, d = fr + C.t1 + C.t2;
    const oa = OPAQUE[rIds[a]], ob = OPAQUE[rIds[b]];
    const oc = oa && ob ? 1 : OPAQUE[rIds[d]];
    ao4[c] = oa && ob ? 0 : 3 - (oa + ob + oc);
    let s = rSky[fr], l = rBlk[fr], n = 1;
    if (!oa) { s += rSky[a]; l += rBlk[a]; n++; }
    if (!ob) { s += rSky[b]; l += rBlk[b]; n++; }
    if (!oc) { s += rSky[d]; l += rBlk[d]; n++; }
    sk4[c] = Math.round((s / n) * 17);
    bl4[c] = Math.round((l / n) * 17);
  }
  buf.ensure(4);
  const start = (ao4[0] + ao4[2] >= ao4[1] + ao4[3]) ? 0 : 1;
  for (let k = 0; k < 4; k++) {
    const c = (k + start) & 3;
    const C = F[c];
    let y16 = (ly + C.y) * 16;
    let v = C.v;
    if (ch && C.y === 1) { const h = ch[C.x + C.z * 2]; y16 -= 16 - h; if (f !== 2 && f !== 3) v = 16 - h; }
    else if (liquidTop && C.y === 1) { y16 -= 2; }
    if (hgt < 16 && C.y === 1) { y16 -= 16 - hgt; if (f !== 2 && f !== 3) v = 16 - hgt; }
    if (liquidTop && !ch && f !== 2 && f !== 3 && C.y === 1) v = 2;
    buf.push((lx + C.x) * 16, y16, (lz + C.z) * 16, layer | (ao4[c] << 8) | (f << 10), C.u, v, sk4[c], bl4[c]);
  }
}

// Sıvı yüzeyi: her köşe, köşeyi paylaşan 4 hücredeki aynı sıvının ortalama yüksekliği
const liqCh = [16, 16, 16, 16];
function liquidCorners(ri, id) {
  for (let cz = 0; cz < 2; cz++) for (let cx = 0; cx < 2; cx++) {
    let sum = 0, n = 0, full = false;
    for (let dz = cz - 1; dz <= cz; dz++) for (let dx = cx - 1; dx <= cx; dx++) {
      const rj = ri + dx * DX + dz * DZ, nid = rIds[rj];
      if (!sameLiquid(nid, id)) continue;
      if (sameLiquid(rIds[rj + DY], id)) { full = true; break; }
      sum += LIQH[nid]; n++;
    }
    liqCh[cx + cz * 2] = full ? 16 : n ? Math.round(sum / n) : LIQH[id];
  }
  return liqCh;
}

// Şekilli blok kutusu (1/16 birim). Sınırdaki yüzler komşu opaksa gizlenir.
const BOX_LO = [0, 0, 0], BOX_HI = [0, 0, 0];
function emitBox(buf, lx, ly, lz, b, id, ri) {
  BOX_LO[0] = b[0]; BOX_LO[1] = b[1]; BOX_LO[2] = b[2]; BOX_HI[0] = b[3]; BOX_HI[1] = b[4]; BOX_HI[2] = b[5];
  buf.ensure(24);
  for (let f = 0; f < 6; f++) {
    const n = FACE_N[f], ax = n[0] ? 0 : n[1] ? 1 : 2, pos = n[ax] > 0;
    const edge = pos ? BOX_HI[ax] === 16 : BOX_LO[ax] === 0;
    const fr = ri + FACE_OFF[f];
    if (edge && OPAQUE[rIds[fr]]) continue;
    const L = edge ? fr : ri;
    const s = rSky[L] * 17, l = rBlk[L] * 17;
    const layer = TEXF[id * 6 + f];
    for (let c = 0; c < 4; c++) {
      const C = FACES[f][c];
      const x = C.x ? BOX_HI[0] : BOX_LO[0], y = C.y ? BOX_HI[1] : BOX_LO[1], z = C.z ? BOX_HI[2] : BOX_LO[2];
      const uv = faceUV(f, [x / 16, y / 16, z / 16]);
      buf.push(lx * 16 + x, ly * 16 + y, lz * 16 + z, layer | (3 << 8) | (f << 10), Math.round(uv[0] * 16), Math.round(uv[1] * 16), s, l);
    }
  }
}

const CROSS_Q = [
  [[2, 0, 2], [2, 16, 2], [14, 16, 14], [14, 0, 14]],
  [[2, 0, 14], [2, 16, 14], [14, 16, 2], [14, 0, 2]],
];
function emitCross(buf, lx, ly, lz, layer, ri) {
  const s = rSky[ri] * 17, l = rBlk[ri] * 17;
  buf.ensure(16);
  const w = layer | (3 << 8) | (6 << 10);
  for (const q of CROSS_Q) {
    const us = [0, 0, 16, 16], vs = [16, 0, 0, 16];
    for (let k = 0; k < 4; k++) buf.push(lx * 16 + q[k][0], ly * 16 + q[k][1], lz * 16 + q[k][2], w, us[k], vs[k], s, l);
    for (let k = 3; k >= 0; k--) buf.push(lx * 16 + q[k][0], ly * 16 + q[k][1], lz * 16 + q[k][2], w, us[k], vs[k], s, l);
  }
}

// Bir parçanın mesh'ini üret. 8 komşu parçanın yüklü olması gerekir.
function buildChunkMesh(world, chunk) {
  const cx = chunk.cx, cz = chunk.cz;
  let top = 0;
  const nb = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.getChunk(cx + dx, cz + dz);
    if (!c) return null;
    nb.push(c);
    if (c.maxY > top) top = c.maxY;
  }
  const H = Math.min(CH, top + 2);
  const LH = H + 2;
  // Bölgeyi doldur: katman 0 = ana kaya, katman LH-1 = hava
  rIds.fill(B.BEDROCK, 0, DY);
  rIds.fill(0, (LH - 1) * DY, LH * DY);
  for (let k = 0; k < 9; k++) {
    const c = nb[k], ox = (k % 3) - 1, oz = ((k / 3) | 0) - 1;
    const lx0 = Math.max(0, -(ox * 16 + MARGIN)), lx1 = Math.min(16, RW - (ox * 16 + MARGIN));
    const lz0 = Math.max(0, -(oz * 16 + MARGIN)), lz1 = Math.min(16, RW - (oz * 16 + MARGIN));
    const len = lx1 - lx0;
    const blocks = c.blocks;
    for (let y = 0; y < H; y++) {
      for (let lz = lz0; lz < lz1; lz++) {
        const src = (y * 16 + lz) * 16 + lx0;
        const dst = (y + 1) * DY + (lz + oz * 16 + MARGIN) * DZ + (lx0 + ox * 16 + MARGIN);
        rIds.set(blocks.subarray(src, src + len), dst);
      }
    }
  }
  computeLight(H, world.hasSky);

  bufOpaque.n = 0; bufTrans.n = 0;
  const maxY = Math.min(chunk.maxY, H - 1);
  for (let y = 0; y <= maxY; y++) {
    for (let z = 0; z < 16; z++) {
      let ri = (y + 1) * DY + (z + MARGIN) * DZ + MARGIN;
      for (let x = 0; x < 16; x++, ri++) {
        const id = rIds[ri];
        if (!id) continue;
        const rt = RENDER[id];
        if (rt === R_CROSS) { emitCross(bufOpaque, x, y, z, TEXF[id * 6 + 2], ri); continue; }
        if (rt === R_SHAPE) {
          const sh = shapeOf(id, (d) => rIds[ri + DIR4[d][0] * DX + DIR4[d][1] * DZ]);
          for (const b of sh.draw) emitBox(bufOpaque, x, y, z, b, id, ri);
          continue;
        }
        const buf = PASS[id] ? bufTrans : bufOpaque;
        const liquidTop = rt === R_LIQUID && (isLiquid(id) ? !sameLiquid(rIds[ri + DY], id) : rIds[ri + DY] !== id);
        const ch = liquidTop && isLiquid(id) ? liquidCorners(ri, id) : null;
        const hgt = HGT[id];
        for (let f = 0; f < 6; f++) {
          if (f === 3 && y === 0) continue;
          const nid = rIds[ri + FACE_OFF[f]];
          if (!faceVisible(id, nid)) {
            // Sıvı yüzeyi alçaltılmışsa / blok alçaksa üst yüz hâlâ görünmeli
            if (!((liquidTop || hgt < 16) && f === 2 && !OPAQUE[nid])) continue;
          }
          emitFace(buf, x, y, z, f, TEXF[id * 6 + f], ri, liquidTop, hgt, ch);
        }
      }
    }
  }
  return { opaque: bufOpaque.take(), opaqueCount: bufOpaque.n, trans: bufTrans.take(), transCount: bufTrans.n };
}

// Elde tutulan blok / kırılma çatlağı için tek blok mesh'i
const itemBuf = new VBuf(256);
function buildBlockMesh(id, sky, blk, layerOverride) {
  itemBuf.n = 0;
  const s = Math.round(sky * 255), l = Math.round(blk * 255);
  if ((id >= 256 || RENDER[id] === R_CROSS || FLAT[id]) && layerOverride === undefined) {
    const layer = heldLayer(id);
    const w = layer | (3 << 8) | (6 << 10);
    const q = [[8, 0, 0], [8, 16, 0], [8, 16, 16], [8, 0, 16]];
    const us = [0, 0, 16, 16], vs = [16, 0, 0, 16];
    for (let k = 0; k < 4; k++) itemBuf.push(q[k][0], q[k][1], q[k][2], w, us[k], vs[k], s, l);
    for (let k = 3; k >= 0; k--) itemBuf.push(q[k][0], q[k][1], q[k][2], w, us[k], vs[k], s, l);
    return itemBuf;
  }
  for (let f = 0; f < 6; f++) {
    const layer = layerOverride !== undefined ? layerOverride : TEXF[id * 6 + f];
    for (let c = 0; c < 4; c++) {
      const C = FACES[f][c];
      itemBuf.push(C.x * 16, C.y * 16, C.z * 16, layer | (3 << 8) | (f << 10), C.u, C.v, s, l);
    }
  }
  return itemBuf;
}
