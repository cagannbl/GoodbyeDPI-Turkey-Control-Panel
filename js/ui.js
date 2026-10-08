'use strict';
// ---------------------------------------------------------------------------
// Arayüz: menüler, HUD, envanter, tarifler, dokunmatik kontroller
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const SPLASHES = ['HTML5 ile!', '%100 JavaScript!', 'Kurulum yok!', 'Bloklar!', 'Creeper geliyor!', 'Merhaba Türkiye!',
  'WebGL2 güçlü!', 'Sonsuz dünya!', 'Ssssss...', 'Meşaleni unutma!', 'Elmas bul!', 'Kazmaya devam!', 'Çay molası?'];

function pixelIcon(rows, palette, scale = 1) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (palette[ch]) { ctx.fillStyle = palette[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}

const HEART_ROWS = [
  '..##.##..',
  '.#rr#rr#.',
  '#rwrrrrr#',
  '#rwrrrrr#',
  '#rrrrrrr#',
  '.#rrrrr#.',
  '..#rrr#..',
  '...#r#...',
  '....#....',
];
const BUBBLE_ROWS = [
  '..####...',
  '.#bbbb#..',
  '#bwwbbb#.',
  '#bwbbbb#.',
  '#bbbbbb#.',
  '#bbbbbb#.',
  '.#bbbb#..',
  '..####...',
  '.........',
];

class UI {
  constructor(game) {
    this.g = game;
    this.screen = 'mainMenu';
    this.prevScreen = null;
    this.hotbarDirty = true;
    this.lastHealth = -1; this.lastAir = -1;
    this.nameTimer = 0;
    this.toastTimer = 0;
    this.cursor = null;
    this.mx = 0; this.my = 0;
    this.createMode = 'survival'; this.createDiff = 1;
    this.tab = 0; this.bookOpen = false; this.result = null; this.bookList = [];
    const H = (p) => pixelIcon(HEART_ROWS, p);
    this.icons = {
      heart: H({ '#': '#1a0000', r: '#e01010', w: '#ffb0b0' }),
      heartEmpty: H({ '#': '#1a0000', r: '#3a1010', w: '#3a1010' }),
      heartHalf: pixelIcon(HEART_ROWS.map((r) => r.slice(0, 5) + r.slice(5).replace(/[rw]/g, 'e')), { '#': '#1a0000', r: '#e01010', w: '#ffb0b0', e: '#3a1010' }),
      bubble: pixelIcon(BUBBLE_ROWS, { '#': '#103080', b: '#3a7bff', w: '#ffffff' }),
    };
    this.bindMenus();
    this.bindInventory();
    document.documentElement.style.setProperty('--dirt', `url(${this.tileURL(TEX.dirt)})`);
    $('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  }

  tileURL(layer) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(16, 16);
    img.data.set(texLayers[layer]); ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // ---------------- Menüler ----------------
  show(id) {
    for (const s of ['mainMenu', 'worldsMenu', 'createMenu', 'settingsMenu', 'helpMenu', 'pauseMenu', 'deathMenu', 'loading']) {
      $(s).classList.toggle('hidden', s !== id);
    }
    if (id && id !== this.screen) { this.prevScreen = this.screen; }
    this.screen = id;
    if (id === 'worldsMenu') this.renderWorldList();
    if (id === 'settingsMenu') this.syncSettings();
  }

  bindMenus() {
    const g = this.g;
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      g.audio.init();
      g.audio.play('click');
      const a = b.dataset.action;
      switch (a) {
        case 'worlds': this.show('worldsMenu'); break;
        case 'settings': this.settingsReturn = this.screen; this.show('settingsMenu'); break;
        case 'settingsBack': g.saveSettings(); this.show(this.settingsReturn || 'mainMenu'); break;
        case 'help': this.helpReturn = this.screen; this.show('helpMenu'); break;
        case 'back':
          if (this.screen === 'helpMenu') this.show(this.helpReturn || 'mainMenu');
          else this.show('mainMenu');
          break;
        case 'create':
          $('worldName').value = 'Yeni Dünya ' + (g.listWorlds().length + 1);
          $('worldSeed').value = '';
          this.show('createMenu');
          setTimeout(() => $('worldName').focus(), 50);
          break;
        case 'doCreate': {
          const name = $('worldName').value.trim() || 'Yeni Dünya';
          const seed = $('worldSeed').value.trim() || String(Math.floor(Math.random() * 2147483647));
          g.createWorld(name, seed, this.createMode, this.createDiff);
          break;
        }
        case 'resume': g.resume(); break;
        case 'quit': g.quitToMenu(); break;
        case 'respawn': g.respawn(); break;
      }
    });
    $('modeToggle').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]'); if (!b) return;
      this.createMode = b.dataset.mode;
      for (const x of $('modeToggle').children) x.classList.toggle('sel', x === b);
      $('modeHint').textContent = this.createMode === 'creative'
        ? 'Sınırsız blok, uçma yeteneği ve hasar yok. Sadece inşa et!'
        : 'Blok topla, canavarlardan korun, sağlığına dikkat et.';
    });
    $('diffToggle').addEventListener('click', (e) => {
      const b = e.target.closest('[data-diff]'); if (!b) return;
      this.createDiff = +b.dataset.diff;
      for (const x of $('diffToggle').children) x.classList.toggle('sel', x === b);
    });
    $('worldName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('createMenu').querySelector('[data-action=doCreate]').click(); });

    const S = g.settings;
    const bindRange = (id, key, valId, fmt, apply) => {
      const el = $(id);
      el.addEventListener('input', () => { S[key] = +el.value; $(valId).textContent = fmt(S[key]); if (apply) apply(S[key]); });
    };
    bindRange('setRD', 'renderDist', 'rdVal', (v) => v + ' parça');
    bindRange('setFOV', 'fov', 'fovVal', (v) => v + '°');
    bindRange('setSens', 'sensitivity', 'sensVal', (v) => Math.round(v * 100) + '%');
    bindRange('setGamma', 'gamma', 'gammaVal', (v) => v === 0 ? 'Karanlık' : v >= 0.7 ? 'Parlak!' : '+' + Math.round(v / 0.7 * 100) + '%');
    bindRange('setVol', 'volume', 'volVal', (v) => Math.round(v * 100) + '%', (v) => g.audio.setVolume(v));
    bindRange('setMus', 'music', 'musVal', (v) => v === 0 ? 'Kapalı' : Math.round(v * 100) + '%', (v) => g.audio.setMusic(v > 0, v));
    bindRange('setRes', 'resScale', 'resVal', (v) => Math.round(v * 100) + '%', (v) => { g.renderer.resScale = v; });
    const bindChk = (id, key) => $(id).addEventListener('change', () => { S[key] = $(id).checked; });
    bindChk('setClouds', 'clouds'); bindChk('setBob', 'viewBob'); bindChk('setMobs', 'mobs'); bindChk('setInvert', 'invertY');
  }

  syncSettings() {
    const S = this.g.settings;
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input')); };
    set('setRD', S.renderDist); set('setFOV', S.fov); set('setSens', S.sensitivity); set('setGamma', S.gamma);
    set('setVol', S.volume); set('setMus', S.music); set('setRes', S.resScale);
    $('setClouds').checked = S.clouds; $('setBob').checked = S.viewBob; $('setMobs').checked = S.mobs; $('setInvert').checked = S.invertY;
  }

  renderWorldList() {
    const g = this.g, list = $('worldList');
    list.innerHTML = '';
    const worlds = g.listWorlds().sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    if (!worlds.length) { list.innerHTML = '<div class="empty">Henüz dünya yok. Yeni bir tane oluştur!</div>'; return; }
    for (const w of worlds) {
      const d = document.createElement('div');
      d.className = 'worldItem';
      const date = w.lastPlayed ? new Date(w.lastPlayed).toLocaleString('tr-TR') : '-';
      d.innerHTML = `<img class="wi" src="${ICONS[w.mode === 'creative' ? B.GLOWSTONE : B.GRASS]}">
        <div class="wt"><div class="wn"></div><div class="wd"></div></div>
        <button class="btn small" data-play>Oyna</button><button class="btn small danger" data-del>Sil</button>`;
      d.querySelector('.wn').textContent = w.name;
      d.querySelector('.wd').textContent = `${w.mode === 'creative' ? 'Yaratıcı' : 'Hayatta Kalma'} · Tohum: ${w.seed} · ${date}`;
      d.addEventListener('click', (e) => {
        g.audio.init();
        if (e.target.closest('[data-del]')) {
          const del = e.target.closest('[data-del]');
          if (del.dataset.armed) { g.deleteWorld(w.id); this.renderWorldList(); }
          else { del.dataset.armed = '1'; del.textContent = 'Emin misin?'; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Sil'; } }, 3000); }
          return;
        }
        g.audio.play('click');
        g.loadWorld(w.id);
      });
      list.appendChild(d);
    }
  }

  setLoading(p, text) {
    $('loadBar').style.width = Math.round(p * 100) + '%';
    $('loadText').textContent = text || '';
  }

  // ---------------- HUD ----------------
  toast(msg, t = 2.5) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show'); this.toastTimer = t;
  }

  showItemName() {
    const s = this.g.inv[this.g.selected];
    $('itemName').textContent = s ? itemName(s.id) : '';
    $('itemName').style.opacity = 1;
    this.nameTimer = 2;
  }

  renderHotbar() {
    const g = this.g, hb = $('hotbar');
    if (hb.children.length !== 9) {
      hb.innerHTML = '';
      for (let i = 0; i < 9; i++) { const d = document.createElement('div'); d.className = 'hslot'; hb.appendChild(d); }
    }
    for (let i = 0; i < 9; i++) {
      const el = hb.children[i], s = g.inv[i];
      el.classList.toggle('sel', i === g.selected);
      const key = s ? s.id + ':' + s.count + ':' + (s.dmg || 0) : '';
      if (el.dataset.k === key) continue;
      el.dataset.k = key;
      el.innerHTML = this.slotInner(s);
    }
    this.hotbarDirty = false;
  }

  updateHUD(dt) {
    const g = this.g, p = g.player;
    if (this.hotbarDirty) this.renderHotbar();
    if (this.nameTimer > 0) { this.nameTimer -= dt; if (this.nameTimer <= 0) $('itemName').style.opacity = 0; }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) $('toast').classList.remove('show'); }
    const surv = !p.creative;
    $('bars').style.visibility = surv ? 'visible' : 'hidden';
    if (surv && p.health !== this.lastHealth) {
      const hs = $('hearts');
      if (p.health < this.lastHealth) { hs.classList.remove('shake'); void hs.offsetWidth; hs.classList.add('shake'); }
      this.lastHealth = p.health;
      let html = '';
      for (let i = 0; i < 10; i++) {
        const v = p.health - i * 2;
        html += `<img src="${v >= 2 ? this.icons.heart : v === 1 ? this.icons.heartHalf : this.icons.heartEmpty}">`;
      }
      hs.innerHTML = html;
    }
    const air = p.eyeInWater && surv ? Math.ceil(Math.max(0, p.air)) : -1;
    if (air !== this.lastAir) {
      this.lastAir = air;
      $('bubbles').innerHTML = air < 0 ? '' : `<img src="${this.icons.bubble}">`.repeat(air);
    }
    $('hurtFlash').style.opacity = p.hurtTime > 0 ? Math.min(1, p.hurtTime * 2.4) : 0;
    const lo = $('liquidOverlay');
    const cls = p.eyeInLava ? 'lava' : p.eyeInWater ? 'water' : '';
    if (lo.className !== cls) lo.className = cls;
    $('portalOverlay').style.opacity = Math.min(0.85, (g.portalT || 0) / 2.5);
  }

  updateDebug(info) {
    const el = $('debug');
    if (!this.g.showDebug) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = info.map((l) => `<span>${l}</span>`).join('\n');
  }

  // ---------------- Envanter (Minecraft düzeni) ----------------
  // Yuva türleri: inv (0-8 eşya çubuğu, 9-35 ana), craft, result, tile (fırın/sandık), pal (yaratıcı), trash
  slotInner(s) {
    if (!s) return '';
    let h = `<img src="${ICONS[s.id]}" draggable="false">`;
    if (s.count > 1) h += `<span class="cnt">${s.count}</span>`;
    const t = toolOf(s);
    if (t && s.dmg > 0) {
      const f = Math.max(0, 1 - s.dmg / t.dur);
      h += `<span class="dur"><i style="width:${Math.round(f * 100)}%;background:hsl(${Math.round(f * 120)},90%,45%)"></i></span>`;
    }
    return h;
  }
  slot(c, i, s, extra = '') { return `<div class="slot ${extra}" data-c="${c}" data-i="${i}">${this.slotInner(s)}</div>`; }

  getSlot(c, i) {
    const g = this.g;
    if (c === 'inv') return g.inv[i];
    if (c === 'craft') return g.craft[i];
    if (c === 'tile') return g.screen.tile.items[i];
    if (c === 'result') return this.result;
    return null;
  }
  setSlot(c, i, v) {
    const g = this.g;
    if (v && v.count <= 0) v = null;
    if (c === 'inv') g.inv[i] = v;
    else if (c === 'craft') g.craft[i] = v;
    else if (c === 'tile') g.screen.tile.items[i] = v;
  }
  canPut(c, i, s) {
    if (c === 'result' || c === 'pal') return false;
    if (c === 'tile' && this.g.screen.kind === 'furnace') {
      if (i === 2) return false;
      if (i === 1) return fuelTime(s.id) > 0;
    }
    return true;
  }
  gridW() { return this.g.screen.kind === 'crafting' ? 3 : 2; }

  updateResult() {
    const g = this.g, k = g.screen && g.screen.kind;
    this.result = null; this.recipe = null;
    if (k !== 'player' && k !== 'crafting') return;
    const w = this.gridW();
    const grid = w === 3 ? g.craft.slice(0, 9) : [g.craft[0], g.craft[1], g.craft[2], g.craft[3]];
    const r = matchRecipe(grid, w);
    if (r) { this.recipe = r; this.result = { id: r.out, count: r.n }; }
  }

  // Sonucu bir kez al: ızgaradaki her malzemeden bir tane eksilt
  takeResult() {
    const g = this.g, n = this.gridW() === 3 ? 9 : 4;
    for (let i = 0; i < n; i++) {
      const s = g.craft[i];
      if (!s) continue;
      s.count--;
      if (s.count <= 0) g.craft[i] = s.id === I.WATER_BUCKET || s.id === I.LAVA_BUCKET ? { id: I.BUCKET, count: 1 } : null;
    }
    g.audio.play('pop');
    this.updateResult();
  }

  // Eşyaları envantere aktar (shift-tık). range: [başlangıç, bitiş) dizileri
  moveInto(stack, targets) {
    for (const [c, a, b] of targets) for (let i = a; i < b && stack.count > 0; i++) {
      const t = this.getSlot(c, i);
      if (t && t.id === stack.id && !toolOf(t) && t.count < maxStack(t.id) && this.canPut(c, i, stack)) {
        const m = Math.min(maxStack(t.id) - t.count, stack.count); t.count += m; stack.count -= m;
      }
    }
    for (const [c, a, b] of targets) for (let i = a; i < b && stack.count > 0; i++) {
      if (!this.getSlot(c, i) && this.canPut(c, i, stack)) {
        const m = Math.min(maxStack(stack.id), stack.count);
        this.setSlot(c, i, Object.assign({}, stack, { count: m })); stack.count -= m;
      }
    }
    return stack.count;
  }

  shiftClick(c, i) {
    const g = this.g, k = g.screen.kind;
    if (c === 'result') {
      for (let n = 0; n < 64 && this.result; n++) {
        const st = { id: this.result.id, count: this.result.count };
        if (!this.hasRoom(st)) break;
        this.moveInto(st, [['inv', 9, 36], ['inv', 0, 9]]);
        this.takeResult();
      }
      return;
    }
    const s = this.getSlot(c, i);
    if (!s) return;
    let targets;
    if (c === 'inv') {
      if (k === 'chest') targets = [['tile', 0, 27]];
      else if (k === 'furnace') targets = SMELT[s.id] !== undefined ? [['tile', 0, 1]] : fuelTime(s.id) ? [['tile', 1, 2]] : null;
      if (!targets) targets = i < 9 ? [['inv', 9, 36]] : [['inv', 0, 9]];
    } else targets = [['inv', 9, 36], ['inv', 0, 9]];
    const left = this.moveInto(s, targets);
    if (!left) this.setSlot(c, i, null);
  }

  hasRoom(st) {
    let n = st.count;
    for (const s of this.g.inv) {
      if (!s) n -= maxStack(st.id);
      else if (s.id === st.id && !toolOf(s)) n -= maxStack(s.id) - s.count;
      if (n <= 0) return true;
    }
    return n <= 0;
  }

  clickSlot(c, i, right, shift) {
    const g = this.g;
    if (c === 'trash') { this.cursor = null; return; }
    if (c === 'pal') {
      const id = +i;
      if (shift) { const st = { id, count: maxStack(id) }; this.moveInto(st, [['inv', 0, 9], ['inv', 9, 36]]); return; }
      if (this.cursor && this.cursor.id === id && !right) { this.cursor.count = Math.min(maxStack(id), this.cursor.count + 1); return; }
      this.cursor = this.cursor ? null : { id, count: right ? 1 : maxStack(id) };
      return;
    }
    if (shift) { this.shiftClick(c, i); return; }
    if (c === 'result') {
      const r = this.result;
      if (!r) return;
      const cur = this.cursor;
      if (!cur) { this.cursor = { id: r.id, count: r.count }; this.takeResult(); }
      else if (cur.id === r.id && !toolOf(cur) && cur.count + r.count <= maxStack(r.id)) { cur.count += r.count; this.takeResult(); }
      return;
    }
    const s = this.getSlot(c, i), cur = this.cursor;
    if (c === 'tile' && g.screen.kind === 'furnace' && i === 2) {
      // Çıktı yuvası: sadece al
      if (!s) return;
      if (!cur) { this.cursor = s; this.setSlot(c, i, null); }
      else if (cur.id === s.id && cur.count + s.count <= maxStack(s.id)) { cur.count += s.count; this.setSlot(c, i, null); }
      return;
    }
    if (right) {
      if (!cur && s) { const h = Math.ceil(s.count / 2); this.cursor = Object.assign({}, s, { count: h }); s.count -= h; if (!s.count) this.setSlot(c, i, null); }
      else if (cur && this.canPut(c, i, cur)) {
        if (!s) { this.setSlot(c, i, Object.assign({}, cur, { count: 1 })); cur.count--; }
        else if (s.id === cur.id && !toolOf(s) && s.count < maxStack(s.id)) { s.count++; cur.count--; }
        if (cur.count <= 0) this.cursor = null;
      }
      return;
    }
    if (!cur) { if (s) { this.cursor = s; this.setSlot(c, i, null); } return; }
    if (!this.canPut(c, i, cur)) return;
    if (!s) { this.setSlot(c, i, cur); this.cursor = null; }
    else if (s.id === cur.id && !toolOf(s)) {
      const m = Math.min(maxStack(s.id) - s.count, cur.count); s.count += m; cur.count -= m;
      if (!cur.count) this.cursor = null;
    } else { this.setSlot(c, i, cur); this.cursor = s; }
  }

  // Çift tık: aynı eşyaları imlece topla
  collect() {
    const cur = this.cursor;
    if (!cur || toolOf(cur)) return;
    const k = this.g.screen.kind;
    const areas = [['inv', 0, 36]];
    if (k === 'chest') areas.push(['tile', 0, 27]);
    if (k === 'player' || k === 'crafting') areas.push(['craft', 0, 9]);
    for (const [c, a, b] of areas) for (let i = a; i < b && cur.count < maxStack(cur.id); i++) {
      const s = this.getSlot(c, i);
      if (s && s.id === cur.id) { const m = Math.min(maxStack(cur.id) - cur.count, s.count); cur.count += m; s.count -= m; if (!s.count) this.setSlot(c, i, null); }
    }
  }

  bindInventory() {
    const inv = $('inventory');
    this.drag = null;
    inv.addEventListener('contextmenu', (e) => e.preventDefault());
    inv.addEventListener('pointermove', (e) => {
      this.moveCursor(e.clientX, e.clientY);
      if (!this.drag) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const s = el && el.closest('.slot');
      if (!s || s.dataset.c === 'pal' || s.dataset.c === 'result' || s.dataset.c === 'trash') return;
      const key = s.dataset.c + ':' + s.dataset.i;
      if (!this.drag.slots.some((d) => d.key === key)) {
        const t = this.getSlot(s.dataset.c, +s.dataset.i);
        if ((!t || (t.id === this.cursor.id && !toolOf(t))) && this.canPut(s.dataset.c, +s.dataset.i, this.cursor)) {
          this.drag.slots.push({ key, c: s.dataset.c, i: +s.dataset.i });
          s.classList.add('dragsel');
        }
      }
    });
    inv.addEventListener('pointerdown', (e) => {
      const g = this.g;
      this.moveCursor(e.clientX, e.clientY);
      const tab = e.target.closest('[data-tab]');
      if (tab) { this.tab = +tab.dataset.tab; g.audio.play('click'); this.render(); return; }
      if (e.target.closest('#bookBtn')) { this.bookOpen = !this.bookOpen; g.audio.play('click'); this.render(); return; }
      const rec = e.target.closest('.rbook');
      if (rec) { this.fillRecipe(+rec.dataset.r); return; }
      const slot = e.target.closest('.slot');
      if (!slot) {
        if (e.target === inv || e.target.classList.contains('invWrap')) {
          if (this.cursor) { this.dropCursor(e.button === 2); this.render(); } else g.closeInventory();
        }
        return;
      }
      e.preventDefault();
      const c = slot.dataset.c, i = c === 'pal' ? slot.dataset.i : +slot.dataset.i;
      const now = performance.now();
      if (!e.shiftKey && this.cursor && this.lastClick && now - this.lastClick.t < 300 && this.lastClick.key === c + ':' + i && e.button === 0) {
        this.collect(); this.lastClick = null; this.render(); return;
      }
      this.lastClick = { t: now, key: c + ':' + i };
      // İmleçte eşya varken sürükleyerek dağıt
      if (this.cursor && !e.shiftKey && c !== 'pal' && c !== 'result' && c !== 'trash') {
        this.drag = { right: e.button === 2, slots: [], start: { c, i } };
        const t = this.getSlot(c, i);
        if ((!t || (t.id === this.cursor.id && !toolOf(t))) && this.canPut(c, i, this.cursor)) { this.drag.slots.push({ key: c + ':' + i, c, i }); slot.classList.add('dragsel'); }
        else { this.drag = null; this.clickSlot(c, i, e.button === 2, false); this.afterChange(); }
        return;
      }
      g.audio.play('click');
      this.clickSlot(c, i, e.button === 2, e.shiftKey);
      this.afterChange();
    });
    window.addEventListener('pointerup', () => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      const cur = this.cursor;
      if (!cur) { this.render(); return; }
      if (d.slots.length <= 1) {
        this.clickSlot(d.start.c, d.start.i, d.right, false);
      } else {
        const per = d.right ? 1 : Math.floor(cur.count / d.slots.length);
        for (const sl of d.slots) {
          if (cur.count <= 0 || per <= 0) break;
          const t = this.getSlot(sl.c, sl.i);
          const room = t ? maxStack(t.id) - t.count : maxStack(cur.id);
          const m = Math.min(per, room, cur.count);
          if (m <= 0) continue;
          if (t) t.count += m; else this.setSlot(sl.c, sl.i, Object.assign({}, cur, { count: m }));
          cur.count -= m;
        }
        if (cur.count <= 0) this.cursor = null;
      }
      this.g.audio.play('click');
      this.afterChange();
    });
    $('invSearch').addEventListener('input', () => this.render());
    $('bookSearch').addEventListener('input', () => this.render());
    $('bookSearch').addEventListener('keydown', (e) => e.stopPropagation());
    $('bookOk').addEventListener('change', () => this.render());
    $('invSearch').addEventListener('keydown', (e) => e.stopPropagation());
    inv.addEventListener('pointerover', (e) => {
      const s = e.target.closest('.slot, .rbook');
      const tt = $('tooltip');
      if (!s) { tt.style.display = 'none'; return; }
      let st = null;
      if (s.classList.contains('rbook')) { const r = this.bookList[+s.dataset.r]; st = r ? { id: r.out, count: r.n } : null; }
      else if (s.dataset.c === 'pal') st = { id: +s.dataset.i, count: 1 };
      else st = this.getSlot(s.dataset.c, +s.dataset.i);
      if (!st) { tt.style.display = 'none'; return; }
      let html = `<b>${itemName(st.id)}</b>`;
      const t = toolOf(st), def = itemDef(st.id);
      if (t && t.dmg) html += `<br><span class="tt2">Saldırı hasarı: ${t.dmg}</span>`;
      if (t && t.dur) html += `<br><span class="tt2">Dayanıklılık: ${t.dur - (st.dmg || 0)} / ${t.dur}</span>`;
      if (def && def.food) html += `<br><span class="tt2">Can: +${def.food / 2} ❤</span>`;
      if (s.classList.contains('rbook')) {
        const r = this.bookList[+s.dataset.r];
        const ings = r.type === 'shaped' ? r.cells.flat().filter(Boolean) : r.ings;
        const cnt = {};
        for (const g of ings) cnt[g] = (cnt[g] || 0) + 1;
        html += '<br><span class="tt2">' + Object.keys(cnt).map((g) => `${cnt[g]}× ${itemName(groupIcon(isNaN(g) ? g : +g))}`).join(', ') + '</span>';
      }
      tt.innerHTML = html; tt.style.display = 'block';
    });
  }

  afterChange() {
    this.updateResult();
    this.render();
    this.hotbarDirty = true;
  }

  dropCursor(one) {
    const c = this.cursor;
    if (!c) return;
    if (one) { c.count--; if (!c.count) this.cursor = null; } else this.cursor = null;
  }

  moveCursor(x, y) {
    this.mx = x; this.my = y;
    const c = $('cursorItem'); c.style.left = x + 'px'; c.style.top = y + 'px';
    const tt = $('tooltip'); tt.style.left = x + 16 + 'px'; tt.style.top = y - 34 + 'px';
  }

  // Tarif kitabından ızgarayı doldur
  fillRecipe(ri) {
    const g = this.g, r = this.bookList[ri];
    if (!r) return;
    const w = this.gridW();
    // Izgaradaki eşyaları envantere geri koy
    for (let i = 0; i < 9; i++) if (g.craft[i]) { const left = this.moveInto(g.craft[i], [['inv', 0, 36]]); g.craft[i] = left ? g.craft[i] : null; }
    const cells = [];
    if (r.type === 'shaped') { for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.cells[y][x]) cells.push([y * w + x, r.cells[y][x]]); }
    else r.ings.forEach((ing, k) => cells.push([k, ing]));
    const creative = g.player.creative;
    const counts = {};
    for (const [, ing] of cells) counts[ing] = (counts[ing] || 0) + 1;
    if (!creative) for (const ing in counts) {
      const have = g.inv.reduce((a, s) => a + (s && groupHas(isNaN(ing) ? ing : +ing, s.id) ? s.count : 0), 0);
      if (have < counts[ing]) { this.toast('Malzeme eksik', 1.2); g.audio.play('click'); this.render(); return; }
    }
    for (const [pos, ing] of cells) {
      if (creative) { g.craft[pos] = { id: groupIcon(ing), count: 1 }; continue; }
      const k = g.inv.findIndex((s) => s && groupHas(ing, s.id));
      const s = g.inv[k];
      g.craft[pos] = { id: s.id, count: 1 };
      s.count--; if (!s.count) g.inv[k] = null;
    }
    g.audio.play('click');
    this.afterChange();
  }

  canMake(r) {
    const g = this.g;
    if (g.player.creative) return true;
    const ings = r.type === 'shaped' ? r.cells.flat().filter(Boolean) : r.ings;
    const counts = {};
    for (const x of ings) counts[x] = (counts[x] || 0) + 1;
    for (const k in counts) {
      const have = g.inv.concat(g.craft).reduce((a, s) => a + (s && groupHas(isNaN(k) ? k : +k, s.id) ? s.count : 0), 0);
      if (have < counts[k]) return false;
    }
    return true;
  }

  renderBook() {
    const w = this.gridW();
    const seen = new Set();
    this.bookList = [];
    const q = ($('bookSearch') && $('bookSearch').value || '').toLocaleLowerCase('tr');
    const onlyOk = $('bookOk') && $('bookOk').checked;
    for (const r of RECIPES) {
      const fits = r.type === 'shaped' ? r.w <= w && r.h <= w : r.ings.length <= w * w;
      if (!fits || seen.has(r.out + ':' + r.type + ':' + (r.ings || '').toString())) continue;
      seen.add(r.out + ':' + r.type + ':' + (r.ings || '').toString());
      if (q && !itemName(r.out).toLocaleLowerCase('tr').includes(q)) continue;
      const ok = this.canMake(r);
      if (onlyOk && !ok) continue;
      this.bookList.push(r);
    }
    this.bookList.sort((a, b) => this.canMake(b) - this.canMake(a));
    return this.bookList.map((r, i) => `<div class="rbook ${this.canMake(r) ? '' : 'no'}" data-r="${i}"><img src="${ICONS[r.out]}" draggable="false">${r.n > 1 ? `<span class="cnt">${r.n}</span>` : ''}</div>`).join('');
  }

  steveURL() {
    if (this._steve) return this._steve;
    const c = document.createElement('canvas'); c.width = 16; c.height = 32;
    const x = c.getContext('2d');
    const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    R('#c69c78', 4, 0, 8, 8); R('#3b2716', 4, 0, 8, 2); R('#3b2716', 4, 2, 1, 2); R('#3b2716', 11, 2, 1, 2);
    R('#fff', 5, 4, 1, 1); R('#4a3aa8', 6, 4, 1, 1); R('#4a3aa8', 9, 4, 1, 1); R('#fff', 10, 4, 1, 1);
    R('#8a5a3c', 6, 6, 4, 1); R('#9b6b4a', 7, 5, 2, 1);
    R('#00a8a8', 4, 8, 8, 12); R('#008a8a', 4, 8, 8, 1);
    R('#00a8a8', 0, 8, 4, 4); R('#00a8a8', 12, 8, 4, 4); R('#c69c78', 0, 12, 4, 8); R('#c69c78', 12, 12, 4, 8);
    R('#3c3caa', 4, 20, 8, 10); R('#2a2a80', 7, 21, 2, 9); R('#6a6a6a', 4, 30, 8, 2);
    return (this._steve = c.toDataURL());
  }

  render() {
    const g = this.g, S = g.screen, creative = g.player.creative;
    if (!S) return;
    const kind = S.kind;
    let top = '';
    const showBook = kind === 'player' || kind === 'crafting';
    const book = showBook ? `<button id="bookBtn" class="bookBtn" title="Tarif Kitabı"><img src="${ICONS[B.BOOKSHELF]}"></button>` : '';
    if (kind === 'creative') {
      const tabs = CREATIVE_TABS.map((t, i) => `<div class="ctab ${i === this.tab ? 'on' : ''}" data-tab="${i}" title="${t.name}"><img src="${ICONS[t.icon]}"></div>`).join('')
        + `<div class="ctab ${this.tab === -1 ? 'on' : ''}" data-tab="-1" title="Hayatta Kalma Envanteri"><img src="${ICONS[B.CHEST]}"></div>`;
      top = `<div class="ctabs">${tabs}</div>`;
      if (this.tab >= 0) {
        const T = CREATIVE_TABS[this.tab];
        top += `<div class="invTitle">${T.name}</div>`;
        let items = T.items;
        const search = !items;
        if (search) {
          const q = $('invSearch').value.trim().toLocaleLowerCase('tr');
          items = [];
          for (const t of CREATIVE_TABS) if (t.items) for (const id of t.items) if (!q || itemName(id).toLocaleLowerCase('tr').includes(q)) items.push(id);
        }
        $('invSearch').classList.toggle('hidden', !search);
        top += `<div class="grid pal">${items.map((id) => this.slot('pal', id, { id, count: 1 })).join('')}</div>`;
      } else $('invSearch').classList.add('hidden');
    } else {
      $('invSearch').classList.add('hidden');
      if (kind === 'player') {
        const cg = [0, 1, 2, 3].map((i) => this.slot('craft', i, g.craft[i])).join('');
        top = `<div class="ptop"><div class="steve"><img src="${this.steveURL()}"></div>
          <div class="craftArea"><div class="invTitle">Üretim</div><div class="crow"><div class="grid g2">${cg}</div><div class="arrow"></div>${this.slot('result', 0, this.result, 'big')}</div></div>${book}</div>`;
      } else if (kind === 'crafting') {
        const cg = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => this.slot('craft', i, g.craft[i])).join('');
        top = `<div class="invTitle">Üretim</div><div class="crow c3">${book}<div class="grid g3">${cg}</div><div class="arrow"></div>${this.slot('result', 0, this.result, 'big')}</div>`;
      } else if (kind === 'furnace') {
        const t = S.tile;
        const fl = t.burnMax ? Math.round(t.burn / t.burnMax * 100) : 0, pr = Math.round((t.prog / SMELT_TIME) * 100);
        top = `<div class="invTitle">Fırın</div><div class="crow furn"><div class="fcol">${this.slot('tile', 0, t.items[0])}<div class="flame"><i style="height:${fl}%"></i></div>${this.slot('tile', 1, t.items[1])}</div>
          <div class="arrow prog"><i style="width:${Math.min(22, pr * 0.22)}px"></i></div>${this.slot('tile', 2, t.items[2], 'big')}</div>`;
      } else if (kind === 'chest') {
        top = `<div class="invTitle">Sandık</div><div class="grid">${S.tile.items.map((s, i) => this.slot('tile', i, s)).join('')}</div>`;
      }
    }
    $('containerArea').innerHTML = top;
    const showMain = kind !== 'creative' || this.tab === -1;
    $('invLabel').classList.toggle('hidden', !showMain);
    $('invMain').classList.toggle('hidden', !showMain);
    if (showMain) {
      let h = ''; for (let i = 9; i < 36; i++) h += this.slot('inv', i, g.inv[i]);
      $('invMain').innerHTML = h;
    }
    let hb = ''; for (let i = 0; i < 9; i++) hb += this.slot('inv', i, g.inv[i]);
    if (creative && kind === 'creative') hb += `<div class="slot trash" data-c="trash" data-i="0" title="Eşyayı sil">✕</div>`;
    $('invHotbar').innerHTML = hb;
    $('invHotbar').classList.toggle('withTrash', creative && kind === 'creative');
    // Tarif kitabı
    const bp = $('recipePanel');
    bp.classList.toggle('hidden', !(showBook && this.bookOpen));
    if (showBook && this.bookOpen) $('recipeList').innerHTML = this.renderBook();
    const cur = this.cursor;
    $('cursorItem').innerHTML = cur ? this.slotInner(cur) : '';
    this.furnaceKey = kind === 'furnace' ? this.furnaceState() : null;
  }

  furnaceState() {
    const t = this.g.screen.tile;
    return t.items.map((s) => (s ? s.id + 'x' + s.count : '-')).join(',') + '|' + Math.round(t.burn * 4) + '|' + Math.round(t.prog * 8);
  }
  tick() {
    const S = this.g.screen;
    if (S && S.kind === 'furnace' && !this.drag && this.furnaceState() !== this.furnaceKey) this.render();
  }

  // ---------------- Dokunmatik ----------------
  initTouch() {
    const g = this.g;
    $('touch').classList.remove('hidden');
    document.body.classList.add('touch');
    const joy = $('joy'), knob = $('joyKnob');
    let joyId = null, jx = 0, jy = 0;
    const joyMove = (t) => {
      const r = joy.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy), max = r.width / 2;
      if (l > max) { dx *= max / l; dy *= max / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      jx = dx / max; jy = dy / max;
      g.touchMove = [jx, jy];
    };
    joy.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; joyId = t.identifier; joyMove(t); }, { passive: false });
    joy.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyId) joyMove(t); }, { passive: false });
    const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; knob.style.transform = ''; g.touchMove = [0, 0]; } };
    joy.addEventListener('touchend', joyEnd); joy.addEventListener('touchcancel', joyEnd);

    const look = $('lookArea');
    const looks = new Map();
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) looks.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now() });
    }, { passive: false });
    look.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const l = looks.get(t.identifier); if (!l) continue;
        g.look(t.clientX - l.x, t.clientY - l.y, 2.2);
        l.x = t.clientX; l.y = t.clientY;
      }
    }, { passive: false });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        const l = looks.get(t.identifier); if (!l) continue;
        looks.delete(t.identifier);
        // Kısa dokunuş = blok koy
        if (performance.now() - l.t < 250 && Math.hypot(t.clientX - l.sx, t.clientY - l.sy) < 12) g.tapPlace = true;
      }
    };
    look.addEventListener('touchend', lookEnd); look.addEventListener('touchcancel', lookEnd);

    const hold = (id, key) => {
      const el = $(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); g.touch[key] = true; el.classList.add('on'); }, { passive: false });
      const up = (e) => { e.preventDefault(); g.touch[key] = false; el.classList.remove('on'); };
      el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
    };
    hold('tbJump', 'jump'); hold('tbBreak', 'break'); hold('tbPlace', 'place');
    const sneak = $('tbSneak');
    sneak.addEventListener('touchstart', (e) => { e.preventDefault(); g.touch.sneak = !g.touch.sneak; sneak.classList.toggle('on', g.touch.sneak); }, { passive: false });
    const tap = (id, fn) => $(id).addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    tap('tbFly', () => { if (g.player.creative) { g.player.flying = !g.player.flying; g.player.vel[1] = 0; } });
    tap('tbInv', () => g.toggleInventory());
    tap('tbPause', () => g.pause());
    $('hotbar').style.pointerEvents = 'auto';
    $('hotbar').addEventListener('touchstart', (e) => {
      const s = e.target.closest('.hslot'); if (!s) return;
      g.selectSlot([...$('hotbar').children].indexOf(s));
    });
  }
}
