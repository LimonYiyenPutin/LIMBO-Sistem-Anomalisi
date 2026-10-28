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
  let muted = false;
  let musicOn = true;
  let paused = false;

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
    sfxBus.gain.value = 0.85;
    sfxBus.connect(compressor);

    ambBus = ctx.createGain();
    ambBus.gain.value = 0.28;
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
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      data[i] = last * 3.2 + white * 0.18;
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
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
  }

  function isMuted() { return muted; }

  function setPaused(value) {
    paused = Boolean(value);
    if (!ctx) return;
    if (musicBus) musicBus.gain.setTargetAtTime(paused ? 0.0001 : 0.35 + combat * 0.45, ctx.currentTime, 0.2);
    if (ambBus) ambBus.gain.setTargetAtTime(paused ? 0.18 : 0.28, ctx.currentTime, 0.25);
    if (fanGain) fanGain.gain.setTargetAtTime(paused ? 0.014 : 0.03, ctx.currentTime, 0.3);
    if (staticGain) staticGain.gain.setTargetAtTime(paused ? 0.0015 : 0.0045, ctx.currentTime, 0.3);
    if (paused) safeCtx();
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

  function startMusic(root, style) {
    if (!safeCtx()) return;
    startAmbient(root, style);
    if (seqTimer) clearInterval(seqTimer);
    step = 0;
    nextTime = ctx.currentTime + 0.15;
    bpm = STYLE_BPM[style] || 104;
    if (musicOn) seqTimer = setInterval(scheduler, 40);
    if (musicBus) musicBus.gain.setTargetAtTime(0.22 + combat * 0.6, ctx.currentTime, 1.2);
  }

  function stopMusic() {
    if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
    stopAmbient();
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  }

  function setMusicEnabled(on) {
    musicOn = Boolean(on);
    if (!musicOn) {
      if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
    } else if (ctx && !seqTimer) {
      step = 0;
      nextTime = ctx.currentTime + 0.1;
      seqTimer = setInterval(scheduler, 40);
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
    setMuted,
    isMuted,
    setPaused,
    setCombat,
    startMusic,
    stopMusic,
    setMusicEnabled,
    setGlitch,
    setHardwareStyle,
    get ctx() { return ctx; },
  };
})();
