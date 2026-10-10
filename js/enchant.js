'use strict';
// ---------------------------------------------------------------------------
// Tecrübe (XP), büyüler, büyü masası ve örs (Minecraft formülleri):
// - Seviye başına gereken XP: 2L+7 (0-15), 5L-38 (16-30), 9L-158 (31+)
// - Büyü masası: kitaplık sayısına göre 3 seçenek; bedel 1/2/3 seviye ve lapis
// - Örs: onarım, büyü birleştirme, büyülü kitap uygulama, yeniden adlandırma;
//   her kullanımda "önceki iş" cezası katlanır, 40 seviye ve üstü "Çok Pahalı!"
// Büyüler yığında { ench: { anahtar: seviye } } olarak tutulur.
// ---------------------------------------------------------------------------

// w: ağırlık (nadirlik), min/max: büyü gücü aralığı, im/bm: örs çarpanı (eşya/kitap)
const ENCH = {
  protection: { name: 'Koruma', max: 4, w: 10, cat: 'armor', min: (l) => 1 + (l - 1) * 11, span: 11, im: 1, bm: 1 },
  feather_falling: { name: 'Tüy Gibi Düşüş', max: 4, w: 5, cat: 'boots', min: (l) => 5 + (l - 1) * 6, span: 6, im: 2, bm: 1 },
  sharpness: { name: 'Keskinlik', max: 5, w: 10, cat: 'weapon', min: (l) => 1 + (l - 1) * 11, span: 20, im: 1, bm: 1, excl: 'damage' },
  smite: { name: 'Kutsal Darbe', max: 5, w: 5, cat: 'weapon', min: (l) => 5 + (l - 1) * 8, span: 20, im: 2, bm: 1, excl: 'damage' },
  knockback: { name: 'Geri Tepme', max: 2, w: 5, cat: 'sword', min: (l) => 5 + (l - 1) * 20, span: 50, im: 2, bm: 1 },
  fire_aspect: { name: 'Alev', max: 2, w: 2, cat: 'sword', min: (l) => 10 + (l - 1) * 20, span: 50, im: 4, bm: 2 },
  looting: { name: 'Ganimet', max: 3, w: 2, cat: 'sword', min: (l) => 15 + (l - 1) * 9, span: 50, im: 4, bm: 2 },
  efficiency: { name: 'Verimlilik', max: 5, w: 10, cat: 'digger', min: (l) => 1 + (l - 1) * 10, span: 50, im: 1, bm: 1 },
  silk_touch: { name: 'İpeksi Dokunuş', max: 1, w: 1, cat: 'digger', min: () => 15, span: 50, im: 8, bm: 4, excl: 'loot' },
  fortune: { name: 'Servet', max: 3, w: 2, cat: 'digger', min: (l) => 15 + (l - 1) * 9, span: 50, im: 4, bm: 2, excl: 'loot' },
  power: { name: 'Güç', max: 5, w: 10, cat: 'bow', min: (l) => 1 + (l - 1) * 10, span: 15, im: 1, bm: 1 },
  flame: { name: 'Alev Oku', max: 1, w: 2, cat: 'bow', min: () => 20, span: 30, im: 4, bm: 2 },
  infinity: { name: 'Sonsuzluk', max: 1, w: 1, cat: 'bow', min: () => 20, span: 30, im: 8, bm: 4, excl: 'arrows' },
  unbreaking: { name: 'Kırılmazlık', max: 3, w: 5, cat: 'durable', min: (l) => 5 + (l - 1) * 8, span: 50, im: 2, bm: 1 },
  mending: { name: 'Onarım', max: 1, w: 2, cat: 'durable', min: (l) => 25 * l, span: 50, im: 4, bm: 2, treasure: true, excl: 'arrows' },
};
// Büyü masasında görünen rünler (Minecraft'ın Standart Galaktik Alfabesi'ne benzer)
const RUNES = 'ᔑʖᓵ↸ᒷ⎓⊣⍑╎ꖌꖎᒲリᑑ∷ᓭℸ⚍⍊∴';
const UNDEAD = new Set(['zombie', 'skeleton', 'zpiglin']);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const enchLabel = (k, l) => ENCH[k].name + (ENCH[k].max > 1 || l > 1 ? ' ' + (ROMAN[l] || l) : '');

const enchLvl = (s, k) => (s && s.ench && s.ench[k]) || 0;
const isEnchanted = (s) => !!(s && s.ench && Object.keys(s.ench).length);
const incompatible = (a, b) => a !== b && !!ENCH[a].excl && ENCH[a].excl === ENCH[b].excl;
// Yığının görünen adı (örste verilen ad öncelikli)
const stackName = (s) => (s && s.name) || (s ? itemName(s.id) : '');

// Büyünün yığına uygulanabilirliği (table: büyü masasından mı?)
function enchFits(k, s, table) {
  if (!s) return false;
  if (s.id === I.BOOK || s.id === I.ENCHANTED_BOOK) return true;
  const t = toolOf(s), a = armorOf(s), cat = ENCH[k].cat;
  if (!t || !t.dur) return false;
  switch (cat) {
    case 'durable': return true;
    case 'armor': return !!a;
    case 'boots': return !!a && a.slot === 3;
    case 'sword': return t.kind === 'sword';
    case 'weapon': return t.kind === 'sword' || (t.kind === 'axe' && !table);
    case 'digger': return t.kind === 'pickaxe' || t.kind === 'axe' || t.kind === 'shovel' || t.kind === 'hoe';
    case 'bow': return t.kind === 'bow';
  }
  return false;
}

// Büyülenebilirlik (malzemeye göre, Minecraft değerleri)
function enchantability(s) {
  if (!s || isEnchanted(s)) return 0;
  if (s.id === I.BOOK) return 1;
  const t = toolOf(s), a = armorOf(s);
  if (a) return { leather: 15, gold: 25, iron: 9, diamond: 10, netherite: 15 }[a.mat] || 0;
  if (!t) return 0;
  if (t.kind === 'bow') return 1;
  return t.mat ? { wood: 15, stone: 5, iron: 14, gold: 22, diamond: 10, netherite: 15 }[t.mat] || 0 : 0;
}

function pickWeighted(list, rng) {
  let sum = 0;
  for (const e of list) sum += ENCH[e.k].w;
  let r = rng() * sum;
  for (const e of list) { r -= ENCH[e.k].w; if (r < 0) return e; }
  return list[list.length - 1];
}

// Verilen güç seviyesinde rastgele büyü listesi (Minecraft EnchantmentHelper)
function selectEnchants(s, level, rng, treasure = false) {
  const e = enchantability(s) || 1, ri = (n) => Math.floor(rng() * n);
  let L = level + 1 + ri((e >> 2) + 1) + ri((e >> 2) + 1);
  L = Math.max(1, Math.round(L + L * (rng() + rng() - 1) * 0.15));
  const avail = [];
  for (const k in ENCH) {
    const E = ENCH[k];
    if ((E.treasure && !treasure) || !enchFits(k, s, true)) continue;
    for (let l = E.max; l >= 1; l--) if (L >= E.min(l) && L <= E.min(l) + E.span) { avail.push({ k, l }); break; }
  }
  if (!avail.length) return [];
  const out = [pickWeighted(avail, rng)];
  let pool = avail;
  while (rng() < (L + 1) / 50) {
    pool = pool.filter((a) => out.every((o) => o.k !== a.k && !incompatible(o.k, a.k)));
    if (!pool.length) break;
    out.push(pickWeighted(pool, rng));
    L >>= 1;
  }
  if (s.id === I.BOOK && out.length > 1) out.splice(ri(out.length), 1);
  return out;
}

// Büyü masası seçenekleri: [{ cost, list }] × 3
function enchantOffers(s, shelves, seed) {
  if (!enchantability(s)) return null;
  const b = Math.min(15, shelves);
  const r0 = mulberry32(seed ^ (s.id * 2654435761));
  const ri = (n) => Math.floor(r0() * n);
  const base = ri(8) + 1 + (b >> 1) + ri(b + 1);
  const costs = [Math.floor(Math.max(base / 3, 1)), Math.floor(base * 2 / 3 + 1), Math.floor(Math.max(base, b * 2))];
  return costs.map((cost, i) => ({ cost, list: selectEnchants(s, cost, mulberry32(seed + i * 7919 + s.id)) }));
}

function applyEnchants(s, list) {
  const out = Object.assign({}, s, { count: 1, ench: Object.assign({}, s.ench || {}) });
  if (s.id === I.BOOK) out.id = I.ENCHANTED_BOOK;
  for (const e of list) out.ench[e.k] = e.l;
  return out;
}

// Rastgele büyülü kitap (köylü ticareti ve sandık ganimeti için)
function randomBook(rng, allowTreasure = true) {
  const keys = Object.keys(ENCH).filter((k) => allowTreasure || !ENCH[k].treasure);
  const k = keys[Math.floor(rng() * keys.length)], E = ENCH[k];
  const l = 1 + Math.floor(rng() * E.max);
  return { id: I.ENCHANTED_BOOK, count: 1, ench: { [k]: l } };
}

// Örs onarım malzemesi
function repairMaterial(s) {
  const t = toolOf(s), a = armorOf(s);
  const mat = a ? a.mat : t && t.mat;
  return { wood: '#planks', stone: '#stone', iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND, netherite: I.NETHERITE_INGOT, leather: I.LEATHER }[mat] || null;
}

// Örs sonucu: { out, cost, used } ya da null
function anvilResult(left, right, name) {
  if (!left) return null;
  const t = toolOf(left);
  const out = Object.assign({}, left, { ench: Object.assign({}, left.ench || {}) });
  let cost = 0, used = right ? 1 : 0;
  if (right) {
    const isBook = right.id === I.ENCHANTED_BOOK, mat = repairMaterial(left);
    if (t && t.dur && mat !== null && groupHas(mat, right.id) && left.count === 1) {
      // Malzemeyle onarım: her malzeme dayanıklılığın %25'ini geri verir
      if (!left.dmg) return null;
      const per = Math.floor(t.dur / 4);
      let d = left.dmg, n = 0;
      while (d > 0 && n < right.count) { d = Math.max(0, d - per); n++; cost++; }
      out.dmg = d; used = n;
    } else {
      if (!isBook && right.id !== left.id) return null;
      if (left.count > 1 || right.count > 1) return null;
      if (!isBook && t && t.dur && left.dmg) {
        const sum = (t.dur - left.dmg) + (t.dur - (right.dmg || 0)) + Math.floor(t.dur * 0.12);
        out.dmg = Math.max(0, t.dur - sum);
        cost += 2;
      }
      let good = 0, bad = 0;
      for (const k in right.ench || {}) {
        const E = ENCH[k], lv = right.ench[k], cur = out.ench[k] || 0;
        let ok = enchFits(k, left, false);
        for (const o in out.ench) if (incompatible(o, k)) { ok = false; cost++; }
        if (!ok) { bad++; continue; }
        good++;
        out.ench[k] = Math.min(E.max, cur === lv ? lv + 1 : Math.max(cur, lv));
        cost += (isBook ? E.bm : E.im) * out.ench[k];
      }
      if (bad && !good) return null;
    }
  }
  let newName = name === undefined ? left.name : name.trim();
  if (newName === itemName(left.id)) newName = '';
  if ((newName || '') !== (left.name || '')) {
    cost += 1;
    if (newName) out.name = newName.slice(0, 35); else delete out.name;
  }
  if (!cost) return null;
  if (!Object.keys(out.ench).length) delete out.ench;
  const prior = (left.rc || 0) + (right ? right.rc || 0 : 0);
  if (right) out.rc = Math.max(left.rc || 0, right.rc || 0) * 2 + 1;
  return { out, cost: cost + prior, used };
}

// --- Tecrübe ----------------------------------------------------------------
const xpToNext = (l) => (l < 16 ? 2 * l + 7 : l < 31 ? 5 * l - 38 : 9 * l - 158);
function xpTotal(level, prog) { let t = prog; for (let l = 0; l < level; l++) t += xpToNext(l); return t; }
// Minecraft küre boyutları
const ORB_SIZES = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
function splitXp(n) {
  const out = [];
  while (n > 0) {
    const v = ORB_SIZES.find((s) => s <= n) || 1;
    // Çok fazla küre olmasın
    const take = out.length >= 40 ? n : v;
    out.push(take); n -= take;
  }
  return out;
}
// Cevherlerden düşen XP (Minecraft aralıkları)
function oreXp(id) {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  switch (id) {
    case B.COAL: return r(0, 2);
    case B.DIAMOND: case B.EMERALD: return r(3, 7);
    case B.LAPIS_ORE: case B.QUARTZ_ORE: return r(2, 5);
    case B.REDSTONE: return r(1, 5);
    case B.NETHER_GOLD_ORE: return r(0, 1);
  }
  return 0;
}
// Fırından alınan ürün başına XP
function smeltXp(id) {
  if (id === I.IRON_INGOT || id === I.GOLD_INGOT || id === I.NETHERITE_SCRAP) return 0.85;
  if (id === I.DIAMOND || id === I.EMERALD) return 1;
  if (id === I.COOKED_PORKCHOP || id === I.STEAK || id === I.COOKED_CHICKEN) return 0.35;
  return 0.15;
}

// Kayıt biçimi: [id, adet, hasar, { e: büyüler, n: ad, r: önceki iş }]
function stackToSave(s) {
  if (!s) return 0;
  const a = [s.id, s.count, s.dmg || 0];
  if (s.ench || s.name || s.rc) a.push({ e: s.ench, n: s.name, r: s.rc });
  return a;
}
function stackFromSave(a) {
  const s = { id: a[0], count: a[1] };
  if (a[2]) s.dmg = a[2];
  if (a[3]) { if (a[3].e) s.ench = a[3].e; if (a[3].n) s.name = a[3].n; if (a[3].r) s.rc = a[3].r; }
  return s;
}
