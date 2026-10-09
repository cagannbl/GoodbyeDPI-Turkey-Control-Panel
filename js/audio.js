'use strict';
// ---------------------------------------------------------------------------
// Ses efektleri: açık lisanslı gerçek kayıtlar (sounds/, emeği geçenler sounds/CREDITS.md)
// Minecraft gibi her çalışta rastgele varyasyon ve hafif perde farkı. Kaydı olmayan ya da
// yüklenemeyen sesler Web Audio ile sentezlenir. Müzik üretkendir (piyano).
// ---------------------------------------------------------------------------

// Ses adı -> varyasyon sayısı (sounds/<ad><n>.ogg)
const SOUND_FILES = {'step_stone': 3, 'step_grass': 3, 'step_gravel': 3, 'step_sand': 3, 'step_snow': 3, 'step_wood': 2, 'step_glass': 1, 'step_metal': 3, 'step_water': 3, 'step_cloth': 3, 'hit_stone': 3, 'hit_wood': 3, 'hit_grass': 2, 'hit_gravel': 2, 'hit_glass': 3, 'hit_metal': 1, 'hit_snow': 3, 'break_stone': 2, 'break_gravel': 3, 'break_glass': 3, 'break_metal': 2, 'break_ice': 1, 'place': 3, 'place_hard': 2, 'place_metal': 2, 'hurt': 1, 'toolbreak': 3, 'chest_open': 1, 'chest_close': 1, 'door_open': 1, 'door_close': 1, 'explode': 1, 'fuse': 1, 'fizz': 3, 'splash': 1, 'flint': 1, 'pig': 1, 'hurt_pig': 1, 'cow': 1, 'hurt_cow': 1, 'sheep': 1, 'chicken': 3, 'hurt_chicken': 1, 'zombie': 1, 'hurt_zombie': 1, 'death_zombie': 1, 'skeleton': 2, 'hurt_skeleton': 1, 'death_skeleton': 1, 'spider': 1, 'hurt_spider': 3, 'death_spider': 1, 'hurt_creeper': 1, 'death_creeper': 1, 'enderman': 1, 'hurt_enderman': 3, 'teleport': 1, 'zpiglin': 1, 'hurt_zpiglin': 3, 'roar': 1, 'eat': 1, 'bow': 1, 'arrowhit': 1, 'enchant': 3, 'orb': 1};

// Malzeme sesleri: [dosya, ses seviyesi, perde]
const MAT_SOUNDS = {
  break: { stone: ['hit_stone', 0.9, 0.78], wood: ['hit_wood', 0.9, 0.8], grass: ['break_stone', 0.9, 1], gravel: ['break_gravel', 0.9, 1], sand: ['step_sand', 1, 0.8],
    snow: ['step_snow', 1, 0.8], glass: ['break_glass', 0.8, 1], cloth: ['step_cloth', 1, 0.85], metal: ['break_metal', 0.8, 1], water: ['splash', 0.6, 1.1] },
  hit: { stone: ['hit_stone', 0.45, 1], wood: ['hit_wood', 0.45, 1], grass: ['hit_grass', 0.45, 1], gravel: ['hit_gravel', 0.45, 1], sand: ['step_sand', 0.5, 0.9],
    snow: ['hit_snow', 0.45, 1], glass: ['hit_glass', 0.45, 1.2], cloth: ['step_cloth', 0.5, 1], metal: ['hit_metal', 0.45, 1], water: ['step_water', 0.4, 1] },
  place: { stone: ['place_hard', 0.75, 1], glass: ['place_hard', 0.7, 1.2], metal: ['place_metal', 0.7, 1], wood: ['place_hard', 0.7, 0.85] },
  step: { stone: ['step_stone', 0.22, 1], grass: ['step_grass', 0.22, 1], gravel: ['step_gravel', 0.22, 1], sand: ['step_sand', 0.22, 1], snow: ['step_snow', 0.22, 1],
    wood: ['step_wood', 0.22, 1], glass: ['step_glass', 0.22, 1], metal: ['step_metal', 0.22, 1], cloth: ['step_cloth', 0.22, 1], water: ['step_water', 0.25, 1] },
};
// Diğer sesler: oyun adı -> [dosya, ses seviyesi, perde]
const SFX = {
  hurt: ['hurt', 0.8, 1], explode: ['explode', 1.2, 1], fuse: ['fuse', 0.7, 1], fizz: ['fizz', 0.6, 1], splash: ['splash', 0.7, 1],
  flint: ['flint', 0.7, 1], toolbreak: ['toolbreak', 0.8, 1], chest: ['chest_open', 0.6, 1], chest_close: ['chest_close', 0.6, 1],
  door_open: ['door_open', 0.6, 1], door_close: ['door_close', 0.6, 1], bow: ['bow', 0.7, 1], arrowhit: ['arrowhit', 0.6, 1],
  eat: ['eat', 0.6, 1], enchant: ['enchant', 0.6, 1], anvil: ['break_metal', 0.6, 1.25], roar: ['roar', 1.2, 1], teleport: ['teleport', 0.7, 1],
  creeperfuse: ['hurt_creeper', 0.8, 1], pig: ['pig', 0.6, 1], cow: ['cow', 0.6, 1], sheep: ['sheep', 0.6, 1], chicken: ['chicken', 0.6, 1],
  zombie: ['zombie', 0.6, 1], skeleton: ['skeleton', 0.6, 1], spider: ['spider', 0.6, 1], enderman: ['enderman', 0.6, 1], zpiglin: ['zpiglin', 0.6, 1],
};

class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.musicVolume = 0.5;
    this.musicOn = true;
    this.listener = [0, 0, 0];
    this.listenerYaw = 0;
    this.musicTimer = null;
    this.buf = {};          // ses adı -> çözülmüş kayıtlar
    this.base = 'sounds/';
  }

  // Kayıtları arka planda yükle (yüklenmeyen ses sentezle çalar)
  loadSamples() {
    const ctx = this.ctx;
    if (location.protocol === 'file:') return; // dosyadan açılınca tarayıcı yüklemeye izin vermez: sentez
    for (const k in SOUND_FILES) for (let i = 1; i <= SOUND_FILES[k]; i++) {
      fetch(this.base + k + i + '.ogg')
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .then((buf) => { (this.buf[k] || (this.buf[k] = [])).push(buf); })
        .catch(() => { /* sentez yedeği kullanılır */ });
    }
  }
  // Kayıt çal: rastgele varyasyon, ±%8 perde. Kayıt yoksa false
  sample(key, dest, vol = 1, pitch = 1) {
    const L = this.buf[key];
    if (!L || !L.length) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = L[Math.floor(Math.random() * L.length)];
    src.playbackRate.value = pitch * (0.92 + Math.random() * 0.16);
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(dest);
    src.start();
    return true;
  }
  // Oyun içi ses adını kayda çevir
  sampleFor(name, arg) {
    const mk = { dig: 'break', hit: 'hit', place: 'place', step: 'step', land: 'step' }[name];
    if (mk) {
      const T = MAT_SOUNDS[mk];
      const r = T[arg] || (mk === 'place' ? ['place', 0.7, 1] : T.stone);
      return r && name === 'land' ? [r[0], r[1] * 2.2, 0.85] : r;
    }
    if (name === 'mobhurt' && arg) return SOUND_FILES['hurt_' + arg] ? ['hurt_' + arg, 0.8, 1] : null;
    if (name === 'mobdeath' && arg) return SOUND_FILES['death_' + arg] ? ['death_' + arg, 0.8, 1] : SOUND_FILES['hurt_' + arg] ? ['hurt_' + arg, 0.8, 0.8] : null;
    if (name === 'orb') return ['orb', 0.35, (arg || 1) * (0.75 + Math.random() * 0.5)];
    return SFX[name] || null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVolume * 0.5; this.music.connect(this.master);
    // Gürültü tamponu
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Yankı (müzik için)
    const rl = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const c = ir.getChannelData(ch);
      for (let i = 0; i < rl; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet); wet.connect(this.music);
    this.loadSamples();
    this.scheduleMusic(6000);
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusic(on, v) {
    this.musicOn = on;
    if (v !== undefined) this.musicVolume = v;
    if (this.music) this.music.gain.value = on ? this.musicVolume * 0.5 : 0;
  }

  // Konuma göre ses seviyesi + stereo
  out(pos, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let v = vol;
    let pan = 0;
    if (pos) {
      const dx = pos[0] - this.listener[0], dy = pos[1] - this.listener[1], dz = pos[2] - this.listener[2];
      const d = Math.hypot(dx, dy, dz);
      v *= Math.max(0, 1 - d / 28);
      const rx = Math.cos(this.listenerYaw), rz = -Math.sin(this.listenerYaw);
      pan = d > 0.5 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8 : 0;
    }
    g.gain.value = v;
    if (ctx.createStereoPanner && pan) {
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    return v > 0.001 ? g : null;
  }

  noiseBurst(dest, type, freq, q, dur, vol, t0 = 0, sweepTo) {
    const ctx = this.ctx, t = ctx.currentTime + t0;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  tone(dest, type, f0, f1, dur, vol, t0 = 0, attack = 0.01) {
    const ctx = this.ctx, t = ctx.currentTime + t0;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  material(kind, dest, scale, dur) {
    const r = 0.85 + Math.random() * 0.3;
    switch (kind) {
      case 'grass': this.noiseBurst(dest, 'highpass', 1800 * r, 0.7, 0.16 * dur, 0.5 * scale); this.noiseBurst(dest, 'bandpass', 700 * r, 1, 0.1 * dur, 0.3 * scale); break;
      case 'gravel': this.noiseBurst(dest, 'lowpass', 1100 * r, 1, 0.18 * dur, 0.7 * scale); this.noiseBurst(dest, 'bandpass', 300 * r, 2, 0.12 * dur, 0.5 * scale, 0.02); break;
      case 'sand': this.noiseBurst(dest, 'lowpass', 1600 * r, 0.5, 0.22 * dur, 0.45 * scale); break;
      case 'snow': this.noiseBurst(dest, 'lowpass', 1300 * r, 0.6, 0.2 * dur, 0.4 * scale); break;
      case 'wood': this.noiseBurst(dest, 'bandpass', 650 * r, 3, 0.14 * dur, 0.6 * scale); this.tone(dest, 'triangle', 190 * r, 130, 0.12 * dur, 0.35 * scale); break;
      case 'metal': this.tone(dest, 'square', 900 * r, 820 * r, 0.1 * dur, 0.12 * scale); this.noiseBurst(dest, 'bandpass', 2600 * r, 4, 0.08 * dur, 0.4 * scale); break;
      case 'glass': this.noiseBurst(dest, 'highpass', 3500, 1, 0.25 * dur, 0.5 * scale);
        for (let i = 0; i < 4; i++) this.tone(dest, 'sine', 1800 + Math.random() * 2200, 0, 0.3, 0.12 * scale, i * 0.03); break;
      case 'cloth': this.noiseBurst(dest, 'lowpass', 650 * r, 0.6, 0.18 * dur, 0.55 * scale); break;
      case 'water': this.noiseBurst(dest, 'lowpass', 1500, 1, 0.35 * dur, 0.5 * scale, 0, 300); break;
      default: this.noiseBurst(dest, 'bandpass', 2300 * r, 1.2, 0.12 * dur, 0.6 * scale); this.noiseBurst(dest, 'lowpass', 600 * r, 1, 0.1 * dur, 0.5 * scale);
    }
  }

  play(name, pos, arg) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const d = this.out(pos, 1);
    if (!d) return;
    const sm = this.sampleFor(name, arg);
    if (sm && this.sample(sm[0], d, sm[1], sm[2])) return;
    switch (name) {
      case 'mobdeath': this.play('mobhurt', pos, arg); break;
      case 'chest': case 'chest_close': case 'door_open': case 'door_close': this.play('door', pos); break;
      case 'fizz': case 'creeperfuse': case 'flint': this.play('fuse', pos); break;
      case 'toolbreak': this.material('glass', d, 1, 1.3); break;
      case 'teleport': this.play('pop', pos); break;
      case 'enderman': this.play('zombie', pos); break;
      case 'zpiglin': this.play('pig', pos); break;
      case 'dig': this.material(arg, d, 1, 1.3); break;
      case 'place': this.material(arg, d, 0.85, 1); break;
      case 'hit': this.material(arg, d, 0.35, 0.6); break;
      case 'step': this.material(arg, d, 0.22, 0.7); break;
      case 'land': this.material(arg, d, 0.5, 1); break;
      case 'hurt': this.tone(d, 'square', 260, 120, 0.2, 0.25); this.noiseBurst(d, 'lowpass', 900, 1, 0.15, 0.4); break;
      case 'mobhurt': this.tone(d, 'sawtooth', 300, 160, 0.18, 0.18); break;
      case 'pop': this.tone(d, 'sine', 500, 900, 0.08, 0.3); break;
      case 'click': this.tone(d, 'square', 900, 700, 0.05, 0.12); break;
      case 'splash': this.noiseBurst(d, 'lowpass', 2500, 0.8, 0.6, 0.6, 0, 300); break;
      case 'explode':
        this.noiseBurst(d, 'lowpass', 1200, 0.7, 1.8, 1.2, 0, 60);
        this.noiseBurst(d, 'lowpass', 300, 1, 2.2, 1.0, 0.02, 40);
        this.tone(d, 'sine', 70, 30, 1.2, 0.9);
        break;
      case 'fuse': this.noiseBurst(d, 'highpass', 4000, 0.5, 1.5, 0.35, 0, 7000); break;
      case 'pig':
        for (let i = 0; i < 2; i++) { const o = this.tone(d, 'sawtooth', 320, 220, 0.16, 0.15, i * 0.2); }
        break;
      case 'cow': {
        const o = this.tone(d, 'sawtooth', 140, 110, 1.1, 0.18, 0, 0.15);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = 6;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(ctx.currentTime + 1.2);
        break;
      }
      case 'sheep': {
        const o = this.tone(d, 'square', 420, 380, 0.6, 0.08, 0, 0.05);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 22; const lg = ctx.createGain(); lg.gain.value = 25;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(ctx.currentTime + 0.7);
        break;
      }
      case 'zombie': this.tone(d, 'sawtooth', 95, 65, 1.0, 0.2, 0, 0.2); this.noiseBurst(d, 'lowpass', 400, 2, 0.9, 0.2); break;
      case 'creeper': break;
      case 'roar': this.tone(d, 'sawtooth', 110, 55, 1.6, 0.35, 0, 0.15); this.tone(d, 'sawtooth', 83, 40, 1.6, 0.25, 0, 0.2); this.noiseBurst(d, 'lowpass', 700, 1, 1.4, 0.4, 0, 200); break;
      case 'flap': this.noiseBurst(d, 'lowpass', 400, 0.7, 0.45, 0.6, 0, 120); break;
      case 'door': this.noiseBurst(d, 'bandpass', 420, 2, 0.15, 0.5); this.tone(d, 'triangle', 140, 90, 0.12, 0.2); break;
      case 'villager': this.tone(d, 'sawtooth', 210 + Math.random() * 60, 150, 0.28, 0.12, 0, 0.03); this.tone(d, 'triangle', 420, 300, 0.25, 0.06); break;
      case 'trade': this.tone(d, 'triangle', 520, 780, 0.12, 0.18); this.tone(d, 'triangle', 780, 1040, 0.12, 0.14, 0.1); break;
      case 'eat': this.noiseBurst(d, 'bandpass', 900 + Math.random() * 600, 1.5, 0.12, 0.35); break;
      case 'burp': this.tone(d, 'sawtooth', 120, 70, 0.3, 0.12); this.noiseBurst(d, 'lowpass', 500, 2, 0.25, 0.2); break;
      case 'bow': this.tone(d, 'triangle', 220, 90, 0.18, 0.3); this.noiseBurst(d, 'highpass', 2500, 0.8, 0.12, 0.25, 0, 900); break;
      case 'arrowhit': this.noiseBurst(d, 'bandpass', 500, 2, 0.08, 0.5); this.tone(d, 'square', 160, 90, 0.06, 0.12); break;
      case 'equip': this.tone(d, 'square', 700, 500, 0.06, 0.12); this.tone(d, 'triangle', 1200, 900, 0.1, 0.1, 0.05); break;
      case 'chicken': for (let i = 0; i < 2; i++) this.tone(d, 'square', 1100 + Math.random() * 200, 800, 0.07, 0.08, i * 0.12); break;
      case 'skeleton': for (let i = 0; i < 4; i++) this.noiseBurst(d, 'bandpass', 2200 + Math.random() * 800, 4, 0.04, 0.3, i * 0.07); break;
      case 'orb': { // tecrübe küresi: rastgele perdeli "tın"
        const f = (arg || 1) * (900 + Math.random() * 500);
        this.tone(d, 'sine', f, f * 1.01, 0.18, 0.13); this.tone(d, 'triangle', f * 2, f * 2, 0.08, 0.04);
        break;
      }
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(d, 'triangle', f, f, 0.35, 0.16, i * 0.09)); break;
      case 'enchant':
        for (let i = 0; i < 6; i++) this.tone(d, 'sine', 600 + Math.random() * 900, 1400 + Math.random() * 600, 0.4, 0.07, i * 0.06);
        this.noiseBurst(d, 'highpass', 5000, 0.7, 0.6, 0.12, 0, 9000);
        break;
      case 'anvil': this.tone(d, 'square', 1250, 1180, 0.25, 0.12); this.tone(d, 'sine', 2600, 2500, 0.5, 0.1); this.noiseBurst(d, 'bandpass', 3200, 6, 0.08, 0.4); break;
      case 'anvilbreak': this.noiseBurst(d, 'bandpass', 1500, 1, 0.5, 0.7); this.tone(d, 'square', 300, 90, 0.4, 0.2); break;
      case 'spider': this.noiseBurst(d, 'highpass', 3000, 0.6, 0.5, 0.25, 0, 1500); this.tone(d, 'sawtooth', 90, 60, 0.4, 0.08); break;
    }
  }

  // Sakin, rastgele piyano benzeri müzik
  scheduleMusic(delay) {
    clearTimeout(this.musicTimer);
    this.musicTimer = setTimeout(() => this.playPhrase(), delay);
  }
  playPhrase() {
    if (!this.ctx) return;
    if (!this.musicOn || this.ctx.state !== 'running') { this.scheduleMusic(5000); return; }
    const scales = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 5, 7, 9, 11]];
    const sc = scales[Math.floor(Math.random() * scales.length)];
    const roots = [48, 50, 53, 55, 57];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const n = 5 + Math.floor(Math.random() * 9);
    let t = 0;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    // Bas akor
    for (const k of [0, 2, 4]) this.pianoNote(mtof(root - 12 + sc[k % sc.length] + (k >= sc.length ? 12 : 0)), 0, 0.09, 6);
    let idx = Math.floor(Math.random() * sc.length);
    for (let i = 0; i < n; i++) {
      idx = clamp(idx + Math.floor(Math.random() * 5) - 2, 0, sc.length * 2 - 1);
      const m = root + 12 + sc[idx % sc.length] + Math.floor(idx / sc.length) * 12;
      this.pianoNote(mtof(m), t, 0.07 + Math.random() * 0.04, 3.5);
      if (Math.random() < 0.25) this.pianoNote(mtof(m - 12 + 7), t, 0.04, 3);
      t += [0.5, 0.75, 1, 1, 1.5][Math.floor(Math.random() * 5)];
    }
    this.scheduleMusic((t + 8 + Math.random() * 30) * 1000);
  }
  pianoNote(f, t0, vol, dur) {
    const ctx = this.ctx, t = ctx.currentTime + t0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    for (const [type, mul, det, a] of [['sine', 1, 0, 1], ['triangle', 2, 3, 0.25], ['sine', 3, -2, 0.1]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + 0.1);
    }
    g.connect(lp); lp.connect(this.music); lp.connect(this.reverb);
  }
}
