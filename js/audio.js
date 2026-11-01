'use strict';

const LimboAudio = (() => {
  let ctx = null;
  let master = null;
  let compressor = null;
  let musicBus = null;
  let sfxBus = null;
  let ambBus = null;
  let noiseBuffer = null;
  let started = false;
  let volume = 0.7;
  let musicVolume = 0.7;
  let sfxVolume = 0.85;
  let ambienceVolume = 0.55;
  let muted = false;
  let musicOn = true;
  let paused = false;

  // file-based music decks (two decks for crossfades)
  let musicDecks = null;
  let musicDeckIndex = 0;
  let musicCategory = null;
  let musicCurrentTrack = null;
  let musicCurrentTrackIndex = -1;
  let musicFadeTimer = null;
  let musicAdvancing = false;
  let musicFallback = false;
  let musicAutoplayBlocked = false;
  let musicGestureBound = false;
  const musicLastIndex = Object.create(null);
  const musicFailed = Object.create(null);

  // ambient nodes
  let droneNodes = [];
  let ambFilter = null;
  let ambLfo = null;
  let ambGain = null;

  // sequencer
  let seqTimer = null;
  let step = 0;
  let nextTime = 0;
  let bpm = 104;
  let rootHz = 55;
  let combat = 0;
  let levelStyle = 'concrete';

  // continuous hardware bed: case fan, disk seeking, electrical static
  let hardwareStarted = false;
  let fanGain = null;
  let fanFilter = null;
  let staticGain = null;
  let diskTimer = null;

  const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];
  const STYLE_BPM = {
    office: 92, ice: 84, shadow: 76, void: 68, grave: 64,
    corrupt: 118, circuit: 126, code: 112, mirror: 88, root: 60, hazard: 132,
  };

  // --------------------------------------------------------------- file music
  // The MP3 files live in assets/music/<category>/ and are described in
  // assets/music/manifest.json together with their source and license.
  const MUSIC_ROOT = 'assets/music/';
  const MUSIC_CATEGORY_META = {
    menu: { label: 'Ana Menü', fadeSeconds: 3.0, gain: 0.90 },
    exploration: { label: 'Keşif', fadeSeconds: 4.0, gain: 1.00 },
    facility: { label: 'Tesis', fadeSeconds: 3.5, gain: 0.95 },
    mystery: { label: 'Gizem', fadeSeconds: 4.0, gain: 0.95 },
    suspense: { label: 'Gerilim', fadeSeconds: 2.5, gain: 1.00 },
    chase: { label: 'Kovalamaca', fadeSeconds: 1.8, gain: 1.00 },
    timed: { label: 'Süreli Bulmaca', fadeSeconds: 1.8, gain: 0.95 },
    boss: { label: 'Boss / Büyük Olay', fadeSeconds: 1.6, gain: 1.00 },
    ending: { label: 'Final / Jenerik', fadeSeconds: 4.0, gain: 0.90 },
  };
  const MUSIC_LIBRARY = {
    menu: [
      { file: 'menu/the-empty-corridor.mp3', title: 'The Empty Corridor', duration: 150.38 },
      { file: 'menu/before-the-last-door.mp3', title: 'Before the Last Door', duration: 149.58 },
    ],
    exploration: [
      { file: 'exploration/broken-hallway.mp3', title: 'Broken Hallway', duration: 134.64 },
      { file: 'exploration/moth-hall.mp3', title: 'Moth Hall', duration: 168.19 },
      { file: 'exploration/no-way-back.mp3', title: 'No Way Back', duration: 119.57 },
    ],
    facility: [
      { file: 'facility/haunted-glass-hall.mp3', title: 'Haunted Glass Hall', duration: 163.39 },
      { file: 'facility/glass-house-pulse.mp3', title: 'Glass House Pulse', duration: 134.04 },
    ],
    mystery: [
      { file: 'mystery/basement-door.mp3', title: 'Basement Door', duration: 144.24 },
      { file: 'mystery/haunted-hallway-tape.mp3', title: 'Haunted Hallway Tape', duration: 149.30 },
    ],
    suspense: [
      { file: 'suspense/footsteps-approaching.mp3', title: 'Footsteps Approaching', duration: 168.17 },
      { file: 'suspense/sensing-something-behind-you.mp3', title: 'Sensing Something Behind You', duration: 193.39 },
      { file: 'suspense/cornered-with-no-way-out.mp3', title: 'Cornered with No Way Out', duration: 204.05 },
    ],
    chase: [
      { file: 'chase/run-and-dont-look-back.mp3', title: "Run and Don't Look Back", duration: 65.14 },
      { file: 'chase/the-footsteps-behind.mp3', title: 'The Footsteps Behind', duration: 87.62 },
      { file: 'chase/clip-run.mp3', title: 'Clip Run', duration: 137.40 },
    ],
    timed: [
      { file: 'timed/koto-circuit.mp3', title: 'Koto Circuit', duration: 162.19 },
      { file: 'timed/neon-afterimage.mp3', title: 'Neon Afterimage', duration: 184.27 },
    ],
    boss: [
      { file: 'boss/scarlet-dominion.mp3', title: 'Scarlet Dominion', duration: 180.07 },
      { file: 'boss/voidbreaker.mp3', title: 'Voidbreaker', duration: 127.08 },
      { file: 'boss/ashfall-tyrant.mp3', title: 'Ashfall Tyrant', duration: 158.66 },
    ],
    ending: [
      { file: 'ending/first-light-promise.mp3', title: 'First Light Promise', duration: 119.28 },
      { file: 'ending/last-goodbye.mp3', title: 'Last Goodbye', duration: 154.94 },
    ],
  };

  function safeCtx() {
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  function init() {
    if (ctx) {
      safeCtx();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    compressor.connect(master);
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0001;
    musicBus.connect(compressor);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(compressor);

    ambBus = ctx.createGain();
    ambBus.gain.value = ambienceVolume * 0.5;
    ambBus.connect(compressor);

    noiseBuffer = makeNoise(2.2);
    started = true;
    safeCtx();
    startHardware();
  }

  function startHardware() {
    if (!ctx || hardwareStarted) return;
    hardwareStarted = true;
    // case fan: filtered noise plus a low motor hum
    try {
      const fan = ctx.createBufferSource();
      fan.buffer = noiseBuffer;
      fan.loop = true;
      fanFilter = ctx.createBiquadFilter();
      fanFilter.type = 'lowpass';
      fanFilter.frequency.value = 240;
      fanFilter.Q.value = 0.6;
      fanGain = ctx.createGain();
      fanGain.gain.value = 0.032;
      fan.connect(fanFilter);
      fanFilter.connect(fanGain);
      fanGain.connect(ambBus);
      fan.start();

      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = 'sine';
      hum.frequency.value = 57.5;
      humGain.gain.value = 0.011;
      hum.connect(humGain);
      humGain.connect(ambBus);
      hum.start();

      const stat = ctx.createBufferSource();
      stat.buffer = noiseBuffer;
      stat.loop = true;
      const statFilter = ctx.createBiquadFilter();
      statFilter.type = 'bandpass';
      statFilter.frequency.value = 3600;
      statFilter.Q.value = 0.7;
      staticGain = ctx.createGain();
      staticGain.gain.value = 0.0045;
      stat.connect(statFilter);
      statFilter.connect(staticGain);
      staticGain.connect(ambBus);
      stat.start();

      diskTimer = setInterval(() => {
        if (!ctx || paused || muted) return;
        if (Math.random() < 0.62) {
          noiseHit({ dur: randRange(0.025, 0.075), vol: 0.02 + Math.random() * 0.025, type: 'bandpass', freq: 2200 + Math.random() * 2800, q: 3.5 });
          if (Math.random() < 0.22) {
            noiseHit({ dur: 0.12, vol: 0.018, type: 'bandpass', freq: 800 + Math.random() * 900, q: 1.8, delay: 0.06 });
          }
        }
      }, 4600);
    } catch (_) {}
  }

  function randRange(a, b) { return a + Math.random() * (b - a); }

  function setHardwareStyle(style) {
    levelStyle = style || levelStyle;
    if (!ctx || !fanFilter) return;
    const freq = style === 'office' ? 320 : style === 'ice' ? 170 : style === 'void' ? 145 : 240;
    fanFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 1.5);
    if (fanGain) fanGain.gain.setTargetAtTime(style === 'office' ? 0.04 : 0.03, ctx.currentTime, 1.2);
  }

  function setGlitch(amount) {
    if (!ctx || !staticGain) return;
    const v = Math.max(0, Math.min(1, Number(amount) || 0));
    staticGain.gain.cancelScheduledValues(ctx.currentTime);
    staticGain.gain.setTargetAtTime(0.0045 + v * 0.07, ctx.currentTime, 0.035);
    setTimeout(() => {
      if (staticGain && ctx) staticGain.gain.setTargetAtTime(paused ? 0.001 : 0.0045, ctx.currentTime, 0.4);
    }, 320 + v * 500);
  }

  function makeNoise(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const fade = Math.max(16, Math.floor(ctx.sampleRate * 0.05));
    const temp = new Float32Array(len + fade);
    let last = 0;
    for (let i = 0; i < temp.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      temp[i] = last * 3.2 + white * 0.18;
    }
    // Crossfade the tail into the head so looping the noise bed cannot click.
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      if (i < fade) {
        const t = i / fade;
        data[i] = temp[i] * t + temp[len + i] * (1 - t);
      } else {
        data[i] = temp[i];
      }
    }
    return buf;
  }

  function noiseSource(duration, loop) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = Boolean(loop);
    if (!loop) {
      const bufDur = src.buffer.duration || 2.2;
      const dur = Math.min(Math.max(0.006, Number(duration) || 0.12), bufDur - 0.01);
      const maxOffset = Math.max(0, bufDur - dur - 0.005);
      const offset = Math.random() * maxOffset;
      src.start(ctx.currentTime, offset, dur);
    } else {
      src.start();
    }
    return src;
  }

  function tone(opts) {
    if (!safeCtx()) return;
    const {
      freq = 220, to = null, type = 'square', dur = 0.15, vol = 0.2,
      attack = 0.002, bus = sfxBus, detune = 0,
    } = opts || {};
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(15, to), ctx.currentTime + dur);
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseHit(opts) {
    if (!safeCtx()) return;
    const {
      dur = 0.12, vol = 0.3, type = 'lowpass', freq = 1200, q = 0.7,
      to = null, bus = sfxBus, delay = 0,
    } = opts || {};
    const src = noiseSource(dur + delay, false);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (to != null) filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), ctx.currentTime + delay + dur);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.04);
    applyMusicVolumes();
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, Number(v) || 0));
    applyMusicVolumes();
  }

  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
  }

  function setAmbienceVolume(v) {
    ambienceVolume = Math.max(0, Math.min(1, Number(v) || 0));
    applyAmbienceGain();
  }

  function applyAmbienceGain() {
    if (!ambBus || !ctx) return;
    ambBus.gain.setTargetAtTime((paused ? 0.64 : 1) * ambienceVolume * 0.5, ctx.currentTime, 0.2);
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
    applyMusicVolumes();
  }

  function isMuted() { return muted; }

  function setPaused(value) {
    const next = Boolean(value);
    if (paused === next) {
      if (!next) resumeFileMusic();
      return;
    }
    paused = next;
    if (!ctx) {
      if (paused) pauseFileMusic(); else resumeFileMusic();
      return;
    }
    if (musicBus) musicBus.gain.setTargetAtTime(paused ? 0.0001 : 0.35 + combat * 0.45, ctx.currentTime, 0.2);
    applyAmbienceGain();
    if (fanGain) fanGain.gain.setTargetAtTime(paused ? 0.014 : 0.03, ctx.currentTime, 0.3);
    if (staticGain) staticGain.gain.setTargetAtTime(paused ? 0.0015 : 0.0045, ctx.currentTime, 0.3);
    if (paused) {
      pauseFileMusic();
      safeCtx();
    } else {
      resumeFileMusic();
    }
  }

  function setCombat(value) {
    combat = Math.max(0, Math.min(1, value));
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(paused ? 0.0001 : 0.24 + combat * 0.62, ctx.currentTime, 0.6);
  }

  function stopAmbient() {
    for (const node of droneNodes) {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    }
    droneNodes = [];
    if (ambLfo) { try { ambLfo.stop(); } catch (_) {} ambLfo = null; }
    if (ambFilter) { try { ambFilter.disconnect(); } catch (_) {} ambFilter = null; }
    if (ambGain) { try { ambGain.disconnect(); } catch (_) {} ambGain = null; }
  }

  function startAmbient(root, style) {
    if (!safeCtx()) return;
    stopAmbient();
    rootHz = root || 55;
    levelStyle = style || 'concrete';
    setHardwareStyle(levelStyle);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.0001;
    ambGain.connect(ambBus);
    ambFilter = ctx.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.frequency.value = style === 'office' ? 480 : style === 'ice' ? 260 : 340;
    ambFilter.Q.value = 2.2;
    ambFilter.connect(ambGain);

    const freqs = [rootHz, rootHz * 1.4983, rootHz * 2.006, rootHz * 0.5];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'sine' : 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 7;
      const g = ctx.createGain();
      g.gain.value = i === 3 ? 0.14 : 0.06;
      osc.connect(g);
      g.connect(ambFilter);
      osc.start();
      droneNodes.push(osc);
    });

    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 880;
    airFilter.Q.value = 0.55;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.022;
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(ambGain);
    air.start();
    droneNodes.push(air);

    ambLfo = ctx.createOscillator();
    ambLfo.type = 'sine';
    ambLfo.frequency.value = 0.07 + Math.random() * 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    ambLfo.connect(lfoGain);
    lfoGain.connect(ambFilter.frequency);
    ambLfo.start();

    ambGain.gain.setTargetAtTime(0.55, ctx.currentTime, 2.5);
  }

  function scheduler() {
    if (!ctx || paused) return;
    const lookahead = 0.14;
    while (nextTime < ctx.currentTime + lookahead) {
      scheduleStep(step, nextTime);
      nextTime += (60 / bpm) / 4;
      step = (step + 1) % 16;
    }
  }

  function scheduleStep(s, t) {
    const intensity = combat;
    // kick
    if (s === 0 || s === 8 || (s === 14 && intensity > 0.55)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.42 + intensity * 0.2, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(musicBus);
      osc.start(t);
      osc.stop(t + 0.25);
    }
    // snare
    if (s === 4 || s === 12) {
      noiseHit({ dur: 0.1, vol: 0.14 + intensity * 0.1, type: 'highpass', freq: 1400, bus: musicBus, delay: t - ctx.currentTime });
    }
    // hats
    if (s % 2 === 0 && intensity > 0.18) {
      noiseHit({ dur: 0.025, vol: 0.035 + intensity * 0.03, type: 'highpass', freq: 6000, bus: musicBus, delay: t - ctx.currentTime });
    }
    // bass line
    const pattern = levelStyle === 'ice'
      ? [0, 0, 0, -5, 0, 0, 3, 0, 0, 0, 7, 0, 3, 0, 0, 0]
      : levelStyle === 'spirit'
        ? [0, 0, 7, 0, 3, 0, 5, 0, 0, 10, 7, 0, 3, 0, -2, 0]
        : levelStyle === 'root' || levelStyle === 'grave'
          ? [0, -5, 0, -5, 0, -2, 0, 3, 0, -5, 0, -7, 0, -2, 0, -5]
          : levelStyle === 'void'
            ? [0, 0, -12, 0, 0, 0, -7, 0, 0, 0, -5, 0, 0, 0, -2, 0]
            : levelStyle === 'mirror' || levelStyle === 'corrupt'
              ? [0, 12, 0, 7, 0, 3, 0, 10, 0, 5, 0, 12, 0, 7, 0, 3]
              : [0, 0, 12, 0, 0, 3, 0, 7, 0, 0, 10, 0, 3, 0, 5, 0];
    if (s % 2 === 0) {
      const semitone = pattern[s] + (s === 0 ? 0 : 0);
      const freq = rootHz * Math.pow(2, semitone / 12);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = levelStyle === 'ice' ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240 + intensity * 700, t);
      filter.Q.value = 3;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.09 + intensity * 0.07, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicBus);
      osc.start(t);
      osc.stop(t + 0.26);
    }
    // distant melodic ping
    if ((s === 6 || s === 15) && Math.random() < 0.5) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone({ freq: rootHz * 4 * Math.pow(2, n / 12), type: 'sine', dur: 0.7, vol: 0.025, bus: musicBus });
    }
  }

  // --------------------------------------------------------------- file music engine
  function ensureMusicDecks() {
    if (musicDecks) return musicDecks;
    musicDecks = [createMusicDeck(0), createMusicDeck(1)];
    return musicDecks;
  }

  function createMusicDeck(index) {
    const el = new Audio();
    el.preload = 'auto';
    el.volume = 0;
    el.addEventListener('ended', () => {
      if (musicDeckIndex === index) advanceMusicTrack('ended');
    });
    el.addEventListener('timeupdate', () => {
      if (musicDeckIndex !== index || paused || !musicCategory) return;
      const deck = musicDecks && musicDecks[index];
      if (!deck || !deck.track || deck.advanceQueued) return;
      const total = Number(el.duration);
      if (!Number.isFinite(total) || total <= 0) return;
      const meta = MUSIC_CATEGORY_META[musicCategory];
      const lead = Math.max(2.8, (meta ? meta.fadeSeconds : 3) + 0.9);
      const remaining = total - el.currentTime;
      if (remaining > 0.15 && remaining <= lead) {
        deck.advanceQueued = true;
        advanceMusicTrack('near-end');
      }
    });
    el.addEventListener('error', () => onMusicDeckError(index));
    return {
      index,
      el,
      track: null,
      trackIndex: -1,
      gain: 0,
      fadeFrom: 0,
      fadeTo: 0,
      fadeStart: 0,
      fadeDur: 1,
      fadeAction: '',
      advanceQueued: false,
    };
  }

  function currentMusicDeck() {
    if (!musicDecks) return null;
    return musicDecks[musicDeckIndex] || musicDecks[0] || null;
  }

  function applyMusicVolumes() {
    if (!musicDecks) return;
    for (const deck of musicDecks) applyDeckVolume(deck);
  }

  function applyDeckVolume(deck) {
    if (!deck) return;
    const meta = musicCategory ? MUSIC_CATEGORY_META[musicCategory] : null;
    const bus = (muted ? 0 : volume) * musicVolume * (meta ? meta.gain : 1);
    const level = Math.max(0, Math.min(1, bus * deck.gain));
    try { deck.el.volume = level; } catch (_) {}
  }

  function fadeDeckTo(deck, target, seconds, action) {
    if (!deck) return;
    deck.fadeFrom = deck.gain;
    deck.fadeTo = Math.max(0, Math.min(1, Number(target) || 0));
    deck.fadeStart = performance.now();
    deck.fadeDur = Math.max(40, (Number(seconds) || 0.01) * 1000);
    deck.fadeAction = action || '';
    if (!musicFadeTimer) musicFadeTimer = setInterval(musicFadeStep, 40);
  }

  function musicFadeStep() {
    if (!musicDecks) {
      clearInterval(musicFadeTimer);
      musicFadeTimer = null;
      return;
    }
    const now = performance.now();
    let active = false;
    for (const deck of musicDecks) {
      if (!deck.fadeStart) continue;
      const t = Math.min(1, (now - deck.fadeStart) / deck.fadeDur);
      deck.gain = deck.fadeFrom + (deck.fadeTo - deck.fadeFrom) * t;
      applyDeckVolume(deck);
      if (t >= 1) {
        const action = deck.fadeAction;
        deck.fadeStart = 0;
        deck.fadeAction = '';
        deck.gain = deck.fadeTo;
        applyDeckVolume(deck);
        if (deck.gain <= 0.001 && action === 'pause') {
          try { deck.el.pause(); } catch (_) {}
        } else if (deck.gain <= 0.001 && action === 'release') {
          releaseMusicDeck(deck);
        }
      } else {
        active = true;
      }
    }
    if (!active) {
      clearInterval(musicFadeTimer);
      musicFadeTimer = null;
    }
  }

  function releaseMusicDeck(deck) {
    if (!deck) return;
    try { deck.el.pause(); } catch (_) {}
    deck.track = null;
    deck.trackIndex = -1;
    deck.gain = 0;
    deck.advanceQueued = false;
    deck.fadeStart = 0;
    deck.fadeAction = '';
    try { deck.el.volume = 0; } catch (_) {}
    try {
      deck.el.removeAttribute('src');
      deck.el.load();
    } catch (_) {}
  }

  function attemptDeckPlay(deck) {
    if (!deck || !deck.track) return;
    const promise = deck.el.play();
    if (promise && typeof promise.catch === 'function') {
      promise.then(() => {
        musicAutoplayBlocked = false;
      }).catch((err) => {
        if (err && err.name === 'NotAllowedError') {
          musicAutoplayBlocked = true;
          bindMusicGesture();
        }
      });
    }
  }

  function bindMusicGesture() {
    if (musicGestureBound) return;
    musicGestureBound = true;
    const retry = () => {
      document.removeEventListener('pointerdown', retry, true);
      document.removeEventListener('keydown', retry, true);
      musicGestureBound = false;
      if (paused || !musicOn) return;
      const deck = currentMusicDeck();
      if (deck && deck.track && deck.el.paused) {
        attemptDeckPlay(deck);
        fadeDeckTo(deck, 1, 0.6);
      }
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
  }

  function onMusicDeckError(index) {
    const deck = musicDecks && musicDecks[index];
    if (!deck || !deck.track) return;
    const failedFile = deck.track.file;
    musicFailed[failedFile] = true;
    const wasCurrent = musicDeckIndex === index;
    releaseMusicDeck(deck);
    if (!wasCurrent || !musicCategory) return;
    const category = musicCategory;
    const pick = pickMusicTrack(category);
    if (!pick) {
      enableProceduralFallback();
      return;
    }
    setTimeout(() => {
      if (musicCategory === category && !paused && musicOn) {
        startDeckTrack(pick, category, false);
      }
    }, 80);
  }

  function pickMusicTrack(category) {
    const list = MUSIC_LIBRARY[category];
    if (!Array.isArray(list) || !list.length) return null;
    const available = [];
    for (let i = 0; i < list.length; i++) {
      if (!musicFailed[list[i].file]) available.push(i);
    }
    if (!available.length) return null;
    let pool = available;
    if (pool.length > 1 && musicLastIndex[category] != null) {
      const filtered = pool.filter((i) => i !== musicLastIndex[category]);
      if (filtered.length) pool = filtered;
    }
    const index = pool[Math.floor(Math.random() * pool.length)];
    musicLastIndex[category] = index;
    return { track: list[index], index };
  }

  function startDeckTrack(pick, category, crossfade = true) {
    if (!pick || !pick.track) return;
    const decks = ensureMusicDecks();
    const oldDeck = currentMusicDeck();
    let next = decks.find((d) => d !== oldDeck && !d.track);
    if (!next) next = decks.find((d) => d !== oldDeck);
    if (!next) next = decks[0];
    if (next.track) releaseMusicDeck(next);

    const meta = MUSIC_CATEGORY_META[category] || { fadeSeconds: 2.5, gain: 1 };
    next.track = pick.track;
    next.trackIndex = pick.index;
    next.advanceQueued = false;
    next.gain = 0;
    next.fadeStart = 0;
    next.fadeAction = '';
    try { next.el.volume = 0; } catch (_) {}
    next.el.src = MUSIC_ROOT + pick.track.file;
    try { next.el.load(); } catch (_) {}
    musicCategory = category;
    musicCurrentTrack = pick.track;
    musicCurrentTrackIndex = pick.index;
    musicDeckIndex = next.index;
    musicFallback = false;
    attemptDeckPlay(next);
    const fade = crossfade ? meta.fadeSeconds : 0.5;
    fadeDeckTo(next, 1, fade);
    if (oldDeck && oldDeck !== next && oldDeck.track && oldDeck.fadeAction !== 'pause') {
      fadeDeckTo(oldDeck, 0, fade, 'release');
    }
    applyMusicVolumes();
  }

  function playMusic(category, options) {
    const meta = MUSIC_CATEGORY_META[category];
    if (!meta || !MUSIC_LIBRARY[category] || !MUSIC_LIBRARY[category].length) {
      return getMusicState();
    }
    ensureMusicDecks();
    const force = Boolean(options && options.force);
    const sameCategory = musicCategory === category && Boolean(musicCurrentTrack);
    if (sameCategory && !force && !musicFallback) {
      const deck = currentMusicDeck();
      if (deck && deck.track && deck.el.paused && !paused && musicOn) {
        attemptDeckPlay(deck);
        fadeDeckTo(deck, 1, 0.8);
      }
      return getMusicState();
    }
    const pick = pickMusicTrack(category);
    if (!pick) {
      enableProceduralFallback();
      return getMusicState();
    }
    musicAdvancing = false;
    startDeckTrack(pick, category, true);
    return getMusicState();
  }

  function advanceMusicTrack(reason) {
    if (musicAdvancing || paused || !musicCategory || musicFallback) return;
    musicAdvancing = true;
    const category = musicCategory;
    const pick = pickMusicTrack(category);
    if (!pick) {
      musicAdvancing = false;
      enableProceduralFallback();
      return;
    }
    startDeckTrack(pick, category, true);
    setTimeout(() => { musicAdvancing = false; }, 900);
  }

  function pauseFileMusic() {
    if (!musicDecks) return;
    for (const deck of musicDecks) {
      if (!deck.track || deck.fadeAction === 'release') continue;
      if (deck.el.paused) {
        deck.gain = 0;
        applyDeckVolume(deck);
      } else {
        fadeDeckTo(deck, 0, 0.55, 'pause');
      }
    }
  }

  function resumeFileMusic() {
    if (!musicOn) return;
    if (musicFallback) {
      startSequencer();
      return;
    }
    if (!musicDecks) return;
    const deck = currentMusicDeck();
    if (!deck || !deck.track) return;
    for (const other of musicDecks) {
      if (other !== deck && other.track) fadeDeckTo(other, 0, 0.4, 'release');
    }
    deck.gain = Math.min(deck.gain, 0.05);
    applyDeckVolume(deck);
    attemptDeckPlay(deck);
    fadeDeckTo(deck, 1, 0.9);
  }

  function startSequencer() {
    if (!ctx || seqTimer || !musicOn || paused || !musicFallback) return;
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    bpm = STYLE_BPM[levelStyle] || 104;
    seqTimer = setInterval(scheduler, 40);
    if (musicBus) musicBus.gain.setTargetAtTime(0.22 + combat * 0.6, ctx.currentTime, 1.2);
  }

  function enableProceduralFallback() {
    if (musicFallback) return;
    musicFallback = true;
    musicAdvancing = false;
    if (musicDecks) {
      for (const deck of musicDecks) {
        if (deck.track) fadeDeckTo(deck, 0, 0.8, 'release');
      }
    }
    startSequencer();
  }

  function seekMusic(remaining) {
    const deck = currentMusicDeck();
    if (!deck || !deck.track) return getMusicState();
    const total = Number(deck.el.duration);
    if (Number.isFinite(total) && total > 0.5) {
      deck.el.currentTime = Math.max(0, total - Math.max(1, Number(remaining) || 3));
    }
    return getMusicState();
  }

  function getMusicState() {
    const deck = currentMusicDeck();
    const meta = musicCategory ? MUSIC_CATEGORY_META[musicCategory] : null;
    const duration = deck && Number.isFinite(deck.el.duration)
      ? Number(deck.el.duration.toFixed(2))
      : (musicCurrentTrack ? musicCurrentTrack.duration : 0);
    return {
      category: musicCategory,
      label: meta ? meta.label : null,
      track: musicCurrentTrack ? musicCurrentTrack.title : null,
      file: musicCurrentTrack ? musicCurrentTrack.file : null,
      trackIndex: musicCurrentTrackIndex,
      deck: musicDeckIndex,
      playing: Boolean(deck && deck.track && !deck.el.paused),
      paused,
      position: deck ? Number(deck.el.currentTime.toFixed(2)) : 0,
      duration,
      gain: deck ? Number(deck.gain.toFixed(3)) : 0,
      fallback: musicFallback,
      autoplayBlocked: musicAutoplayBlocked,
      failed: Object.keys(musicFailed),
      volumes: {
        master: Number(volume.toFixed(2)),
        music: Number(musicVolume.toFixed(2)),
        sfx: Number(sfxVolume.toFixed(2)),
        ambience: Number(ambienceVolume.toFixed(2)),
        muted,
        musicOn,
      },
      decks: (musicDecks || []).map((d) => ({
        index: d.index,
        track: d.track ? d.track.title : null,
        gain: Number(d.gain.toFixed(3)),
        output: Number(d.el.volume.toFixed(3)),
        paused: d.el.paused,
      })),
    };
  }

  function startMusic(root, style) {
    if (!safeCtx()) return;
    startAmbient(root, style);
    // File-based music is the primary layer. The procedural sequencer is kept
    // as a fallback for machines where the bundled MP3 files cannot be decoded.
    if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
    if (musicFallback) startSequencer();
  }

  function stopMusic() {
    if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
    stopAmbient();
    musicAdvancing = false;
    musicCategory = null;
    musicCurrentTrack = null;
    musicCurrentTrackIndex = -1;
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    if (musicDecks) {
      for (const deck of musicDecks) {
        if (deck.track) fadeDeckTo(deck, 0, 0.9, 'release');
      }
    }
  }

  function setMusicEnabled(on) {
    musicOn = Boolean(on);
    if (!musicOn) {
      if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
      if (musicDecks) {
        for (const deck of musicDecks) {
          if (deck.track) fadeDeckTo(deck, 0, 0.5, 'pause');
        }
      }
      return;
    }
    if (musicFallback) {
      startSequencer();
    } else {
      const deck = currentMusicDeck();
      if (deck && deck.track && !paused) {
        attemptDeckPlay(deck);
        fadeDeckTo(deck, 1, 0.7);
      }
    }
  }

  function shot(kind) {
    if (kind === 'rifle') {
      noiseHit({ dur: 0.09, vol: 0.28, type: 'bandpass', freq: 1900, q: 0.8 });
      tone({ freq: 240, to: 70, type: 'square', dur: 0.07, vol: 0.12 });
    } else if (kind === 'shotgun') {
      noiseHit({ dur: 0.28, vol: 0.44, type: 'lowpass', freq: 1700, to: 120, q: 1.2 });
      tone({ freq: 120, to: 34, type: 'triangle', dur: 0.32, vol: 0.34 });
      noiseHit({ dur: 0.22, vol: 0.16, type: 'highpass', freq: 2200 });
    } else if (kind === 'blade') {
      noiseHit({ dur: 0.18, vol: 0.25, type: 'bandpass', freq: 3200, to: 700, q: 2.4 });
      tone({ freq: 620, to: 150, type: 'sawtooth', dur: 0.11, vol: 0.06 });
    } else if (kind === 'boss') {
      noiseHit({ dur: 0.5, vol: 0.4, type: 'lowpass', freq: 500, to: 60 });
      tone({ freq: 80, to: 25, type: 'sawtooth', dur: 0.6, vol: 0.24 });
    }
  }

  const SFX = {
    hit: () => {
      noiseHit({ dur: 0.045, vol: 0.16, type: 'bandpass', freq: 1200, q: 1.4 });
      tone({ freq: 900, to: 300, type: 'square', dur: 0.05, vol: 0.055 });
    },
    kill: () => {
      noiseHit({ dur: 0.3, vol: 0.26, type: 'lowpass', freq: 900, to: 90 });
      tone({ freq: 130, to: 38, type: 'sawtooth', dur: 0.35, vol: 0.16 });
      tone({ freq: 320, to: 80, type: 'square', dur: 0.2, vol: 0.06 });
    },
    hurt: () => {
      noiseHit({ dur: 0.22, vol: 0.3, type: 'bandpass', freq: 700, q: 0.8 });
      tone({ freq: 160, to: 50, type: 'sawtooth', dur: 0.25, vol: 0.16 });
    },
    dash: () => {
      noiseHit({ dur: 0.2, vol: 0.22, type: 'bandpass', freq: 600, to: 3200, q: 1.2 });
      tone({ freq: 180, to: 540, type: 'sine', dur: 0.14, vol: 0.08 });
    },
    slide: () => noiseHit({ dur: 0.3, vol: 0.13, type: 'bandpass', freq: 900, to: 500, q: 0.9 }),
    jump: () => tone({ freq: 190, to: 330, type: 'triangle', dur: 0.1, vol: 0.06 }),
    land: () => noiseHit({ dur: 0.07, vol: 0.12, type: 'lowpass', freq: 300 }),
    pickup: () => {
      tone({ freq: 660, to: 990, type: 'triangle', dur: 0.1, vol: 0.1 });
      tone({ freq: 990, to: 1320, type: 'sine', dur: 0.1, vol: 0.07 });
    },
    popup: () => {
      tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.045 });
      setTimeout(() => tone({ freq: 660, type: 'square', dur: 0.08, vol: 0.04 }), 70);
    },
    click: () => tone({ freq: 1100, type: 'square', dur: 0.025, vol: 0.03 }),
    denied: () => {
      tone({ freq: 170, to: 100, type: 'sawtooth', dur: 0.18, vol: 0.09 });
      setTimeout(() => tone({ freq: 130, to: 80, type: 'sawtooth', dur: 0.2, vol: 0.08 }), 130);
    },
    code: () => tone({ freq: 440, to: 880, type: 'sine', dur: 0.12, vol: 0.06 }),
    codeOk: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.07 }), i * 90));
    },
    complete: () => {
      [220, 277, 330, 440].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', dur: 0.9, vol: 0.06 }), i * 170));
    },
    death: () => {
      noiseHit({ dur: 1.4, vol: 0.35, type: 'lowpass', freq: 1200, to: 40 });
      [180, 150, 110, 70].forEach((f, i) => setTimeout(() => tone({ freq: f, to: f * 0.5, type: 'sawtooth', dur: 0.6, vol: 0.12 }), i * 190));
    },
    bossSpawn: () => {
      noiseHit({ dur: 1.6, vol: 0.35, type: 'lowpass', freq: 350, to: 50 });
      [55, 58, 66, 82].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 1.5, vol: 0.11 }), i * 130));
    },
    bossShield: () => {
      tone({ freq: 520, to: 260, type: 'square', dur: 0.35, vol: 0.1 });
      noiseHit({ dur: 0.3, vol: 0.18, type: 'bandpass', freq: 1600, q: 2 });
    },
    qte: () => {
      tone({ freq: 740, type: 'square', dur: 0.06, vol: 0.06 });
      setTimeout(() => tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.06 }), 100);
    },
    qteHit: () => tone({ freq: 1200, to: 1600, type: 'sine', dur: 0.08, vol: 0.07 }),
    qteFail: () => {
      noiseHit({ dur: 0.5, vol: 0.3, type: 'bandpass', freq: 900, q: 0.5 });
      tone({ freq: 140, to: 60, type: 'sawtooth', dur: 0.5, vol: 0.14 });
    },
    fileDeleted: () => {
      tone({ freq: 300, to: 90, type: 'square', dur: 0.18, vol: 0.09 });
      setTimeout(() => tone({ freq: 180, to: 60, type: 'sawtooth', dur: 0.24, vol: 0.08 }), 100);
    },
    unlock: () => {
      [330, 440, 554, 660].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.4, vol: 0.07 }), i * 110));
    },
    glitch: () => {
      noiseHit({ dur: 0.4, vol: 0.12, type: 'highpass', freq: 800 });
      tone({ freq: 2000 + Math.random() * 1200, to: 200, type: 'square', dur: 0.2, vol: 0.025 });
      setGlitch(0.7);
    },
    cursorOn: () => {
      tone({ freq: 620, to: 880, type: 'square', dur: 0.05, vol: 0.04 });
      setTimeout(() => tone({ freq: 1180, type: 'sine', dur: 0.05, vol: 0.03 }), 60);
    },
    cursorOff: () => {
      tone({ freq: 880, to: 520, type: 'square', dur: 0.05, vol: 0.04 });
      setTimeout(() => tone({ freq: 380, type: 'sine', dur: 0.06, vol: 0.03 }), 55);
    },
    camera: () => {
      noiseHit({ dur: 0.16, vol: 0.07, type: 'bandpass', freq: 700, to: 1500, q: 1.5 });
      tone({ freq: 240, to: 420, type: 'triangle', dur: 0.12, vol: 0.04 });
    },
    mapOpen: () => {
      noiseHit({ dur: 0.12, vol: 0.05, type: 'highpass', freq: 1800 });
      tone({ freq: 440, type: 'square', dur: 0.05, vol: 0.035 });
      setTimeout(() => tone({ freq: 660, type: 'square', dur: 0.07, vol: 0.035 }), 80);
    },
    mapClose: () => {
      tone({ freq: 660, to: 330, type: 'square', dur: 0.07, vol: 0.035 });
      noiseHit({ dur: 0.07, vol: 0.035, type: 'highpass', freq: 1400 });
    },
    takeover: () => {
      noiseHit({ dur: 0.7, vol: 0.2, type: 'lowpass', freq: 400, to: 90 });
      tone({ freq: 90, to: 45, type: 'sawtooth', dur: 0.7, vol: 0.12 });
      setGlitch(1);
    },
    takeoverEnd: () => {
      tone({ freq: 180, to: 540, type: 'triangle', dur: 0.22, vol: 0.07 });
      noiseHit({ dur: 0.15, vol: 0.05, type: 'bandpass', freq: 2400, q: 2 });
    },
    type: () => tone({ freq: 1400 + Math.random() * 900, type: 'square', dur: 0.012, vol: 0.012 }),
    kernel: () => {
      noiseHit({ dur: 1.2, vol: 0.42, type: 'lowpass', freq: 320, to: 40 });
      tone({ freq: 70, to: 28, type: 'sawtooth', dur: 1.4, vol: 0.2 });
      setTimeout(() => {
        tone({ freq: 880, type: 'square', dur: 0.16, vol: 0.05 });
        setTimeout(() => tone({ freq: 440, type: 'square', dur: 0.22, vol: 0.05 }), 190);
      }, 260);
      setGlitch(1);
    },
    hazard: () => {
      [0, 0.18].forEach((delay, i) => setTimeout(() => {
        tone({ freq: i ? 520 : 720, to: i ? 380 : 560, type: 'square', dur: 0.2, vol: 0.06 });
      }, delay * 1000));
      noiseHit({ dur: 0.3, vol: 0.09, type: 'bandpass', freq: 1300, q: 1.2 });
    },
    clock: () => {
      [880, 1174, 1760].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', dur: 0.45, vol: 0.04 }), i * 160));
    },
    wallpaper: () => {
      noiseHit({ dur: 0.5, vol: 0.14, type: 'highpass', freq: 600 });
      tone({ freq: 140, to: 60, type: 'sawtooth', dur: 0.5, vol: 0.08 });
      setGlitch(0.9);
    },
    nag: () => {
      tone({ freq: 130, to: 70, type: 'sawtooth', dur: 0.35, vol: 0.08 });
      noiseHit({ dur: 0.18, vol: 0.08, type: 'lowpass', freq: 500 });
    },
    token: () => {
      [330, 440, 554, 660, 880].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.06 }), i * 120));
      noiseHit({ dur: 0.4, vol: 0.04, type: 'highpass', freq: 3000 });
    },
    final: () => {
      tone({ freq: 55, type: 'sine', dur: 6, vol: 0.15 });
      noiseHit({ dur: 4, vol: 0.2, type: 'lowpass', freq: 500, to: 20 });
      setGlitch(1);
    },
  };

  function play(name, arg) {
    if (!ctx || muted) return;
    if (name === 'shot') return shot(arg);
    const fn = SFX[name];
    if (fn) fn();
  }

  return {
    init,
    play,
    setVolume,
    setMusicVolume,
    setSfxVolume,
    setAmbienceVolume,
    setMuted,
    isMuted,
    setPaused,
    setCombat,
    startMusic,
    stopMusic,
    setMusicEnabled,
    playMusic,
    getMusicState,
    seekMusic,
    setGlitch,
    setHardwareStyle,
    get ctx() { return ctx; },
  };
})();
