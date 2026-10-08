'use strict';
// ---------------------------------------------------------------------------
// Arayüz: menüler, HUD, envanter, tarifler, dokunmatik kontroller
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const RECIPES = [
  { out: [B.PLANKS, 4], in: [[B.LOG, 1]] },
  { out: [B.BIRCH_PLANKS, 4], in: [[B.BIRCH_LOG, 1]] },
  { out: [B.SPRUCE_PLANKS, 4], in: [[B.SPRUCE_LOG, 1]] },
  { out: [B.CRAFTING, 1], in: [[B.PLANKS, 4]] },
  { out: [B.TORCH, 4], in: [[B.COAL, 1], [B.PLANKS, 1]] },
  { out: [B.FURNACE, 1], in: [[B.COBBLE, 8]] },
  { out: [B.STONE, 1], in: [[B.COBBLE, 1]] },
  { out: [B.STONE_BRICKS, 4], in: [[B.STONE, 4]] },
  { out: [B.MOSSY_COBBLE, 1], in: [[B.COBBLE, 1], [B.LEAVES, 1]] },
  { out: [B.GLASS, 1], in: [[B.SAND, 1]] },
  { out: [B.SANDSTONE, 1], in: [[B.SAND, 4]] },
  { out: [B.BRICKS, 1], in: [[B.DIRT, 2], [B.GRAVEL, 2]] },
  { out: [B.BOOKSHELF, 1], in: [[B.PLANKS, 6]] },
  { out: [B.TNT, 1], in: [[B.SAND, 4], [B.GRAVEL, 4], [B.COAL, 1]] },
  { out: [B.JACK, 1], in: [[B.PUMPKIN, 1], [B.TORCH, 1]] },
  { out: [B.GLOWSTONE, 1], in: [[B.REDSTONE, 2], [B.GOLD, 1]] },
  { out: [B.SNOW, 1], in: [[B.ICE, 1]] },
  { out: [B.WOOL_RED, 1], in: [[B.WOOL_WHITE, 1], [B.POPPY, 1]] },
  { out: [B.WOOL_YELLOW, 1], in: [[B.WOOL_WHITE, 1], [B.DANDELION, 1]] },
  { out: [B.WOOL_BLUE, 1], in: [[B.WOOL_WHITE, 1], [B.BLUE_FLOWER, 1]] },
  { out: [B.WOOL_ORANGE, 1], in: [[B.WOOL_RED, 1], [B.WOOL_YELLOW, 1]] },
  { out: [B.WOOL_PURPLE, 1], in: [[B.WOOL_RED, 1], [B.WOOL_BLUE, 1]] },
  { out: [B.WOOL_LIME, 1], in: [[B.WOOL_YELLOW, 1], [B.LEAVES, 1]] },
  { out: [B.WOOL_BLACK, 1], in: [[B.WOOL_WHITE, 1], [B.COAL, 1]] },
  { out: [B.OBSIDIAN, 1], in: [[B.STONE, 4], [B.DIAMOND, 1]] },
];

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
    $('itemName').textContent = s ? BLOCKS[s.id].name : '';
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
      const key = s ? s.id + ':' + s.count + ':' + g.player.creative : '';
      if (el.dataset.k === key) continue;
      el.dataset.k = key;
      el.innerHTML = s ? `<img src="${ICONS[s.id]}">${!g.player.creative && s.count > 1 ? `<span class="cnt">${s.count}</span>` : ''}` : '';
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
  }

  updateDebug(info) {
    const el = $('debug');
    if (!this.g.showDebug) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = info.map((l) => `<span>${l}</span>`).join('\n');
  }

  // ---------------- Envanter ----------------
  bindInventory() {
    const inv = $('inventory');
    inv.addEventListener('pointermove', (e) => this.moveCursor(e.clientX, e.clientY));
    inv.addEventListener('contextmenu', (e) => e.preventDefault());
    inv.addEventListener('pointerdown', (e) => {
      const g = this.g;
      const slot = e.target.closest('.slot');
      const rec = e.target.closest('.recipe');
      this.moveCursor(e.clientX, e.clientY);
      if (rec) { g.craft(+rec.dataset.r); return; }
      if (!slot) {
        if (e.target === inv) g.closeInventory();
        return;
      }
      g.audio.play('click');
      if (slot.dataset.pal !== undefined) {
        const id = +slot.dataset.pal;
        if (e.shiftKey) {
          let i = g.inv.slice(0, 9).findIndex((s) => !s);
          if (i < 0) i = g.selected;
          g.inv[i] = { id, count: 64 };
        } else if (this.cursor && this.cursor.id !== id) this.cursor = null;
        else this.cursor = { id, count: 64 };
      } else {
        this.clickSlot(+slot.dataset.idx, e.button === 2, e.shiftKey);
      }
      this.renderInventory();
      this.hotbarDirty = true;
    });
    $('invSearch').addEventListener('input', () => this.renderInventory());
    $('invSearch').addEventListener('keydown', (e) => e.stopPropagation());
    inv.addEventListener('pointerover', (e) => {
      const s = e.target.closest('.slot');
      const tt = $('tooltip');
      if (!s) { tt.style.display = 'none'; return; }
      const id = s.dataset.pal !== undefined ? +s.dataset.pal : (this.g.inv[+s.dataset.idx] || {}).id;
      if (!id) { tt.style.display = 'none'; return; }
      tt.textContent = BLOCKS[id].name; tt.style.display = 'block';
    });
  }

  moveCursor(x, y) {
    this.mx = x; this.my = y;
    const c = $('cursorItem'); c.style.left = x + 'px'; c.style.top = y + 'px';
    const tt = $('tooltip'); tt.style.left = x + 16 + 'px'; tt.style.top = y - 30 + 'px';
  }

  clickSlot(i, right, shift) {
    const g = this.g, inv = g.inv;
    const s = inv[i];
    if (shift && s && !g.player.creative) {
      // Eşya çubuğu <-> ana envanter arasında hızlı taşı
      const range = i < 9 ? [9, 36] : [0, 9];
      for (let k = range[0]; k < range[1] && inv[i]; k++) {
        if (inv[k] && inv[k].id === s.id && inv[k].count < 64) {
          const m = Math.min(64 - inv[k].count, s.count); inv[k].count += m; s.count -= m;
          if (!s.count) inv[i] = null;
        }
      }
      for (let k = range[0]; k < range[1] && inv[i]; k++) if (!inv[k]) { inv[k] = s; inv[i] = null; }
      return;
    }
    if (shift && g.player.creative) { inv[i] = null; return; }
    const c = this.cursor;
    if (right) {
      if (!c && s) { const h = Math.ceil(s.count / 2); this.cursor = { id: s.id, count: h }; s.count -= h; if (!s.count) inv[i] = null; }
      else if (c && !s) { inv[i] = { id: c.id, count: 1 }; c.count--; if (!c.count) this.cursor = null; }
      else if (c && s && s.id === c.id && s.count < 64) { s.count++; c.count--; if (!c.count) this.cursor = null; }
      return;
    }
    if (!c) { this.cursor = s; inv[i] = null; }
    else if (!s) { inv[i] = c; this.cursor = null; }
    else if (s.id === c.id) {
      const m = Math.min(64 - s.count, c.count); s.count += m; c.count -= m;
      if (!c.count) this.cursor = null;
    } else { inv[i] = c; this.cursor = s; }
  }

  slotHTML(s, attrs) {
    const inner = s ? `<img src="${ICONS[s.id]}">${s.count > 1 && !this.g.player.creative ? `<span class="cnt">${s.count}</span>` : ''}` : '';
    return `<div class="slot" ${attrs}>${inner}</div>`;
  }

  renderInventory() {
    const g = this.g, creative = g.player.creative;
    $('invTitle').textContent = creative ? 'Yaratıcı Mod Blokları' : 'Envanter';
    $('invTabs').classList.toggle('hidden', !creative);
    $('recipePanel').classList.toggle('hidden', creative);
    let html = '';
    if (creative) {
      const q = $('invSearch').value.trim().toLocaleLowerCase('tr');
      for (const id of CREATIVE_ORDER) {
        if (q && !BLOCKS[id].name.toLocaleLowerCase('tr').includes(q)) continue;
        html += this.slotHTML({ id, count: 1 }, `data-pal="${id}"`);
      }
    } else {
      for (let i = 9; i < 36; i++) html += this.slotHTML(g.inv[i], `data-idx="${i}"`);
    }
    $('invGrid').innerHTML = html;
    let hb = '';
    for (let i = 0; i < 9; i++) hb += this.slotHTML(g.inv[i], `data-idx="${i}"`);
    $('invHotbar').innerHTML = hb;
    const c = this.cursor;
    $('cursorItem').innerHTML = c ? `<img src="${ICONS[c.id]}">${c.count > 1 && !creative ? `<span class="cnt">${c.count}</span>` : ''}` : '';
    if (!creative) this.renderRecipes();
  }

  renderRecipes() {
    const g = this.g;
    let html = '';
    RECIPES.forEach((r, i) => {
      const ok = r.in.every(([id, n]) => g.countItem(id) >= n);
      const ins = r.in.map(([id, n]) => `<span class="rin"><img src="${ICONS[id]}" title="${BLOCKS[id].name}"><span class="rc">${n}</span></span>`).join('');
      html += `<div class="recipe ${ok ? 'ok' : 'no'}" data-r="${i}" title="${BLOCKS[r.out[0]].name}">${ins}<span class="arrow">→</span><img src="${ICONS[r.out[0]]}"><span class="rc">${r.out[1]}</span></div>`;
    });
    $('recipeList').innerHTML = html;
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
