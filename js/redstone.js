'use strict';
// ---------------------------------------------------------------------------
// Kızıltaş devreleri (Minecraft kurallarının sadeleştirilmiş hâli):
// - Güç 0-15. Toz her blokta 1 azalır; basamak çıkıp inebilir (üstü kapalı değilse).
// - Kaynaklar: kızıltaş bloğu, yanan meşale, açık şalter, basılı düğme/plaka, açık yineleyici.
// - Katı bloklar "güçlü" (meşalenin üstü, şalterin tutunduğu blok, plakanın altı, yineleyicinin
//   önü) ya da "zayıf" (üstündeki/yöneldiği toz) güç alır. Güçlü blok tozu besler, zayıf blok
//   yalnızca yanındaki aletleri (lamba, piston, kapı, TNT, meşale) çalıştırır.
// - Meşale tutunduğu blok güç alınca söner (1 tik), yineleyici 1-4 tik geciktirir.
// - Bir kızıltaş tiki 0,1 sn. Değişen bloğun yakınındaki aletler yeniden değerlendirilir.
// ---------------------------------------------------------------------------

const RS_TICK = 0.1;
const isRedstoneRelated = (id) => isWire(id) || isRTorch(id) || isLever(id) || isButton(id) || isPlate(id) || isRepeater(id) ||
  id === B.LAMP || id === B.LAMP_ON || isPiston(id) || isPistonHead(id) || id === B.REDSTONE_BLOCK || id === B.TNT ||
  isDoor(id) || id === B.TRAPDOOR || (id >= B.TRAPDOOR_OPEN && id < B.TRAPDOOR_OPEN + 4) || (id >= B.GATE && id < B.GATE + 4);
// Piston itemez: ana kaya, obsidyen, geçitler, kutu varlıkları, uzamış pistonlar
const UNMOVABLE = new Set();

class Redstone {
  constructor(game) {
    this.g = game;
    this.q = new Map();        // "x,y,z" -> zaman
    this.later = [];           // gecikmeli işler { t, fn }
    this.power = new Map();    // toz gücü
    this.prev = new Map();     // kapılar için son güç durumu (sadece değişimde aç/kapa)
    this.stamp = new Map();    // bu tikte ağı hesaplanmış tozlar
    this.time = 0; this.tickN = 0; this.acc = 0;
    for (const id of [B.BEDROCK, B.OBSIDIAN, B.CRYING_OBSIDIAN, B.NETHER_PORTAL, B.END_PORTAL, B.END_FRAME, B.END_FRAME_EYE, B.CHEST, B.FURNACE,
      B.ENCH_TABLE, B.BED_FOOT, B.BED_HEAD, B.DRAGON_EGG]) UNMOVABLE.add(id);
  }
  clear() { this.q.clear(); this.later.length = 0; this.power.clear(); this.prev.clear(); this.stamp.clear(); this.plates = null; this.btn = null; this.pendingRep = null; }

  get w() { return this.g.world; }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  schedule(x, y, z, delay = 0) {
    const k = this.key(x, y, z), t = this.time + delay;
    const old = this.q.get(k);
    if (old === undefined || t < old) this.q.set(k, t);
  }
  after(delay, fn) { this.later.push({ t: this.time + delay, fn }); }

  // Bir blok değişti: 2 blok çevresindeki kızıltaş öğelerini yeniden değerlendir
  onChange(x, y, z, old, id) {
    const w = this.w;
    if (isWire(old) && !isWire(id)) this.power.delete(this.key(x, y, z));
    for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
      const n = w.getBlock(x + dx, y + dy, z + dz);
      if (isRedstoneRelated(n)) this.schedule(x + dx, y + dy, z + dz);
    }
  }

  tick(dt) {
    this.time += dt;
    const w = this.w;
    if (w.pendingRS && w.pendingRS.length) for (const [x, y, z] of w.pendingRS.splice(0)) this.schedule(x, y, z);
    // Basınç plakaları: üstünde canlı var mı
    this.acc += dt;
    if (this.acc >= RS_TICK) { this.acc = 0; this.tickN++; this.stamp.clear(); this.checkPlates(); }
    if (this.later.length) {
      const due = this.later.filter((j) => j.t <= this.time);
      if (due.length) { this.later = this.later.filter((j) => j.t > this.time); for (const j of due) j.fn(); }
    }
    if (!this.q.size) return;
    let n = 0;
    for (const [k, t] of this.q) {
      if (t > this.time) continue;
      this.q.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      if (w.isLoadedAt(x, z)) this.update(x, y, z);
      if (++n > 600) break;
    }
  }

  // --- Güç hesapları --------------------------------------------------------
  wirePower(x, y, z) {
    const id = this.w.getBlock(x, y, z);
    if (!isWire(id)) return 0;
    const p = this.power.get(this.key(x, y, z));
    return p !== undefined ? p : [0, 7, 15][id - B.WIRE];
  }
  // Tozun güç verdiği yatay yönler (nokta: 4 yön, tek bağlantı: düz çizgi)
  wireDirs(x, y, z) {
    const w = this.w;
    const m = wireMask((d, dy = 0) => w.getBlock(x + (d >= 0 ? DIR4[d][0] : 0), y + dy, z + (d >= 0 ? DIR4[d][1] : 0))) & 15;
    if (!m) return 15;
    if ((m & (m - 1)) === 0) return m | (1 << ((Math.log2(m) + 2) & 3));
    return m;
  }
  // (x,y,z)'deki kaynağın v yönündeki komşusuna verdiği güç (toz hariç)
  emit(x, y, z, v) {
    const id = this.w.getBlock(x, y, z);
    if (id === B.REDSTONE_BLOCK) return 15;
    if (id === B.RTORCH_ON) return v[1] === -1 ? 0 : 15;          // meşale tutunduğu bloğu beslemez
    if (isLever(id)) return ((id - B.LEVER) & 1) ? 15 : 0;
    if (isButton(id)) return ((id - B.BUTTON) & 1) ? 15 : 0;
    if (id === B.PLATE_ON) return 15;
    if (isRepeater(id)) { const k = id - B.REPEATER, d = DIR4[k & 3]; return k & 4 && v[0] === d[0] && v[2] === d[1] && v[1] === 0 ? 15 : 0; }
    return 0;
  }
  // Katı bloğun güçlü gücü
  strong(x, y, z) {
    const w = this.w;
    if (!OPAQUE[w.getBlock(x, y, z)]) return 0;
    if (w.getBlock(x, y - 1, z) === B.RTORCH_ON) return 15;
    if (w.getBlock(x, y + 1, z) === B.PLATE_ON) return 15;
    const lf = w.getBlock(x, y + 1, z);
    if (isLever(lf) && ((lf - B.LEVER) >> 1) === 4 && ((lf - B.LEVER) & 1)) return 15;
    for (let d = 0; d < 4; d++) {
      const nx = x - DIR4[d][0], nz = z - DIR4[d][1], n = w.getBlock(nx, y, nz);
      // Duvardaki şalter/düğme: d yönündeki bloğa tutunur
      if (isLever(n) && ((n - B.LEVER) >> 1) === d && ((n - B.LEVER) & 1)) return 15;
      if (isButton(n) && ((n - B.BUTTON) >> 1) === d && ((n - B.BUTTON) & 1)) return 15;
    }
    for (let d = 0; d < 4; d++) {
      const n = w.getBlock(x - DIR4[d][0], y, z - DIR4[d][1]);
      if (isRepeater(n) && ((n - B.REPEATER) & 4) && ((n - B.REPEATER) & 3) === d) return 15;
    }
    return 0;
  }
  // Katı bloğun zayıf gücü (üstündeki ya da ona yönelen toz)
  weak(x, y, z) {
    const w = this.w;
    if (!OPAQUE[w.getBlock(x, y, z)]) return 0;
    let p = this.wirePower(x, y + 1, z);
    for (let d = 0; d < 4; d++) {
      const nx = x - DIR4[d][0], nz = z - DIR4[d][1];
      if (isWire(w.getBlock(nx, y, nz)) && (this.wireDirs(nx, y, nz) & (1 << d))) p = Math.max(p, this.wirePower(nx, y, nz));
    }
    return p;
  }
  blockPower(x, y, z) { return Math.max(this.strong(x, y, z), this.weak(x, y, z)); }
  // Bir aletin (lamba, piston, kapı...) aldığı güç; skip: yok sayılacak DIR6 yönü
  input(x, y, z, skip = -1) {
    const w = this.w;
    let p = 0;
    for (let k = 0; k < 6; k++) {
      if (k === skip) continue;
      const v = DIR6[k], nx = x + v[0], ny = y + v[1], nz = z + v[2];
      const n = w.getBlock(nx, ny, nz);
      p = Math.max(p, this.emit(nx, ny, nz, [-v[0], -v[1], -v[2]]));
      if (isWire(n)) {
        // Toz altındaki bloğu ve yöneldiği yanları besler
        if (v[1] === 1) p = Math.max(p, this.wirePower(nx, ny, nz));
        else if (v[1] === 0) { const d = DIR4.findIndex(([a, b]) => a === -v[0] && b === -v[2]); if (this.wireDirs(nx, ny, nz) & (1 << d)) p = Math.max(p, this.wirePower(nx, ny, nz)); }
      } else if (OPAQUE[n]) p = Math.max(p, this.blockPower(nx, ny, nz));
      if (p >= 15) return 15;
    }
    return p;
  }

  // --- Toz ağı ------------------------------------------------------------------
  wireLinks(x, y, z) {
    const w = this.w, out = [], upFree = !OPAQUE[w.getBlock(x, y + 1, z)];
    for (const [dx, dz] of DIR4) {
      const sx = x + dx, sz = z + dz, side = w.getBlock(sx, y, sz);
      if (isWire(side)) out.push([sx, y, sz]);
      else {
        if (upFree && OPAQUE[side] && isWire(w.getBlock(sx, y + 1, sz))) out.push([sx, y + 1, sz]);
        if (!OPAQUE[side] && isWire(w.getBlock(sx, y - 1, sz))) out.push([sx, y - 1, sz]);
      }
    }
    return out;
  }
  // Tozun ağ dışından aldığı güç: kaynaklar ve güçlü bloklar
  wireSource(x, y, z) {
    const w = this.w;
    let p = 0;
    for (const v of DIR6) {
      const nx = x + v[0], ny = y + v[1], nz = z + v[2];
      p = Math.max(p, this.emit(nx, ny, nz, [-v[0], -v[1], -v[2]]));
      if (OPAQUE[w.getBlock(nx, ny, nz)]) p = Math.max(p, this.strong(nx, ny, nz));
    }
    return p;
  }
  updateNetwork(x, y, z) {
    const w = this.w, k0 = this.key(x, y, z);
    // Bu tikte zaten hesaplandıysa bir sonraki tike bırak
    if (this.stamp.get(k0) === this.tickN) { this.schedule(x, y, z, RS_TICK); return; }
    // Bağlı tozları topla
    const nodes = new Map(), stack = [[x, y, z]];
    nodes.set(k0, [x, y, z]);
    while (stack.length && nodes.size < 3000) {
      const [a, b, c] = stack.pop();
      for (const p of this.wireLinks(a, b, c)) {
        const k = this.key(p[0], p[1], p[2]);
        if (!nodes.has(k)) { nodes.set(k, p); stack.push(p); }
      }
    }
    // En güçlü kaynaktan başlayarak her adımda 1 azalt
    const lvl = new Map(), buckets = [];
    for (let i = 0; i <= 15; i++) buckets.push([]);
    for (const [k, p] of nodes) { const s = this.wireSource(p[0], p[1], p[2]); lvl.set(k, s); if (s) buckets[s].push(k); }
    for (let s = 15; s > 1; s--) for (const k of buckets[s]) {
      if (lvl.get(k) !== s) continue;
      const p = nodes.get(k);
      for (const q of this.wireLinks(p[0], p[1], p[2])) {
        const qk = this.key(q[0], q[1], q[2]);
        if (lvl.has(qk) && lvl.get(qk) < s - 1) { lvl.set(qk, s - 1); buckets[s - 1].push(qk); }
      }
    }
    // Uygula; değişenlerin çevresini güncelle
    const changed = [];
    for (const [k, p] of nodes) {
      this.stamp.set(k, this.tickN);
      const old = this.wirePower(p[0], p[1], p[2]), nv = lvl.get(k) || 0;
      this.power.set(k, nv);
      const id = B.WIRE + (nv === 0 ? 0 : nv < 8 ? 1 : 2);
      if (w.getBlock(p[0], p[1], p[2]) !== id) w.setBlock(p[0], p[1], p[2], id, false);
      if (old !== nv) changed.push(p);
    }
    for (const [a, b, c] of changed) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
      const n = w.getBlock(a + dx, b + dy, c + dz);
      if (isRedstoneRelated(n) && !isWire(n)) this.schedule(a + dx, b + dy, c + dz);
    }
  }

  // --- Aletler ----------------------------------------------------------------
  update(x, y, z) {
    const g = this.g, w = this.w, id = w.getBlock(x, y, z), k = this.key(x, y, z);
    if (isWire(id)) {
      if (!SOLID[w.getBlock(x, y - 1, z)]) { g.breakBlock(x, y, z, false, true); return; }
      this.updateNetwork(x, y, z);
    } else if (isRTorch(id)) {
      if (!SOLID[w.getBlock(x, y - 1, z)]) { g.breakBlock(x, y, z, false, true); return; }
      const want = this.blockPower(x, y - 1, z) > 0 ? B.RTORCH : B.RTORCH_ON;
      if (want !== id) this.after(RS_TICK, () => {
        if (!isRTorch(w.getBlock(x, y, z))) return;
        const now = this.blockPower(x, y - 1, z) > 0 ? B.RTORCH : B.RTORCH_ON;
        if (now !== w.getBlock(x, y, z)) {
          w.setBlock(x, y, z, now);
          if (now === B.RTORCH) g.particles.puff(x + 0.5, y + 0.8, z + 0.5, 2, 0.6);
        }
      });
    } else if (id === B.LAMP || id === B.LAMP_ON) {
      const on = this.input(x, y, z) > 0;
      if (on && id === B.LAMP) w.setBlock(x, y, z, B.LAMP_ON);
      else if (!on && id === B.LAMP_ON) this.after(RS_TICK * 2, () => { if (w.getBlock(x, y, z) === B.LAMP_ON && !this.input(x, y, z)) w.setBlock(x, y, z, B.LAMP); });
    } else if (isRepeater(id)) {
      const r = id - B.REPEATER, f = r & 3, back = DIR4[f];
      const bx = x - back[0], bz = z - back[1], bid = w.getBlock(bx, y, bz);
      let p = this.emit(bx, y, bz, [back[0], 0, back[1]]);
      if (isWire(bid)) p = Math.max(p, this.wirePower(bx, y, bz));
      else if (OPAQUE[bid]) p = Math.max(p, this.blockPower(bx, y, bz));
      const want = p > 0;
      if (want !== !!(r & 4) && !this.pendingRep?.has(k)) {
        (this.pendingRep || (this.pendingRep = new Set())).add(k);
        this.after(RS_TICK * this.delayOf(x, y, z), () => {
          this.pendingRep.delete(k);
          const cur = w.getBlock(x, y, z);
          if (isRepeater(cur)) w.setBlock(x, y, z, B.REPEATER + ((cur - B.REPEATER) & 3) + (want ? 4 : 0));
          this.schedule(x, y, z, RS_TICK);
        });
      }
    } else if (isButton(id)) {
      const wall = DIR4[(id - B.BUTTON) >> 1];
      if (!SOLID[w.getBlock(x + wall[0], y, z + wall[1])]) { g.breakBlock(x, y, z, false, true); return; }
      // Kayıttan basılı yüklenen düğme de bir saniye sonra kalkar
      if (((id - B.BUTTON) & 1) && !(this.btn && this.btn.has(k))) this.releaseLater(x, y, z);
    } else if (isLever(id)) {
      const pos = (id - B.LEVER) >> 1;
      const sx = pos === 4 ? x : x + DIR4[pos][0], sy = pos === 4 ? y - 1 : y, sz = pos === 4 ? z : z + DIR4[pos][1];
      if (!SOLID[w.getBlock(sx, sy, sz)]) g.breakBlock(x, y, z, false, true);
    } else if (isPlate(id)) {
      if (!SOLID[w.getBlock(x, y - 1, z)]) { g.breakBlock(x, y, z, false, true); return; }
      this.plates = this.plates || new Map();
      if (id === B.PLATE_ON && !this.plates.has(k)) this.plates.set(k, this.time + 1);
    } else if (id === B.TNT) {
      if (this.input(x, y, z) > 0) { w.setBlock(x, y, z, 0); g.ignite(x, y, z, 4); }
    } else if (isDoor(id) || id === B.TRAPDOOR || (id >= B.TRAPDOOR_OPEN && id < B.TRAPDOOR_OPEN + 4) || (id >= B.GATE && id < B.GATE + 4)) {
      this.updateOpenable(x, y, z, id, k);
    } else if (isPiston(id)) {
      const fc = (id - B.PISTON) % 6, ext = id >= B.PISTON_EXT;
      const p = this.input(x, y, z, fc) > 0;
      if (p && !ext) this.extend(x, y, z, fc);
      else if (!p && ext) this.retract(x, y, z, fc);
    } else if (isPistonHead(id)) {
      const v = DIR6[id - B.PISTON_HEAD];
      if (w.getBlock(x - v[0], y - v[1], z - v[2]) !== B.PISTON_EXT + (id - B.PISTON_HEAD)) w.setBlock(x, y, z, 0);
    }
  }

  // Kapı/tuzak kapı/çit kapısı: güç değişiminde aç/kapa (oyuncu elle de açabilir)
  updateOpenable(x, y, z, id, k) {
    const w = this.w;
    let p = this.input(x, y, z) > 0;
    let lx = x, ly = y, lz = z;
    if (isDoor(id)) {
      if ((id - B.DOOR) & 8) ly = y - 1;
      p = this.input(lx, ly, lz) > 0 || this.input(lx, ly + 1, lz) > 0;
      k = this.key(lx, ly, lz);
    }
    const prev = this.prev.get(k);
    this.prev.set(k, p);
    if (prev === undefined && !p) return;
    if (prev === p) return;
    const g = this.g;
    if (isDoor(id)) {
      const lo = w.getBlock(lx, ly, lz), up = w.getBlock(lx, ly + 1, lz);
      if (!isDoor(lo)) return;
      const open = !!((lo - B.DOOR) & 4);
      if (open === p) return;
      w.setBlock(lx, ly, lz, B.DOOR + ((lo - B.DOOR) ^ 4));
      if (isDoor(up)) w.setBlock(lx, ly + 1, lz, B.DOOR + ((up - B.DOOR) ^ 4));
    } else if (id === B.TRAPDOOR || (id >= B.TRAPDOOR_OPEN && id < B.TRAPDOOR_OPEN + 4)) {
      const open = id !== B.TRAPDOOR;
      if (open === p) return;
      w.setBlock(x, y, z, p ? B.TRAPDOOR_OPEN + 0 : B.TRAPDOOR);
    } else {
      const open = !!((id - B.GATE) & 1);
      if (open === p) return;
      w.setBlock(x, y, z, B.GATE + ((id - B.GATE) ^ 1));
    }
    g.audio.play(p ? 'door_open' : 'door_close', [x + 0.5, y + 0.5, z + 0.5]);
  }

  // --- Piston -------------------------------------------------------------------
  extend(x, y, z, fc) {
    const g = this.g, w = this.w, v = DIR6[fc], line = [];
    let endBreak = null;
    for (let k = 1; k <= 13; k++) {
      const px = x + v[0] * k, py = y + v[1] * k, pz = z + v[2] * k;
      if (py < 1 || py >= CH - 1 || !w.isLoadedAt(px, pz)) return;
      const id = w.getBlock(px, py, pz);
      if (!id || isLiquid(id)) break;
      if (RENDER[id] === R_CROSS || isWire(id) || isButton(id) || isLever(id) || isPlate(id) || isDoor(id) || isRepeater(id)) { endBreak = [px, py, pz]; break; }
      if (UNMOVABLE.has(id) || BLOCKS[id].hardness < 0 || id >= B.PISTON_EXT || this.g.dims[this.g.dim].tiles[this.key(px, py, pz)]) return;
      if (k > 12) return; // en çok 12 blok itilir
      line.push([px, py, pz, id]);
    }
    if (endBreak) g.breakBlock(endBreak[0], endBreak[1], endBreak[2], false, true);
    // Uzaktan yakına taşı
    for (let i = line.length - 1; i >= 0; i--) {
      const [px, py, pz, id] = line[i];
      w.setBlock(px + v[0], py + v[1], pz + v[2], id);
    }
    w.setBlock(x, y, z, B.PISTON_EXT + fc);
    w.setBlock(x + v[0], y + v[1], z + v[2], B.PISTON_HEAD + fc);
    // Taşınan blokların içinde kalan canlıları da it
    const moved = line.map(([px, py, pz]) => [px + v[0], py + v[1], pz + v[2]]).concat([[x + v[0], y + v[1], z + v[2]]]);
    const push = (e) => {
      for (const [bx, by, bz] of moved) {
        if (e.pos[0] + e.hw > bx && e.pos[0] - e.hw < bx + 1 && e.pos[2] + e.hw > bz && e.pos[2] - e.hw < bz + 1 && e.pos[1] + e.h > by && e.pos[1] < by + 1) {
          e.pos[0] += v[0] * 1.01; e.pos[1] += v[1] * 1.01; e.pos[2] += v[2] * 1.01;
          if (v[1] > 0) e.vel[1] = Math.max(e.vel[1], 4);
          return;
        }
      }
    };
    push(g.player);
    for (const m of g.entities.mobs) push(m);
    g.audio.play('piston', [x + 0.5, y + 0.5, z + 0.5]);
  }
  retract(x, y, z, fc) {
    const g = this.g, w = this.w, v = DIR6[fc];
    if (w.getBlock(x + v[0], y + v[1], z + v[2]) === B.PISTON_HEAD + fc) w.setBlock(x + v[0], y + v[1], z + v[2], 0);
    w.setBlock(x, y, z, B.PISTON + fc);
    g.audio.play('piston', [x + 0.5, y + 0.5, z + 0.5], 0.8);
  }

  // --- Oyuncu etkileşimleri ----------------------------------------------------
  delayOf(x, y, z) { const D = this.g.dims[this.g.dim]; return (D.rdelay && D.rdelay[this.key(x, y, z)]) || 1; }
  cycleDelay(x, y, z) {
    const D = this.g.dims[this.g.dim];
    D.rdelay = D.rdelay || {};
    const d = (this.delayOf(x, y, z) % 4) + 1;
    D.rdelay[this.key(x, y, z)] = d;
    return d;
  }
  pressButton(x, y, z) {
    const w = this.w, id = w.getBlock(x, y, z);
    if (!isButton(id) || ((id - B.BUTTON) & 1)) return;
    w.setBlock(x, y, z, id + 1);
    this.releaseLater(x, y, z);
  }
  releaseLater(x, y, z) {
    const w = this.w, k = this.key(x, y, z);
    (this.btn || (this.btn = new Set())).add(k);
    this.after(1.0, () => {
      this.btn.delete(k);
      const c = w.getBlock(x, y, z);
      if (isButton(c) && ((c - B.BUTTON) & 1)) { w.setBlock(x, y, z, c - 1); this.g.audio.play('click', [x + 0.5, y + 0.5, z + 0.5]); }
    });
  }
  // Basınç plakası: üstünde oyuncu ya da canlı varsa basılı
  checkPlates() {
    const g = this.g, w = this.w;
    const ents = [g.player, ...g.entities.mobs].filter((e) => e && !e.dead);
    const near = new Set();
    for (const e of ents) {
      const bx = Math.floor(e.pos[0]), by = Math.floor(e.pos[1] + 0.05), bz = Math.floor(e.pos[2]);
      if (isPlate(w.getBlock(bx, by, bz)) && e.pos[1] - by < 0.3) near.add(this.key(bx, by, bz));
    }
    this.plates = this.plates || new Map();
    for (const k of near) {
      const [x, y, z] = k.split(',').map(Number);
      this.plates.set(k, this.time + 1.0);
      if (w.getBlock(x, y, z) === B.PLATE) { w.setBlock(x, y, z, B.PLATE_ON); g.audio.play('click', [x + 0.5, y + 0.2, z + 0.5]); }
    }
    for (const [k, t] of this.plates) {
      if (near.has(k) || t > this.time) continue;
      this.plates.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      if (w.getBlock(x, y, z) === B.PLATE_ON) { w.setBlock(x, y, z, B.PLATE); g.audio.play('click', [x + 0.5, y + 0.2, z + 0.5]); }
    }
  }
}
