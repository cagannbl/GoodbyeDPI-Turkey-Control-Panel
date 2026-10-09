'use strict';
// ---------------------------------------------------------------------------
// Oyun döngüsü, girişler, dünya yönetimi, etkileşim ve kayıt
// ---------------------------------------------------------------------------

const DAY_LENGTH = 720; // saniye (12 dakikalık gün)
const LS_SETTINGS = 'webcraft.settings';
const LS_WORLDS = 'webcraft.worlds';
const LS_WORLD = 'webcraft.world.';
const REPLACEABLE = new Set([B.TALL_GRASS, B.DEAD_BUSH]);
const MOB_DROPS = (r) => ({
  sheep: [[B.WOOL_WHITE, 1]], pig: [[I.PORKCHOP, r(1, 3)]], cow: [[I.BEEF, r(1, 3)], [I.LEATHER, r(0, 2)]], zombie: [[I.ROTTEN_FLESH, r(0, 2)]],
  creeper: [[I.GUNPOWDER, r(0, 2)]], enderman: [[I.ENDER_PEARL, r(0, 1)]], zpiglin: [[I.ROTTEN_FLESH, r(0, 1)], [I.GOLD_INGOT, Math.random() < 0.3 ? 1 : 0]],
  chicken: [[I.CHICKEN, 1], [I.FEATHER, r(0, 2)]], skeleton: [[I.BONE, r(0, 2)], [I.ARROW, r(0, 2)]], spider: [[I.STRING, r(0, 2)]],
});

const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Game {
  constructor() {
    this.canvas = $('game');
    this.isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    this.settings = Object.assign({
      renderDist: this.isTouch ? 4 : 7, fov: 75, sensitivity: 1, gamma: 0.2, volume: 0.7, music: 0.5, resScale: 1,
      clouds: true, viewBob: true, mobs: true, invertY: false,
    }, this.loadJSON(LS_SETTINGS) || {});

    initBlocks();
    this.renderer = new Renderer(this.canvas);
    this.renderer.resScale = this.settings.resScale;
    this.audio = new GameAudio();
    this.audio.setVolume(this.settings.volume);
    this.audio.setMusic(this.settings.music > 0, this.settings.music);
    this.particles = new Particles();
    this.fluids = new Fluids(this);
    this.entities = new EntityManager(this);
    this.player = new Player();
    this.inv = new Array(36).fill(null);
    this.armor = [null, null, null, null];
    this.selected = 0;
    this.bowT = 0; this.sleeping = null; this.plantT = 0;
    this.ui = new UI(this);

    this.keys = {};
    this.mouse = { left: false, right: false };
    this.leftPressed = false; this.rightPressed = false; this.midPressed = false;
    this.touch = { jump: false, break: false, place: false, sneak: false };
    this.touchMove = [0, 0];
    this.tapPlace = false;
    this.locked = false;
    this.state = 'menu';
    this.world = null; this.meta = null;
    this.dayTime = 0.03;
    this.primed = [];
    this.shake = 0;
    this.swingT = 0; this.equipT = 0;
    this.mining = null; this.mineProgress = 0; this.mineSoundT = 0;
    this.breakCd = 0; this.placeCd = 0; this.attackCd = 0;
    this.target = null; this.targetMob = null;
    this.showDebug = false;
    this.saveTimer = 0;
    this.lastSpace = 0; this.lastW = 0; this.sprintTap = false;
    this.fps = 0; this.fpsAcc = 0; this.fpsN = 0;
    this.sunLevel = 1;
    this.S = { chunks: [], cam: [0, 0, 0], sunDir: [1, 0, 0] };
    this.menuYaw = 0;
    this.genQueue = []; this.genCenter = null;
    this.craft = new Array(9).fill(null);
    this.screen = null;
    this.dim = 'overworld';
    this.dims = null;
    this.portalT = 0; this.portalCd = 0; this.eatT = 0;

    const p = this.player;
    p.onHurt = () => { this.audio.play('hurt'); this.wake(); };
    p.onStep = (land) => {
      const b = this.world.getBlock(Math.floor(p.pos[0]), Math.floor(p.pos[1] - 0.2), Math.floor(p.pos[2]));
      if (b && BLOCKS[b]) this.audio.play(land ? 'land' : 'step', null, BLOCKS[b].sound);
      // Tarlanın üstüne zıplamak onu ezer
      if (land && (b === B.FARMLAND || b === B.FARMLAND_WET) && Math.random() < 0.7) {
        const x = Math.floor(p.pos[0]), y = Math.floor(p.pos[1] - 0.2), z = Math.floor(p.pos[2]);
        if (RENDER[this.world.getBlock(x, y + 1, z)] === R_CROSS) this.breakBlock(x, y + 1, z, true);
        this.world.setBlock(x, y, z, B.DIRT);
      }
    };
    p.onSplash = () => this.audio.play('splash');
    p.onReduce = (a, type) => this.armorReduce(a, type);
    p.onDeath = () => setTimeout(() => this.onDeath(), 600);

    this.bindInput();
    if (this.isTouch) this.ui.initTouch();
    this.openMenuWorld();
    this.ui.show('mainMenu');
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------ Kayıt
  loadJSON(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { this.ui && this.ui.toast('Kayıt alanı dolu! Eski dünyaları silmeyi dene.'); return false; }
  }
  saveSettings() { this.saveJSON(LS_SETTINGS, this.settings); }
  listWorlds() { return this.loadJSON(LS_WORLDS) || []; }
  deleteWorld(id) {
    this.saveJSON(LS_WORLDS, this.listWorlds().filter((w) => w.id !== id));
    try { localStorage.removeItem(LS_WORLD + id); } catch (e) { /* yok say */ }
  }

  saveWorld() {
    if (!this.world || !this.meta) return;
    const p = this.player;
    const data = {
      v: 2, dim: this.dim, dims: this.dims, time: this.dayTime, selected: this.selected,
      inv: this.inv.map((s) => (s ? [s.id, s.count, s.dmg || 0] : 0)),
      armor: this.armor.map((s) => (s ? [s.id, 1, s.dmg || 0] : 0)),
      player: { pos: p.pos, yaw: p.yaw, pitch: p.pitch, health: p.health, flying: p.flying, spawn: p.spawn, bed: p.bed, food: p.food, sat: p.sat, exh: p.exh },
    };
    this.saveJSON(LS_WORLD + this.meta.id, data);
    const list = this.listWorlds();
    const m = list.find((w) => w.id === this.meta.id);
    if (m) m.lastPlayed = Date.now(); else list.push(Object.assign({}, this.meta, { lastPlayed: Date.now() }));
    this.saveJSON(LS_WORLDS, list);
  }

  // ------------------------------------------------------------ Dünyalar
  disposeWorld() {
    if (!this.world) return;
    for (const c of this.world.chunks.values()) this.renderer.freeChunk(c);
    this.world.chunks.clear();
    this.world = null;
    this.genQueue = []; this.genCenter = null;
    this.entities.clear(); this.particles.clear(); this.primed = [];
  }

  openMenuWorld() {
    this.disposeWorld();
    const seeds = ['webcraft', 'anadolu', 'kapadokya', 'karadeniz', 'toros'];
    this.world = new World(seeds[Math.floor(Math.random() * seeds.length)]);
    this.meta = null;
    const s = this.world.findSpawn();
    this.menuCam = [s[0], Math.max(s[1] + 14, SEA + 18), s[2]];
    this.menuYaw = Math.random() * Math.PI * 2;
    this.dayTime = 0.08 + Math.random() * 0.25;
    this.state = 'menu';
    $('hud').classList.add('hidden');
  }

  makeWorld(dim) {
    const w = new World(this.meta.seed, this.dims[dim].edits, dim, { dragonKilled: !!this.dims.end.dragonKilled });
    this.fluids.clear();
    w.onBlockChange = (x, y, z) => this.fluids.onChange(x, y, z);
    return w;
  }

  // End: ejderha ve kristaller (ejderha yenilmediyse)
  setupEnd() {
    const E = this.dims.end;
    if (this.dim !== 'end' || E.dragonKilled || this.entities.dragon) return;
    this.entities.mobs.push(new Dragon(0, 82, 70));
    E.crystals = E.crystals || {};
    this.world.pillars.forEach((P, i) => { if (E.crystals[i] !== false) this.entities.mobs.push(new EndCrystal(P.x + 0.5, P.h + 2, P.z + 0.5, i)); });
  }

  onDragonDeath() {
    const E = this.dims.end, w = this.world;
    E.dragonKilled = true; w.dragonKilled = true;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dz) <= 2.6 && (dx || dz)) w.setBlock(dx, 61, dz, B.END_PORTAL);
    w.setBlock(0, 65, 0, B.DRAGON_EGG);
    this.audio.play('explode');
    this.ui.toast('Ender Ejderhası yenildi! Çıkış geçidi açıldı.', 4);
    this.saveWorld();
  }

  createWorld(name, seed, mode, diff) {
    const meta = { id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name, seed, mode, diff, created: Date.now(), lastPlayed: Date.now() };
    const list = this.listWorlds(); list.push(meta); this.saveJSON(LS_WORLDS, list);
    this.openWorld(meta, null);
  }

  loadWorld(id) {
    const meta = this.listWorlds().find((w) => w.id === id);
    if (!meta) return;
    this.openWorld(meta, this.loadJSON(LS_WORLD + id));
  }

  openWorld(meta, data) {
    this.disposeWorld();
    this.meta = meta;
    const blank = () => ({ edits: {}, tiles: {} });
    this.dims = data && data.v >= 2 ? data.dims : { overworld: { edits: (data && data.edits) || {}, tiles: {} } };
    for (const d of ['overworld', 'nether', 'end']) if (!this.dims[d]) this.dims[d] = blank();
    this.dim = (data && data.dim) || 'overworld';
    this.world = this.makeWorld(this.dim);
    this.arrival = null;
    this.craft = new Array(9).fill(null);
    const p = this.player;
    p.creative = meta.mode === 'creative';
    p.dead = false; p.health = 20; p.air = 10; p.vel = [0, 0, 0]; p.flying = false; p.hurtTime = 0; p.fallStart = null;
    p.food = 20; p.sat = 5; p.exh = 0; p.regen = 0; p.hungerEff = 0; p.bed = null;
    this.inv = new Array(36).fill(null);
    this.armor = [null, null, null, null];
    this.sleeping = null; this.bowT = 0;
    if (data && data.player) {
      p.pos = data.player.pos.slice(); p.yaw = data.player.yaw; p.pitch = data.player.pitch;
      p.health = data.player.health || 20; p.flying = !!data.player.flying && p.creative;
      p.spawn = data.player.spawn || p.pos.slice();
      p.bed = data.player.bed || null;
      if (data.player.food !== undefined) { p.food = data.player.food; p.sat = data.player.sat; p.exh = data.player.exh || 0; }
      this.fresh = false;
      const st = (s) => (s[2] ? { id: s[0], count: s[1], dmg: s[2] } : { id: s[0], count: s[1] });
      (data.inv || []).forEach((s, i) => { if (s && itemDef(s[0])) this.inv[i] = st(s); });
      (data.armor || []).forEach((s, i) => { if (s && itemDef(s[0])) this.armor[i] = st(s); });
      this.selected = data.selected || 0;
      this.dayTime = data.time || 0.03;
    } else {
      p.spawn = this.world.findSpawn();
      p.pos = p.spawn.slice(); p.yaw = Math.random() * Math.PI * 2; p.pitch = 0;
      this.fresh = true;
      this.selected = 0;
      this.dayTime = 0.03;
      if (p.creative) [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.TORCH, B.BRICKS].forEach((id, i) => { this.inv[i] = { id, count: 64 }; });
    }
    const diff = meta.diff === undefined ? 1 : meta.diff;
    this.diffMult = [0.5, 1, 1.5][diff];
    p.starveFloor = [10, 1, 0][diff];
    this.ui.hotbarDirty = true; this.ui.lastHealth = -1; this.ui.lastFood = -1; this.ui.lastArmor = -1;
    this.state = 'loading';
    this.loadStart = performance.now();
    this.ui.show('loading');
    this.ui.setLoading(0, 'Arazi oluşturuluyor…');
    $('hud').classList.add('hidden');
  }

  difficultyDmg(d) { return Math.max(1, Math.round(d * (this.diffMult || 1))); }

  finishLoading() {
    const p = this.player, w = this.world;
    if (this.arrival) {
      this.handleArrival(this.arrival);
      this.arrival = null;
      this.ui.show(null);
      $('hud').classList.remove('hidden');
      this.ui.toast({ nether: 'Nether', end: 'End', overworld: 'Yerüstü' }[this.dim], 2);
      this.setupEnd();
      this.startPlaying();
      this.saveWorld();
      return;
    }
    if (this.fresh) {
      const x = Math.floor(p.spawn[0]), z = Math.floor(p.spawn[2]);
      const y = w.surfaceY(x, z);
      p.spawn[1] = y + 1; p.pos = p.spawn.slice();
    } else if (boxHitsSolid(w, p.pos[0] - 0.3, p.pos[1], p.pos[2] - 0.3, p.pos[0] + 0.3, p.pos[1] + 1.8, p.pos[2] + 0.3)) {
      p.pos[1] = w.surfaceY(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1;
    }
    this.ui.show(null);
    $('hud').classList.remove('hidden');
    $('modeTag').textContent = p.creative ? 'Yaratıcı' : '';
    this.ui.showItemName();
    this.ui.toast(this.meta.name, 2.5);
    this.setupEnd();
    this.startPlaying();
    this.saveWorld();
  }

  startPlaying() {
    this.state = 'playing';
    this.ui.show(null);
    $('inventory').classList.add('hidden');
    if (!this.isTouch && !this.locked && !this.noLock) $('clickToPlay').classList.remove('hidden');
  }

  quitToMenu() {
    this.saveWorld();
    if (document.pointerLockElement) document.exitPointerLock();
    $('inventory').classList.add('hidden');
    $('clickToPlay').classList.add('hidden');
    this.openMenuWorld();
    this.ui.show('mainMenu');
  }

  // ------------------------------------------------------------ Girişler
  requestLock() {
    if (this.isTouch) return;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* yok say */ }
  }

  look(dx, dy, mult = 1) {
    const p = this.player, s = 0.0024 * this.settings.sensitivity * mult;
    p.yaw -= dx * s;
    p.pitch -= dy * s * (this.settings.invertY ? -1 : 1);
    p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
  }

  selectSlot(i) {
    this.selected = ((i % 9) + 9) % 9;
    this.ui.hotbarDirty = true;
    this.ui.showItemName();
    this.equipT = 0.2;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pauseMenu');
    $('clickToPlay').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    this.mouse.left = this.mouse.right = false;
    this.saveWorld();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.startPlaying();
    this.requestLock();
  }

  toggleInventory() {
    if (this.state === 'inventory') this.closeInventory();
    else if (this.state === 'playing') { this.wake(); this.openInventory(); }
  }

  openInventory(kind, tile) {
    this.state = 'inventory';
    this.ignoreUnlock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.mouse.left = this.mouse.right = false;
    this.eatT = 0;
    $('clickToPlay').classList.add('hidden');
    $('inventory').classList.remove('hidden');
    $('invSearch').value = '';
    this.screen = { kind: kind || (this.player.creative ? 'creative' : 'player'), tile: tile || null };
    this.ui.updateResult();
    this.ui.render();
    this.ui.moveCursor(innerWidth / 2, innerHeight / 2);
  }

  closeInventory() {
    // Üretim ızgarası ve imleçteki eşyalar envantere döner
    for (let i = 0; i < 9; i++) if (this.craft[i]) { this.addStack(this.craft[i]); this.craft[i] = null; }
    const c = this.ui.cursor;
    if (c && !this.player.creative) this.addStack(c);
    this.ui.cursor = null;
    this.screen = null;
    if (this.openTile) { this.audio.play('click'); this.openTile = null; }
    $('inventory').classList.add('hidden');
    $('tooltip').style.display = 'none';
    this.ui.hotbarDirty = true;
    this.startPlaying();
    this.requestLock();
  }

  bindInput() {
    const cv = this.canvas;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
      if (this.locked) $('clickToPlay').classList.add('hidden');
      else if (this.state === 'playing') {
        if (this.ignoreUnlock) this.ignoreUnlock = false;
        else this.pause();
      }
    });
    // Fare kilidi reddedilirse: sürükleyerek bak, tıklayarak kır/koy
    document.addEventListener('pointerlockerror', () => {
      this.noLock = true;
      $('clickToPlay').classList.add('hidden');
      this.ui.toast('Bakmak için fareyi basılı tutup sürükle', 3);
    });
    $('clickToPlay').addEventListener('click', () => { this.audio.init(); this.requestLock(); if (this.noLock) $('clickToPlay').classList.add('hidden'); });
    cv.addEventListener('mousedown', (e) => {
      this.audio.init();
      if (this.state !== 'playing' || this.isTouch) return;
      if (!this.locked && this.noLock) { this.drag = { b: e.button, moved: 0 }; if (e.button === 1) this.midPressed = true; return; }
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) { this.mouse.left = true; this.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.rightPressed = true; }
      if (e.button === 1) { this.midPressed = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (this.drag) {
        if (this.drag.moved < 6 && this.state === 'playing') { if (e.button === 0) this.leftPressed = true; if (e.button === 2) this.rightPressed = true; }
        this.drag = null;
      }
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.state === 'playing') this.look(e.movementX, e.movementY);
      else if (this.drag && this.state === 'playing') { this.drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); this.look(e.movementX, e.movementY); }
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      this.selectSlot(this.selected + (e.deltaY > 0 ? 1 : -1));
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (['F1', 'F2', 'F3', 'Space', 'Tab', 'F5'].includes(k) || (this.state === 'playing' && k.startsWith('Arrow'))) e.preventDefault();
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
      this.audio.init();
      if (this.state === 'inventory') {
        if (k === 'KeyE' || k === 'Escape') this.closeInventory();
        else if (k.startsWith('Digit')) {
          // Fare altındaki eşyayı eşya çubuğuna taşı
          const el = document.elementFromPoint(this.ui.mx, this.ui.my);
          const s = el && el.closest('.slot');
          const n = +k.slice(5) - 1;
          if (s && n >= 0 && n < 9 && s.dataset.c !== 'result' && s.dataset.c !== 'trash') {
            if (s.dataset.c === 'pal') this.inv[n] = { id: +s.dataset.i, count: maxStack(+s.dataset.i) };
            else {
              const c = s.dataset.c, i = +s.dataset.i, a = this.ui.getSlot(c, i), b = this.inv[n];
              if (!b || this.ui.canPut(c, i, b)) { this.ui.setSlot(c, i, b); this.inv[n] = a; }
            }
            this.ui.afterChange();
          }
        }
        return;
      }
      if (this.state === 'paused' && k === 'Escape') { this.resume(); return; }
      if (this.state !== 'playing') return;
      if (e.repeat) { this.keys[k] = true; return; }
      this.keys[k] = true;
      const now = performance.now();
      if (this.sleeping && (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyE')) { this.wake(); return; }
      if (k === 'KeyE') this.openInventory();
      else if (k === 'Escape' && this.isTouch) this.pause();
      else if (k.startsWith('Digit')) { const n = +k.slice(5); if (n >= 1 && n <= 9) this.selectSlot(n - 1); }
      else if (k === 'F3') this.showDebug = !this.showDebug;
      else if (k === 'F1') document.body.classList.toggle('nohud');
      else if (k === 'F2') this.screenshotNext = true;
      else if (k === 'Space') {
        if (this.player.creative && now - this.lastSpace < 300) {
          this.player.flying = !this.player.flying; this.player.vel[1] = 0;
          this.ui.toast(this.player.flying ? 'Uçuş açık' : 'Uçuş kapalı', 1);
          this.lastSpace = 0;
        } else this.lastSpace = now;
      } else if (k === 'KeyW') {
        if (now - this.lastW < 280) this.sprintTap = true;
        this.lastW = now;
      } else if (k === 'KeyQ') this.dropSelected(e.ctrlKey);
      else if (k === 'F5') { this.thirdPerson = ((this.thirdPerson || 0) + 1) % 3; }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyW') this.sprintTap = false;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.left = this.mouse.right = false; this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.pause(); this.saveWorld(); } });
    window.addEventListener('beforeunload', () => this.saveWorld());
  }

  // ------------------------------------------------------------ Envanter
  addItem(id, n) {
    if (this.player.creative) return true;
    return this.addStack({ id, count: n });
  }
  // Yığını envantere ekle (eşya çubuğu önce). Sığmayan kısım oyuncunun önüne düşer.
  addStack(st) {
    const inv = this.inv, mx = maxStack(st.id);
    let n = st.count;
    if (!toolOf(st)) for (let i = 0; i < 36 && n > 0; i++) {
      const s = inv[i];
      if (s && s.id === st.id && s.count < mx) { const m = Math.min(mx - s.count, n); s.count += m; n -= m; }
    }
    for (let i = 0; i < 36 && n > 0; i++) {
      if (!inv[i]) { const m = Math.min(mx, n); inv[i] = Object.assign({}, st, { count: m }); n -= m; }
    }
    this.ui.hotbarDirty = true;
    if (n > 0) { this.throwStack(Object.assign({}, st, { count: n })); return false; }
    return true;
  }
  // Yerdeki eşyayı al (sığmazsa yerde kalır)
  pickup(st) {
    if (!this.player.creative) {
      if (!this.ui.hasRoom(st)) return false;
      this.addStack(st);
    }
    this.audio.play('pop', null);
    return true;
  }
  // Oyuncunun baktığı yöne eşya fırlat
  throwStack(st) {
    const p = this.player, d = p.lookDir(), e = p.eye();
    this.entities.spawnDrop(st, e[0] + d[0] * 0.3, e[1] - 0.3, e[2] + d[2] * 0.3, d[0] * 5.5, d[1] * 5 + 2, d[2] * 5.5, 1.5);
  }
  // Blok/canlı ganimetini yere düşür
  dropAt(id, n, x, y, z) {
    if (this.player.creative || n <= 0) return;
    const mx = maxStack(id);
    while (n > 0) { const k = Math.min(mx, n); this.entities.spawnDrop({ id, count: k }, x, y, z); n -= k; }
  }
  // Elde tutulan aleti aşındır
  damageTool(amount = 1) {
    if (this.player.creative) return;
    const s = this.inv[this.selected], t = toolOf(s);
    if (!t || !t.dur) return;
    s.dmg = (s.dmg || 0) + amount;
    if (s.dmg >= t.dur) { this.inv[this.selected] = null; this.audio.play('dig', null, 'glass'); this.ui.toast(itemName(s.id) + ' kırıldı!', 1.5); }
    this.ui.hotbarDirty = true;
  }
  consumeHeld(replace) {
    if (this.player.creative) return;
    const s = this.inv[this.selected];
    if (!s) return;
    s.count--;
    if (s.count <= 0) this.inv[this.selected] = replace ? { id: replace, count: 1 } : null;
    else if (replace) this.addItem(replace, 1);
    this.ui.hotbarDirty = true;
  }
  getTile(x, y, z, type) {
    const tiles = this.dims[this.dim].tiles, k = x + ',' + y + ',' + z;
    if (!tiles[k]) tiles[k] = { type, items: new Array(type === 'chest' ? 27 : 3).fill(null), burn: 0, burnMax: 0, prog: 0 };
    return tiles[k];
  }
  tickFurnaces(dt) {
    const tiles = this.dims[this.dim].tiles;
    for (const k in tiles) {
      const t = tiles[k];
      if (t.type !== 'furnace') continue;
      const inp = t.items[0], fuel = t.items[1], out = t.items[2];
      const res = inp ? SMELT[inp.id] : undefined;
      const can = res !== undefined && (!out || (out.id === res && out.count < maxStack(res)));
      if (t.burn > 0) t.burn = Math.max(0, t.burn - dt);
      if (t.burn <= 0 && can && fuel && fuelTime(fuel.id)) {
        t.burn = t.burnMax = fuelTime(fuel.id);
        fuel.count--;
        if (fuel.count <= 0) t.items[1] = fuel.id === I.LAVA_BUCKET ? { id: I.BUCKET, count: 1 } : null;
      }
      if (t.burn > 0 && can) {
        t.prog += dt;
        if (t.prog >= SMELT_TIME) {
          t.prog = 0;
          inp.count--; if (inp.count <= 0) t.items[0] = null;
          if (out) out.count++; else t.items[2] = { id: res, count: 1 };
        }
      } else t.prog = Math.max(0, t.prog - dt * 2);
    }
  }
  countItem(id) { let c = 0; for (const s of this.inv) if (s && s.id === id) c += s.count; return c; }
  removeItem(id, n) {
    for (let i = 35; i >= 0 && n > 0; i--) {
      const s = this.inv[i];
      if (s && s.id === id) { const m = Math.min(s.count, n); s.count -= m; n -= m; if (!s.count) this.inv[i] = null; }
    }
  }
  // Zırh: Minecraft hasar azaltma formülü + parça aşınması
  armorPoints() { let d = 0; for (const s of this.armor) { const a = armorOf(s); if (a) d += a.def; } return d; }
  armorReduce(dmg, type) {
    if (type === 'fall' || type === 'drown' || type === 'starve' || type === 'void' || type === 'pearl') return dmg;
    let def = 0, tough = 0;
    for (const s of this.armor) { const a = armorOf(s); if (a) { def += a.def; tough += a.tough; } }
    if (!def) return dmg;
    const f = clamp(def - (4 * dmg) / (tough + 8), def / 5, 20) / 25;
    const wear = Math.max(1, Math.floor(dmg / 4));
    for (let i = 0; i < 4; i++) {
      const s = this.armor[i], t = toolOf(s);
      if (!t) continue;
      s.dmg = (s.dmg || 0) + wear;
      if (s.dmg >= t.dur) { this.armor[i] = null; this.audio.play('dig', null, 'glass'); this.ui.toast(itemName(s.id) + ' kırıldı!', 1.5); }
    }
    this.ui.lastArmor = -1;
    return dmg * (1 - f);
  }
  equipArmor() {
    const s = this.inv[this.selected], a = armorOf(s);
    if (!a) return false;
    const old = this.armor[a.slot];
    this.armor[a.slot] = s;
    this.inv[this.selected] = old;
    this.audio.play('equip');
    this.ui.hotbarDirty = true; this.ui.lastArmor = -1;
    return true;
  }
  mobDrops(m) {
    if (this.player.creative) return;
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    for (const [id, n] of MOB_DROPS(r)[m.type] || []) if (n > 0) this.dropAt(id, n, m.pos[0], m.pos[1] + 0.4, m.pos[2]);
  }

  // Q: bir tane at, Ctrl+Q: tüm yığını at
  dropSelected(all) {
    const s = this.inv[this.selected];
    if (!s) return;
    const k = all ? s.count : 1;
    this.throwStack(Object.assign({}, s, { count: k }));
    s.count -= k; if (s.count <= 0) this.inv[this.selected] = null;
    this.swingT = 0.3;
    this.ui.hotbarDirty = true;
  }

  // ------------------------------------------------------------ Dünya etkileşimi
  breakBlock(x, y, z, byPlayer = true) {
    const w = this.world, id = w.getBlock(x, y, z);
    if (!id) return;
    w.setBlock(x, y, z, 0);
    this.particles.blockBreak(x, y, z, id);
    this.audio.play('dig', [x + 0.5, y + 0.5, z + 0.5], BLOCKS[id].sound);
    // Yatağın diğer yarısı
    if (isBed(id)) {
      const other = id === B.BED_FOOT ? B.BED_HEAD : B.BED_FOOT;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (w.getBlock(x + dx, y, z + dz) === other) { w.setBlock(x + dx, y, z + dz, 0); this.particles.blockBreak(x + dx, y, z + dz, other, 10); break; }
      }
    }
    if (byPlayer) this.player.exh += 0.005;
    if (byPlayer && !this.player.creative) {
      const tool = toolOf(this.inv[this.selected]);
      for (const [d, n] of blockDrops(id, tool)) this.dropAt(d, n, x + 0.5, y + 0.25, z + 0.5);
      if (tool && tool.dur && BLOCKS[id].hardness > 0) this.damageTool(tool.kind === 'sword' ? 2 : 1);
    }
    // Sandık/fırın içeriği
    const tk = x + ',' + y + ',' + z, tiles = this.dims[this.dim].tiles;
    if (tiles[tk]) {
      if (!this.player.creative) for (const st of tiles[tk].items) if (st) this.entities.spawnDrop(st, x + 0.5, y + 0.5, z + 0.5);
      delete tiles[tk];
    }
    // Geçit çerçevesi bozulursa geçit söner
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (w.getBlock(x + dx, y + dy, z + dz) === B.NETHER_PORTAL) this.removePortal(x + dx, y + dy, z + dz);
    }
    // Üstteki bitki/kaktüs desteksiz kalır
    const above = w.getBlock(x, y + 1, z);
    if (RENDER[above] === R_CROSS || above === B.CACTUS) this.breakBlock(x, y + 1, z, byPlayer);
    // Kapının diğer yarısı / üstteki kapı
    if (isDoor(id)) {
      const oy = (id - B.DOOR) & 8 ? y - 1 : y + 1;
      if (isDoor(w.getBlock(x, oy, z))) w.setBlock(x, oy, z, 0);
    }
    const ab = w.getBlock(x, y + 1, z);
    if (isDoor(ab) && !((ab - B.DOOR) & 8)) this.breakBlock(x, y + 1, z, byPlayer);
    // Bu bloğa tutunan merdivenler düşer
    for (let d = 0; d < 4; d++) {
      const nx = x - DIR4[d][0], nz = z - DIR4[d][1], nid = w.getBlock(nx, y, nz);
      if (isLadder(nid) && nid - B.LADDER === d) this.breakBlock(nx, y, nz, byPlayer);
    }
    this.applyGravity(x, y + 1, z);
  }

  applyGravity(x, y, z) {
    const w = this.world;
    for (let guard = 0; guard < 64; guard++) {
      const id = w.getBlock(x, y, z);
      if (id !== B.SAND && id !== B.GRAVEL) return;
      let ty = y;
      while (ty > 0 && !SOLID[w.getBlock(x, ty - 1, z)]) ty--;
      if (ty === y) return;
      w.setBlock(x, y, z, 0);
      w.setBlock(x, ty, z, id);
      y++;
    }
  }

  canPlaceAt(id, x, y, z) {
    const w = this.world;
    if (y < 0 || y >= CH) return false;
    const cur = w.getBlock(x, y, z);
    if (cur && !isLiquid(cur) && !REPLACEABLE.has(cur)) return false;
    if (RENDER[id] === R_CROSS) {
      const below = w.getBlock(x, y - 1, z);
      if (id === B.TORCH) return !!SOLID[below] && below !== B.CACTUS;
      if (id === B.DEAD_BUSH) return below === B.SAND;
      if (id === B.END_ROD) return !!SOLID[below];
      if (id === B.CRIMSON_FUNGUS || id === B.WARPED_FUNGUS) return below === B.CRIMSON_NYLIUM || below === B.WARPED_NYLIUM || below === B.SOUL_SOIL;
      if (isWheat(id)) return below === B.FARMLAND || below === B.FARMLAND_WET;
      if (isSapling(id)) return below === B.GRASS || below === B.DIRT || below === B.SNOWY_GRASS || below === B.FARMLAND || below === B.FARMLAND_WET;
      return below === B.GRASS || below === B.DIRT || below === B.SNOWY_GRASS;
    }
    if (id === B.CACTUS) {
      const below = w.getBlock(x, y - 1, z);
      if (below !== B.SAND && below !== B.CACTUS) return false;
    }
    if (SOLID[id]) {
      const p = this.player;
      const ov = (ax0, ay0, az0, ax1, ay1, az1) => ax0 < x + 1 && ax1 > x && ay0 < y + 1 && ay1 > y && az0 < z + 1 && az1 > z;
      if (ov(p.pos[0] - p.hw, p.pos[1], p.pos[2] - p.hw, p.pos[0] + p.hw, p.pos[1] + p.h, p.pos[2] + p.hw)) return false;
      for (const m of this.entities.mobs) if (ov(m.pos[0] - m.hw, m.pos[1], m.pos[2] - m.hw, m.pos[0] + m.hw, m.pos[1] + m.h, m.pos[2] + m.hw)) return false;
    }
    return true;
  }

  // Sağ tık: blokla etkileşim veya eldeki eşyayı kullan
  useAction(hit) {
    const w = this.world, p = this.player;
    const s = this.inv[this.selected];
    const id = s ? s.id : 0;
    // Konteyner blokları
    if (hit && !p.sneaking) {
      if (hit.id === B.CRAFTING) { this.openInventory('crafting'); return true; }
      if (hit.id === B.FURNACE || hit.id === B.CHEST) {
        const tile = this.getTile(hit.x, hit.y, hit.z, hit.id === B.FURNACE ? 'furnace' : 'chest');
        this.openTile = tile;
        this.audio.play('click');
        this.openInventory(hit.id === B.FURNACE ? 'furnace' : 'chest', tile);
        return true;
      }
      if (isBed(hit.id)) { this.useBed(hit); return true; }
      if (this.toggleShape(hit)) return true;
    }
    if (armorOf(s)) return this.equipArmor();
    if (hit && this.useFarmItem(hit, s)) return true;
    if (id === I.BED && hit) return this.placeBed(hit);
    if (id === I.FLINT_STEEL && hit) {
      if (hit.id === B.TNT) { this.ignite(hit.x, hit.y, hit.z, 3); this.damageTool(); return true; }
      if (this.tryLightPortal(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz)) { this.damageTool(); return true; }
      this.audio.play('click');
      return false;
    }
    if (id === I.ENDER_PEARL) { this.throwPearl(); return true; }
    if (id === I.ENDER_EYE && hit && hit.id === B.END_FRAME) {
      w.setBlock(hit.x, hit.y, hit.z, B.END_FRAME_EYE);
      this.consumeHeld();
      this.audio.play('pop', [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5]);
      this.checkEndPortal(hit.x, hit.y, hit.z);
      return true;
    }
    if (id === I.BUCKET) {
      const lh = raycast(w, p.eye(), p.lookDir(), 5, true);
      if (lh && isSource(lh.id)) {
        w.setBlock(lh.x, lh.y, lh.z, 0);
        this.audio.play('splash', [lh.x + 0.5, lh.y + 0.5, lh.z + 0.5]);
        this.consumeHeld(lh.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET);
        return true;
      }
      return false;
    }
    if (!hit) return false;
    if (id === I.WATER_BUCKET || id === I.LAVA_BUCKET) {
      let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
      if (REPLACEABLE.has(hit.id)) { x = hit.x; y = hit.y; z = hit.z; }
      if (!this.canPlaceAt(B.WATER, x, y, z)) return false;
      if (id === I.WATER_BUCKET && this.dim === 'nether') { this.particles.puff(x + 0.5, y + 0.5, z + 0.5, 8); this.audio.play('fuse', [x, y, z]); this.consumeHeld(I.BUCKET); return true; }
      this.placeLiquid(x, y, z, id === I.WATER_BUCKET ? B.WATER : B.LAVA);
      this.consumeHeld(I.BUCKET);
      return true;
    }
    if (hit.id === B.TNT && !p.sneaking && p.creative && !isPlaceable(id)) { this.ignite(hit.x, hit.y, hit.z, 3); return true; }
    if (!isPlaceable(id)) return false;
    if (SHAPE[id] && SHAPE[id] !== 6 && SHAPE[id] !== 8) return this.placeShape(id, hit);
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (REPLACEABLE.has(hit.id)) { x = hit.x; y = hit.y; z = hit.z; }
    if (!this.canPlaceAt(id, x, y, z)) return false;
    if (id === B.WATER || id === B.LAVA) this.placeLiquid(x, y, z, id);
    else w.setBlock(x, y, z, id);
    this.audio.play('place', [x + 0.5, y + 0.5, z + 0.5], BLOCKS[id].sound);
    this.consumeHeld();
    this.applyGravity(x, y, z);
    return true;
  }

  // Çapa, tohum ve kemik tozu
  useFarmItem(hit, s) {
    const w = this.world, id = s ? s.id : 0, t = toolOf(s);
    const above = w.getBlock(hit.x, hit.y + 1, hit.z);
    const at = [hit.x + 0.5, hit.y + 1, hit.z + 0.5];
    if (t && t.kind === 'hoe') {
      if ((hit.id === B.GRASS || hit.id === B.DIRT || hit.id === B.SNOWY_GRASS) && hit.ny !== -1 && !above) {
        w.setBlock(hit.x, hit.y, hit.z, B.FARMLAND);
        this.audio.play('place', at, 'gravel');
        this.damageTool();
        return true;
      }
      return false;
    }
    if (id === I.WHEAT_SEEDS) {
      if ((hit.id === B.FARMLAND || hit.id === B.FARMLAND_WET) && hit.ny === 1 && !above) {
        w.setBlock(hit.x, hit.y + 1, hit.z, B.WHEAT_0);
        this.audio.play('place', at, 'grass');
        this.consumeHeld();
        return true;
      }
      return false;
    }
    if (id === I.BONE_MEAL) {
      const c = [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5];
      if (isWheat(hit.id) && hit.id < B.WHEAT_7) {
        w.setBlock(hit.x, hit.y, hit.z, Math.min(B.WHEAT_7, hit.id + 2 + Math.floor(Math.random() * 4)));
      } else if (isSapling(hit.id)) {
        if (Math.random() < 0.45) this.growTree(hit.x, hit.y, hit.z, hit.id);
      } else if (hit.id === B.GRASS && !above) {
        for (let k = 0; k < 14; k++) {
          const x = hit.x + Math.round((Math.random() - 0.5) * 6), z = hit.z + Math.round((Math.random() - 0.5) * 6);
          for (let y = hit.y + 2; y >= hit.y - 2; y--) {
            if (w.getBlock(x, y, z) === B.GRASS && !w.getBlock(x, y + 1, z)) {
              const r = Math.random();
              w.setBlock(x, y + 1, z, r < 0.75 ? B.TALL_GRASS : r < 0.88 ? B.POPPY : B.DANDELION);
              break;
            }
          }
        }
      } else return false;
      this.particles.sparkle(c[0], c[1], c[2], 12);
      this.audio.play('pop', c);
      this.consumeHeld();
      return true;
    }
    return false;
  }

  // Fidanı ağaca dönüştür (yer varsa)
  growTree(x, y, z, sap) {
    const w = this.world;
    const spruce = sap === B.SPRUCE_SAPLING, birch = sap === B.BIRCH_SAPLING;
    const th = 4 + Math.floor(Math.random() * 3) + (spruce ? 2 : birch ? 1 : 0);
    const isLeaf = (b) => b === B.LEAVES || b === B.BIRCH_LEAVES || b === B.SPRUCE_LEAVES;
    for (let k = 1; k <= th + 1; k++) {
      const b = w.getBlock(x, y + k, z);
      if (y + k >= CH - 1 || (b && !isLeaf(b) && RENDER[b] !== R_CROSS)) return false;
    }
    w.setBlock(x, y, z, 0);
    const below = w.getBlock(x, y - 1, z);
    if (below === B.GRASS || below === B.FARMLAND || below === B.FARMLAND_WET) w.setBlock(x, y - 1, z, B.DIRT);
    const put = (px, py, pz, bid, soft) => {
      const cur = w.getBlock(px, py, pz);
      if (cur && (soft ? !REPLACEABLE.has(cur) && RENDER[cur] !== R_CROSS : SOLID[cur] && !isLeaf(cur))) return;
      w.setBlock(px, py, pz, bid);
    };
    if (spruce) w.spruceTree(put, x, y, z, th);
    else w.oakTree(put, x, y, z, th, birch ? B.BIRCH_LOG : B.LOG, birch ? B.BIRCH_LEAVES : B.LEAVES, w.seed);
    this.particles.sparkle(x + 0.5, y + 1, z + 0.5, 16);
    return true;
  }

  // Ekin büyümesi, fidanlar ve tarla nemi (saniyede bir)
  tickPlants(dt) {
    this.plantT += dt;
    if (this.plantT < 1) return;
    const el = this.plantT, w = this.world;
    this.plantT = 0;
    const chance = (rate) => Math.random() < 1 - Math.exp(-el * rate);
    for (const c of Array.from(w.chunks.values())) {
      if (!c.plants || !c.plants.size) continue;
      for (const i of Array.from(c.plants)) {
        const x = c.cx * 16 + (i & 15), z = c.cz * 16 + ((i >> 4) & 15), y = i >> 8;
        const id = c.blocks[i];
        if (id === B.FARMLAND || id === B.FARMLAND_WET) {
          const above = w.getBlock(x, y + 1, z);
          if (SOLID[above]) { w.setBlock(x, y, z, B.DIRT); continue; }
          let wet = false;
          for (let dy = 0; dy <= 1 && !wet; dy++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dx = -4; dx <= 4; dx++) {
            if (isWater(w.getBlock(x + dx, y + dy, z + dz))) { wet = true; break; }
          }
          if (wet && id === B.FARMLAND) w.setBlock(x, y, z, B.FARMLAND_WET);
          else if (!wet && id === B.FARMLAND_WET && chance(1 / 20)) w.setBlock(x, y, z, B.FARMLAND);
          else if (!wet && id === B.FARMLAND && !isWheat(above) && chance(1 / 60)) w.setBlock(x, y, z, B.DIRT);
        } else if (isWheat(id)) {
          const below = w.getBlock(x, y - 1, z);
          if (below !== B.FARMLAND && below !== B.FARMLAND_WET) { this.breakBlock(x, y, z, false); continue; }
          if (id < B.WHEAT_7 && chance(below === B.FARMLAND_WET ? 1 / 20 : 1 / 55)) w.setBlock(x, y, z, id + 1);
        } else if (isSapling(id)) {
          const below = w.getBlock(x, y - 1, z);
          if (below !== B.GRASS && below !== B.DIRT && below !== B.SNOWY_GRASS && below !== B.FARMLAND && below !== B.FARMLAND_WET) { this.breakBlock(x, y, z, false); continue; }
          if (chance(1 / 70)) this.growTree(x, y, z, id);
        }
      }
    }
  }

  // ------------------------------------------------------------ Yatak ve uyku
  placeBed(hit) {
    const w = this.world, p = this.player;
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (REPLACEABLE.has(hit.id)) { x = hit.x; y = hit.y; z = hit.z; }
    const d = p.lookDir();
    const [dx, dz] = Math.abs(d[0]) > Math.abs(d[2]) ? [Math.sign(d[0]), 0] : [0, Math.sign(d[2]) || 1];
    const hx = x + dx, hz = z + dz;
    if (!this.canPlaceAt(B.BED_FOOT, x, y, z) || !this.canPlaceAt(B.BED_HEAD, hx, y, hz)) return false;
    if (!SOLID[w.getBlock(x, y - 1, z)] || !SOLID[w.getBlock(hx, y - 1, hz)]) return false;
    w.setBlock(x, y, z, B.BED_FOOT);
    w.setBlock(hx, y, hz, B.BED_HEAD);
    this.audio.play('place', [x + 0.5, y + 0.5, z + 0.5], 'cloth');
    this.consumeHeld();
    return true;
  }

  useBed(hit) {
    const w = this.world, p = this.player;
    if (this.dim !== 'overworld') {
      // Nether ve End'de yatak patlar
      this.breakBlock(hit.x, hit.y, hit.z, false);
      this.explode(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 5);
      return;
    }
    const same = p.bed && p.bed[0] === hit.x && p.bed[1] === hit.y && p.bed[2] === hit.z;
    p.bed = [hit.x, hit.y, hit.z];
    if (!same) this.ui.toast('Doğma noktası ayarlandı', 2);
    if (Math.sin(this.dayTime * Math.PI * 2) > -0.04) { if (same) this.ui.toast('Sadece geceleri uyuyabilirsin', 2); return; }
    for (const m of this.entities.mobs) {
      if (m.dead || !(m.T.hostile || m.angry)) continue;
      if (Math.abs(m.pos[0] - hit.x) < 8 && Math.abs(m.pos[1] - hit.y) < 5 && Math.abs(m.pos[2] - hit.z) < 8) { this.ui.toast('Yakında canavarlar varken dinlenemezsin', 2.5); return; }
    }
    this.sleeping = { t: 0 };
    p.pos = [hit.x + 0.5, hit.y + HGT[hit.id] / 16 + 0.01, hit.z + 0.5]; p.vel = [0, 0, 0]; p.fallStart = null;
    this.mouse.left = this.mouse.right = false;
  }

  wake() {
    if (!this.sleeping) return;
    this.sleeping = null;
    $('sleepOverlay').style.opacity = 0;
  }

  updateSleep(dt) {
    const s = this.sleeping;
    s.t += dt;
    $('sleepOverlay').style.opacity = Math.min(1, s.t / 2);
    if (s.t >= 2.6) {
      this.dayTime = 0.002;
      this.wake();
      this.ui.toast('Günaydın!', 2);
      this.saveWorld();
    }
  }

  // Yeniden doğma noktası: yatak (varsa) ya da dünya doğma noktası
  placeRespawn() {
    const p = this.player, w = this.world, b = p.bed;
    if (b && isBed(w.getBlock(b[0], b[1], b[2]))) {
      p.pos = [b[0] + 0.5, b[1] + 0.5725, b[2] + 0.5];
      return;
    }
    if (b) { this.ui.toast('Yatağın kayıp ya da engellenmiş', 2.5); p.bed = null; }
    p.pos = p.spawn.slice();
    p.pos[1] = w.surfaceY(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1;
  }

  chorusTeleport() {
    const p = this.player, w = this.world;
    for (let k = 0; k < 16; k++) {
      const x = Math.floor(p.pos[0] + (Math.random() - 0.5) * 16), z = Math.floor(p.pos[2] + (Math.random() - 0.5) * 16);
      for (let y = Math.floor(p.pos[1]) + 8; y > Math.floor(p.pos[1]) - 8; y--) {
        if (y > 1 && SOLID[w.getBlock(x, y - 1, z)] && !SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)] && !w.getBlock(x, y, z)) {
          this.particles.puff(p.pos[0], p.pos[1] + 1, p.pos[2], 10, 0.6);
          p.pos = [x + 0.5, y, z + 0.5]; p.vel = [0, 0, 0]; p.fallStart = null;
          this.audio.play('pop');
          return;
        }
      }
    }
  }

  // Yay: basılı tutma süresine göre ok hızı ve hasarı (Minecraft formülü)
  fireBow() {
    const p = this.player;
    let f = this.bowT;
    f = Math.min(1, (f * f + 2 * f) / 3);
    if (f < 0.1) return;
    const d = p.lookDir(), e = p.eye(), V = 60 * f;
    let dmg = Math.ceil(6 * f);
    if (f >= 1) dmg += Math.floor(Math.random() * (dmg / 2 + 2));
    this.entities.shoot([e[0] + d[0] * 0.4, e[1] + d[1] * 0.4 - 0.1, e[2] + d[2] * 0.4], [d[0] * V, d[1] * V, d[2] * V], 'player', dmg);
    if (!p.creative) this.removeItem(I.ARROW, 1);
    this.damageTool();
    this.audio.play('bow');
    this.ui.hotbarDirty = true;
  }

  // Oyuncunun baktığı yön: 0 -z, 1 +x, 2 +z, 3 -x
  facing() {
    const d = this.player.lookDir();
    return Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 3) : (d[2] > 0 ? 2 : 0);
  }

  // Yarım blok, basamak, kapı, tuzak kapı, çit kapısı, merdiven yerleştirme
  placeShape(id, hit) {
    const w = this.world, p = this.player, k = SHAPE[id], f = this.facing();
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (REPLACEABLE.has(hit.id)) { x = hit.x; y = hit.y; z = hit.z; }
    const done = (bid, at = [x, y, z]) => {
      this.audio.play('place', [at[0] + 0.5, at[1] + 0.5, at[2] + 0.5], BLOCKS[bid].sound);
      this.consumeHeld();
      return true;
    };
    if (k === 1) {
      const m = id - B.SLAB, full = BLOCKS[id].full;
      // İki yarım blok birleşince tam blok olur
      if ((hit.id === B.SLAB + m && hit.ny === 1) || (hit.id === B.SLAB_TOP + m && hit.ny === -1)) { w.setBlock(hit.x, hit.y, hit.z, full); return done(full, [hit.x, hit.y, hit.z]); }
      const cur = w.getBlock(x, y, z);
      if (cur === B.SLAB + m || cur === B.SLAB_TOP + m) { w.setBlock(x, y, z, full); return done(full); }
      const hy = p.eye()[1] + p.lookDir()[1] * hit.dist;
      const top = hit.ny === -1 || (hit.ny === 0 && hy - Math.floor(hy) > 0.5);
      const bid = top ? B.SLAB_TOP + m : id;
      if (!this.canPlaceAt(bid, x, y, z)) return false;
      w.setBlock(x, y, z, bid);
      return done(bid);
    }
    let bid = id;
    if (k === 3) bid = id + f;
    else if (k === 7) bid = B.GATE + (f === 1 || f === 3 ? 2 : 0);
    else if (k === 9) {
      if (hit.ny !== 0 || !OPAQUE[hit.id]) return false;
      bid = B.LADDER + DIR4.findIndex(([dx, dz]) => dx === -hit.nx && dz === -hit.nz);
    }
    if (k === 4) {
      if (!this.canPlaceAt(id, x, y, z) || !this.canPlaceAt(id, x, y + 1, z) || !SOLID[w.getBlock(x, y - 1, z)]) return false;
      w.setBlock(x, y, z, B.DOOR + f);
      w.setBlock(x, y + 1, z, B.DOOR + 8 + f);
      return done(id);
    }
    if (!this.canPlaceAt(bid, x, y, z)) return false;
    w.setBlock(x, y, z, bid);
    return done(bid);
  }

  // Kapı, tuzak kapı ve çit kapısını aç/kapa
  toggleShape(hit) {
    const w = this.world, id = hit.id, k = SHAPE[id];
    const at = [hit.x + 0.5, hit.y + 0.5, hit.z + 0.5];
    if (k === 4) {
      const v = id - B.DOOR, ly = v & 8 ? hit.y - 1 : hit.y;
      const lo = w.getBlock(hit.x, ly, hit.z), up = w.getBlock(hit.x, ly + 1, hit.z);
      if (isDoor(lo)) w.setBlock(hit.x, ly, hit.z, B.DOOR + ((lo - B.DOOR) ^ 4));
      if (isDoor(up)) w.setBlock(hit.x, ly + 1, hit.z, B.DOOR + ((up - B.DOOR) ^ 4));
    } else if (k === 5) w.setBlock(hit.x, hit.y, hit.z, id === B.TRAPDOOR ? B.TRAPDOOR_OPEN + this.facing() : B.TRAPDOOR);
    else if (k === 7) w.setBlock(hit.x, hit.y, hit.z, B.GATE + ((id - B.GATE) ^ 1));
    else return false;
    this.audio.play('door', at);
    return true;
  }

  // Su + lav = obsidyen (akışın geri kalanını Fluids yönetir)
  placeLiquid(x, y, z, id) {
    const w = this.world;
    let result = id;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = w.getBlock(x + dx, y + dy, z + dz);
      if (id === B.WATER && isLava(n)) { w.setBlock(x + dx, y + dy, z + dz, isSource(n) ? B.OBSIDIAN : B.COBBLE); this.particles.puff(x + dx + 0.5, y + dy + 1, z + dz + 0.5, 5); }
      if (id === B.LAVA && isWater(n)) result = B.OBSIDIAN;
    }
    w.setBlock(x, y, z, result);
    if (result !== id) { this.particles.puff(x + 0.5, y + 1, z + 0.5, 6); this.audio.play('fuse', [x, y, z]); }
    else this.audio.play('splash', [x + 0.5, y + 0.5, z + 0.5]);
  }

  throwPearl() {
    const p = this.player, w = this.world;
    const hit = raycast(w, p.eye(), p.lookDir(), 40);
    this.consumeHeld();
    this.swingT = 0.3;
    if (!hit) return;
    const tx = hit.x + hit.nx + 0.5, tz = hit.z + hit.nz + 0.5;
    let ty = hit.y + hit.ny;
    while (ty < CH - 2 && (SOLID[w.getBlock(Math.floor(tx), ty, Math.floor(tz))] || SOLID[w.getBlock(Math.floor(tx), ty + 1, Math.floor(tz))])) ty++;
    this.particles.puff(p.pos[0], p.pos[1] + 1, p.pos[2], 10, 0.6);
    p.pos = [tx, ty, tz]; p.vel = [0, 0, 0]; p.fallStart = null;
    this.audio.play('pop');
    p.hurt(2);
  }

  // Obsidyen çerçevenin içini Nether geçidiyle doldur
  tryLightPortal(x, y, z) {
    const w = this.world;
    if (this.dim === 'end' || w.getBlock(x, y, z)) return false;
    for (const ax of [0, 2]) {
      const dx = ax === 0 ? 1 : 0, dz = ax === 2 ? 1 : 0;
      let by = y;
      while (by > 0 && !w.getBlock(x, by - 1, z) && y - by < 21) by--;
      if (w.getBlock(x, by - 1, z) !== B.OBSIDIAN) continue;
      // Sol ve sağ kenarı bul (eksen boyunca)
      let a = 0, bb = 0;
      while (a < 21 && !w.getBlock(x - dx * (a + 1), by, z - dz * (a + 1))) a++;
      while (bb < 21 && !w.getBlock(x + dx * (bb + 1), by, z + dz * (bb + 1))) bb++;
      if (w.getBlock(x - dx * (a + 1), by, z - dz * (a + 1)) !== B.OBSIDIAN || w.getBlock(x + dx * (bb + 1), by, z + dz * (bb + 1)) !== B.OBSIDIAN) continue;
      const width = a + bb + 1;
      const sx = x - dx * a, sz = z - dz * a;
      let h = 0;
      while (h < 21 && !w.getBlock(sx, by + h, sz)) h++;
      if (width < 2 || h < 3 || w.getBlock(sx, by + h, sz) !== B.OBSIDIAN) continue;
      let ok = true;
      for (let i = 0; i < width && ok; i++) {
        const cx = sx + dx * i, cz = sz + dz * i;
        if (w.getBlock(cx, by - 1, cz) !== B.OBSIDIAN || w.getBlock(cx, by + h, cz) !== B.OBSIDIAN) ok = false;
        for (let j = 0; j < h && ok; j++) if (w.getBlock(cx, by + j, cz)) ok = false;
      }
      for (let j = 0; j < h && ok; j++) {
        if (w.getBlock(sx - dx, by + j, sz - dz) !== B.OBSIDIAN || w.getBlock(sx + dx * width, by + j, sz + dz * width) !== B.OBSIDIAN) ok = false;
      }
      if (!ok) continue;
      for (let i = 0; i < width; i++) for (let j = 0; j < h; j++) w.setBlock(sx + dx * i, by + j, sz + dz * i, B.NETHER_PORTAL);
      this.audio.play('fuse', [x, y, z]);
      this.ui.toast('Nether geçidi açıldı!', 2);
      return true;
    }
    return false;
  }

  removePortal(x, y, z) {
    const w = this.world, q = [[x, y, z]];
    let n = 0;
    while (q.length && n < 600) {
      const [a, b, c] = q.pop();
      if (w.getBlock(a, b, c) !== B.NETHER_PORTAL) continue;
      w.setBlock(a, b, c, 0); n++;
      q.push([a + 1, b, c], [a - 1, b, c], [a, b + 1, c], [a, b - 1, c], [a, b, c + 1], [a, b, c - 1]);
    }
  }

  // 3x3 boşluğun etrafında 12 gözlü çerçeve varsa End geçidini aç
  checkEndPortal(x, y, z) {
    const w = this.world;
    for (let cz = z - 4; cz <= z + 4; cz++) for (let cx = x - 4; cx <= x + 4; cx++) {
      let ok = true;
      for (let k = -1; k <= 1 && ok; k++) {
        for (const [px, pz] of [[cx + k, cz - 2], [cx + k, cz + 2], [cx - 2, cz + k], [cx + 2, cz + k]]) {
          if (w.getBlock(px, y, pz) !== B.END_FRAME_EYE) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(cx + dx, y, cz + dz, B.END_PORTAL);
      this.audio.play('explode', [cx, y, cz]);
      this.ui.toast('End geçidi açıldı!', 2.5);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ Boyutlar arası seyahat
  travel(dim, pos, arrival) {
    const p = this.player;
    this.wake(); this.bowT = 0;
    this.saveWorld();
    this.disposeWorld();
    this.dim = dim;
    this.world = this.makeWorld(dim);
    p.pos = pos.slice(); p.vel = [0, 0, 0]; p.fallStart = null; p.flying = false;
    this.arrival = arrival;
    this.portalT = 0; this.portalCd = 4;
    this.state = 'loading';
    this.ui.show('loading');
    this.ui.setLoading(0, dim === 'nether' ? "Nether'a gidiliyor…" : dim === 'end' ? "End'e gidiliyor…" : 'Yerüstüne dönülüyor…');
    $('hud').classList.add('hidden');
    if (document.pointerLockElement) { this.ignoreUnlock = true; document.exitPointerLock(); }
  }

  handleArrival(type) {
    const p = this.player, w = this.world;
    const tx = Math.floor(p.pos[0]), tz = Math.floor(p.pos[2]);
    if (type === 'end') {
      for (let z = -2; z <= 2; z++) for (let x = 98; x <= 102; x++) {
        w.setBlock(x, 48, z, B.OBSIDIAN);
        for (let y = 49; y <= 51; y++) w.setBlock(x, y, z, 0);
      }
      p.pos = [100.5, 49, 0.5]; p.yaw = Math.PI / 2;
      return;
    }
    if (type === 'spawn' || type === 'respawn') { this.placeRespawn(); return; }
    // Nether geçidi: yakında geçit ara, yoksa yenisini kur
    for (let r = 0; r <= 16; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      for (let y = 1; y < CH - 1; y++) {
        if (w.getBlock(tx + dx, y, tz + dz) === B.NETHER_PORTAL && w.getBlock(tx + dx, y - 1, tz + dz) !== B.NETHER_PORTAL) {
          const ax = w.getBlock(tx + dx + 1, y, tz + dz) === B.NETHER_PORTAL || w.getBlock(tx + dx - 1, y, tz + dz) === B.NETHER_PORTAL;
          p.pos = ax ? [tx + dx + 0.5, y, tz + dz + 1.5] : [tx + dx + 1.5, y, tz + dz + 0.5];
          if (SOLID[w.getBlock(Math.floor(p.pos[0]), y, Math.floor(p.pos[2]))]) p.pos = [tx + dx + 0.5, y, tz + dz + 0.5];
          return;
        }
      }
    }
    let ty = -1;
    if (this.dim === 'nether') {
      for (let y = 100; y > 33 && ty < 0; y--) {
        if (SOLID[w.getBlock(tx, y - 1, tz)] && !w.getBlock(tx, y, tz) && !w.getBlock(tx, y + 1, tz) && !w.getBlock(tx, y + 2, tz)) ty = y;
      }
      if (ty < 0) ty = 64;
    } else ty = Math.max(SEA + 1, w.surfaceY(tx, tz) + 1);
    for (let z = tz - 1; z <= tz + 2; z++) for (let x = tx - 1; x <= tx + 2; x++) {
      for (let y = ty; y <= ty + 3; y++) w.setBlock(x, y, z, 0);
      if (!SOLID[w.getBlock(x, ty - 1, z)] || isLava(w.getBlock(x, ty - 1, z))) w.setBlock(x, ty - 1, z, B.OBSIDIAN);
    }
    for (let x = tx - 1; x <= tx + 2; x++) for (let y = ty - 1; y <= ty + 3; y++) {
      const frame = x === tx - 1 || x === tx + 2 || y === ty - 1 || y === ty + 3;
      w.setBlock(x, y, tz, frame ? B.OBSIDIAN : B.NETHER_PORTAL);
    }
    p.pos = [tx + 0.5, ty, tz + 1.5];
  }

  ignite(x, y, z, t) {
    if (this.primed.some((p) => p.x === x && p.y === y && p.z === z)) return;
    this.primed.push({ x, y, z, t });
    this.audio.play('fuse', [x + 0.5, y + 0.5, z + 0.5]);
  }

  explode(x, y, z, r) {
    const w = this.world;
    this.audio.play('explode', [x, y, z]);
    this.particles.explosion(x, y, z, r);
    const R = Math.ceil(r);
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > r - Math.random() * 1.2) continue;
      const bx = cx + dx, by = cy + dy, bz = cz + dz;
      const id = w.getBlock(bx, by, bz);
      if (!id || BLOCKS[id].hardness < 0 || id === B.OBSIDIAN) continue;
      if (id === B.TNT) { this.ignite(bx, by, bz, 0.3 + Math.random() * 0.7); continue; }
      w.setBlock(bx, by, bz, 0);
      if (Math.random() < 0.12) this.particles.blockBreak(bx, by, bz, id, 4);
    }
    const p = this.player;
    const pdx = p.pos[0] - x, pdy = p.pos[1] + 0.9 - y, pdz = p.pos[2] - z;
    const pd = Math.hypot(pdx, pdy, pdz);
    if (pd < r * 2) {
      const f = 1 - pd / (r * 2);
      p.hurt(this.difficultyDmg(f * 22), (pdx / (pd || 1)) * f * 14, (pdz / (pd || 1)) * f * 14);
      if (p.creative || p.dead) { p.vel[0] += (pdx / (pd || 1)) * f * 10; p.vel[2] += (pdz / (pd || 1)) * f * 10; }
      p.vel[1] += f * 8;
    }
    for (const m of this.entities.mobs) {
      const mdx = m.pos[0] - x, mdz = m.pos[2] - z, md = Math.hypot(mdx, m.pos[1] - y, mdz);
      if (md < r * 2) m.hit((1 - md / (r * 2)) * 25, mdx, mdz);
    }
    this.shake = Math.max(this.shake, clamp(1.2 - pd / 20, 0, 1));
  }

  attackMob(m) {
    const d = this.player.lookDir();
    const tool = toolOf(this.inv[this.selected]);
    m.hit(tool && tool.dmg ? tool.dmg : 2, d[0], d[2]);
    if (tool && tool.dur && tool.kind !== 'armor' && tool.kind !== 'bow') this.damageTool(tool.kind === 'sword' ? 1 : 2);
    this.audio.play('mobhurt', m.pos);
    this.player.exh += 0.1;
    if (m.dead) this.mobDrops(m);
  }

  pickBlock(hit) {
    if (!hit) return;
    const id = hit.id;
    const hi = this.inv.slice(0, 9).findIndex((s) => s && s.id === id);
    if (hi >= 0) { this.selectSlot(hi); return; }
    if (this.player.creative && BLOCKS[id] && BLOCKS[id].creative !== false) { this.inv[this.selected] = { id, count: 64 }; this.ui.hotbarDirty = true; this.ui.showItemName(); }
  }

  interact(dt) {
    const p = this.player, w = this.world;
    const eye = p.eye(), dir = p.lookDir();
    if (this.sleeping) { this.target = this.targetMob = null; this.leftPressed = this.rightPressed = this.midPressed = this.tapPlace = false; return; }
    const reach = p.creative ? 6 : 4.8;
    const hit = raycast(w, eye, dir, reach);
    const mh = this.entities.raycast(eye, dir, reach);
    this.targetMob = mh && (!hit || mh.dist < hit.dist) ? mh.mob : null;
    this.target = this.targetMob ? null : hit;

    this.breakCd -= dt; this.placeCd -= dt; this.attackCd -= dt;
    const breakDown = this.mouse.left || this.touch.break;
    const placeDown = this.mouse.right || this.touch.place;

    if (this.targetMob && (this.leftPressed || (this.touch.break && this.attackCd <= 0))) {
      if (this.attackCd <= 0) { this.attackMob(this.targetMob); this.attackCd = 0.35; this.swingT = 0.3; }
    } else if (breakDown && this.target) {
      const t = this.target;
      if (p.creative) {
        if (this.leftPressed || this.breakCd <= 0) {
          if (t.id !== B.END_PORTAL) this.breakBlock(t.x, t.y, t.z);
          this.breakCd = 0.22; this.swingT = 0.3;
        }
        this.mining = null;
      } else {
        const same = this.mining && this.mining[0] === t.x && this.mining[1] === t.y && this.mining[2] === t.z;
        if (!same) { this.mining = [t.x, t.y, t.z]; this.mineProgress = 0; }
        const time = mineTime(t.id, toolOf(this.inv[this.selected]));
        this.mineTimeCur = time;
        if (time < Infinity && this.breakCd <= 0) {
          this.mineProgress += dt;
          this.mineSoundT -= dt;
          if (this.mineSoundT <= 0) {
            this.mineSoundT = 0.25;
            this.audio.play('hit', [t.x + 0.5, t.y + 0.5, t.z + 0.5], BLOCKS[t.id].sound);
            this.particles.hitBits(t.x, t.y, t.z, t.id);
          }
          if (this.swingT <= 0) this.swingT = 0.3;
          if (this.mineProgress >= time) {
            this.breakBlock(t.x, t.y, t.z);
            this.mining = null; this.mineProgress = 0; this.breakCd = 0.15;
          }
        } else if (this.swingT <= 0) this.swingT = 0.3;
      }
    } else {
      this.mining = null; this.mineProgress = 0;
      if (this.leftPressed && this.swingT <= 0) this.swingT = 0.3;
    }

    // Yemek: sağ tıkı basılı tut (açken ya da altın elma / koro meyvesi)
    const held = this.inv[this.selected], food = held && itemDef(held.id) && itemDef(held.id).food;
    const wantsUse = this.rightPressed || this.tapPlace || (placeDown && this.placeCd <= 0);
    const onContainer = this.target && !p.sneaking && (this.target.id === B.CRAFTING || this.target.id === B.FURNACE || this.target.id === B.CHEST || isBed(this.target.id));
    const isBow = held && held.id === I.BOW;
    if (!isBow) this.bowT = 0;
    if (isBow && !onContainer) {
      if (placeDown && (p.creative || this.countItem(I.ARROW) > 0)) this.bowT += dt;
      else if (this.bowT > 0) { this.fireBow(); this.bowT = 0; }
    } else if (food && !onContainer && !p.creative && (placeDown || this.tapPlace) && (p.food < 20 || food.always)) {
      this.eatT += dt;
      this.eatSndT = (this.eatSndT || 0) - dt;
      if (this.eatSndT <= 0) {
        this.eatSndT = 0.22;
        this.audio.play('eat');
        const e = p.eye(), d = p.lookDir();
        this.particles.itemBits(e[0] + d[0] * 0.45, e[1] - 0.25 + d[1] * 0.3, e[2] + d[2] * 0.45, ITEM_LAYER[held.id], 3);
      }
      if (this.eatT >= 1.6) {
        this.eatT = 0;
        p.eat(food);
        if (food.regen) p.regen = food.regen;
        if (food.hunger && Math.random() < food.hunger) { p.hungerEff = 30; this.ui.toast('Açlık etkisi!', 1.5); }
        if (food.teleport) this.chorusTeleport();
        this.consumeHeld();
        this.audio.play('burp');
      }
    } else {
      this.eatT = 0;
      if (wantsUse) {
        if (this.useAction(this.target)) this.swingT = 0.3;
        this.placeCd = 0.23;
      }
    }
    if (this.midPressed) this.pickBlock(this.target);
    this.leftPressed = this.rightPressed = this.midPressed = false;
    this.tapPlace = false;
  }

  onDeath() {
    if (this.state !== 'playing' && this.state !== 'inventory') return;
    $('inventory').classList.add('hidden');
    this.state = 'dead';
    if (document.pointerLockElement) document.exitPointerLock();
    $('deathInfo').textContent = 'Envanterin korundu. Doğma noktanda yeniden başlayabilirsin.';
    this.ui.show('deathMenu');
  }

  respawn() {
    const p = this.player, w = this.world;
    p.dead = false; p.health = 20; p.air = 10; p.vel = [0, 0, 0]; p.fallStart = null; p.hurtTime = 0;
    p.food = 20; p.sat = 5; p.exh = 0; p.regen = 0; p.hungerEff = 0;
    this.ui.lastHealth = -1;
    const target = p.bed ? [p.bed[0] + 0.5, p.bed[1] + 1, p.bed[2] + 0.5] : p.spawn;
    if (this.dim !== 'overworld' || !w.isLoadedAt(target[0], target[2]) || Math.hypot(target[0] - p.pos[0], target[2] - p.pos[2]) > this.settings.renderDist * 16) {
      this.travel('overworld', target, 'respawn'); return;
    }
    this.placeRespawn();
    this.entities.mobs = this.entities.mobs.filter((m) => !m.T.hostile || Math.hypot(m.pos[0] - p.pos[0], m.pos[2] - p.pos[2]) > 24);
    this.startPlaying();
    this.requestLock();
  }

  // ------------------------------------------------------------ Parça yönetimi
  updateChunks(budget, cx, cz, R) {
    const w = this.world;
    const t0 = performance.now();
    const pcx = Math.floor(cx / 16), pcz = Math.floor(cz / 16);
    const key = pcx + ',' + pcz + ',' + R;
    if (this.genCenter !== key) {
      this.genCenter = key;
      const q = [];
      for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
        if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) continue;
        if (!w.getChunk(pcx + dx, pcz + dz)) q.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
      q.sort((a, b) => b[2] - a[2]);
      this.genQueue = q;
      // Uzaktaki parçaları boşalt
      for (const [k, c] of w.chunks) {
        if (Math.abs(c.cx - pcx) > R + 3 || Math.abs(c.cz - pcz) > R + 3) { this.renderer.freeChunk(c); w.chunks.delete(k); }
      }
      w._lk = -1;
    }
    // Acil (oyuncu düzenlemesi) mesh'ler
    for (const c of w.chunks.values()) {
      if (c.urgent) {
        const m = buildChunkMesh(w, c);
        if (m) { this.renderer.uploadChunk(c, m); c.dirty = false; }
        c.urgent = false;
      }
    }
    // Üretim
    let gen = 0;
    while (this.genQueue.length && (performance.now() - t0 < budget * 0.5 || gen === 0)) {
      const [x, z] = this.genQueue.pop();
      if (!w.getChunk(x, z)) { w.generate(x, z); gen++; }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = w.getChunk(x + dx, z + dz); if (n) n.dirty = true; }
    }
    // Mesh oluşturma (yakından uzağa)
    const cand = [];
    for (const c of w.chunks.values()) {
      if (!c.dirty) continue;
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      cand.push([c, dx * dx + dz * dz - (c.gpu ? 0 : 1000)]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    for (const [c] of cand) {
      if (performance.now() - t0 > budget) break;
      const m = buildChunkMesh(w, c);
      if (m) { this.renderer.uploadChunk(c, m); c.dirty = false; }
    }
    return this.genQueue.length + cand.length;
  }

  checkPortals(dt) {
    const p = this.player, w = this.world;
    this.portalCd = Math.max(0, this.portalCd - dt);
    const fx = Math.floor(p.pos[0]), fz = Math.floor(p.pos[2]);
    const feet = w.getBlock(fx, Math.floor(p.pos[1] + 0.1), fz), head = w.getBlock(fx, Math.floor(p.pos[1] + 1.2), fz);
    if ((feet === B.END_PORTAL || w.getBlock(fx, Math.floor(p.pos[1] - 0.2), fz) === B.END_PORTAL) && this.portalCd <= 0) {
      if (this.dim === 'end') this.travel('overworld', p.bed ? [p.bed[0] + 0.5, p.bed[1] + 1, p.bed[2] + 0.5] : p.spawn, 'respawn');
      else this.travel('end', [100.5, 49, 0.5], 'end');
      return true;
    }
    if (feet === B.NETHER_PORTAL || head === B.NETHER_PORTAL) {
      if (this.portalCd <= 0) this.portalT += dt;
      if (this.portalT > (p.creative ? 1 : 3)) {
        if (this.dim === 'nether') this.travel('overworld', [p.pos[0] * 8, 64, p.pos[2] * 8], 'portal');
        else this.travel('nether', [p.pos[0] / 8, 64, p.pos[2] / 8], 'portal');
        return true;
      }
    } else this.portalT = Math.max(0, this.portalT - dt * 2);
    return false;
  }

  applyDimSky(S, p, R) {
    S.dim = 0; S.ambient = [0.05, 0.05, 0.05];
    if (this.dim === 'nether') {
      const bio = this.world.netherBiome(Math.floor(p.pos[0]), Math.floor(p.pos[2]));
      const fog = [[0.3, 0.06, 0.05], [0.38, 0.07, 0.05], [0.08, 0.22, 0.24], [0.16, 0.24, 0.26]][bio];
      S.dim = 1; S.dimColor = fog; S.fogColor = fog; S.sun = 0; this.sunLevel = 0;
      S.ambient = [0.46, 0.36, 0.32];
      this.dimFog = [R * 16 * 0.15, R * 16 * 0.85];
    } else if (this.dim === 'end') {
      S.dim = 2; S.dimColor = [0.09, 0.07, 0.13]; S.fogColor = [0.08, 0.06, 0.11];
      S.sun = 0.82; S.sunTint = [0.98, 0.94, 1.0]; this.sunLevel = 0.7;
      S.ambient = [0.28, 0.25, 0.32];
      this.dimFog = [R * 16 * 0.5, R * 16 * 0.95];
    }
  }

  // ------------------------------------------------------------ Gökyüzü
  computeSky() {
    const S = this.S, t = this.dayTime;
    const a = t * Math.PI * 2;
    S.sunDir = [Math.cos(a), Math.sin(a), 0.12];
    const l = Math.hypot(...S.sunDir); S.sunDir = S.sunDir.map((v) => v / l);
    const h = S.sunDir[1];
    const k = smoothstep(-0.22, 0.22, h);
    const sunset = Math.exp(-((h / 0.2) ** 2));
    S.zenith = mixv([0.012, 0.016, 0.05], [0.38, 0.6, 1.0], k);
    S.horizon = mixv(mixv([0.035, 0.045, 0.1], [0.7, 0.83, 1.0], k), [1.0, 0.55, 0.3], sunset * 0.45);
    S.sunset = [sunset * 0.9, sunset * 0.42, sunset * 0.15];
    S.night = 1 - k;
    this.sunLevel = 0.16 + 0.84 * k;
    S.sun = this.sunLevel;
    S.sunTint = mixv(mixv([0.6, 0.68, 1.0], [1, 1, 1], k), [1.0, 0.82, 0.65], sunset * 0.5);
    S.cloudColor = mixv([0.12, 0.13, 0.18], [1, 1, 1], k);
    S.fogColor = S.horizon;
  }

  // ------------------------------------------------------------ Döngü
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try {
      if (this.state === 'menu') this.frameMenu(dt);
      else if (this.state === 'loading') this.frameLoading();
      else if (this.world) this.frameGame(dt);
    } catch (e) {
      console.error(e);
      $('fatal').classList.remove('hidden');
      $('fatalText').textContent = String(e && e.stack || e);
      return;
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }

  frameMenu(dt) {
    const R = Math.min(this.settings.renderDist, 6);
    this.updateChunks(10, this.menuCam[0], this.menuCam[2], R);
    this.menuYaw += dt * 0.04;
    this.dayTime += dt / DAY_LENGTH * 0.3;
    this.computeSky();
    const S = this.S;
    Object.assign(S, {
      cam: this.menuCam, yaw: this.menuYaw, pitch: -0.12, roll: 0, fov: 75, renderDist: R,
      fogStart: R * 16 * 0.55, fogEnd: R * 16 * 0.95, time: performance.now() / 1000, gamma: this.settings.gamma,
      clouds: this.settings.clouds, underwater: false, selection: null, crack: null, hand: null, entityCount: 0, particleCount: 0,
      dim: 0, ambient: [0.05, 0.05, 0.05],
    });
    S.chunks = this.world.chunks.values();
    this.renderer.render(S);
  }

  frameLoading() {
    const p = this.player, w = this.world;
    const R = this.settings.renderDist;
    this.updateChunks(45, p.pos[0], p.pos[2], R);
    const pcx = Math.floor(p.pos[0] / 16), pcz = Math.floor(p.pos[2] / 16);
    let need = 0, have = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { need++; const c = w.getChunk(pcx + dx, pcz + dz); if (c && c.gpu) have++; }
    this.ui.setLoading(have / need, have < need ? `Parçalar hazırlanıyor… ${have}/${need}` : 'Neredeyse hazır…');
    if (have >= need) this.finishLoading();
  }

  frameGame(dt) {
    const p = this.player, w = this.world;
    const playing = this.state === 'playing';
    if (playing) {
      const K = this.keys, T = this.touch, tm = this.touchMove;
      const slow = this.bowT > 0 || this.eatT > 0 ? 0.25 : 1;
      const inp = {
        f: (K.KeyW || K.ArrowUp ? 1 : 0) + Math.max(0, -tm[1]),
        b: (K.KeyS || K.ArrowDown ? 1 : 0) + Math.max(0, tm[1]),
        l: (K.KeyA || K.ArrowLeft ? 1 : 0) + Math.max(0, -tm[0]),
        r: (K.KeyD || K.ArrowRight ? 1 : 0) + Math.max(0, tm[0]),
        jump: !!(K.Space || T.jump),
        sneak: !!(K.ShiftLeft || K.ShiftRight || T.sneak),
        sprint: !!(K.KeyR || K.ControlLeft || this.sprintTap || Math.hypot(tm[0], tm[1]) > 0.95),
        autoJump: this.isTouch,
      };
      if (slow < 1) { inp.f *= slow; inp.b *= slow; inp.l *= slow; inp.r *= slow; inp.sprint = false; }
      if (this.sleeping) { inp.f = inp.b = inp.l = inp.r = 0; inp.jump = inp.sprint = inp.sneak = false; this.updateSleep(dt); }
      if (w.isLoadedAt(p.pos[0], p.pos[2])) p.update(dt, inp, w);
      this.interact(dt);
      if (this.checkPortals(dt)) return;
      this.dayTime = (this.dayTime + dt / DAY_LENGTH) % 1;
      this.entities.update(dt);
      this.tickPlants(dt);
      this.fluids.tick(dt);
      // Ateşlenmiş TNT
      for (const pr of this.primed) {
        pr.t -= dt;
        if (Math.random() < dt * 20) this.particles.puff(pr.x + 0.5, pr.y + 1.1, pr.z + 0.5, 1, 0.9);
        if (pr.t <= 0) {
          pr.done = true;
          if (w.getBlock(pr.x, pr.y, pr.z) === B.TNT) { w.setBlock(pr.x, pr.y, pr.z, 0); this.explode(pr.x + 0.5, pr.y + 0.5, pr.z + 0.5, 4); }
        }
      }
      this.primed = this.primed.filter((pr) => !pr.done);
      if (p.eyeInWater && Math.random() < dt * 3) {
        const ld = p.lookDir(), a = Math.random() * Math.PI * 2;
        this.particles.bubble(p.pos[0] + ld[0] * 1.5 + Math.cos(a) * 0.6, p.pos[1] + 0.6 + Math.random() * 0.6, p.pos[2] + ld[2] * 1.5 + Math.sin(a) * 0.6);
      }
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.saveWorld(); }
    }
    if (playing || this.state === 'inventory') { this.tickFurnaces(dt); this.ui.tick(); }
    this.particles.update(dt, w);
    this.swingT = Math.max(0, this.swingT - dt);
    this.equipT = Math.max(0, this.equipT - dt);
    this.shake = Math.max(0, this.shake - dt * 1.5);

    const R = this.settings.renderDist;
    this.updateChunks(playing ? 7 : 12, p.pos[0], p.pos[2], R);

    // Kamera
    this.computeSky();
    const S = this.S;
    this.applyDimSky(S, p, R);
    const eye = p.eye();
    let roll = 0;
    if (this.settings.viewBob && p.onGround) {
      const ph = p.walkDist * Math.PI * 0.62;
      eye[1] += -Math.abs(Math.cos(ph)) * 0.07 * p.bob + 0.035 * p.bob;
      roll = Math.sin(ph) * 0.006 * p.bob;
    }
    if (p.hurtTime > 0) roll += Math.sin(p.hurtTime * 12) * 0.05 * p.hurtTime;
    if (p.dead) { roll = 0.6; eye[1] = p.pos[1] + 0.3; }
    if (this.sleeping) eye[1] = p.pos[1] + 0.35;
    if (this.shake > 0) { eye[0] += (Math.random() - 0.5) * this.shake * 0.4; eye[1] += (Math.random() - 0.5) * this.shake * 0.4; }
    const under = p.eyeInWater, inLava = p.eyeInLava;
    const fogEnd = R * 16 * 0.95;
    this.audio.listener = eye; this.audio.listenerYaw = p.yaw;
    // F5: üçüncü şahıs (arkadan / önden) kamera
    let cam = eye, cyaw = p.yaw, cpitch = p.pitch;
    const tp = this.thirdPerson && !p.dead && !this.sleeping;
    if (tp) {
      const ld = p.lookDir(), sgn = this.thirdPerson === 1 ? -1 : 1;
      const dir = [ld[0] * sgn, ld[1] * sgn, ld[2] * sgn];
      const hit = raycast(w, eye, dir, 4.2);
      const dist = Math.max(0.5, Math.min(4, hit ? hit.dist - 0.3 : 4));
      cam = [eye[0] + dir[0] * dist, eye[1] + dir[1] * dist, eye[2] + dir[2] * dist];
      if (this.thirdPerson === 2) { cyaw = p.yaw + Math.PI; cpitch = -p.pitch; }
    }
    this.updatePlayerModel(dt);

    Object.assign(S, {
      cam, yaw: cyaw, pitch: cpitch, roll, fov: this.settings.fov * (1 + p.fovBoost * 0.12) * (under ? 0.92 : 1) * (1 - 0.15 * Math.min(1, this.bowT)),
      renderDist: R, time: performance.now() / 1000, gamma: this.settings.gamma, clouds: this.settings.clouds, underwater: under || inLava,
      fogStart: under ? 0 : inLava ? 0 : R * 16 * 0.55, fogEnd: under ? 22 : inLava ? 2.5 : fogEnd,
    });
    if (this.dim !== 'overworld') {
      S.clouds = false;
      if (!under && !inLava) { S.fogStart = this.dimFog[0]; S.fogEnd = this.dimFog[1]; }
    }
    if (under) S.fogColor = mixv([0.02, 0.07, 0.2], [0.1, 0.25, 0.6], this.sunLevel);
    if (inLava) S.fogColor = [0.8, 0.28, 0.04];
    S.chunks = w.chunks.values();
    const tg = this.target;
    S.selection = (this.state === 'playing' || this.state === 'inventory') && tg ? [tg.x, tg.y, tg.z] : null;
    S.crack = null;
    if (this.mining && tg && this.mineProgress > 0 && this.mineTimeCur < Infinity) {
      const stage = Math.min(9, Math.floor(this.mineProgress / this.mineTimeCur * 10));
      S.crack = [tg.x, tg.y, tg.z, stage];
    }
    S.entityCount = this.entities.buildMesh(cam);
    S.entityVerts = this.entities.verts;
    S.drops = this.entities.drops.map((d) => {
      let light = 0.7;
      if (this.dim === 'overworld') light = Math.max(0.2, w.skyLightAt(Math.floor(d.pos[0]), Math.floor(d.pos[1] + 0.3), Math.floor(d.pos[2])) ? this.sunLevel : 0.35);
      return { id: d.stack.id, count: d.stack.count, pos: d.pos, spin: d.spin + d.age * 1.6, bob: Math.sin(d.age * 2.4 + d.spin) * 0.06, light };
    });
    S.heldTP = null;
    if (tp && this.inv[this.selected]) {
      const pm = this.playerModel, sw2 = Math.sin(pm.walk) * 0.75 * pm.walkAmt;
      S.heldTP = { id: this.inv[this.selected].id, pos: p.pos, yaw: pm.yaw, arm: -sw2 * 0.9 - (pm.swing > 0 ? Math.sin(pm.swing * Math.PI) * 1.4 : 0) - 0.3, light: 0.8 };
      S.heldTP.light = this.dim === 'overworld' ? Math.max(0.2, w.skyLightAt(Math.floor(p.pos[0]), Math.floor(p.pos[1] + 1), Math.floor(p.pos[2])) ? this.sunLevel : 0.35) : 0.7;
    }
    S.particleCount = this.particles.fill(cam, this.sunLevel);
    S.particleData = this.particles.data;
    const held = this.inv[this.selected];
    const sky = this.dim === 'overworld' ? w.skyLightAt(Math.floor(p.pos[0]), Math.floor(p.pos[1] + 1.6), Math.floor(p.pos[2])) : 0;
    const hb = this.settings.viewBob ? p.bob : 0;
    // El ataleti: kol, bakış dönüşünü biraz geriden takip eder
    let dy = p.yaw - (this.armYaw === undefined ? p.yaw : this.armYaw);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.armYaw = p.yaw - dy * Math.exp(-dt * 14);
    this.armPitch = p.pitch - (p.pitch - (this.armPitch === undefined ? p.pitch : this.armPitch)) * Math.exp(-dt * 14);
    S.hand = p.dead || tp || this.sleeping || document.body.classList.contains('nohud') ? null : {
      id: held ? (held.id === I.BOW && this.bowT > 0.25 ? I.BOW_PULL : held.id) : 0,
      light: (sky ? Math.max(0.2, this.sunLevel) : this.dim === 'overworld' ? 0.4 : 0.65),
      swing: this.swingT > 0 ? 1 - this.swingT / 0.3 : 0,
      bobX: Math.sin(p.walkDist * Math.PI * 0.62) * 0.03 * hb,
      bobY: -Math.abs(Math.cos(p.walkDist * Math.PI * 0.62)) * 0.035 * hb,
      lower: this.equipT / 0.2,
      swayYaw: clamp((p.yaw - this.armYaw) * 0.35, -0.3, 0.3), swayPitch: clamp((p.pitch - this.armPitch) * 0.35, -0.3, 0.3),
      eat: this.eatT, bow: held && held.id === I.BOW ? this.bowT : 0, time: performance.now() / 1000,
    };
    this.renderer.render(S);
    if (this.screenshotNext) { this.screenshotNext = false; this.screenshot(); }

    this.ui.updateHUD(dt);
    if (this.showDebug) {
      const f = ['Güney (+Z)', 'Batı (-X)', 'Kuzey (-Z)', 'Doğu (+X)'][Math.round(((-p.yaw / (Math.PI / 2)) % 4 + 6) % 4) % 4];
      let biomeName;
      if (this.dim === 'nether') biomeName = ['Nether Çorak Toprakları', 'Kızıl Orman', 'Çarpık Orman', 'Ruh Kumu Vadisi'][w.netherBiome(Math.floor(p.pos[0]), Math.floor(p.pos[2]))];
      else if (this.dim === 'end') biomeName = 'End';
      else { w.column(Math.floor(p.pos[0]), Math.floor(p.pos[2])); biomeName = BIOME_NAMES[w._b]; }
      const hours = Math.floor(((this.dayTime + 0.25) % 1) * 24), mins = Math.floor((((this.dayTime + 0.25) % 1) * 24 % 1) * 60);
      this.ui.updateDebug([
        `WebCraft 1.0 (${this.fps} fps)`,
        `XYZ: ${p.pos[0].toFixed(2)} / ${p.pos[1].toFixed(2)} / ${p.pos[2].toFixed(2)}`,
        `Parça: ${Math.floor(p.pos[0]) >> 4}, ${Math.floor(p.pos[2]) >> 4}   Yön: ${f}`,
        `Boyut: ${{ overworld: 'Yerüstü', nether: 'Nether', end: 'End' }[this.dim]}   Biyom: ${biomeName}`,
        `Saat: ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}   Güneş: ${Math.round(this.sunLevel * 100)}%`,
        `Parçalar: ${this.renderer.stats.chunks} görünür / ${w.chunks.size} yüklü   Yüzey: ${Math.round(this.renderer.stats.faces / 1000)}k`,
        `Canlılar: ${this.entities.mobs.length}   Parçacık: ${this.particles.list.length}`,
        `Tohum: ${w.seedStr}`,
        tg ? `Hedef: ${itemName(tg.id)} (${tg.x}, ${tg.y}, ${tg.z})` : 'Hedef: -',
      ]);
    } else this.ui.updateDebug(null);
  }

  // F5 görünümü için oyuncu modeli (Steve)
  updatePlayerModel(dt) {
    const p = this.player;
    if (!this.playerModel) this.playerModel = new Mob('player', 0, 0, 0);
    const m = this.playerModel;
    m.pos = p.pos; m.hurtTime = p.hurtTime; m.anim += dt;
    const hs = Math.hypot(p.vel[0], p.vel[2]);
    if (p.onGround || p.flying) { m.walk += hs * dt * 2.2; m.walkAmt += (Math.min(1, hs / 4.3) - m.walkAmt) * Math.min(1, dt * 8); }
    // Gövde yürürken bakış yönüne döner, dururken baş 50°'den fazla dönerse takip eder
    let d = p.yaw - m.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (hs > 0.5) m.yaw += d * Math.min(1, dt * 8);
    else if (Math.abs(d) > 0.9) m.yaw += (d - Math.sign(d) * 0.9);
    d = p.yaw - m.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    m.headYaw = d; m.headPitch = p.pitch;
    m.swing = this.swingT > 0 ? 1 - this.swingT / 0.3 : 0;
    m.holding = !!this.inv[this.selected];
  }

  screenshot() {
    try {
      const a = document.createElement('a');
      a.href = this.canvas.toDataURL('image/png');
      a.download = 'webcraft-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
      a.click();
      this.ui.toast('Ekran görüntüsü kaydedildi', 1.5);
    } catch (e) { this.ui.toast('Ekran görüntüsü alınamadı'); }
  }
}

window.addEventListener('load', () => {
  try {
    window.game = new Game();
  } catch (e) {
    console.error(e);
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    $('fatal').classList.remove('hidden');
    $('fatalText').textContent = (e && e.message && e.message.includes('WebGL2'))
      ? 'Tarayıcın WebGL2 desteklemiyor. Lütfen güncel bir Chrome, Firefox, Edge veya Safari kullan.'
      : String(e && e.stack || e);
  }
});
