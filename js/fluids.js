'use strict';
// ---------------------------------------------------------------------------
// Su ve lav akışı (Minecraft kuralları):
// - Kaynak blok (seviye 0) yanlara 1..7 seviyeli akan sıvı yayar, aşağıya düşen sıvı akıtır.
// - Akan sıvı aşağı akabiliyorsa yana yayılmaz; yana yayılırken 4 blok içindeki en yakın
//   çukura doğru yönelir.
// - İki kaynağın arasındaki su yeni bir kaynak olur (sonsuz su).
// - Lav yerüstünde 3 blok (2'şer adım), Nether'de 7 blok yayılır ve daha yavaş akar.
// - Su lav kaynağına değerse obsidyen, akan lava değerse kırıktaş, lav suya akarsa taş olur.
// Sadece değişen blokların komşuları güncellenir; dünya oluşturulurken sıvılar durgundur.
// ---------------------------------------------------------------------------

class Fluids {
  constructor(game) {
    this.g = game;
    this.q = new Map();   // "x,y,z" -> zaman
    this.time = 0;
  }
  clear() { this.q.clear(); }

  delay(lava) { return lava ? (this.g.dim === 'nether' ? 0.5 : 1.5) : 0.25; }

  schedule(x, y, z, lava) {
    const k = x + ',' + y + ',' + z;
    if (!this.q.has(k)) this.q.set(k, this.time + this.delay(lava));
  }

  // Bir blok değişti: kendisi ve sıvı komşuları güncellenecek
  onChange(x, y, z) {
    const w = this.g.world;
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const id = w.getBlock(x + dx, y + dy, z + dz);
      if (isLiquid(id)) this.schedule(x + dx, y + dy, z + dz, isLava(id));
    }
  }

  tick(dt) {
    this.time += dt;
    const pend = this.g.world.pendingFluids;
    if (pend && pend.length) for (const [x, y, z] of pend.splice(0)) { const id = this.g.world.getBlock(x, y, z); if (isLiquid(id)) this.schedule(x, y, z, isLava(id)); }
    if (!this.q.size) return;
    const due = [];
    for (const [k, t] of this.q) {
      if (t <= this.time) due.push(k);
      if (due.length >= 250) break;
    }
    for (const k of due) {
      this.q.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      this.update(x, y, z);
    }
  }

  loaded(x, z) { return this.g.world.isLoadedAt(x, z); }

  update(x, y, z) {
    const g = this.g, w = g.world;
    if (!this.loaded(x, z)) return;
    const id = w.getBlock(x, y, z);
    if (!isLiquid(id)) return;
    const lava = isLava(id), step = lava && g.dim !== 'nether' ? 2 : 1;
    // Lav suyla temas ederse taşlaşır
    if (lava) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
        if (isWater(w.getBlock(x + dx, y + dy, z + dz))) { this.solidify(x, y, z, isSource(id) ? B.OBSIDIAN : B.COBBLE); return; }
      }
    }
    let level = liquidLevel(id);
    if (!isSource(id)) {
      // Akan sıvının olması gereken seviyesini komşulardan hesapla
      let want;
      if (sameLiquid(w.getBlock(x, y + 1, z), id)) want = 8;
      else {
        let best = 99, sources = 0;
        for (const [dx, dz] of DIR4) {
          const n = w.getBlock(x + dx, y, z + dz);
          if (!sameLiquid(n, id)) continue;
          let l = liquidLevel(n);
          if (l === 0) sources++;
          if (l === 8) l = SOLID[w.getBlock(x + dx, y - 1, z + dz)] || isLiquid(w.getBlock(x + dx, y - 1, z + dz)) ? 0 : 99;
          best = Math.min(best, l);
        }
        want = best + step;
        if (want > 7) want = -1;
        const below = w.getBlock(x, y - 1, z);
        if (!lava && sources >= 2 && (SOLID[below] || (isWater(below) && isSource(below)))) want = 0;
      }
      if (want !== level) {
        if (want < 0) { w.setBlock(x, y, z, 0, false); this.onChange(x, y, z); return; }
        w.setBlock(x, y, z, liquidId(lava, want), false);
        level = want;
        this.onChange(x, y, z);
      }
    }
    this.spread(x, y, z, lava, level, step);
  }

  // Hedef hücreye akabilir mi? (hava, bitki, daha zayıf akan sıvı)
  canEnter(x, y, z, lava, lvl) {
    const w = this.g.world;
    if (y < 0 || y >= CH || !this.loaded(x, z)) return false;
    const n = w.getBlock(x, y, z);
    if (!n || RENDER[n] === R_CROSS) return true;
    if (isLiquid(n) && !sameLiquid(n, lava ? B.LAVA : B.WATER)) return !isSource(n) || !lava; // su lavı söndürür
    if (sameLiquid(n, lava ? B.LAVA : B.WATER) && !isSource(n)) { const l = liquidLevel(n); return lvl === 8 ? l !== 8 : l !== 8 && l > lvl; }
    return false;
  }

  flowInto(x, y, z, lava, lvl) {
    const g = this.g, w = g.world, cur = w.getBlock(x, y, z);
    if (isLiquid(cur) && lava !== isLava(cur)) {
      // Su ↔ lav karşılaşması
      if (lava) this.solidify(x, y, z, lvl === 8 ? B.STONE : B.COBBLE);
      else this.solidify(x, y, z, isSource(cur) ? B.OBSIDIAN : B.COBBLE);
      return;
    }
    if (cur && RENDER[cur] === R_CROSS) g.breakBlock(x, y, z, false);
    w.setBlock(x, y, z, liquidId(lava, lvl), false);
    this.onChange(x, y, z);
  }

  solidify(x, y, z, id) {
    const g = this.g;
    g.world.setBlock(x, y, z, id);
    g.particles.puff(x + 0.5, y + 1, z + 0.5, 6);
    g.audio.play('fizz', [x + 0.5, y + 0.5, z + 0.5]);
    this.onChange(x, y, z);
  }

  spread(x, y, z, lava, level, step) {
    // Önce aşağı
    if (this.canEnter(x, y - 1, z, lava, 8)) { this.flowInto(x, y - 1, z, lava, 8); return; }
    const w = this.g.world, below = w.getBlock(x, y - 1, z);
    if (sameLiquid(below, lava ? B.LAVA : B.WATER) && !isSource(below)) return; // altta akan sıvı var
    const base = level === 8 ? 0 : level;
    const nl = base + step;
    if (nl > 7) return;
    for (const d of this.flowDirs(x, y, z, lava)) {
      const nx = x + DIR4[d][0], nz = z + DIR4[d][1];
      if (this.canEnter(nx, y, nz, lava, nl)) this.flowInto(nx, y, nz, lava, nl);
    }
  }

  // En yakın çukura giden yönler (bulunamazsa hepsi)
  flowDirs(x, y, z, lava) {
    const w = this.g.world, maxD = lava && this.g.dim !== 'nether' ? 2 : 4;
    const passable = (bx, by, bz) => {
      if (!this.loaded(bx, bz)) return false;
      const n = w.getBlock(bx, by, bz);
      return !n || RENDER[n] === R_CROSS || (sameLiquid(n, lava ? B.LAVA : B.WATER) && !isSource(n));
    };
    let best = 99;
    const res = [];
    for (let d = 0; d < 4; d++) {
      const sx = x + DIR4[d][0], sz = z + DIR4[d][1];
      if (!passable(sx, y, sz)) continue;
      // Genişlik öncelikli arama
      let dist = 99;
      const seen = new Set([sx + ',' + sz]);
      let front = [[sx, sz]];
      for (let k = 1; k <= maxD && dist === 99; k++) {
        const next = [];
        for (const [bx, bz] of front) {
          if (passable(bx, y - 1, bz)) { dist = k; break; }
          for (const [dx, dz] of DIR4) {
            const cx = bx + dx, cz = bz + dz, key = cx + ',' + cz;
            if (seen.has(key) || (cx === x && cz === z)) continue;
            seen.add(key);
            if (passable(cx, y, cz)) next.push([cx, cz]);
          }
        }
        front = next;
      }
      if (dist < best) { best = dist; res.length = 0; }
      if (dist === best) res.push(d);
    }
    return best === 99 ? [0, 1, 2, 3] : res;
  }
}
