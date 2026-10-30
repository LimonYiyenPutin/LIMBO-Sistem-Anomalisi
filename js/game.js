'use strict';

/* L.I.M.B.O. // SİSTEM_ANOMALİSİ — oyun katmanı */
(() => {
  const CONTENT = LIMBO_CONTENT;
  const ENGINE = LimboEngine;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'limbo_progress_v3';
  const SETTINGS_KEY = 'limbo_settings_v3';
  const FINAL_KEY = 'limbo_final_v1';
  const GAME_SAVE_VERSION = 1;
  const DEV_MODE = new URLSearchParams(window.location.search).get('dev') === '1';

  const WALLS = new Set(['#', '%', '+', 'D', 'L']);
  const WEAPONS = [
    { key: 'blade', name: 'VERİ BIÇAĞI', slot: '01', sfx: 'blade' },
    { key: 'rifle', name: 'SEKTÖR TÜFEĞİ', slot: '02', sfx: 'rifle' },
    { key: 'core', name: 'ÇEKİRDEK MAKİNESİ', slot: '03', sfx: 'shotgun' },
  ];
  const ACT_NAMES = {
    1: 'PERDE I // DIŞ ÇEPER',
    2: 'PERDE II // İÇ KATMANLAR',
    3: 'PERDE III // KÖK BÖLGESİ',
  };
  const WHISPERS = [
    'SENİ İÇERİ ALDIĞIMIZ İÇİN ÜZGÜNÜZ.',
    'KATMANLAR SAYIYOR. SEN SAYMA.',
    'ARKANDAKİ ADIM SESİ SENİN DEĞİL.',
    'DOSYALARINI SİLERSEN DAHA HAFİF OLURSUN.',
    'ÇIKIŞ BİR DOSYADIR.',
    'BURADA NEFES ALMAK BİR HATA.',
    'SENİN YÜZÜN KAÇ KERE KOPYALANDI?',
    'SİSTEM SENİ TANIMIYOR. BU İYİ BİR ŞEY.',
    'AŞAĞIDA IŞIK YOK. SADECE KAPI VAR.',
    'OTURUM KAYDI BULUNAMADI. SEN KİMSİN?',
  ];
  const BOSS_POPUP_BODIES = [
    'BU PENCERE SİLİNEMEZ.\nAMA KAPATILABİLİR.',
    'YÖNETİCİ SÜRECİ HÂLÂ AKTİF.\nKALKANIN BİR PARÇASI AÇIK.',
    'SENİ İZLİYORUZ.\nPENCEREYİ KAPAT [F].',
    'ERİŞİM REDDEDİLDİ.\nISRAR ET.',
    'BİR PENCERE DAHA AÇILDI.\nBİR KATMAN DAHA KAPANDI.',
  ];

  const G = {
    mode: 'boot',
    debug: false,
    level: null,
    levelId: 1,
    map: null,
    mapW: 0,
    mapH: 0,
    player: null,
    enemies: [],
    projectiles: [],
    dataOrbs: [],
    pickups: [],
    exits: [],
    terminals: [],
    spawnCells: [],
    openCells: [],
    usedSpawns: new Set(),
    boss: null,
    bossDead: false,
    timeScale: 1,
    keys: Object.create(null),
    firing: false,
    pointerLocked: false,
    expectUnlock: false,
    allowFreeAim: false,
    levelTime: 0,
    gtime: 0,
    animTime: 0,
    kills: 0,
    totalKills: 0,
    deaths: 0,
    exitOpen: false,
    exitReason: '',
    objectiveText: '',
    flashlight: false,
    flashlightLevel: 1,
    doors: [],
    itemPickups: [],
    interactDoor: null,
    checkpointTimer: 0,
    saveCorrupt: false,
    saveRecovered: false,
    fileConsole: {
      open: false, file: '', content: '', status: '', source: '', targetDoor: null,
    },
    keypadOpen: false,
    puzzleChallenge: {
      active: false, remaining: 60, levelId: 0, deadline: 0, reason: '', expired: false,
      solved: false, paused: false, solvedReasons: Object.create(null),
    },
    bsodActive: false,
    inventoryTab: 'items',
    selectedItem: null,
    selectedNote: null,
    wave: 0,
    waveTotal: 0,
    waveGroups: [],
    wavePending: false,
    waveTimer: 0,
    pendingLevel: null,
    files: {
      active: false,
      names: [],
      status: {},
      remaining: 0,
      prepared: false,
      unlocked: false,
      timer: null,
      levelId: 0,
      final: false,
    },
    finale: {
      active: false,
      fileName: '',
      deleted: false,
      timer: null,
      started: false,
      path: '',
    },
    popups: new Map(),
    popupSeq: 0,
    popupsFired: new Set(),
    qte: { active: false, seq: [], idx: 0, time: 0, next: 14, timer: 0 },
    freezeTimer: 0,
    freezeCd: 20,
    weapon: 0,
    allowed: [0],
    cooldown: 0,
    heat: 0,
    overheat: false,
    swing: 0,
    recoil: 0,
    flash: 0,
    muzzle: 0,
    switchAnim: 0,
    style: 0,
    combo: 0,
    comboTimer: 0,
    styleIdle: 0,
    lastHud: 0,
    lastFrame: 0,
    noiseAcc: 0,
    whisperTimer: 18,
    ambientGlitch: 28,
    shake: 0,
    shakeTime: 0,
    hitmarkerTimer: 0,
    bossBlockCooldown: 0,
    interactTarget: null,
    panel: null,
    panelFrom: null,
    completedLevel: 0,
    fakeEndTimer: null,
    endingStarted: false,
    bootTimers: [],
    bootReady: false,
    lastObjectiveRefresh: 0,
    audioReady: false,
    touchSpawn: 0,
    hudWarned: false,

    // --- meta-fiction layer ------------------------------------------------
    meta: {
      ready: false,
      user: 'OPERATÖR',
      host: 'LIMBO-HOST',
      platform: 'linux',
      baseMs: Date.now(),
      sampleMs: performance.now(),
      terminated: false,
      tokenFound: false,
      tokenPhrase: 'LIMBO_RESET_0x0009',
      tokenLocations: [],
      helperPath: '',
      stateDir: '',
      lastMinuteKey: '',
      lastClockSecond: -1,
      spillNext: 64,
      spillCount: 0,
      wallpaperNext: 120,
      tokenTimer: null,
    },
    cursorMode: false,
    hitboxes: false,
    mapOpen: false,
    mapZoom: 1,
    mapPanX: 0,
    mapPanY: 0,
    mapExplore: new Set(),
    mapDrawnAt: 0,
    mapExploreTimer: 0,
    camera: {
      third: false,
      blend: 0,
      dist: 2.45,
    },
    takeover: {
      active: false,
      levelId: 0,
      timers: [],
      token: 0,
      scene: null,
      lineIndex: 0,
      typed: '',
      target: '',
    },
    takeoverDone: new Set(),
    hazard: {
      type: '',
      name: '',
      desc: '',
      variant: '',
      timer: 30,
      active: 0,
      buff: '',
    },
    kernel: {
      active: false,
      timer: null,
    },
    gpuTimer: null,
    effectsTimers: [],
  };

  const settings = {
    sens: 1,
    volume: 70,
    popups: 2,
    crt: true,
    shake: true,
    fullscreen: false,
    spill: false,
    wallpaper: false,
    takeover: true,
  };
  const progress = {
    completed: [],
    last: 1,
    started: false,
    deaths: 0,
    items: [],
    notes: [],
    doors: {},
    puzzles: {},
    checkpoint: null,
  };

  // --------------------------------------------------------------- utilities
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, '0');
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const isWallChar = (ch) => WALLS.has(ch);
  const nowSeconds = () => performance.now() / 1000;

  function replaceUser(text) {
    return String(text == null ? '' : text).replace(/\$USER/g, G.meta.user || 'OPERATÖR');
  }

  function pulseScreen(className, ms = 500) {
    document.body.classList.add(className);
    const timer = setTimeout(() => document.body.classList.remove(className), Math.max(80, ms));
    G.effectsTimers.push(timer);
    while (G.effectsTimers.length > 24) clearTimeout(G.effectsTimers.shift());
  }

  function refreshMeta(force = false) {
    if (!window.limboOS) {
      G.meta.ready = true;
      setText('sideUser', G.meta.user.toUpperCase());
      return Promise.resolve(G.meta);
    }
    const now = performance.now();
    if (!force && G.meta.ready && now - (G.meta.lastSync || 0) < 15000) return Promise.resolve(G.meta);
    G.meta.lastSync = now;
    return Promise.all([
      window.limboOS.metaInfo().catch(() => null),
      window.limboOS.metaState().catch(() => null),
    ]).then(([info, state]) => {
      if (info) {
        G.meta.user = info.user || G.meta.user;
        G.meta.host = info.host || G.meta.host;
        G.meta.platform = info.platform || G.meta.platform;
        G.meta.baseMs = Date.now();
        G.meta.sampleMs = performance.now();
        G.meta.stateDir = info.stateDir || '';
        if (info.resetPhrase) G.meta.tokenPhrase = info.resetPhrase;
      }
      if (state) {
        G.meta.terminated = Boolean(state.terminated);
        G.meta.tokenFound = Boolean(state.tokenFound);
        G.meta.tokenPhrase = state.tokenPhrase || G.meta.tokenPhrase;
        G.meta.tokenLocations = Array.isArray(state.tokenLocations) ? state.tokenLocations : [];
        G.meta.helperPath = state.helperPath || G.meta.helperPath;
        G.meta.stateDir = state.stateDir || G.meta.stateDir;
      }
      G.meta.ready = true;
      setText('sideUser', String(G.meta.user || 'OPERATÖR').toUpperCase());
      return G.meta;
    }).catch(() => {
      G.meta.ready = true;
      return G.meta;
    });
  }

  function updateSystemClock() {
    const real = new Date(G.meta.baseMs + (performance.now() - G.meta.sampleMs));
    const clock = `${pad2(real.getHours())}:${pad2(real.getMinutes())}:${pad2(real.getSeconds())}`;
    if (real.getSeconds() !== G.meta.lastClockSecond) {
      G.meta.lastClockSecond = real.getSeconds();
      setText('sideClock', clock);
    }
    const minuteKey = `${real.getFullYear()}-${real.getMonth()}-${real.getDate()}-${real.getHours()}-${real.getMinutes()}`;
    if (minuteKey !== G.meta.lastMinuteKey) {
      G.meta.lastMinuteKey = minuteKey;
      if (real.getHours() === 0 && real.getMinutes() === 0) triggerTimeEvent('midnight');
      else if (real.getHours() === 3 && real.getMinutes() === 0) triggerTimeEvent('three');
    }
  }

  function triggerTimeEvent(name) {
    const pool = CONTENT.TIME_EVENTS && CONTENT.TIME_EVENTS[name];
    if (!pool || !pool.length) return;
    const line = replaceUser(pool[Math.floor(Math.random() * pool.length)]);
    showSubtitle('// SİSTEM SAATİ', line, 9000);
    showNotify(name === 'midnight' ? '00:00 // TARİH DEĞİŞTİ' : '03:00 // SİSTEM UYANDI', 'warn', 5200);
    triggerGlitch();
    pulseScreen('screen-shrink', 900);
    sfx('clock');
    if (G.mode === 'playing') {
      spawnExternalPopup({
        title: name === 'midnight' ? 'GECE YARISI' : '03:00',
        tag: 'SYSTEM_CLOCK',
        severity: 'ghost',
        body: line,
        buttons: ['TAMAM'],
        life: 16000,
      });
    }
  }

  function maybeTriggerSpill(force = false) {
    if (!window.limboOS || !settings.spill) return;
    if (!force && G.mode !== 'playing') return;
    const messages = CONTENT.SPILL_MESSAGES || ['BUNU SEN Mİ YAZDIN, $USER?'];
    const msg = replaceUser(messages[Math.floor(Math.random() * messages.length)]);
    window.limboOS.spill({ message: msg, kind: Math.random() < 0.34 ? 'bin' : 'txt' })
      .then((res) => {
        if (!res || !res.ok) return;
        G.meta.spillCount++;
        showFeed('BİR DOSYA MASAÜSTÜNE BIRAKILDI // .LIMBO', 'warn');
        showNotify('SENİN İÇİN BİR DOSYA BIRAKTIK', 'warn', 4200);
        sfx('fileDeleted');
      }).catch(() => {});
  }

  function maybeTriggerWallpaper(force = false) {
    if (!window.limboOS || !settings.wallpaper) return;
    if (!force && G.mode !== 'playing') return;
    const bleed = $('wallpaper-bleed');
    window.limboOS.wallpaperGlitch().then((res) => {
      if (!res || !res.ok) return;
      if (bleed) {
        bleed.classList.remove('active');
        void bleed.offsetWidth;
        bleed.classList.add('active');
        setTimeout(() => bleed.classList.remove('active'), res.simulated ? 2400 : 4000);
      }
      pulseScreen('screen-shake', 520);
      triggerGlitch();
      sfx('wallpaper');
      showFeed(res.simulated ? 'ARKA PLAN SİMÜLASYONU ÇALIŞTI.' : 'SİSTEM ARKA PLANI YENİDEN YAZILDI.', 'bad');
      showNotify('WALLPAPER_0x0009 // GERİ YÜKLENECEK', 'warn', 4800);
      if (!res.simulated) setTimeout(() => { try { window.limboOS.wallpaperRestore(); } catch (_) {} }, 4600);
    }).catch(() => {});
  }

  function scheduleMetaEvents(dtReal) {
    if (G.meta.terminated) return;
    if (settings.spill && G.mode === 'playing' && G.levelId >= 2) {
      G.meta.spillNext -= dtReal;
      if (G.meta.spillNext <= 0) {
        G.meta.spillNext = rand(58, 118);
        maybeTriggerSpill();
      }
    }
    if (settings.wallpaper && G.mode === 'playing' && G.levelId >= 3) {
      G.meta.wallpaperNext -= dtReal;
      if (G.meta.wallpaperNext <= 0) {
        G.meta.wallpaperNext = rand(120, 220);
        maybeTriggerWallpaper();
      }
    }
  }

  function setText(id, text) {
    const el = $(id);
    if (el && el.textContent !== text) el.textContent = text;
  }
  function toggleHidden(id, hidden) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', Boolean(hidden));
  }
  function setStyle(id, prop, value) {
    const el = $(id);
    if (el) el.style[prop] = value;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function sanitizeIdList(value, table, limit = 64) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const id of value) {
      if (typeof id === 'string' && table[id] && !out.includes(id)) out.push(id);
      if (out.length >= limit) break;
    }
    return out;
  }

  function sanitizeFlagMap(value, limit = 128) {
    const out = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    let count = 0;
    for (const key of Object.keys(value)) {
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(key)) continue;
      if (typeof value[key] === 'boolean') out[key] = value[key];
      else if (typeof value[key] === 'number' && Number.isFinite(value[key])) out[key] = value[key];
      else if (typeof value[key] === 'string' && value[key].length <= 200) out[key] = value[key];
      else continue;
      if (++count >= limit) break;
    }
    return out;
  }

  function applyProgressData(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
    if (Array.isArray(saved.completed)) {
      progress.completed = saved.completed.filter((n) => Number.isInteger(n) && n >= 1 && n <= 15);
    }
    progress.last = clamp(Number(saved.last) || 1, 1, 15);
    progress.started = Boolean(saved.started);
    progress.deaths = Math.max(0, Number(saved.deaths) || 0);
    progress.items = sanitizeIdList(saved.items, CONTENT.ITEMS);
    progress.notes = sanitizeIdList(saved.notes, CONTENT.NOTES);
    progress.doors = sanitizeFlagMap(saved.doors);
    progress.puzzles = sanitizeFlagMap(saved.puzzles);
    const cp = saved.checkpoint;
    if (cp && Number.isInteger(cp.levelId) && cp.levelId >= 1 && cp.levelId <= 15
      && Number.isFinite(Number(cp.x)) && Number.isFinite(Number(cp.y))) {
      progress.checkpoint = {
        levelId: cp.levelId,
        x: Number(cp.x), y: Number(cp.y),
        angle: Number.isFinite(Number(cp.angle)) ? Number(cp.angle) : 0,
        at: Number(cp.at) || 0,
      };
    } else {
      progress.checkpoint = null;
    }
  }

  function applySettingsData(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return;
    settings.sens = clamp(Number(s.sens) || 1, 0.25, 2.5);
    settings.volume = clamp(Number(s.volume) || 70, 0, 100);
    settings.popups = clamp(Number(s.popups), 0, 2);
    if (!Number.isFinite(settings.popups)) settings.popups = 2;
    settings.crt = s.crt !== false;
    settings.shake = s.shake !== false;
    settings.fullscreen = Boolean(s.fullscreen);
    settings.spill = Boolean(s.spill);
    settings.wallpaper = Boolean(s.wallpaper);
    settings.takeover = s.takeover !== false;
  }

  function loadState() {
    applyProgressData(loadJSON(SAVE_KEY, null));
    applySettingsData(loadJSON(SETTINGS_KEY, null));
  }

  let saveFileTimer = null;
  let saveFileWriting = false;
  let saveFileDirty = false;

  function savePayload() {
    return {
      version: GAME_SAVE_VERSION,
      savedAt: new Date().toISOString(),
      progress: {
        completed: progress.completed.slice(),
        last: progress.last,
        started: progress.started,
        deaths: progress.deaths,
        items: progress.items.slice(),
        notes: progress.notes.slice(),
        doors: Object.assign({}, progress.doors),
        puzzles: Object.assign({}, progress.puzzles),
        checkpoint: progress.checkpoint ? Object.assign({}, progress.checkpoint) : null,
      },
      settings: {
        sens: settings.sens,
        volume: settings.volume,
        popups: settings.popups,
        crt: settings.crt,
        shake: settings.shake,
        fullscreen: settings.fullscreen,
        spill: settings.spill,
        wallpaper: settings.wallpaper,
        takeover: settings.takeover,
      },
    };
  }

  function scheduleFileSave(delay = 650) {
    if (!window.limboOS || !window.limboOS.writeSave) return;
    if (saveFileTimer) clearTimeout(saveFileTimer);
    saveFileTimer = setTimeout(() => {
      saveFileTimer = null;
      flushFileSave();
    }, Math.max(120, delay));
  }

  function flushFileSave() {
    if (!window.limboOS || !window.limboOS.writeSave) return;
    if (saveFileWriting) {
      saveFileDirty = true;
      return;
    }
    saveFileWriting = true;
    saveFileDirty = false;
    window.limboOS.writeSave(savePayload()).then((res) => {
      if (!res || !res.ok) {
        G.saveWriteFailed = true;
      } else {
        G.saveWriteFailed = false;
      }
    }).catch(() => {
      G.saveWriteFailed = true;
    }).finally(() => {
      saveFileWriting = false;
      if (saveFileDirty) {
        saveFileDirty = false;
        scheduleFileSave(250);
      }
    });
  }

  function applySavePayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.progress) applyProgressData(data.progress);
    if (data.settings) applySettingsData(data.settings);
    return true;
  }

  async function loadGameState() {
    loadState();
    if (!window.limboOS || !window.limboOS.loadSave) return;
    try {
      const res = await window.limboOS.loadSave();
      if (res && res.ok && res.data) {
        applySavePayload(res.data);
        G.saveRecovered = Boolean(res.recovered);
        if (G.saveRecovered) G.saveCorrupt = true;
      } else if (res && res.corrupt) {
        G.saveCorrupt = true;
      }
    } catch (_) {
      // The localStorage copy remains the fallback; never block boot on disk IO.
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch (_) {}
    scheduleFileSave();
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
    scheduleFileSave();
  }

  function resetGameProgress() {
    progress.completed = [];
    progress.last = 1;
    progress.started = false;
    progress.deaths = 0;
    progress.items = [];
    progress.notes = [];
    progress.doors = {};
    progress.puzzles = {};
    progress.checkpoint = null;
    G.saveCorrupt = false;
    G.saveRecovered = false;
    G.flashlight = false;
    G.bsodActive = false;
    G.fileConsole.open = false;
    G.keypadOpen = false;
    resetPuzzleChallenge();
    toggleHidden('fileConsole', true);
    toggleHidden('keypad', true);
    toggleHidden('bsod', true);
    const bsodBar = $('bsodBar');
    if (bsodBar) bsodBar.style.width = '0%';
    setText('bsodPercent', '0');
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    if (saveFileTimer) { clearTimeout(saveFileTimer); saveFileTimer = null; }
    if (window.limboOS) {
      if (window.limboOS.clearSave) window.limboOS.clearSave().catch(() => {});
      if (window.limboOS.sandboxClear) {
        window.limboOS.sandboxClear([
          'SEKTOR_09.lock',
          'GHOST_001.ghost', 'GHOST_002.ghost', 'GHOST_003.ghost',
        ]).catch(() => {});
      }
    }
    updateMenuInfo();
  }

  function markCompleted(levelId) {
    if (!progress.completed.includes(levelId)) {
      progress.completed.push(levelId);
      progress.completed.sort((a, b) => a - b);
    }
    progress.last = clamp(Math.max(progress.last, levelId + 1), 1, 15);
    saveProgress();
  }
  function nextPlayableLevel() {
    if (progress.completed.length >= 15) return 15;
    return progress.last || 1;
  }

  // --------------------------------------------------------------- UI / overlays
  function hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
  }
  function showOverlay(id) {
    hideAllOverlays();
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }
  function showHUD(visible) {
    toggleHidden('hud', !visible);
    if (!visible) {
      toggleHidden('interactPrompt', true);
      toggleHidden('qtePanel', true);
      toggleHidden('popupAlert', true);
      toggleHidden('bossBar', true);
    }
  }
  function setMode(mode) {
    G.mode = mode;
    document.body.dataset.mode = mode;
    updateHitboxBadge();
  }
  function updateHitboxBadge() {
    const active = G.hitboxes && (G.mode === 'playing' || G.mode === 'paused');
    toggleHidden('hitboxBadge', !active);
    document.body.classList.toggle('hitboxes-on', active);
  }
  function toggleHitboxes(force) {
    G.hitboxes = force === undefined ? !G.hitboxes : Boolean(force);
    updateHitboxBadge();
    if (G.mode === 'playing' || G.mode === 'paused') {
      showNotify(G.hitboxes ? 'HITBOX KATMANI AÇIK // F3' : 'HITBOX KATMANI KAPALI // F3', '', 1600);
      sfx(G.hitboxes ? 'unlock' : 'click');
    }
  }
  function applyTheme(theme) {
    if (!theme) return;
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-2', theme.accent2);
    document.documentElement.style.setProperty('--grade', theme.grade);
    document.documentElement.style.setProperty('--glitch', String(theme.glitch == null ? 0.04 : theme.glitch));
    setStyle('color-grade', 'background', theme.grade);
  }
  function resetTheme() {
    document.documentElement.style.setProperty('--accent', '#b8ff5a');
    document.documentElement.style.setProperty('--accent-2', '#42ffd0');
    document.documentElement.style.setProperty('--grade', 'transparent');
    document.documentElement.style.setProperty('--glitch', '0.04');
  }

  function showFeed(text, kind = '') {
    const feed = $('messageFeed');
    if (!feed || !text) return;
    const item = document.createElement('div');
    item.className = 'feed-item ' + kind;
    item.textContent = text;
    feed.appendChild(item);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 420);
    }, 4200);
  }

  function showNotify(text, kind = '', life = 3200) {
    const box = $('notifications');
    if (!box || !text) return;
    const item = document.createElement('div');
    item.className = 'notification ' + kind;
    item.textContent = text;
    box.appendChild(item);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 420);
    }, life);
  }

  let toastTimer = null;
  function showToast(text, life = 2800) {
    const el = $('objectiveToast');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), life);
  }

  let subtitleTimer = null;
  function showSubtitle(speaker, text, life = 5200) {
    const box = $('subtitle');
    if (!box) return;
    setText('subSpeaker', speaker || '// SİSTEM');
    setText('subText', text);
    box.classList.remove('hidden');
    clearTimeout(subtitleTimer);
    subtitleTimer = setTimeout(() => box.classList.add('hidden'), life);
  }

  function triggerGlitch() {
    const layer = $('glitch-layer');
    if (!layer) return;
    layer.classList.remove('active');
    void layer.offsetWidth;
    layer.classList.add('active');
    const bars = layer.querySelectorAll('.gbar');
    bars.forEach((bar) => {
      bar.style.top = rand(4, 92) + '%';
      bar.style.height = (Math.random() < 0.3 ? rand(2, 7) : rand(1, 3)) + 'px';
      bar.style.background = Math.random() < 0.5 ? 'var(--accent)' : 'var(--danger)';
    });
    try { if (G.audioReady) LimboAudio.setGlitch(0.45); } catch (_) {}
    const theme = G.level ? CONTENT.THEMES[G.level.theme] : null;
    const intensity = (theme && theme.glitch) || 0.1;
    if (G.mode === 'playing' && Math.random() < 0.04 + intensity * 0.16) flashGpu(rand(320, 720));
    setTimeout(() => layer.classList.remove('active'), 620);
  }

  function flashDamage() {
    const el = $('damage-flash');
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0.9';
    void el.offsetWidth;
    el.style.transition = 'opacity .5s ease-out';
    el.style.opacity = '0';
  }
  function flashFreeze() {
    const el = $('freeze-flash');
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0.75';
    void el.offsetWidth;
    el.style.transition = 'opacity .9s ease';
    el.style.opacity = '0';
  }
  function hitmarker() {
    const el = $('hitmarker');
    if (!el) return;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function addShake(amount) {
    if (!settings.shake) return;
    G.shake = Math.max(G.shake, amount);
  }

  // --------------------------------------------------------------- cursor / camera / map
  function setCursorMode(on, notify = true) {
    const want = Boolean(on);
    if (G.cursorMode === want) return;
    G.cursorMode = want;
    document.body.classList.toggle('cursor-mode', want);
    toggleHidden('cursorModeBanner', !want);
    G.firing = false;
    G.keys = Object.create(null);
    if (want) {
      releasePointer();
      sfx('cursorOn');
      if (notify) showFeed('FARE MODU // HARİCİ PENCERELER AKTİF. T İLE NİŞAN AL.', 'warn');
    } else {
      if (G.mode === 'playing' && !G.mapOpen && !G.takeover.active) requestPointer();
      sfx('cursorOff');
      if (notify) showNotify('NİŞAN MODU // FARE KİLİTLENDİ', '', 1500);
    }
  }

  function toggleCamera() {
    if (G.mode !== 'playing') return;
    G.camera.third = !G.camera.third;
    document.body.classList.toggle('third-person', G.camera.third);
    toggleHidden('cameraBadge', !G.camera.third);
    if (G.camera.third) setText('cameraBadge', '3. ŞAHIS');
    sfx('camera');
    showNotify(G.camera.third ? 'KAMERA // 3. ŞAHIS' : 'KAMERA // 1. ŞAHIS', '', 1700);
  }

  function markExplored(radius = 3.4) {
    const p = G.player;
    if (!p || !G.map) return;
    const r = Math.ceil(radius);
    for (let y = Math.floor(p.y) - r; y <= Math.floor(p.y) + r; y++) {
      for (let x = Math.floor(p.x) - r; x <= Math.floor(p.x) + r; x++) {
        if (x < 0 || y < 0 || x >= G.mapW || y >= G.mapH) continue;
        if (dist(x + 0.5, y + 0.5, p.x, p.y) > radius) continue;
        G.mapExplore.add(`${x},${y}`);
      }
    }
  }

  function mapExplorePercent() {
    if (!G.openCells || !G.openCells.length) return 0;
    let seen = 0;
    for (const c of G.openCells) {
      if (G.mapExplore.has(`${c.x},${c.y}`)) seen++;
    }
    return Math.round((seen / G.openCells.length) * 100);
  }

  function toggleMap(open) {
    if (G.mode !== 'playing' || G.takeover.active || G.kernel.active) return;
    const want = open === undefined ? !G.mapOpen : Boolean(open);
    if (want === G.mapOpen) return;
    if (want && G.puzzleChallenge.active) {
      showNotify('PUZZLE SÜRESİ İŞLİYOR // HARİTA KAPALI', 'warn', 2400);
      sfx('denied');
      return;
    }
    G.mapOpen = want;
    document.body.classList.toggle('map-open', want);
    toggleHidden('mapOverlay', !want);
    if (want) {
      G.keys = Object.create(null);
      G.firing = false;
      releasePointer();
      const lv = G.level;
      if (lv) setText('mapTitle', `${pad2(lv.id)} // ${lv.name.toUpperCase()}`);
      markExplored(4.2);
      drawMap(true);
      sfx('mapOpen');
    } else {
      if (!G.cursorMode) requestPointer();
      sfx('mapClose');
    }
  }

  function drawMap(force = false) {
    if (!G.mapOpen || !G.map || !G.player) return;
    const now = performance.now();
    if (!force && now - G.mapDrawnAt < 110) return;
    G.mapDrawnAt = now;
    const canvas = $('mapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#020602';
    ctx.fillRect(0, 0, cw, ch);
    // blueprint grid
    ctx.strokeStyle = 'rgba(184,255,90,.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let y = 0; y < ch; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }
    const base = Math.min((cw - 96) / G.mapW, (ch - 64) / G.mapH) * 0.92;
    const cell = base * G.mapZoom;
    const ox = cw / 2 - (G.mapW * cell) / 2 + G.mapPanX * cell;
    const oy = ch / 2 - (G.mapH * cell) / 2 + G.mapPanY * cell;

    const explored = G.mapExplore;
    const nearExplored = (x, y) => {
      if (explored.has(`${x},${y}`)) return true;
      return explored.has(`${x - 1},${y}`) || explored.has(`${x + 1},${y}`) ||
        explored.has(`${x},${y - 1}`) || explored.has(`${x},${y + 1}`);
    };

    for (let y = 0; y < G.mapH; y++) {
      for (let x = 0; x < G.mapW; x++) {
        const px0 = ox + x * cell;
        const py0 = oy + y * cell;
        if (px0 > cw || py0 > ch || px0 + cell < 0 || py0 + cell < 0) continue;
        const ch2 = G.map[y][x];
        const wall = isWallChar(ch2);
        const seen = wall ? nearExplored(x, y) : explored.has(`${x},${y}`);
        if (!seen) continue;
        if (wall) {
          ctx.fillStyle = 'rgba(114,138,93,.28)';
          ctx.fillRect(px0, py0, Math.max(1, cell - 0.6), Math.max(1, cell - 0.6));
          ctx.strokeStyle = 'rgba(160,196,126,.16)';
          ctx.strokeRect(px0 + 0.5, py0 + 0.5, cell - 1.4, cell - 1.4);
        } else {
          ctx.fillStyle = ch2 === '~' ? 'rgba(255,75,69,.16)' : 'rgba(9,24,10,.9)';
          ctx.fillRect(px0 + 0.6, py0 + 0.6, Math.max(1, cell - 1.2), Math.max(1, cell - 1.2));
          if (cell > 14) {
            ctx.strokeStyle = 'rgba(184,255,90,.08)';
            ctx.strokeRect(px0 + 1, py0 + 1, cell - 2, cell - 2);
          }
        }
      }
    }

    // static points of interest
    const marker = (x, y, color, label, size) => {
      const cx = ox + (x + 0.5) * cell;
      const cy = oy + (y + 0.5) * cell;
      ctx.fillStyle = color;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - size, cy - size, size * 2, size * 2);
      ctx.font = `${Math.max(9, Math.round(cell * 0.5))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy - size * 1.7);
    };
    for (const t of G.terminals) marker(t.x, t.y, '#ff6a6a', G.level && G.level.final ? 'KÖK' : 'T', 5);
    for (const g of G.exits) marker(g.x, g.y, G.exitOpen ? '#b8ff5a' : '#5e7256', 'Ç', 5);
    for (const item of G.pickups) if (!item.taken) marker(item.x, item.y, '#8fd7ff', 'A', 3);

    // enemy danger points (live)
    const t = now / 1000;
    let danger = 0;
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      const ex = Math.floor(e.x);
      const ey = Math.floor(e.y);
      if (!nearExplored(ex, ey) && dist(e.x, e.y, G.player.x, G.player.y) > 7) continue;
      danger++;
      const cx = ox + e.x * cell;
      const cy = oy + e.y * cell;
      const pulse = 1 + Math.sin(t * 4 + e.x) * 0.35;
      ctx.fillStyle = e.boss ? '#ff2d8a' : '#ff4b45';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2.2, cell * 0.22 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,75,69,.34)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, cell * (0.42 + Math.sin(t * 2.2 + e.y) * 0.08)), 0, Math.PI * 2);
      ctx.stroke();
    }

    // player heading
    const p = G.player;
    const px = ox + p.x * cell;
    const py = oy + p.y * cell;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#eaffd9';
    ctx.beginPath();
    ctx.moveTo(0, -Math.max(5, cell * 0.36));
    ctx.lineTo(Math.max(4, cell * 0.26), Math.max(4, cell * 0.26));
    ctx.lineTo(-Math.max(4, cell * 0.26), Math.max(4, cell * 0.26));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    setText('mapZoom', `ZOOM ${G.mapZoom.toFixed(2)}x`);
    setText('mapDanger', `TEHDİT ${danger}`);
    setText('mapExplore', `KEŞİF %${mapExplorePercent()}`);
  }

  // --------------------------------------------------------------- scripted takeover
  function clearTakeoverTimers() {
    for (const timer of G.takeover.timers) clearTimeout(timer);
    G.takeover.timers = [];
  }

  function moveTakeoverCursor() {
    const cursor = $('takeoverCursor');
    const click = $('takeoverClick');
    if (!cursor) return;
    const lx = rand(18, 74);
    const ty = rand(28, 66);
    cursor.style.left = lx + '%';
    cursor.style.top = ty + '%';
    if (click) {
      click.style.left = `calc(${lx}% + 8px)`;
      click.style.top = `calc(${ty}% + 10px)`;
      const timer = setTimeout(() => {
        click.classList.remove('active');
        void click.offsetWidth;
        click.classList.add('active');
      }, 380);
      G.takeover.timers.push(timer);
    }
  }

  function scheduleTakeover(lv) {
    if (!settings.takeover || G.debug || !lv || !CONTENT.TAKEOVER_SCENES || !CONTENT.TAKEOVER_SCENES[lv.id]) return;
    if (G.takeoverDone.has(lv.id)) return;
    const token = ++G.takeover.token;
    const timer = setTimeout(() => {
      if (G.takeover.token !== token) return;
      if (G.levelId !== lv.id || G.mode !== 'playing') return;
      startTakeover(lv.id);
    }, lv.id === 15 ? 4200 : 6200);
    G.effectsTimers.push(timer);
  }

  function startTakeover(levelId) {
    if (G.takeover.active || G.mode !== 'playing' || G.kernel.active) return;
    if (G.mapOpen) toggleMap(false);
    const scene = CONTENT.TAKEOVER_SCENES && CONTENT.TAKEOVER_SCENES[levelId];
    if (!scene) return;
    G.takeoverDone.add(levelId);
    G.takeover.active = true;
    G.takeover.levelId = levelId;
    G.takeover.scene = scene;
    G.takeover.lineIndex = 0;
    G.takeover.typed = '';
    G.takeover.target = '';
    G.takeover.timers = [];
    G.keys = Object.create(null);
    G.firing = false;
    releasePointer();
    const layer = $('takeover');
    if (layer) {
      layer.classList.remove('hidden');
      layer.setAttribute('aria-hidden', 'false');
    }
    setText('takeoverTag', scene.tag || 'AUTO_EXEC');
    setText('takeoverHint', 'GİRDİLERİNİZ YENİDEN YAZILIYOR // T İLE KES');
    const log = $('takeoverLog');
    if (log) log.replaceChildren();
    setText('takeoverText', '');
    moveTakeoverCursor();
    sfx('takeover');
    showFeed('KONTROL SİSTEME DEVREDİLDİ.', 'bad');
    pulseScreen('screen-shake', 420);
    triggerGlitch();
    const timer = setTimeout(() => runTakeoverLine(0), 520);
    G.takeover.timers.push(timer);
  }

  function runTakeoverLine(index) {
    if (!G.takeover.active) return;
    const scene = G.takeover.scene;
    if (!scene || index >= scene.lines.length) {
      finishTakeover(false);
      return;
    }
    const target = replaceUser(scene.lines[index]);
    G.takeover.lineIndex = index;
    G.takeover.target = target;
    G.takeover.typed = '';
    setText('takeoverText', '');
    moveTakeoverCursor();
    sfx('click');
    let pos = 0;
    const typeNext = () => {
      if (!G.takeover.active) return;
      if (pos >= target.length) {
        const log = $('takeoverLog');
        if (log) {
          const line = document.createElement('div');
          line.textContent = `> ${target}`;
          log.appendChild(line);
          log.scrollTop = log.scrollHeight;
        }
        setText('takeoverText', '');
        const next = setTimeout(() => {
          if (!G.takeover.active) return;
          if (index + 1 >= scene.lines.length) {
            setText('takeoverHint', 'T // KONTROLÜ GERİ AL');
            const hold = setTimeout(() => finishTakeover(false), 2200);
            G.takeover.timers.push(hold);
          } else {
            runTakeoverLine(index + 1);
          }
        }, 520);
        G.takeover.timers.push(next);
        return;
      }
      G.takeover.typed += target[pos];
      setText('takeoverText', G.takeover.typed);
      if (pos % 3 === 0) sfx('type');
      pos++;
      const timer = setTimeout(typeNext, 28 + Math.random() * 42);
      G.takeover.timers.push(timer);
    };
    typeNext();
  }

  function finishTakeover(interrupted) {
    if (!G.takeover.active) return;
    G.takeover.active = false;
    G.takeover.token++;
    clearTakeoverTimers();
    const layer = $('takeover');
    if (layer) {
      layer.classList.add('hidden');
      layer.setAttribute('aria-hidden', 'true');
    }
    setText('takeoverText', '');
    const log = $('takeoverLog');
    if (log) log.replaceChildren();
    sfx('takeoverEnd');
    if (interrupted) {
      showNotify('KONTROL GERİ ALINDI // KLAVYE SENDE', '', 3200);
    } else {
      showNotify('OTOMATİK GİRDİ TAMAMLANDI // İZLENDİ', 'warn', 4200);
    }
    if (G.mode === 'playing') {
      if (!G.cursorMode && !G.mapOpen) requestPointer();
      G.lastFrame = performance.now();
    }
  }

  // --------------------------------------------------------------- per-level hazards
  function initHazard(lv) {
    G.hazard = {
      type: lv.hazard || '',
      name: lv.hazardName || 'BİLİNMİYOR',
      desc: lv.hazardDesc || '',
      variant: lv.variant || 'STANDART',
      timer: rand(20, 30),
      active: 0,
      buff: '',
    };
    setText('sideHazard', `${G.hazard.variant} // ${G.hazard.name}`);
    if (lv.hazard) {
      const timer = setTimeout(() => {
        if (G.levelId !== lv.id || G.mode !== 'playing') return;
        showSubtitle('// KATMAN TEHDİDİ', `${lv.hazardName}: ${lv.hazardDesc}`, 7000);
        showFeed(`TEHDİT: ${lv.variant} // ${lv.hazardName}`, 'warn');
      }, 4200);
      G.effectsTimers.push(timer);
    }
  }

  function hazardSpawnEnemy(typeKey, distance = 5.5) {
    const list = G.level && G.level.enemies && G.level.enemies.length ? G.level.enemies : ['crawler'];
    const kind = typeKey || list[Math.floor(Math.random() * list.length)];
    const pos = randomOpenCell(distance, true);
    const e = spawnEnemy(kind, pos.x + rand(-0.2, 0.2), pos.y + rand(-0.2, 0.2), { burst: true });
    if (e) {
      e.spawnGrace = Math.min(e.spawnGrace, 1.4);
      e.hp *= 0.65;
      e.maxHp = e.hp;
    }
    return e;
  }

  function triggerHazard() {
    if (G.mode !== 'playing' || G.takeover.active || G.kernel.active) return;
    const type = G.hazard.type;
    if (!type) return;
    G.hazard.timer = rand(28, 46);
    G.hazard.active = 0;
    G.hazard.buff = '';
    sfx('hazard');
    addShake(4);
    triggerGlitch();
    switch (type) {
      case 'echo':
        hazardSpawnEnemy();
        showNotify('YANKI // BİR VARLIK DAHA DUYDU', 'warn', 4200);
        break;
      case 'hunt':
        G.hazard.active = 9;
        G.hazard.buff = 'hunt';
        showNotify('AV PROTOKOLÜ // VARLIKLAR HIZLANDI', 'bad', 4800);
        break;
      case 'glitch':
        if (G.player) G.player.angle += rand(-0.75, 0.75);
        flashGpu(900);
        showNotify('GÖRÜŞ AÇISI BOZULDU', 'bad', 4200);
        break;
      case 'windows':
        spawnExternalPopup({
          title: 'PENCERE BASKISI',
          tag: 'ADMIN_WINDOW',
          severity: 'warn',
          body: replaceUser('$USER, bu pencereyi sen açmadın.\nYine de kapatmayı dene.'),
          buttons: ['KAPAT', 'BEKLE'],
          life: 13000,
        });
        showNotify('HARİCİ PENCERE BASKISI', 'warn', 3600);
        break;
      case 'light':
        flashFreeze();
        pulseScreen('screen-shrink', 700);
        showNotify('AŞIRI POZLAMA // NİŞAN BOZULDU', 'warn', 3800);
        if (G.player) G.player.pitch += rand(-12, 12);
        break;
      case 'void':
        if (G.player) {
          G.player.vz = 2.5;
          G.player.grounded = false;
          G.player.z = Math.max(0.02, G.player.z);
        }
        showNotify('YERÇEKİMİ İPTALİ', 'warn', 3600);
        break;
      case 'ghost':
        hazardSpawnEnemy('wraith', 6.2);
        showNotify('DOSYA YASASI // GÖMÜLÜ VARLIK UYANDI', 'bad', 4400);
        break;
      case 'memory':
        if (!G.qte.active) startQTE();
        showNotify('BELLEK SIZINTISI // KISA DEVRE', 'bad', 4200);
        break;
      case 'code':
        triggerKernelPanic(null, 2400);
        showFeed('SEKTÖR KODU BOZULDU // ÇEKİRDEK PANİĞİ', 'bad');
        break;
      case 'heat':
        if (G.player && G.player.grounded) damagePlayer(6, { ignoreIframe: true });
        flashDamage();
        showNotify('ÇEKİRDEK NABZI // ZEMİN ISINIYOR', 'bad', 3800);
        break;
      case 'mirror':
        hazardSpawnEnemy();
        setTimeout(() => { if (G.mode === 'playing') hazardSpawnEnemy(); }, 520);
        showNotify('KOPYA PROTOKOLÜ // ÇİFT VARLIK', 'bad', 4400);
        break;
      case 'cold':
        G.hazard.active = 8;
        G.hazard.buff = 'cold';
        G.timeScale = (G.level && G.level.slow ? 0.64 : 1) * 0.58;
        pulseScreen('screen-shrink', 1200);
        showNotify('MUTLAK SIFIR // ZAMAN YAVAŞLADI', 'warn', 4200);
        break;
      case 'siege':
        hazardSpawnEnemy();
        hazardSpawnEnemy();
        showNotify('DALGA PROTOKOLÜ // TAKVİYE GELDİ', 'bad', 4400);
        break;
      case 'root':
        hazardSpawnEnemy('wraith', 6.5);
        showNotify('KÖK BASKISI // SİSTEM SENİ İZLİYOR', 'bad', 4600);
        if (Math.random() < 0.55) triggerKernelPanic(null, 2600);
        break;
      default:
        showNotify(`${G.hazard.name} // SİSTEM DALGALANIYOR`, 'warn', 3600);
    }
  }

  function updateHazards(dtReal) {
    if (G.mode !== 'playing' || !G.level || G.takeover.active || G.kernel.active) return;
    if (G.hazard.active > 0) {
      G.hazard.active = Math.max(0, G.hazard.active - dtReal);
      if (G.hazard.active <= 0 && G.hazard.buff === 'cold') {
        G.timeScale = G.level.slow ? 0.64 : 1;
      }
      if (G.hazard.active <= 0) G.hazard.buff = '';
    }
    G.hazard.timer -= dtReal;
    if (G.hazard.timer <= 0) triggerHazard();
  }

  // --------------------------------------------------------------- GPU / kernel effects
  function flashGpu(ms = 900) {
    const layer = $('gpu-artifacts');
    if (!layer) return;
    layer.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const bar = document.createElement('div');
      bar.className = 'ga-bar';
      bar.style.top = rand(5, 92) + '%';
      bar.style.height = rand(1, 5).toFixed(1) + 'px';
      bar.style.background = Math.random() < 0.5 ? 'var(--accent-2)' : 'var(--danger)';
      layer.appendChild(bar);
    }
    for (let i = 0; i < 5; i++) {
      const block = document.createElement('div');
      block.className = 'ga-block';
      block.style.left = rand(0, 78) + '%';
      block.style.top = rand(6, 86) + '%';
      block.style.width = rand(6, 26) + '%';
      block.style.height = rand(1, 7) + '%';
      layer.appendChild(block);
    }
    layer.classList.add('active');
    document.body.classList.add('gpu-corrupt');
    clearTimeout(G.gpuTimer);
    G.gpuTimer = setTimeout(() => {
      layer.classList.remove('active');
      document.body.classList.remove('gpu-corrupt');
    }, Math.max(160, ms));
  }

  function triggerKernelPanic(lines, duration = 3800) {
    if (G.kernel.active || G.takeover.active) return;
    if (G.mapOpen) toggleMap(false);
    if (G.cursorMode) setCursorMode(false, false);
    G.kernel.active = true;
    G.firing = false;
    G.keys = Object.create(null);
    releasePointer();
    const real = new Date(G.meta.baseMs + (performance.now() - G.meta.sampleMs));
    const base = Array.isArray(lines) && lines.length ? lines.slice() : [
      '[    0.000000] LIMBO_KERNEL: oturum bütünlüğü doğrulanıyor...',
      `[    0.041009] kullanıcı: ${G.meta.user}`,
      `[    0.044112] ana bilgisayar: ${G.meta.host}`,
      `[    0.061844] saat: ${real.toISOString()}`,
      '[    0.120004] root_anomaly.bin: erişim reddedildi',
      '[    0.188721] gpu: doku belleği bozuldu (0x0009)',
      '[    0.240118] input: kullanıcı girdisi devralındı',
      '[    0.318992] bellekte kalan iz: 1',
      '[    0.409551] LIMBO_SANDBOX: bağlantı kesildi',
      `[    0.552900] ${replaceUser('$USER, bizi duyuyor musun?')}`,
      '[    0.904001] Kernel panic - not syncing: LIMBO_ANOMALY_0x0009',
      '[    0.904337] CPU: 9 PID: 0 Comm: limbo.exe Tainted: G        W',
      '[    0.905001] Error: 0x0000000000000009',
    ];
    setText('kernelLog', base.join('\n'));
    setText('crashHead', 'ELECTRON ÇALIŞMAYI DURDURDU');
    setText('crashSub', `Uygulama beklenmeyen bir sistem hatasıyla karşılaştı. Hata kodu: 0x0000009\n${replaceUser('$USER')} // oturum kurtarılamıyor.`);
    toggleHidden('kernelPanic', false);
    sfx('kernel');
    addShake(15);
    pulseScreen('screen-shake', Math.min(1200, duration));
    flashGpu(Math.min(1400, duration));
    clearTimeout(G.kernel.timer);
    G.kernel.timer = setTimeout(() => {
      G.kernel.active = false;
      toggleHidden('kernelPanic', true);
      if (G.mode === 'playing' && !G.cursorMode && !G.mapOpen) requestPointer();
    }, Math.max(900, duration));
  }

  // --------------------------------------------------------------- audio
  function initAudio() {
    if (G.audioReady) return;
    try {
      LimboAudio.init();
      G.audioReady = true;
      LimboAudio.setVolume(settings.volume / 100);
      LimboAudio.setMuted(false);
    } catch (_) {}
  }
  function sfx(name, arg) {
    try {
      if (G.audioReady) LimboAudio.play(name, arg);
    } catch (_) {}
  }
  function startLevelMusic(lv) {
    if (!G.audioReady) return;
    const theme = CONTENT.THEMES[lv.theme] || CONTENT.THEMES.awakening;
    try {
      LimboAudio.setPaused(false);
      LimboAudio.setCombat(0);
      LimboAudio.startMusic(theme.ambient, theme.pattern);
    } catch (_) {}
  }

  // --------------------------------------------------------------- settings / boot / menu
  function applySettingsUI() {
    document.body.classList.toggle('no-crt', !settings.crt);
    setText('sensValue', settings.sens.toFixed(2));
    setText('volValue', String(Math.round(settings.volume)));
    setText('popValue', settings.popups === 0 ? 'KAPALI' : settings.popups === 1 ? 'DÜŞÜK' : 'NORMAL');
    const sens = $('sensRange');
    const vol = $('volRange');
    const pop = $('popRange');
    if (sens) sens.value = String(settings.sens);
    if (vol) vol.value = String(settings.volume);
    if (pop) pop.value = String(settings.popups);
    const crt = $('crtToggle');
    const shake = $('shakeToggle');
    const fs = $('fsToggle');
    const spill = $('spillToggle');
    const wallpaper = $('wallpaperToggle');
    const takeover = $('takeoverToggle');
    if (crt) crt.checked = settings.crt;
    if (shake) shake.checked = settings.shake;
    if (fs) fs.checked = settings.fullscreen;
    if (spill) spill.checked = settings.spill;
    if (wallpaper) wallpaper.checked = settings.wallpaper;
    if (takeover) takeover.checked = settings.takeover;
    if (G.audioReady) {
      try { LimboAudio.setVolume(settings.volume / 100); } catch (_) {}
    }
  }

  function setupSettingsInputs() {
    const sens = $('sensRange');
    const vol = $('volRange');
    const pop = $('popRange');
    const crt = $('crtToggle');
    const shake = $('shakeToggle');
    const fs = $('fsToggle');
    const spill = $('spillToggle');
    const wallpaper = $('wallpaperToggle');
    const takeover = $('takeoverToggle');
    if (sens) sens.addEventListener('input', () => {
      settings.sens = Number(sens.value);
      setText('sensValue', settings.sens.toFixed(2));
      saveSettings();
    });
    if (vol) vol.addEventListener('input', () => {
      settings.volume = Number(vol.value);
      setText('volValue', String(Math.round(settings.volume)));
      if (G.audioReady) {
        try { LimboAudio.setVolume(settings.volume / 100); } catch (_) {}
      }
      saveSettings();
    });
    if (pop) pop.addEventListener('input', () => {
      settings.popups = Number(pop.value);
      setText('popValue', settings.popups === 0 ? 'KAPALI' : settings.popups === 1 ? 'DÜŞÜK' : 'NORMAL');
      saveSettings();
    });
    if (crt) crt.addEventListener('change', () => {
      settings.crt = crt.checked;
      document.body.classList.toggle('no-crt', !settings.crt);
      saveSettings();
    });
    if (shake) shake.addEventListener('change', () => {
      settings.shake = shake.checked;
      if (!settings.shake) G.shake = 0;
      saveSettings();
    });
    if (fs) fs.addEventListener('change', () => {
      settings.fullscreen = fs.checked;
      if (window.limboOS) window.limboOS.setFullscreen(settings.fullscreen).catch(() => {});
      saveSettings();
    });
    if (spill) spill.addEventListener('change', () => {
      settings.spill = spill.checked;
      if (settings.spill) {
        G.meta.spillNext = rand(18, 32);
        showNotify('MASAÜSTÜ SIZINTISI ETKİN // .limbo_* DOSYALARI', 'warn', 4200);
      }
      saveSettings();
    });
    if (wallpaper) wallpaper.addEventListener('change', () => {
      settings.wallpaper = wallpaper.checked;
      if (settings.wallpaper) {
        G.meta.wallpaperNext = rand(40, 80);
        showNotify('DUVAR KAĞIDI GLITCH ETKİN // GERİ YÜKLEME GARANTİLİ', 'warn', 4200);
      } else if (window.limboOS) {
        window.limboOS.wallpaperRestore().catch(() => {});
      }
      saveSettings();
    });
    if (takeover) takeover.addEventListener('change', () => {
      settings.takeover = takeover.checked;
      saveSettings();
    });
    const reset = $('btnResetProgress');
    if (reset) reset.addEventListener('click', () => {
      resetGameProgress();
      showNotify('KAYITLAR SIFIRLANDI // OYUN VERİSİ TEMİZLENDİ', 'warn', 3200);
      sfx('denied');
    });
  }

  function runBootSequence() {
    showOverlay('boot');
    showHUD(false);
    setMode('boot');
    resetTheme();
    G.bootReady = false;
    G.bootTimers.forEach(clearTimeout);
    G.bootTimers = [];
    const log = $('bootLog');
    if (log) log.replaceChildren();
    setText('bootStatus', 'BEKLENİYOR...');
    const btn = $('btnStart');
    if (btn) {
      btn.classList.remove('ready');
      btn.textContent = 'OTURUMU BAŞLAT';
    }
    const lines = CONTENT.BOOT_LINES;
    lines.forEach((line, i) => {
      const t = setTimeout(() => {
        if (!log) return;
        const span = document.createElement('span');
        if (/uyarı/i.test(line)) span.className = 'r';
        else if (/\[OK\]/.test(line)) span.className = 'b';
        else if (/BULUNAMADI/.test(line)) span.className = 'y';
        span.textContent = line + '\n';
        log.appendChild(span);
        log.scrollTop = log.scrollHeight;
        if (i === lines.length - 1) {
          const done = setTimeout(() => {
            setText('bootStatus', 'SİSTEM HAZIR // OTURUM BEKLENİYOR');
            if (btn) btn.classList.add('ready');
            G.bootReady = true;
          }, 420);
          G.bootTimers.push(done);
        }
      }, 150 + i * 145);
      G.bootTimers.push(t);
    });
  }

  function showMenu() {
    initAudio();
    setMode('menu');
    showOverlay('menu');
    showHUD(false);
    resetTheme();
    G.panel = null;
    G.firing = false;
    G.keys = Object.create(null);
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    G.finale.active = false;
    G.takeover.active = false;
    G.takeover.token++;
    clearTakeoverTimers();
    toggleHidden('takeover', true);
    G.mapOpen = false;
    document.body.classList.remove('map-open');
    toggleHidden('mapOverlay', true);
    G.cursorMode = false;
    document.body.classList.remove('cursor-mode');
    toggleHidden('cursorModeBanner', true);
    closeExternalWindows();
    closeTerminal();
    stopFilePoll();
    stopFinalPoll();
    stopPuzzlePoll();
    resetPuzzleChallenge();
    G.fileConsole.open = false;
    G.keypadOpen = false;
    toggleHidden('fileConsole', true);
    toggleHidden('keypad', true);
    releasePointer();
    refreshMeta();
    if (G.audioReady) {
      try {
        LimboAudio.setPaused(false);
        LimboAudio.setCombat(0);
        LimboAudio.startMusic(46.25, 'office');
      } catch (_) {}
    }
    setText('appbarStatus', 'OPERATÖR BEKLENİYOR');
    $('statusLed')?.classList.remove('bad');
    updateMenuInfo();
    if (G.saveCorrupt) {
      const recovered = G.saveRecovered;
      G.saveCorrupt = false;
      G.saveRecovered = false;
      showNotify(recovered ? 'KAYIT BOZUK // YEDEKTEN KURTARILDI' : 'KAYIT BOZUK // YEDEK YOK', recovered ? 'warn' : 'bad', 5200);
    }
  }

  function updateMenuInfo() {
    const done = progress.completed.length;
    setText('menuProgress', done ? `KAYIT ${pad2(done)}/15` : 'KAYIT YOK // 00/15');
    const next = nextPlayableLevel();
    setText('menuContinueLabel', progress.started || done ? `OTURUMU SÜRDÜR // ${pad2(next)}` : 'OTURUMU BAŞLAT');
    setText('sideLayer', `${pad2(progress.last)} / 15`);
    setText('sideUser', String(G.meta.user || 'OPERATÖR').toUpperCase());
    if (!G.level) setText('sideHazard', 'BEKLİYOR');
    if (window.limboOS && !updateMenuInfo.done) {
      updateMenuInfo.done = true;
      window.limboOS.appInfo().then((info) => {
        if (!info) return;
        setText('osBadge', `${String(info.platform || 'linux').toUpperCase()} // ELECTRON`);
      }).catch(() => {});
    }
  }

  function openArchive() {
    G.panelFrom = G.mode;
    G.panel = 'chapters';
    hideAllOverlays();
    showOverlay('chapters');
    const grid = $('chapterGrid');
    if (grid) {
      grid.replaceChildren();
      CONTENT.LEVELS.forEach((lv) => {
        const btn = document.createElement('button');
        const done = progress.completed.includes(lv.id);
        btn.className = `chapter-card perde-${lv.act}` + (done ? ' done' : '');
        const top = document.createElement('div');
        top.className = 'cc-top';
        const num = document.createElement('span');
        num.className = 'cc-num';
        num.textContent = pad2(lv.id);
        const state = document.createElement('span');
        state.className = 'cc-state' + (done ? ' done' : lv.id === progress.last ? ' current' : '');
        state.textContent = done ? 'TEMİZLENDİ' : lv.id === progress.last ? 'AKTİF' : 'AÇIK';
        top.append(num, state);
        const name = document.createElement('div');
        name.className = 'cc-name';
        name.textContent = lv.title.replace(/^\[|\]$/g, '').replace(/_/g, ' ');
        const code = document.createElement('div');
        code.className = 'cc-code';
        code.textContent = `${lv.code} // ${(lv.venue || lv.theme).toUpperCase()}`;
        btn.append(top, name, code);
        btn.addEventListener('click', () => {
          G.panel = null;
          beginLevel(lv.id, true);
        });
        grid.appendChild(btn);
      });
    }
    sfx('click');
  }

  function openSettings() {
    G.panelFrom = G.mode;
    G.panel = 'settings';
    hideAllOverlays();
    showOverlay('settings');
    applySettingsUI();
    sfx('click');
  }

  function closePanel() {
    const from = G.panelFrom;
    G.panel = null;
    G.panelFrom = null;
    if (from === 'paused') {
      showOverlay('pause');
      setMode('paused');
    } else {
      showOverlay('menu');
      setMode('menu');
      updateMenuInfo();
    }
    sfx('click');
  }

  function setTokenHint(state) {
    const el = $('tokenHint');
    if (!el) return;
    const phrase = (state && state.tokenPhrase) || G.meta.tokenPhrase || 'LIMBO_RESET_0x0009';
    const helperPath = (state && state.helperPath) || '';
    el.textContent = [
      'KURTARMA ANAHTARI ARANIYOR...',
      'SIFIRLA.TXT // SATIR BAŞINDAKİ # İŞARETİNİ SİL',
      helperPath ? `DOSYA: ${helperPath}` : `.limbo_reset.token // İÇERİK: ${phrase}`,
      'ARANAN YERLER: OYUN KLASÖRÜ / KULLANICI VERİSİ / MASAÜSTÜ / BELGELER / İNDİRİLENLER',
    ].join('\n');
  }

  function stopTokenPoll() {
    if (G.meta.tokenTimer) {
      clearInterval(G.meta.tokenTimer);
      G.meta.tokenTimer = null;
    }
  }

  function handleTokenReset() {
    stopTokenPoll();
    localStorage.removeItem(FINAL_KEY);
    localStorage.removeItem(SAVE_KEY);
    clearEndingTimers();
    document.body.classList.remove('final-mode');
    G.endingStarted = false;
    G.meta.terminated = false;
    G.meta.tokenFound = false;
    progress.completed = [];
    progress.last = 1;
    progress.started = false;
    progress.deaths = 0;
    G.deaths = 0;
    hideAllOverlays();
    showMenu();
    showNotify('KURTARMA ANAHTARI KABUL EDİLDİ // OTURUM GERİ YÜKLENDİ', '', 9000);
    setText('appbarStatus', 'KURTARMA ANAHTARI DOĞRULANDI');
    sfx('token');
  }

  function startTokenPoll() {
    if (!window.limboOS || G.meta.tokenTimer) return;
    const tick = () => {
      window.limboOS.checkReset().then((res) => {
        if (!res) return;
        if (res.reset) {
          handleTokenReset();
          return;
        }
        if (!res.terminated) return;
        return window.limboOS.metaState().then((state) => {
          if (state) {
            G.meta.tokenFound = Boolean(state.tokenFound);
            G.meta.tokenLocations = state.tokenLocations || G.meta.tokenLocations;
            setTokenHint(state);
          }
        }).catch(() => {});
      }).catch(() => {});
    };
    G.meta.tokenTimer = setInterval(tick, 1300);
    tick();
  }

  function showTerminated(permanent = false) {
    if (G.mode === 'terminated' && permanent) {
      startTokenPoll();
      return;
    }
    setMode('terminated');
    showOverlay('terminated');
    showHUD(false);
    closeExternalWindows();
    closeTerminal();
    stopFilePoll();
    stopFinalPoll();
    try { LimboAudio.stopMusic(); } catch (_) {}
    try { LimboAudio.setPaused(true); } catch (_) {}
    setText('appbarStatus', 'OTURUM KALICI OLARAK KAPATILDI');
    $('statusLed')?.classList.add('bad');
    const btn = $('btnNewIdentity');
    if (btn) {
      btn.classList.add('hidden');
      if (!permanent) setTimeout(() => btn.classList.remove('hidden'), 3500);
    }
    document.body.classList.toggle('final-mode', Boolean(permanent));
    setTokenHint(G.meta);
    if (permanent) startTokenPoll();
  }

  function resetIdentity() {
    localStorage.removeItem(FINAL_KEY);
    localStorage.removeItem(SAVE_KEY);
    clearEndingTimers();
    document.body.classList.remove('final-mode');
    G.endingStarted = false;
    progress.completed = [];
    progress.last = 1;
    progress.started = false;
    progress.deaths = 0;
    G.deaths = 0;
    saveProgress();
    showMenu();
    showNotify('YENİ KİMLİK // 0x000A', '', 5000);
  }

  // --------------------------------------------------------------- HUD
  function setupHud() {
    const hpBar = $('hpBar');
    if (hpBar && !hpBar.firstElementChild) {
      const fill = document.createElement('i');
      hpBar.appendChild(fill);
    }
    const dash = $('dashPips');
    if (dash && !dash.children.length) {
      for (let i = 0; i < 2; i++) dash.appendChild(document.createElement('i'));
    }
    const glitch = $('glitch-layer');
    if (glitch && !glitch.children.length) {
      for (let i = 0; i < 7; i++) {
        const bar = document.createElement('div');
        bar.className = 'gbar';
        bar.style.top = rand(5, 90) + '%';
        glitch.appendChild(bar);
      }
    }
  }

  function rankFor(style) {
    let rank = CONTENT.RANKS[0];
    for (const r of CONTENT.RANKS) if (style >= r.min) rank = r;
    return rank;
  }

  function aliveEnemies() {
    return G.enemies.filter((e) => !e.dead);
  }

  function updateBossBar() {
    const bar = $('bossBar');
    if (!bar) return;
    const boss = G.boss;
    if (!boss) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    setText('bossName', boss.name || 'YÖNETİCİ');
    setText('bossPhase', `FAZ ${boss.phase || 1}`);
    const fill = $('bossFill');
    if (fill) fill.style.width = clamp((boss.hp / boss.maxHp) * 100, 0, 100).toFixed(1) + '%';
  }

  function updatePopupHud() {
    const alert = $('popupAlert');
    if (!alert) return;
    const count = G.popups.size;
    if (count <= 0) {
      alert.classList.add('hidden');
      return;
    }
    alert.classList.remove('hidden');
    setText('popupAlertText', count > 1 ? `${count} HARİCİ PENCERE — KAPAT` : 'HARİCİ PENCERE — KAPAT');
  }

  function updateInteractPrompt() {
    const el = $('interactPrompt');
    if (!el) return;
    if (G.mode !== 'playing' || !G.player) {
      el.classList.add('hidden');
      return;
    }
    const target = findInteractable();
    G.interactTarget = target;
    if (!target) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    setText('interactText', target.prompt);
  }

  function updateHud(force = false) {
    if (!G.player) return;
    const now = performance.now();
    if (!force && now - G.lastHud < 70) return;
    G.lastHud = now;
    const p = G.player;
    const hp = Math.max(0, Math.ceil(p.hp));
    setText('hpValue', String(hp));
    const hpFill = $('hpBar')?.firstElementChild;
    if (hpFill) {
      hpFill.style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
      hpFill.style.background = p.hp <= 30 ? 'var(--danger)' : 'var(--accent)';
    }
    const pips = $('dashPips')?.children || [];
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('on', (p.dash || [])[i] > 0);
    }
    setText('dashState', (p.dash || []).some((c) => c > 0) ? 'HAZIR' : 'ŞARJ');
    const w = WEAPONS[G.weapon];
    if (w) {
      setText('weaponName', w.name);
      setText('weaponSlot', w.slot);
      document.querySelectorAll('.weapon-keys span').forEach((span) => {
        const idx = Number(span.dataset.w) - 1;
        span.classList.toggle('active', G.allowed.includes(idx) && idx === G.weapon);
      });
    }
    setStyle('heatFill', 'width', clamp(G.heat, 0, 1) * 100 + '%');
    setStyle('heatFill', 'background', G.overheat ? 'var(--danger)' : 'var(--accent)');
    const rank = rankFor(G.style);
    setText('styleRank', rank.label);
    setText('styleValue', String(Math.floor(G.style)).padStart(3, '0'));
    setText('comboLabel', 'x' + Math.max(1, Math.min(99, G.combo)));
    updateBossBar();
    updatePopupHud();
    updateInteractPrompt();
    const cross = $('crosshair');
    if (cross) {
      cross.classList.toggle('enemy', Boolean(G.aimTarget));
      cross.classList.toggle('fire', G.flash > 0.2 || G.swing > 0.25);
    }
    if (G.mode === 'playing') {
      toggleHidden('qtePanel', !G.qte.active);
      if (G.qte.active) {
        setText('qteTimer', Math.max(0, G.qte.time).toFixed(1));
        const spans = $('qteKeys')?.children || [];
        for (let i = 0; i < spans.length; i++) spans[i].classList.toggle('hit', i < G.qte.idx);
      }
    }
  }

  function setObjective(text, announce = false) {
    if (!text || text === G.objectiveText) return;
    G.objectiveText = text;
    setText('objectiveLabel', text);
    if (announce) showToast(text);
  }

  // --------------------------------------------------------------- boot / menu wiring
  function setupButtons() {
    $('btnStart')?.addEventListener('click', () => {
      initAudio();
      sfx('click');
      showMenu();
    });
    $('btnEnter')?.addEventListener('click', () => startPendingLevel());
    $('btnNextLevel')?.addEventListener('click', advanceFromComplete);
    $('btnRespawn')?.addEventListener('click', respawn);
    $('btnDeathMenu')?.addEventListener('click', showMenu);
    $('btnNewIdentity')?.addEventListener('click', resetIdentity);
    $('keypadClose')?.addEventListener('click', closeKeypad);
    $('btnOpenExplorer')?.addEventListener('click', () => openRootAnomaly());
    $('btnRefreshFiles')?.addEventListener('click', () => refreshFinalFiles(true));
    $('btnOpenResetHelper')?.addEventListener('click', () => {
      if (window.limboOS && window.limboOS.openResetHelper) {
        window.limboOS.openResetHelper().catch(() => {});
      }
    });
    $('mapOverlay')?.addEventListener('click', (event) => {
      if (event.target === $('mapOverlay')) toggleMap(false);
    });
    $('btnMin')?.addEventListener('click', () => window.limboOS?.minimize().catch(() => {}));
    $('btnMax')?.addEventListener('click', () => window.limboOS?.maximize().catch(() => {}));
    $('btnClose')?.addEventListener('click', () => window.limboOS?.closeWindow().catch(() => {}));
    document.querySelectorAll('[data-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        initAudio();
        sfx('click');
        const action = btn.dataset.menu;
        if (action === 'continue') beginLevel(nextPlayableLevel(), true);
        else if (action === 'chapters') openArchive();
        else if (action === 'settings') openSettings();
        else if (action === 'quit') window.limboOS?.quit().catch(() => window.close());
      });
    });
    document.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx('click');
        const action = btn.dataset.pause;
        if (action === 'resume') resumeGame();
        else if (action === 'restart') restartLevel();
        else if (action === 'chapters') { hideAllOverlays(); openArchive(); }
        else if (action === 'settings') { hideAllOverlays(); openSettings(); }
        else if (action === 'menu') showMenu();
      });
    });
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const which = btn.dataset.close;
        if (which === 'finale') closeFinale();
        else if (which === 'inventory') closeInventory();
        else if (which === 'fileConsole') closeFileConsole();
        else closePanel();
      });
    });
    document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx('click');
        setInventoryTab(btn.dataset.invTab);
      });
    });
    $('btnFcRead')?.addEventListener('click', () => readFileConsole());
    $('btnFcWrite')?.addEventListener('click', () => writeFileConsole());
    const kp = $('keypad');
    kp?.querySelectorAll('.kp-grid button').forEach((btn) => {
      btn.addEventListener('click', () => keypadInput(btn.dataset.k));
    });
  }

  // --------------------------------------------------------------- level lifecycle
  function beginLevel(n, withIntro) {
    const lv = CONTENT.levelByNumber(n);
    G.pendingLevel = lv;
    if (!withIntro) {
      startLevelNow(lv);
      return;
    }
    closeExternalWindows();
    stopFilePoll();
    resetTheme();
    applyTheme(CONTENT.THEMES[lv.theme]);
    setMode('intro');
    hideAllOverlays();
    showOverlay('chapterIntro');
    showHUD(false);
    setText('appbarStatus', `KATMAN ${pad2(lv.id)} // BEKLEMEDE`);
    setText('ciAct', ACT_NAMES[lv.act] || ACT_NAMES[1]);
    setText('ciCode', lv.code);
    setText('ciNumber', pad2(lv.id));
    setText('ciTitle', lv.title);
    setText('ciName', lv.name.toUpperCase());
    setText('ciLore', lv.intro);
    setText('ciObjective', lv.objective);
    setText('ciThreat', `TEHDİT: ${lv.threat} // MEKÂN: ${lv.venue || lv.theme}`);
    const enter = $('btnEnter');
    if (enter) enter.textContent = 'KATMANA İN [ENTER]';
    sfx('click');
  }

  function startPendingLevel() {
    if (G.pendingLevel) startLevelNow(G.pendingLevel);
  }

  function startLevelNow(lv) {
    G.level = lv;
    G.levelId = lv.id;
    G.pendingLevel = null;
    G.boss = null;
    G.bossDead = false;
    G.exitOpen = false;
    G.exitReason = '';
    G.wave = 0;
    G.waveTotal = 0;
    G.waveGroups = [];
    G.wavePending = false;
    G.waveTimer = 0;
    G.kills = 0;
    G.totalKills = 0;
    G.levelTime = 0;
    G.gtime = 0;
    G.animTime = 0;
    G.style = 0;
    G.combo = 0;
    G.comboTimer = 0;
    G.styleIdle = 0;
    G.heat = 0;
    G.overheat = false;
    G.cooldown = 0;
    G.swing = 0;
    G.recoil = 0;
    G.flash = 0;
    G.muzzle = 0;
    G.switchAnim = 0;
    G.shake = 0;
    G.freezeTimer = 0;
    G.freezeCd = 20;
    G.whisperTimer = 16 + Math.random() * 10;
    G.ambientGlitch = 20 + Math.random() * 15;
    G.popupsFired = new Set();
    G.qte = { active: false, seq: [], idx: 0, time: 0, next: lv.qte ? 10 : 9999, timer: 0 };
    G.aimTarget = null;
    G.interactTarget = null;
    G.timeScale = lv.slow ? 0.64 : 1;
    G.endingStarted = false;
    G.finale.active = false;
    G.finale.deleted = false;
    G.finale.started = false;
    G.finale.nagTick = 0;
    G.finale.nagNext = 8;
    G.finale.finalizing = false;
    G.codeEntered = false;
    G.hudWarned = false;
    G.takeover.token++;
    G.takeover.active = false;
    clearTakeoverTimers();
    toggleHidden('takeover', true);
    setText('takeoverText', '');
    $('takeoverLog')?.replaceChildren();
    if (G.mapOpen) toggleMap(false);
    G.mapOpen = false;
    document.body.classList.remove('map-open');
    toggleHidden('mapOverlay', true);
    G.mapExplore = new Set();
    G.mapZoom = 1;
    G.mapPanX = 0;
    G.mapPanY = 0;
    G.camera.blend = 0;
    document.body.classList.remove('gpu-corrupt', 'screen-shake', 'screen-shrink');
    G.cursorMode = false;
    document.body.classList.remove('cursor-mode');
    toggleHidden('cameraBadge', !G.camera.third);
    toggleHidden('cursorModeBanner', true);
    if (G.kernel.active) {
      G.kernel.active = false;
      clearTimeout(G.kernel.timer);
      toggleHidden('kernelPanic', true);
    }
    setText('sideUser', String(G.meta.user || 'OPERATÖR').toUpperCase());
    G.lastObjectiveRefresh = 0;
    G.nextAmbientPopup = 0;
    G.freezeCd = lv.slow ? 8 : 0;
    G.freezeTimer = 0;
    G.allowFreeAim = false;
    G.swayX = 0;
    G.swayY = 0;
    G.aimTarget = null;
    clearEndingTimers();
    document.body.classList.remove('final-mode');
    document.querySelectorAll('#ending.fake, #ending.glitch, #ending.final, #ending.void').forEach((el) => {
      el.classList.remove('fake', 'glitch', 'final', 'void');
    });
    G.files = {
      active: false, names: [], status: {}, remaining: 0, prepared: false,
      unlocked: false, timer: null, levelId: lv.id, final: Boolean(lv.final),
    };
    stopFinalPoll();
    stopFilePoll();
    stopPuzzlePoll();
    closeExternalWindows();
    closeTerminal();
    hideAllOverlays();
    setMode('playing');
    showHUD(true);
    applyTheme(CONTENT.THEMES[lv.theme]);
    ENGINE.setLevel(lv);
    parseWorld(lv);
    G.checkpointTimer = 0;
    updateCheckpoint(true);
    if (lv.filePuzzle) prepareFilePuzzle(lv);
    G.fileConsole = { open: false, file: '', content: '', status: '', source: '', targetDoor: null };
    G.keypadOpen = false;
    toggleHidden('keypad', true);
    resetPuzzleChallenge();
    updateFlashlightHud();
    G.allowed = lv.weapons.map((key) => WEAPONS.findIndex((w) => w.key === key)).filter((i) => i >= 0);
    if (!G.allowed.length) G.allowed = [0];
    G.weapon = G.allowed[0];
    G.switchAnim = 1;
    setText('chapterLabel', `BÖLÜM ${pad2(lv.id)} // ${lv.title.replace(/^\[|\]$/g, '')}`);
    setText('appbarStatus', `KATMAN ${pad2(lv.id)} // ÇEVRİMİÇİ`);
    $('statusLed')?.classList.remove('bad');
    setObjective(lv.objective, true);
    spawnLevelEnemies(lv);
    if (lv.boss) spawnBoss(lv.boss);
    markExplored(4.2);
    initHazard(lv);
    scheduleTakeover(lv);
    if (lv.filesDetail && !lv.final) prepareGhostFiles(lv);
    if (lv.terminal) {
      setTimeout(() => {
        if (G.levelId === lv.id && G.mode === 'playing') openSideTerminal(lv);
      }, 1400);
    }
    startLevelMusic(lv);
    if (!G.debug) {
      progress.started = true;
      progress.last = lv.id;
      saveProgress();
      setTimeout(() => {
        if (G.mode === 'playing') requestPointer();
      }, 320);
    }
    refreshObjective(true);
    updateHud(true);
    updateBossBar();
    showSubtitle('// SİSTEM', `KATMAN ${lv.code} AÇILDI. ${lv.name.toUpperCase()} SENİ BEKLİYOR.`, 5200);
    sfx('glitch');
  }

  function parseWorld(lv) {
    const rows = lv.map.slice();
    G.mapW = Math.max(...rows.map((r) => r.length));
    G.mapH = rows.length;
    G.map = rows.map((r) => r.padEnd(G.mapW, '#').split(''));
    G.spawnCells = [];
    G.openCells = [];
    G.usedSpawns = new Set();
    G.pickups = [];
    G.itemPickups = [];
    G.exits = [];
    G.terminals = [];
    G.doors = [];

    // Door cells are runtime state.  Apply the saved open/closed state before
    // scanning the map so an opened vault is walkable and a closed one blocks
    // both the player and enemy pathing.
    for (const def of (lv.doors || [])) {
      if (!def || !Array.isArray(def.cells) || !def.id) continue;
      const open = Boolean(progress.doors[def.id]);
      const door = Object.assign({}, def, {
        open,
        x: 0, y: 0,
      });
      let cx = 0;
      let cy = 0;
      let n = 0;
      for (const [dx, dy] of def.cells) {
        if (!Number.isInteger(dx) || !Number.isInteger(dy)) continue;
        if (dx < 0 || dy < 0 || dx >= G.mapW || dy >= G.mapH) continue;
        const cellChar = open ? '.' : (def.file ? 'L' : 'D');
        G.map[dy][dx] = cellChar;
        ENGINE.setCell(dx, dy, cellChar);
        cx += dx + 0.5;
        cy += dy + 0.5;
        n++;
        if (open) G.openCells.push({ x: dx + 0.5, y: dy + 0.5 });
      }
      if (!n) continue;
      door.x = cx / n;
      door.y = cy / n;
      G.doors.push(door);
    }

    for (const def of (lv.items || [])) {
      if (!def || !CONTENT.ITEMS[def.id]) continue;
      const item = CONTENT.ITEMS[def.id];
      const takenBySave = progress.items.includes(def.id)
        || (item.kind === 'note' && progress.notes.includes(item.note));
      G.itemPickups.push({
        id: def.id, x: Number(def.x) || 0, y: Number(def.y) || 0,
        def: item, taken: takenBySave, bob: Math.random() * 6,
      });
    }

    let playerCell = null;
    const bossCells = [];
    for (let y = 0; y < G.mapH; y++) {
      for (let x = 0; x < G.mapW; x++) {
        const ch = G.map[y][x];
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (ch === 'P') playerCell = { x: cx, y: cy };
        else if (ch === 'S') G.spawnCells.push({ x: cx, y: cy });
        else if (ch === 'B') bossCells.push({ x: cx, y: cy });
        else if (ch === 'E') G.exits.push({ x: cx, y: cy, prompt: 'ÇIKIŞI AÇ' });
        else if (ch === 'T') G.terminals.push({ x: cx, y: cy, prompt: 'TERMİNAL' });
        else if (ch === 'A') G.pickups.push({ x: cx, y: cy, taken: false, bob: Math.random() * 6 });
        if (!WALLS.has(ch)) G.openCells.push({ x: cx, y: cy });
      }
    }
    if (!playerCell) playerCell = G.openCells[Math.floor(G.openCells.length / 2)] || { x: 1.5, y: 1.5 };
    G.player = {
      x: playerCell.x, y: playerCell.y, angle: 0, pitch: 0, z: 0, vz: 0,
      vx: 0, vy: 0, hp: 100, maxHp: 100, grounded: true, bobPhase: 0,
      bob: 0, crouch: 0, iframe: 0, dash: [1, 1], dashRecharge: [0, 0],
      slideTimer: 0, slideCd: 0, dashTimer: 0, radius: 0.22,
    };
    G.bossSpawnCell = bossCells[0] || null;
    G.enemies = [];
    G.projectiles = [];
    G.dataOrbs = [];
    G.touchSpawn = 0;
    for (const id of progress.items) {
      const def = CONTENT.ITEMS[id];
      if (def && def.kind === 'upgrade' && def.maxHp) G.player.maxHp += def.maxHp;
    }
    G.player.hp = G.player.maxHp;
  }

  // --------------------------------------------------------------- items / checkpoints
  function hasItem(id) {
    return Boolean(id) && progress.items.includes(id);
  }

  function levelNoteAcquired(lv) {
    if (!lv || !Array.isArray(lv.items)) return true;
    return lv.items.some((entry) => {
      const def = entry && CONTENT.ITEMS[entry.id];
      return Boolean(def && def.note && progress.notes.includes(def.note));
    });
  }

  function updateCheckpoint(force = false) {
    if (!G.player || !G.level) return;
    const now = performance.now();
    if (!force && now - (G.lastCheckpointAt || 0) < 7000) return;
    if (!force) {
      if (!G.player.grounded || G.player.hp < G.player.maxHp * 0.35) return;
      if (aliveEnemies().some((e) => dist(e.x, e.y, G.player.x, G.player.y) < 3.4)) return;
    }
    G.lastCheckpointAt = now;
    progress.checkpoint = {
      levelId: G.levelId,
      x: Number(G.player.x.toFixed(2)),
      y: Number(G.player.y.toFixed(2)),
      angle: Number(G.player.angle.toFixed(3)),
      at: Date.now(),
    };
    if (!G.debug) saveProgress();
  }

  function restoreCheckpoint() {
    const cp = progress.checkpoint;
    if (!cp || !G.player || cp.levelId !== G.levelId) return false;
    if (!Number.isFinite(cp.x) || !Number.isFinite(cp.y) || isWallAt(cp.x, cp.y)) return false;
    G.player.x = cp.x;
    G.player.y = cp.y;
    G.player.angle = Number.isFinite(cp.angle) ? cp.angle : G.player.angle;
    G.player.vx = 0;
    G.player.vy = 0;
    G.player.z = 0;
    G.player.vz = 0;
    ENGINE.burst(cp.x, cp.y, 0.2, '#7ee8ff', 14, { speed: 1.2, size: 0.03, life: 0.7 });
    return true;
  }

  function takeItemPickup(pickup) {
    if (!pickup || pickup.taken) return;
    const def = pickup.def || CONTENT.ITEMS[pickup.id];
    if (!def) return;
    pickup.taken = true;
    let fresh = false;
    if (!progress.items.includes(def.id)) {
      progress.items.push(def.id);
      fresh = true;
    }
    if (def.kind === 'note' && def.note && !progress.notes.includes(def.note)) {
      progress.notes.push(def.note);
      fresh = true;
    }
    if (fresh && def.kind === 'upgrade' && def.maxHp && G.player) {
      G.player.maxHp += def.maxHp;
      G.player.hp = Math.min(G.player.maxHp, G.player.hp + def.maxHp);
    }
    sfx('pickup');
    addStyle(def.kind === 'upgrade' ? 9 : 4);
    ENGINE.burst(pickup.x, pickup.y, 0.25, def.tint || '#b8ff5a', 20, { speed: 1.5, size: 0.035, life: 0.9 });
    if (def.kind === 'key') {
      showNotify(`${def.name} ALINDI // KATMAN 08 KASASI`, 'good', 4600);
      showFeed('YETKİ KARTI ENVANTERE EKLENDİ // [I]', 'good');
      showSubtitle('// ENVANTER', `${def.name} alındı. Kasayı açmak için kapıya yaklaş.`, 4600);
    } else if (def.kind === 'note') {
      showNotify(`${def.name} ALINDI // [I] NOTLAR`, '', 3800);
      showFeed('NOT ENVANTERE EKLENDİ // [I]', '');
    } else {
      showNotify(`${def.name} // BÜTÜNLÜK +${def.maxHp || 0}`, 'good', 3600);
      showFeed('KALICI BÜTÜNLÜK YÜKSELTMESİ ALINDI.', 'good');
    }
    saveProgress();
  }

  function updateItemPickups(dt) {
    const p = G.player;
    if (!p) return;
    for (const item of G.itemPickups) {
      if (item.taken) continue;
      item.bob += dt * 2.1;
      if (dist(p.x, p.y, item.x, item.y) < 0.66) takeItemPickup(item);
    }
  }

  // --------------------------------------------------------------- doors / file puzzle
  function doorById(id) {
    return G.doors.find((d) => d.id === id) || null;
  }

  function syncDoorCells(door, open) {
    if (!door || !Array.isArray(door.cells)) return;
    const ch = open ? '.' : (door.file ? 'L' : 'D');
    for (const [x, y] of door.cells) {
      if (!G.map || y < 0 || x < 0 || y >= G.mapH || x >= G.mapW) continue;
      G.map[y][x] = ch;
      ENGINE.setCell(x, y, ch);
      if (open && !G.openCells.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y)) {
        G.openCells.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }

  function openDoor(door, opts = {}) {
    if (!door || door.open) return false;
    door.open = true;
    progress.doors[door.id] = true;
    progress.puzzles[door.id] = true;
    syncDoorCells(door, true);
    sfx('unlock');
    addShake(2.4);
    ENGINE.burst(door.x, door.y, 0.5, '#b8ff5a', 26, { speed: 1.8, size: 0.04, life: 1.0 });
    if (!opts.silent) {
      showNotify(door.openText || 'KAPI AÇILDI.', 'good', 4200);
      showFeed(door.openText || 'KAPI AÇILDI.', 'good');
      showToast(door.openText || 'KAPI AÇILDI.');
      if (door.id === 'level9_archive') {
        showSubtitle('// ARŞİV KASASI', 'İçeride bir not var. Şifreyi oku. [I] ENVANTER', 6200);
      }
    }
    saveProgress();
    refreshObjective(true);
    return true;
  }

  function doorLockReason(door) {
    if (!door) return '';
    if (door.file) return door.lockedText || `DOSYA KİLİDİ // ${door.file}`;
    if (door.key && !hasItem(door.key)) return door.lockedText || 'YETKİ KARTI GEREKLİ';
    return '';
  }

  function tryOpenDoor(door) {
    if (!door || door.open) return;
    if (door.file) {
      openFileConsole(door.file, door);
      return;
    }
    const reason = doorLockReason(door);
    if (reason) {
      sfx('denied');
      triggerGlitch();
      showFeed(reason, 'bad');
      showToast(reason);
      return;
    }
    openDoor(door);
  }

  function prepareFilePuzzle(lv) {
    stopPuzzlePoll();
    const fp = lv && lv.filePuzzle;
    if (!fp || !fp.file) return;
    const startPoll = () => startPuzzlePoll(lv);
    if (window.limboOS && window.limboOS.sandboxEnsure) {
      window.limboOS.sandboxEnsure(fp.file, fp.initial || '').then((res) => {
        if (G.levelId !== lv.id) return;
        if (!res || !res.ok) {
          showFeed('DOSYA KİLİDİ HAZIRLANAMADI // SİMÜLASYON', 'warn');
        }
        startPoll();
      }).catch(startPoll);
    } else {
      startPoll();
    }
  }

  function startPuzzlePoll(lv) {
    stopPuzzlePoll();
    const fp = lv && lv.filePuzzle;
    if (!fp) return;
    const lid = lv.id;
    const tick = async () => {
      if (G.levelId !== lid || !G.level || G.level.filePuzzle !== fp) return;
      const door = doorById(fp.door);
      if (door && door.open) return;
      if (!window.limboOS || !window.limboOS.sandboxRead) return;
      try {
        const res = await window.limboOS.sandboxRead(fp.file);
        if (res && res.ok && String(res.content || '').includes(fp.token)) {
          if (door) openDoor(door, { silent: false });
        }
      } catch (_) {}
    };
    tick();
    G.puzzleTimer = setInterval(tick, 1350);
  }

  function stopPuzzlePoll() {
    if (G.puzzleTimer) {
      clearInterval(G.puzzleTimer);
      G.puzzleTimer = null;
    }
  }

  // --------------------------------------------------------------- flashlight
  function updateFlashlightHud() {
    const el = $('flashlightState');
    if (el) {
      el.textContent = G.flashlight ? 'AÇIK' : 'KAPALI';
      el.classList.toggle('on', G.flashlight);
    }
    const block = $('flashlightBlock');
    if (block) block.classList.toggle('on', G.flashlight);
  }

  function toggleFlashlight() {
    G.flashlight = !G.flashlight;
    updateFlashlightHud();
    sfx(G.flashlight ? 'click' : 'denied');
    if (G.player) {
      ENGINE.burst(G.player.x, G.player.y, 0.45, G.flashlight ? '#ffe9b0' : '#4a5548', G.flashlight ? 14 : 6, {
        speed: 0.9, size: 0.03, life: 0.5, gravity: 0.4,
      });
    }
    showNotify(G.flashlight ? 'FENER AÇIK // F' : 'FENER KAPALI // F', '', 1600);
  }

  function randomOpenCell(minAway = 4, avoidOccupied = true) {
    const p = G.player;
    const candidates = G.openCells.filter((c) => {
      if (dist(c.x, c.y, p.x, p.y) < minAway) return false;
      if (avoidOccupied) {
        for (const e of G.enemies) {
          if (!e.dead && dist(c.x, c.y, e.x, e.y) < 0.9) return false;
        }
      }
      return true;
    });
    if (!candidates.length) return G.openCells[Math.floor(Math.random() * G.openCells.length)] || { x: 1.5, y: 1.5 };
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function spawnPointForEnemy() {
    let cell = null;
    const p = G.player;
    const available = G.spawnCells.filter((c) => {
      const key = `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
      return !G.usedSpawns.has(key) && dist(c.x, c.y, p.x, p.y) > 2.6;
    });
    if (available.length) {
      cell = available[Math.floor(Math.random() * available.length)];
      G.usedSpawns.add(`${cell.x.toFixed(1)},${cell.y.toFixed(1)}`);
    } else {
      cell = randomOpenCell(4.2, true);
    }
    return { x: cell.x + rand(-0.16, 0.16), y: cell.y + rand(-0.16, 0.16) };
  }

  function spawnLevelEnemies(lv) {
    if (lv.waves) {
      setupWaves(lv);
      return;
    }
    lv.enemies.forEach((typeKey) => {
      const pos = spawnPointForEnemy();
      spawnEnemy(typeKey, pos.x, pos.y);
    });
  }

  function spawnEnemy(typeKey, x, y, opts = {}) {
    const type = CONTENT.ENEMY_TYPES[typeKey] || CONTENT.ENEMY_TYPES.tick;
    const scale = 1 + Math.max(0, G.levelId - 1) * 0.045;
    const behavior = (G.level && G.level.behavior) || 'swarm';
    const variantColor = (G.level && G.level.variantColor) || null;
    let hp = type.hp * scale;
    let speed = type.speed * (1 + Math.max(0, G.levelId - 1) * 0.012);
    if (behavior === 'swarm') { hp *= 0.88; speed *= 1.14; }
    else if (behavior === 'stalker') { speed *= 0.94; }
    else if (behavior === 'glitch') { speed *= 1.06; }
    else if (behavior === 'shielded') { hp *= 1.18; }
    else if (behavior === 'mimic') { speed *= 1.02; }
    else if (behavior === 'drifter') { speed *= 0.96; }
    else if (behavior === 'weeper') { hp *= 1.12; }
    else if (behavior === 'echo') { hp *= 0.92; speed *= 0.92; }
    else if (behavior === 'watcher') { speed *= 0.9; hp *= 1.08; }
    else if (behavior === 'husk') { hp *= 1.3; speed *= 0.84; }
    else if (behavior === 'siege') { speed *= 1 + Math.max(0, G.wave - 1) * 0.06; }
    else if (behavior === 'king' || behavior === 'root') { hp *= 1.16; speed *= 1.05; }
    const e = {
      typeKey, type, name: type.name, x, y, z: 0,
      hp, maxHp: hp, radius: type.radius,
      height: type.height, sprite: type.sprite, color: type.color,
      speed, behavior, variantColor,
      damage: type.damage, meleeRange: type.meleeRange || 0,
      attackRange: type.attackRange || 0, attackCd: rand(0.5, 1.4),
      cooldown: 0, flash: 0, age: 0, spawnGrace: 0.55, dead: false,
      frame: 0, teleportCd: rand(3.5, 7), minion: Boolean(opts.minion),
      wave: G.wave, lunge: 0,
    };
    if (type.flying) e.z = 0.46 + Math.random() * 0.08;
    G.enemies.push(e);
    if (opts.burst !== false) ENGINE.burst(x, y, e.z + 0.2, type.color, 10, { speed: 1.3, size: 0.03, life: 0.6 });
    return e;
  }

  function spawnBoss(key) {
    const type = CONTENT.BOSSES[key];
    if (!type) return;
    const cell = G.bossSpawnCell || randomOpenCell(6, false);
    const boss = {
      typeKey: key, type, name: type.name, boss: true,
      x: cell.x, y: cell.y, z: 0, hp: type.hp, maxHp: type.hp,
      radius: type.radius, height: type.height, sprite: type.sprite,
      color: type.color, speed: type.speed, damage: 24,
      radius2: type.radius, age: 0, flash: 0, dead: false, frame: 0,
      attackCd: 2.6, cooldown: 0, phase: 1, phases: type.phases,
      popupEvery: type.popupEvery, popupTimer: 2.4, initialShield: false,
      vulnerable: 0, wasShielded: false, summonCd: 9, minionCount: 0,
    };
    G.boss = boss;
    G.bossDead = false;
    G.enemies.push(boss);
    ENGINE.burst(boss.x, boss.y, 0.8, type.color, 34, { speed: 2.6, size: 0.045, life: 1.2 });
    addShake(9);
    sfx('bossSpawn');
    showNotify(`${type.name} // ÇEVRİMİÇİ`, 'bad', 6000);
    showSubtitle('// YÖNETİCİ', `${type.name} OTURUMU DEVRALDI. PENCERELER KALKAN. [F] İLE KAPAT.`, 6500);
    updateBossBar();
    refreshObjective();
  }

  function setupWaves(lv) {
    G.waveTotal = lv.waves || 3;
    G.waveGroups = [];
    const pool = lv.enemies.slice();
    if (!pool.length) pool.push('crawler');
    let cursor = 0;
    for (let w = 0; w < G.waveTotal; w++) {
      const group = [];
      const count = 3;
      for (let i = 0; i < count; i++) {
        group.push(pool[cursor % pool.length]);
        cursor++;
      }
      G.waveGroups.push(group);
    }
    G.wave = 0;
    startNextWave();
  }

  function startNextWave() {
    if (!G.level || !G.level.waves) return;
    if (G.wave >= G.waveTotal) return;
    G.wave++;
    const group = G.waveGroups[G.wave - 1] || ['crawler'];
    group.forEach((typeKey) => {
      const pos = randomOpenCell(4.5, true);
      spawnEnemy(typeKey, pos.x + rand(-0.2, 0.2), pos.y + rand(-0.2, 0.2), { burst: true });
    });
    sfx('glitch');
    addShake(4);
    showSubtitle('// GEÇİT KONTROLÜ', `DALGA ${G.wave} / ${G.waveTotal}. GEÇİT HÂLÂ KAPALI.`, 3600);
    showNotify(`DALGA ${G.wave} // ${group.length} VARLIK`, 'warn');
    refreshObjective(true);
  }

  function unlockExit(message = 'ÇIKIŞ GEÇİDİ AÇILDI.') {
    if (G.exitOpen) return;
    G.exitOpen = true;
    G.exitReason = '';
    sfx('unlock');
    showFeed(message, 'good');
    showToast(message);
    if (G.exits.length) {
      const gate = G.exits[0];
      ENGINE.burst(gate.x, gate.y, 0.55, '#b8ff5a', 16, { speed: 1.6, size: 0.04, life: 0.9 });
    }
    refreshObjective();
  }

  function exitLockReason() {
    const lv = G.level;
    if (!lv) return 'SİSTEM: ÇIKIŞ YOK.';
    if (lv.boss && G.boss) return 'YÖNETİCİ SÜRECİ HÂLÂ AKTİF.';
    if (lv.boss && !G.bossDead) return 'YÖNETİCİ SÜRECİ HÂLÂ AKTİF.';
    if (lv.filesDetail && !lv.final && G.files.remaining > 0) return `GHOST DOSYALARI SİLİNMEDEN ÇIKIŞ YOK. (${G.files.remaining} KALDI)`;
    if (lv.filePuzzle && !levelNoteAcquired(lv)) return 'ARŞİV KASASI MÜHÜRLÜ. KASA NOTUNU BUL.';
    if (lv.terminal && !G.codeEntered) return 'SEKTÖR KİLİDİ KAPALI. YAN TERMİNALİ OKU.';
    if (lv.waves && G.wave < G.waveTotal) return 'DALGA PROTOKOLÜ AKTİF.';
    if (lv.final) return 'KÖK TERMİNALİNE BAĞLANMALISIN.';
    const alive = aliveEnemies().length;
    if (alive > 0) return `SİSTEM: ${alive} VARLIK HÂLÂ AKTİF.`;
    return 'ÇIKIŞ KİLİTLİ.';
  }

  function refreshObjective(force = false) {
    if (!G.level) return;
    const lv = G.level;
    const alive = aliveEnemies().length;
    let text = lv.objective;
    if (lv.final) {
      if (G.finale.deleted) text = 'ROOT_ANOMALY.BIN SİLİNDİ. OTURUM SONLANIYOR.';
      else if (alive > 0) text = `KÖK TERMİNALİNİ KORUYAN ${alive} VARLIĞI TEMİZLE`;
      else text = 'KÖK TERMİNALİNE BAĞLAN [E]';
    } else if (lv.boss) {
      if (G.boss) {
        text = `${G.boss.name} YOK ET`;
        if (G.popups.size > 0) text += ` — ${G.popups.size} PENCEREYİ KAPAT [F]`;
      } else {
        text = G.exitOpen ? 'ÇIKIŞA ULAŞ' : 'YÖNETİCİ SÜRECİ SONLANDI';
      }
    } else if (lv.filesDetail) {
      if (G.files.remaining > 0) text = `GHOST DOSYALARI SİL: ${G.files.remaining} KALDI — GEZGİN [F2]`;
      else text = 'MEZAR KAPISI AÇILDI — ÇIKIŞA ULAŞ';
    } else if (lv.filePuzzle) {
      const door = doorById(lv.filePuzzle.door);
      if (door && !door.open) text = `DOSYA KİLİDİ: ${lv.filePuzzle.file} — KONSOL [F4]`;
      else if (!levelNoteAcquired(lv)) text = 'KASADAKİ NOTU OKU — [I] ENVANTER';
      else if (!G.codeEntered) text = 'SEKTÖR KİLİDİNİ AÇ — TERMİNALE [E]';
      else text = 'ÇIKIŞA ULAŞ';
    } else if (lv.terminal) {
      text = G.codeEntered ? 'ÇIKIŞA ULAŞ' : 'SEKTÖR KİLİDİNİ AÇ — TERMİNALE [E]';
    } else if (lv.waves) {
      if (G.wave < G.waveTotal) text = `DALGA ${Math.max(1, G.wave)}/${G.waveTotal} — ${alive} VARLIK`;
      else if (alive > 0) text = `SON DALGA — ${alive} VARLIK`;
      else text = 'GEÇİT AÇILDI — ÇIKIŞA ULAŞ';
    } else if (G.exitOpen) {
      text = 'ÇIKIŞA ULAŞ';
    } else if (alive > 0) {
      text = `${alive} VARLIK TEMİZLE — ÇIKIŞ KİLİTLİ`;
    } else {
      text = 'ÇIKIŞA ULAŞ';
    }
    if (force || text !== G.objectiveText) {
      G.objectiveText = text;
      setText('objectiveLabel', text);
    }
  }

  function findInteractable() {
    if (!G.player) return null;
    const p = G.player;
    let best = null;
    let bestD = 2.0;
    for (const t of G.terminals) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        const locked = G.level.final && aliveEnemies().length > 0;
        best = {
          kind: 'terminal', ref: t,
          prompt: G.level.final
            ? (locked ? 'TERMİNAL MÜHÜRLÜ' : 'KÖK TERMİNALİNE BAĞLAN')
            : 'SEKTÖR KİLİDİNİ AÇ',
        };
      }
    }
    for (const e of G.exits) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = {
          kind: 'exit', ref: e,
          prompt: G.exitOpen ? 'ÇIKIŞI AÇ' : 'KİLİTLİ ÇIKIŞ — [E] DENE',
        };
      }
    }
    for (const door of G.doors) {
      if (door.open) continue;
      const d = dist(p.x, p.y, door.x, door.y);
      if (d < bestD) {
        bestD = d;
        const reason = doorLockReason(door);
        best = {
          kind: 'door', ref: door,
          prompt: reason || (door.file ? (door.prompt || 'DOSYA KONSOLU [F4]') : 'KASAYI AÇ [E]'),
        };
      }
    }
    return best;
  }

  function interact() {
    if (G.mode !== 'playing' || G.fileConsole.open || G.keypadOpen) return;
    const target = findInteractable();
    if (!target) return;
    if (target.kind === 'exit') {
      if (G.exitOpen) completeLevel();
      else {
        sfx('denied');
        triggerGlitch();
        showFeed(exitLockReason(), 'bad');
        showToast(exitLockReason());
      }
      return;
    }
    if (target.kind === 'door') {
      tryOpenDoor(target.ref);
      return;
    }
    if (target.kind === 'terminal') {
      if (G.level.final) {
        if (aliveEnemies().length > 0) {
          sfx('denied');
          showFeed('TERMİNAL MÜHÜRLÜ. ÖNCE VARLIKLARI TEMİZLE.', 'bad');
          return;
        }
        openFinale();
      } else {
        openKeypad();
      }
    }
  }

  // --------------------------------------------------------------- side terminal / keypad
  function openSideTerminal(lv) {
    if (!window.limboOS || !lv.terminal) return;
    const t = lv.terminal;
    window.limboOS.openTerminal({
      title: t.title, code: t.code, lines: t.lines, footer: t.footer,
    }).catch(() => {});
  }

  const PUZZLE_SECONDS = 60;

  function startPuzzleChallenge(reason, seconds = PUZZLE_SECONDS) {
    const c = G.puzzleChallenge;
    const kind = reason || 'file';
    if (G.bsodActive || c.active || c.expired) return;
    if (c.solvedReasons && c.solvedReasons[kind]) return;
    if (!G.level) return;
    if (kind === 'keypad' && G.codeEntered) return;
    if (kind === 'file') {
      if (!G.level.filePuzzle) return;
      const fpDoor = doorById(G.level.filePuzzle.door);
      if (fpDoor && fpDoor.open) return;
    }
    const total = clamp(Number(seconds) || PUZZLE_SECONDS, 1, 600);
    c.active = true;
    c.solved = false;
    c.expired = false;
    c.paused = false;
    c.levelId = G.levelId;
    c.reason = reason || 'file';
    c.deadline = performance.now() + total * 1000;
    c.remaining = total;
    const block = $('puzzleBlock');
    if (block) block.classList.remove('hidden');
    updatePuzzleChallenge();
    showNotify('PUZZLE SAYACI BAŞLADI // 60 SANİYE', 'bad', 4200);
    showFeed('SÜRE DOLMADAN PUZZLE TAMAMLANMALI.', 'bad');
    sfx('denied');
  }

  function stopPuzzleChallenge(solved = false) {
    const c = G.puzzleChallenge;
    c.active = false;
    c.paused = false;
    if (solved) {
      c.solved = true;
      if (!c.solvedReasons) c.solvedReasons = Object.create(null);
      c.solvedReasons[c.reason] = true;
    }
    const block = $('puzzleBlock');
    if (block) {
      block.classList.add('hidden');
      block.classList.remove('urgent');
    }
  }

  function resetPuzzleChallenge() {
    const c = G.puzzleChallenge;
    c.active = false;
    c.solved = false;
    c.expired = false;
    c.paused = false;
    c.solvedReasons = Object.create(null);
    c.remaining = PUZZLE_SECONDS;
    c.levelId = 0;
    c.reason = '';
    c.deadline = 0;
    const block = $('puzzleBlock');
    if (block) {
      block.classList.add('hidden');
      block.classList.remove('urgent');
    }
    setText('puzzleCountdown', '01:00');
  }

  function updatePuzzleChallenge() {
    const c = G.puzzleChallenge;
    if (!c.active || c.paused || G.bsodActive) return;
    const remainingMs = c.deadline - performance.now();
    c.remaining = Math.max(0, remainingMs / 1000);
    const total = Math.max(0, Math.ceil(c.remaining));
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    setText('puzzleCountdown', `${pad2(mm)}:${pad2(ss)}`);
    setText('puzzleHint', c.reason === 'keypad' ? 'SEKTÖR KİLİDİ' : 'DOSYA KİLİDİ');
    const block = $('puzzleBlock');
    if (block) {
      block.classList.remove('hidden');
      block.classList.toggle('urgent', c.remaining <= 15);
    }
    if (remainingMs <= 0) triggerPuzzleBsod();
  }

  function triggerPuzzleBsod() {
    if (G.bsodActive) return;
    G.bsodActive = true;
    G.puzzleChallenge.active = false;
    G.puzzleChallenge.expired = true;
    G.firing = false;
    G.keys = Object.create(null);
    G.fileConsole.open = false;
    G.keypadOpen = false;
    stopPuzzlePoll();
    stopFilePoll();
    stopFinalPoll();
    closeExternalWindows();
    closeTerminal();
    releasePointer();
    hideAllOverlays();
    showOverlay('bsod');
    setMode('bsod');
    showHUD(false);
    setText('bsodDetail', (G.level && G.level.filePuzzle && G.level.filePuzzle.file) || 'SEKTOR_09.lock');
    try { LimboAudio.setPaused(true); } catch (_) {}
    sfx('glitch');
    addShake(14);
    flushFileSave();
    let pct = 0;
    const bar = $('bsodBar');
    const label = $('bsodPercent');
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 11 + Math.floor(Math.random() * 12));
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.textContent = String(pct);
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          if (window.limboOS && window.limboOS.quit) window.limboOS.quit().catch(() => {});
          else window.close();
        }, 1200);
      }
    }, 380);
  }

  function openKeypad() {
    if (G.mode !== 'playing' || G.keypadOpen) return;
    G.keypadOpen = true;
    G.codeBuffer = '';
    hideAllOverlays();
    showOverlay('keypad');
    setText('keypadDisplay', '_ _ _ _');
    setText('keypadError', '');
    releasePointer();
    startPuzzleChallenge('keypad');
    sfx('click');
  }

  function closeKeypad() {
    if (!G.keypadOpen) return;
    G.keypadOpen = false;
    hideAllOverlays();
    requestPointer();
    sfx('click');
  }

  function keypadInput(key) {
    if (!G.keypadOpen) return;
    sfx('click');
    if (key === 'C') {
      G.codeBuffer = '';
      setText('keypadError', '');
      setText('keypadDisplay', '_ _ _ _');
      return;
    }
    if (key === 'E') {
      const expected = (G.level.terminal && G.level.terminal.code) || '4719';
      if (G.codeBuffer === expected) {
        G.codeEntered = true;
        G.exitOpen = true;
        stopPuzzleChallenge(true);
        setText('keypadDisplay', expected.split('').join(' '));
        setText('keypadError', 'ERİŞİM ONAYLANDI');
        sfx('codeOk');
        if (window.limboOS) {
          window.limboOS.updateTerminal({
            code: expected,
            lines: [
              { text: '', kind: 'gap' },
              { text: '> kod doğrulandı.', kind: 'system' },
              { text: '> SEKTÖR KAPISI AÇILDI.', kind: 'warn' },
              { text: '> çıkış artık mümkün.', kind: 'dim' },
            ],
          }).catch(() => {});
        }
        setTimeout(() => {
          if (G.keypadOpen) {
            G.keypadOpen = false;
            hideAllOverlays();
            unlockExit('SEKTÖR KİLİDİ AÇILDI. ÇIKIŞA ULAŞ.');
            requestPointer();
          }
        }, 900);
      } else {
        sfx('denied');
        triggerGlitch();
        addShake(3);
        setText('keypadError', 'HATALI KOD // ERİŞİM REDDEDİLDİ');
        G.codeBuffer = '';
        setTimeout(() => { if (G.keypadOpen) setText('keypadDisplay', '_ _ _ _'); }, 380);
      }
      return;
    }
    if (!/^[0-9]$/.test(key) || G.codeBuffer.length >= 4) return;
    G.codeBuffer += key;
    const shown = G.codeBuffer.split('').join(' ');
    setText('keypadDisplay', shown + (G.codeBuffer.length < 4 ? ' ' + '_'.repeat(4 - G.codeBuffer.length).split('').join(' ') : ''));
    setText('keypadError', '');
  }

  // --------------------------------------------------------------- inventory / file console
  function setInventoryTab(tab) {
    G.inventoryTab = tab === 'notes' ? 'notes' : 'items';
    document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.invTab === G.inventoryTab);
    });
    $('invItems')?.classList.toggle('hidden', G.inventoryTab !== 'items');
    $('invNotes')?.classList.toggle('hidden', G.inventoryTab !== 'notes');
    renderInventory();
  }

  function selectInventoryItem(id) {
    G.selectedItem = id || null;
    const def = id && CONTENT.ITEMS[id];
    if (def && def.note) G.selectedNote = def.note;
    renderInventory();
  }

  function selectNote(id) {
    G.selectedNote = id || null;
    G.inventoryTab = 'notes';
    renderInventory();
    document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.invTab === 'notes');
    });
    $('invItems')?.classList.add('hidden');
    $('invNotes')?.classList.remove('hidden');
  }

  function renderInventory() {
    const itemsEl = $('invItems');
    const notesEl = $('invNotes');
    const detail = $('invDetail');
    if (!itemsEl || !notesEl) return;

    if (G.inventoryTab === 'notes' && !progress.notes.length) G.inventoryTab = 'items';
    const itemIds = progress.items.filter((id) => CONTENT.ITEMS[id]);

    itemsEl.replaceChildren();
    if (!itemIds.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'ENVANTER BOŞ // KATMANLARDA EŞYA ARA.';
      itemsEl.appendChild(empty);
    } else {
      for (const id of itemIds) {
        const def = CONTENT.ITEMS[id];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inv-card' + (G.selectedItem === id ? ' active' : '');
        const name = document.createElement('strong');
        name.textContent = def.name;
        const tag = document.createElement('span');
        tag.textContent = def.tag || def.kind.toUpperCase();
        btn.append(name, tag);
        btn.addEventListener('click', () => selectInventoryItem(id));
        itemsEl.appendChild(btn);
      }
    }

    notesEl.replaceChildren();
    if (!progress.notes.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'NOT YOK // KASALARI VE GİZLİ ODALARI ARA.';
      notesEl.appendChild(empty);
    } else if (G.inventoryTab === 'notes') {
      for (const id of progress.notes) {
        const note = CONTENT.NOTES[id];
        if (!note) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inv-note-card' + (G.selectedNote === id ? ' active' : '');
        const title = document.createElement('strong');
        title.textContent = note.title;
        const preview = document.createElement('span');
        preview.textContent = note.body.split('\n').find((line) => line.trim()) || '';
        btn.append(title, preview);
        btn.addEventListener('click', () => selectNote(id));
        notesEl.appendChild(btn);
      }
    }

    if (!detail) return;
    detail.replaceChildren();
    if (G.inventoryTab === 'notes') {
      const note = G.selectedNote && CONTENT.NOTES[G.selectedNote];
      if (!note) {
        detail.textContent = 'BİR NOT SEÇ.';
        return;
      }
      const title = document.createElement('h3');
      title.textContent = note.title;
      const body = document.createElement('div');
      body.className = 'inv-note-body';
      body.textContent = note.body;
      detail.append(title, body);
      return;
    }
    const def = G.selectedItem && CONTENT.ITEMS[G.selectedItem];
    if (!def) {
      detail.textContent = 'BİR EŞYA SEÇ.';
      return;
    }
    const title = document.createElement('h3');
    title.textContent = def.name;
    const tag = document.createElement('div');
    tag.className = 'inv-detail-tag';
    tag.textContent = def.tag || '';
    const desc = document.createElement('p');
    desc.textContent = def.desc || '';
    detail.append(title, tag, desc);
    if (def.kind === 'note' && def.note && CONTENT.NOTES[def.note]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'primary-btn';
      btn.textContent = 'NOTU OKU';
      btn.addEventListener('click', () => selectNote(def.note));
      detail.appendChild(btn);
    } else if (def.kind === 'key') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn';
      btn.textContent = 'KARTI GÖSTER';
      btn.addEventListener('click', () => {
        showNotify('KART_08 // KATMAN 08 KASASINDA KULLANILIR', '', 3000);
        sfx('click');
      });
      detail.appendChild(btn);
    } else if (def.kind === 'upgrade') {
      const note = document.createElement('div');
      note.className = 'inv-passive';
      note.textContent = 'PASİF YÜKSELTME // OTOMATİK UYGULANDI';
      detail.appendChild(note);
    }
  }

  function openInventory() {
    if (G.mode !== 'playing' || !G.level) return;
    if (G.puzzleChallenge.active) {
      showNotify('PUZZLE SÜRESİ İŞLİYOR // ENVANTER KAPALI', 'warn', 2400);
      sfx('denied');
      return;
    }
    G.firing = false;
    G.keys = Object.create(null);
    setMode('inventory');
    hideAllOverlays();
    showOverlay('inventory');
    showHUD(false);
    releasePointer();
    G.selectedItem = G.selectedItem || progress.items.find((id) => CONTENT.ITEMS[id]) || null;
    setInventoryTab(G.inventoryTab || 'items');
    sfx('click');
  }

  function closeInventory() {
    if (G.mode !== 'inventory') return;
    hideAllOverlays();
    setMode('playing');
    showHUD(true);
    requestPointer();
    sfx('click');
  }

  function renderFileConsole() {
    const fc = G.fileConsole;
    setText('fcPath', fc.file || '---');
    const area = $('fcContent');
    if (area && area.value !== fc.content) area.value = fc.content;
    setText('fcStatus', fc.status || 'HAZIR');
    const list = $('fcList');
    if (list) {
      list.replaceChildren();
      const lv = G.level;
      const fp = lv && lv.filePuzzle;
      if (fp) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fc-file active';
        const name = document.createElement('strong');
        name.textContent = fp.file;
        const meta = document.createElement('span');
        meta.textContent = 'YAZILABİLİR // TOKEN GEREKLİ';
        btn.append(name, meta);
        btn.addEventListener('click', () => { G.fileConsole.file = fp.file; readFileConsole(); });
        list.appendChild(btn);
      } else {
        list.textContent = 'BU KATMANDA DOSYA BULMACASI YOK.';
      }
    }
  }

  async function readFileConsole() {
    const fc = G.fileConsole;
    if (!fc.open || !fc.file) return;
    const lv = G.level;
    const fp = lv && lv.filePuzzle;
    fc.status = 'OKUNUYOR...';
    renderFileConsole();
    if (!window.limboOS || !window.limboOS.sandboxRead) {
      fc.content = fc.content || (fp && fp.initial) || '';
      fc.status = 'SİMÜLASYON // DOSYA SİSTEMİ YOK';
      renderFileConsole();
      return;
    }
    try {
      const res = await window.limboOS.sandboxRead(fc.file);
      if (res && res.ok) {
        fc.content = String(res.content || '');
        fc.status = `OKUNDU // ${res.size} BAYT`;
      } else {
        fc.content = (fp && fp.initial) || '';
        fc.status = `OKUNAMADI // ${(res && res.error) || 'BİLİNMEYEN'}`;
      }
    } catch (_) {
      fc.status = 'OKUMA HATASI';
    }
    renderFileConsole();
  }

  async function writeFileConsole() {
    const fc = G.fileConsole;
    if (!fc.open || !fc.file) return;
    const area = $('fcContent');
    const content = area ? String(area.value || '') : String(fc.content || '');
    const lv = G.level;
    const fp = lv && lv.filePuzzle;
    if (content.length > 8192) {
      fc.status = 'YAZMA REDDEDİLDİ // İÇERİK ÇOK BÜYÜK';
      renderFileConsole();
      sfx('denied');
      return;
    }
    fc.status = 'YAZILIYOR...';
    renderFileConsole();
    let ok = false;
    let error = '';
    if (window.limboOS && window.limboOS.sandboxWrite) {
      try {
        const res = await window.limboOS.sandboxWrite(fc.file, content);
        ok = Boolean(res && res.ok);
        error = (res && res.error) || '';
      } catch (_) {
        error = 'IPC_HATASI';
      }
    } else {
      ok = true;
      fc.status = 'SİMÜLASYON // YAZILDI';
    }
    if (!ok) {
      fc.status = `YAZILAMADI // ${error || 'BİLİNMEYEN'}`;
      sfx('denied');
      renderFileConsole();
      return;
    }
    fc.content = content;
    fc.status = 'YAZILDI // DOSYA GÜNCELLENDİ';
    renderFileConsole();
    sfx('codeOk');
    if (fp && content.includes(fp.token)) {
      stopPuzzleChallenge(true);
      const door = doorById(fp.door);
      if (door && !door.open) {
        openDoor(door);
        fc.status = 'TOKEN DOĞRULANDI // KASA AÇILDI';
        renderFileConsole();
      }
    } else if (fp) {
      fc.status = 'YAZILDI // TOKEN DOĞRULANMADI';
      renderFileConsole();
      showNotify('DOSYA YAZILDI // TOKEN DOĞRULANMADI', 'warn', 3400);
    }
  }

  function openFileConsole(fileName, door) {
    if (G.mode !== 'playing' || !G.level || G.keypadOpen) return;
    const fp = G.level.filePuzzle;
    if (!fp) {
      showNotify('DOSYA KONSOLU BU KATMANDA YOK', 'warn', 2600);
      return;
    }
    if (G.mapOpen) toggleMap(false);
    G.firing = false;
    G.keys = Object.create(null);
    G.fileConsole = {
      open: true,
      file: fileName || fp.file,
      content: '',
      status: 'DOSYA OKUNUYOR...',
      source: 'in-game',
      targetDoor: (door && door.id) || fp.door,
    };
    hideAllOverlays();
    showOverlay('fileConsole');
    showHUD(true);
    releasePointer();
    renderFileConsole();
    readFileConsole();
    startPuzzleChallenge('file');
    sfx('click');
  }

  function closeFileConsole() {
    const fc = G.fileConsole;
    if (!fc.open) return;
    fc.open = false;
    hideAllOverlays();
    requestPointer();
    const door = doorById(fc.targetDoor);
    if (door && !door.open) showFeed('KASA HÂLÂ MÜHÜRLÜ // DOĞRU TOKEN GEREKLİ', 'warn');
    sfx('click');
  }

  function dismissFileConsole(hide = true) {
    G.fileConsole.open = false;
    if (hide) toggleHidden('fileConsole', true);
  }

  // --------------------------------------------------------------- file sandbox
  function stopFilePoll() {
    if (G.files.timer) {
      clearInterval(G.files.timer);
      G.files.timer = null;
    }
  }

  function openSandbox(fileName) {
    if (!window.limboOS) {
      showNotify('DOSYA GEZGİNİ YOK', 'bad');
      return;
    }
    window.limboOS.openSandbox(fileName || null).then((res) => {
      if (res && res.ok) showNotify('SANDBOX AÇILDI', '', 2600);
    }).catch(() => showNotify('SANDBOX AÇILAMADI', 'bad'));
    sfx('click');
  }

  async function prepareGhostFiles(lv) {
    const detail = lv.filesDetail;
    if (!detail) return;
    G.files.active = true;
    G.files.names = detail.names.slice();
    G.files.remaining = detail.names.length;
    G.files.unlocked = false;
    G.files.prepared = false;
    G.files.status = {};
    G.files.levelId = lv.id;
    if (!window.limboOS) {
      showFeed('SANDBOX BAĞLANTISI YOK — DOSYALAR SİMÜLE EDİLİYOR.', 'warn');
      return;
    }
    try {
      await window.limboOS.sandboxPrepare(detail.names.map((name) => ({
        name,
        content: detail.contents[name] || '',
      })));
      G.files.prepared = true;
    } catch (_) {
      showFeed('SANDBOX HAZIRLANAMADI.', 'bad');
    }
    startGhostPoll(lv);
  }

  function startGhostPoll(lv) {
    stopFilePoll();
    const lid = lv.id;
    const tick = async () => {
      if (!G.files.active || G.levelId !== lid) return;
      if (!window.limboOS) return;
      try {
        const status = await window.limboOS.sandboxStatus(G.files.names);
        if (G.levelId !== lid || G.files.levelId !== lid) return;
        updateGhostStatus(status);
      } catch (_) {}
    };
    tick();
    G.files.timer = setInterval(tick, 950);
  }

  function updateGhostStatus(status) {
    if (!status) return;
    const before = G.files.remaining;
    let remaining = 0;
    G.files.status = status;
    G.files.names.forEach((name) => { if (status[name]) remaining++; });
    G.files.remaining = remaining;
    if (remaining !== before) {
      if (remaining < before) {
        sfx('fileDeleted');
        showNotify(`DOSYA SİLİNDİ // ${remaining} KALDI`, '', 3200);
        showFeed(`GHOST dosyası yok edildi. ${remaining} kaldı.`, 'good');
        triggerGlitch();
        if (remaining === 0 && !G.files.unlocked) {
          G.files.unlocked = true;
          stopFilePoll();
          if (G.exitOpen) return;
          G.exitOpen = true;
          sfx('unlock');
          showSubtitle('// DOSYA MEZARLIĞI', 'ÜÇ MEZAR BOŞ KALDI. AMA BİR DÖRDÜNCÜ MEZARIN KAPAĞI AÇIK.', 6000);
          showToast('MEZAR KAPISI AÇILDI');
          refreshObjective();
          updateGhostStatus(status);
          return;
        }
      }
      refreshObjective();
    }
    if (remaining === 0 && !G.files.unlocked && G.files.prepared) {
      G.files.unlocked = true;
      stopFilePoll();
      G.exitOpen = true;
      sfx('unlock');
      showToast('MEZAR KAPISI AÇILDI');
      refreshObjective();
    }
  }

  // --------------------------------------------------------------- external popups
  function simulatePopup(opts) {
    const key = 'sim' + (++G.popupSeq);
    const entry = { kind: 'sim', key, opts, timer: null };
    G.popups.set(key, entry);
    const life = Math.max(1200, Number(opts.life) || 9000);
    entry.timer = setTimeout(() => removePopup(key), life);
    updatePopupHud();
    showFeed(`[PENCERE] ${opts.title || 'LİMBO_OS'}`, opts.severity === 'boss' ? 'bad' : 'warn');
    afterPopupChange();
  }

  function spawnExternalPopup(opts) {
    if (!opts) return;
    const isBoss = opts.severity === 'boss';
    const density = Number(settings.popups);
    const useOS = Boolean(window.limboOS) && density > 0;
    if (!useOS || (!isBoss && density === 1 && Math.random() < 0.5)) {
      if (density === 0 && !isBoss) return;
      simulatePopup(opts);
      return;
    }
    G.popupSeq++;
    window.limboOS.spawnPopup({
      title: opts.title || 'LIMBO_OS',
      body: opts.body || '',
      tag: opts.tag || 'SYSTEM',
      severity: opts.severity || 'error',
      buttons: opts.buttons || ['TAMAM'],
      puzzle: opts.puzzle || null,
      life: opts.life || 0,
      glitch: true,
    }).then((res) => {
      if (!res || !res.id) {
        simulatePopup(opts);
        return;
      }
      const key = 'os' + res.id;
      const entry = { kind: 'os', key, id: res.id, opts, timer: null };
      entry.timer = setTimeout(() => {
        if (!G.popups.has(key)) return;
        removePopup(key, true);
      }, Math.max(4000, (opts.life || 14000) + 1200));
      G.popups.set(key, entry);
      updatePopupHud();
      sfx('popup');
      afterPopupChange();
    }).catch(() => simulatePopup(opts));
  }

  function removePopup(key, closeWindow) {
    const entry = G.popups.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    G.popups.delete(key);
    if (closeWindow && entry.kind === 'os' && window.limboOS) {
      window.limboOS.closePopup(entry.id).catch(() => {});
    }
    updatePopupHud();
    afterPopupChange();
  }

  function closeOnePopup() {
    if (!G.popups.size) {
      showFeed('HARİCİ PENCERE YOK.', 'warn');
      return;
    }
    const keys = Array.from(G.popups.keys());
    const key = keys[keys.length - 1];
    const entry = G.popups.get(key);
    sfx('click');
    if (entry && entry.kind === 'os' && window.limboOS) {
      removePopup(key);
      window.limboOS.closePopup(entry.id).catch(() => {});
    } else {
      removePopup(key);
    }
  }

  function closeExternalWindows() {
    for (const [, entry] of G.popups) {
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.kind === 'os' && window.limboOS) {
        window.limboOS.closePopup(entry.id).catch(() => {});
      }
    }
    G.popups.clear();
    updatePopupHud();
  }

  function afterPopupChange() {
    const boss = G.boss;
    if (!boss || boss.dead) return;
    if (G.popups.size > 0) {
      boss.wasShielded = true;
      boss.vulnerable = 0;
    } else if (boss.wasShielded) {
      boss.wasShielded = false;
      boss.vulnerable = 8;
      sfx('unlock');
      showFeed('YÖNETİCİ KALKANI KIRILDI — 8 SANİYE ATEŞ SERBEST.', 'good');
      triggerGlitch();
    }
  }

  function spawnBossShield(count = 1) {
    if (!G.boss) return;
    for (let i = 0; i < count; i++) {
      spawnExternalPopup({
        title: 'YÖNETİCİ KALKANI',
        tag: 'PROCESS_SHIELD',
        severity: 'boss',
        body: BOSS_POPUP_BODIES[Math.floor(Math.random() * BOSS_POPUP_BODIES.length)],
        buttons: ['TAMAM'],
        life: 45000,
      });
    }
  }

  function closeTerminal() {
    if (window.limboOS) window.limboOS.closeTerminal().catch(() => {});
  }

  // --------------------------------------------------------------- keypad & finale
  function openRootAnomaly() {
    if (!window.limboOS) {
      showNotify('DOSYA GEZGİNİ YALNIZCA MASAÜSTÜ SÜRÜMÜNDE', 'warn', 4000);
      return;
    }
    window.limboOS.rootAnomalyOpen().then((res) => {
      if (res && res.path) showFeed(`ROOT_ANOMALY.BIN // ${res.path}`, 'warn');
      setTimeout(() => refreshFinalFiles(true), 1200);
    }).catch(() => {
      showNotify('DOSYA GEZGİNİ AÇILAMADI', 'bad', 3200);
    });
  }

  function openFinale() {
    if (!G.level || !G.level.final || G.mode !== 'playing') return;
    G.finale.active = true;
    G.finale.deleted = false;
    G.finale.started = true;
    G.finale.finalizing = false;
    G.finale.fileName = (G.level.filesDetail && G.level.filesDetail.names[0]) || 'root_anomaly.bin';
    G.finale.nagTick = 0;
    G.finale.nagNext = 8;
    setMode('finale');
    hideAllOverlays();
    showOverlay('finale');
    showHUD(false);
    releasePointer();
    setText('finaleCopy', 'Son katman çöktü. Çekirdeğe bağlı tek bir dosya kaldı. Onu yok etmek için kendi dosya gezginini kullanmalısın. Bu dosya silindiğinde LIMBO kapanacak. Sen de onunla birlikte.');
    setText('finaleStatus', 'DOSYA DURUMU KONTROL EDİLİYOR...');
    renderFinaleFiles({ exists: true });
    const detail = G.level.filesDetail;
    const content = detail && detail.contents ? detail.contents[G.finale.fileName] : '';
    if (window.limboOS) {
      window.limboOS.rootAnomalyPrepare(content || 'ROOT_ANOMALY.BIN\n').then((res) => {
        if (res && res.path) {
          G.finale.path = res.path;
          setText('filePath', res.path);
        }
        refreshFinalFiles(true);
        startFinalPoll();
      }).catch(() => {
        setText('finaleStatus', 'KÖK DOSYA KATMANI BAĞLANAMADI');
      });
    } else {
      setText('filePath', 'root_anomaly.bin');
      setText('finaleStatus', 'ELEKTRON KÖK KATMANI GEREKLİ');
    }
    startFinalPoll();
    sfx('glitch');
    showSubtitle('// KÖK', 'DOSYA SİLİNMEDEN OTURUM KAPANMAZ. SİLME İŞLEMİNİ SEN YAPMALISIN.', 8000);
  }

  function renderFinaleFiles(status) {
    const list = $('fileList');
    if (!list) return;
    list.replaceChildren();
    const name = G.finale.fileName;
    const row = document.createElement('div');
    const exists = Boolean(status && (typeof status.exists === 'boolean' ? status.exists : status[name]));
    row.className = 'file-row' + (exists ? '' : ' missing');
    const fname = document.createElement('span');
    fname.className = 'fname';
    fname.textContent = name;
    const state = document.createElement('span');
    state.className = 'fstate';
    state.textContent = exists ? 'MEVCUT' : 'SİLİNDİ';
    row.append(fname, state);
    list.appendChild(row);
    if (!exists && G.finale.started) {
      setText('finaleStatus', 'DOSYA SİLİNDİ // OTURUM SONLANDIRILIYOR');
    }
  }

  function finaleNag() {
    if (G.mode !== 'playing' && G.mode !== 'finale') return;
    const pool = CONTENT.NAG_LINES || ['$USER. DOSYA HÂLÂ ORADA.'];
    const line = replaceUser(pool[Math.floor(Math.random() * pool.length)]);
    setText('finaleStatus', 'SİLMEYİ BEKLİYORUM // DOSYA HÂLÂ MEVCUT');
    showFeed(line, 'bad');
    showSubtitle('// KÖK', line, 6500);
    sfx('nag');
    triggerGlitch();
    G.finale.nagTick = 0;
    G.finale.nagNext = Math.floor(rand(9, 16));
    if (Math.random() < 0.62) {
      spawnExternalPopup({
        title: 'SİLİNMEDİ',
        tag: 'ROOT_ANOMALY',
        severity: Math.random() < 0.5 ? 'error' : 'ghost',
        body: line + '\n\nDOSYA: ' + (G.finale.path || 'root_anomaly.bin'),
        buttons: ['BEKLİYORUM', 'TAMAM'],
        life: 16000,
      });
    }
    if (settings.spill && Math.random() < 0.4) maybeTriggerSpill(true);
    if (Math.random() < 0.32) flashGpu(700);
  }

  async function refreshFinalFiles(manual = false) {
    if (!window.limboOS || !G.finale.fileName || G.finale.finalizing) return;
    try {
      const status = await window.limboOS.rootAnomalyStatus();
      if (status && status.path) {
        G.finale.path = status.path;
        setText('filePath', status.path);
      }
      renderFinaleFiles(status);
      const exists = Boolean(status && status.exists);
      if (!exists) {
        if (!G.finale.deleted) {
          G.finale.deleted = true;
          stopFinalPoll();
          setText('finaleStatus', 'DOSYA SİLİNDİ // OTURUM SONLANDIRILIYOR');
          sfx('fileDeleted');
          pulseScreen('screen-shake', 1000);
          flashGpu(1200);
          window.limboOS.finalizeMeta({ reason: 'root_anomaly_deleted' }).catch(() => {});
          triggerFinalEnding();
        }
      } else {
        setText('finaleStatus', manual ? 'DOSYA HÂLÂ MEVCUT. SİLMEYİ BEKLİYORUM.' : 'DOSYA BEKLENİYOR...');
      }
    } catch (_) {}
  }

  function startFinalPoll() {
    stopFinalPoll();
    G.finale.timer = setInterval(() => {
      if (G.finale.deleted || !G.finale.started) return;
      if (G.mode !== 'finale' && G.mode !== 'playing') return;
      refreshFinalFiles(false);
      if (G.finale.deleted) return;
      G.finale.nagTick = (G.finale.nagTick || 0) + 1;
      if (G.finale.nagTick >= (G.finale.nagNext || 10)) finaleNag();
    }, 1000);
  }

  function stopFinalPoll() {
    if (G.finale.timer) {
      clearInterval(G.finale.timer);
      G.finale.timer = null;
    }
  }

  function closeFinale() {
    if (G.mode !== 'finale' || G.finale.deleted) return;
    // Polling deliberately continues: the anomaly keeps nagging and the
    // ending fires the moment the file disappears, even if the panel is shut.
    G.finale.active = false;
    hideAllOverlays();
    setMode('playing');
    showHUD(true);
    requestPointer();
    showNotify('DOSYA HÂLÂ SİLİNMEDİ // SİSTEM İZLİYOR', 'warn', 4200);
    sfx('click');
  }

  // --------------------------------------------------------------- physics / rays
  function isWallAt(x, y) {
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= G.mapW || my >= G.mapH) return true;
    return isWallChar(G.map[my][mx]);
  }

  function circleBlocked(x, y, radius) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (cx < 0 || cy < 0 || cx >= G.mapW || cy >= G.mapH) return true;
        if (isWallChar(G.map[cy][cx])) return true;
      }
    }
    return false;
  }

  function castWall(x, y, angle, maxDist = 40) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let mapX = Math.floor(x);
    let mapY = Math.floor(y);
    if (mapX < 0 || mapY < 0 || mapX >= G.mapW || mapY >= G.mapH) return 0;
    const deltaX = Math.abs(1 / (dx || 0.000001));
    const deltaY = Math.abs(1 / (dy || 0.000001));
    let stepX;
    let stepY;
    let sideX;
    let sideY;
    if (dx < 0) { stepX = -1; sideX = (x - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - x) * deltaX; }
    if (dy < 0) { stepY = -1; sideY = (y - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - y) * deltaY; }
    let distance = 0;
    for (let i = 0; i < 128; i++) {
      if (sideX < sideY) {
        distance = sideX;
        sideX += deltaX;
        mapX += stepX;
      } else {
        distance = sideY;
        sideY += deltaY;
        mapY += stepY;
      }
      if (distance > maxDist) return maxDist;
      if (mapX < 0 || mapY < 0 || mapX >= G.mapW || mapY >= G.mapH) return distance;
      if (isWallChar(G.map[mapY][mapX])) return distance;
    }
    return maxDist;
  }

  function hasLOS(ax, ay, bx, by) {
    const d = dist(ax, ay, bx, by);
    if (d < 0.05) return true;
    const angle = Math.atan2(by - ay, bx - ax);
    return castWall(ax, ay, angle, d + 0.1) >= d - 0.06;
  }

  function moveWithCollision(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (!circleBlocked(nx, entity.y, radius)) entity.x = nx;
    const ny = entity.y + dy;
    if (!circleBlocked(entity.x, ny, radius)) entity.y = ny;
  }

  function nearestOpenCellNear(x, y, minD, maxD) {
    const options = G.openCells.filter((c) => {
      const d = dist(c.x, c.y, x, y);
      return d >= minD && d <= maxD && !circleBlocked(c.x, c.y, 0.4);
    });
    if (!options.length) return randomOpenCell(3, true);
    return options[Math.floor(Math.random() * options.length)];
  }

  // --------------------------------------------------------------- combat
  // The renderer composes the horizon from pitch, walking bob and the jump
  // height (all expressed as screen-pixel offsets on the 480x270 canvas).
  // Converting that offset back to a world slope makes shots follow the actual
  // centre of the crosshair, including up/down aim and airborne shots, instead
  // of always travelling on the horizontal plane.  The projection's centre
  // line starts at world height 0.5, so the same origin is used here.
  const RENDER_H = 270;

  function aimSlope(extra = 0) {
    const p = G.player;
    if (!p) return extra;
    const screenOffset = (p.pitch || 0) + (p.bob || 0) + (p.z || 0) * RENDER_H * 0.72;
    return clamp(screenOffset / RENDER_H + extra, -0.94, 0.94);
  }

  function playerEyeZ() {
    return 0.5;
  }

  function traceShot(angle, maxDist = 40, slope = aimSlope()) {
    const p = G.player;
    const ox = p.x;
    const oy = p.y;
    const oz = playerEyeZ();
    const wall = castWall(ox, oy, angle, maxDist);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let best = null;
    let bestT = Infinity;
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      const dx = e.x - ox;
      const dy = e.y - oy;
      const r = e.radius + (e.boss ? 0.28 : 0.08);
      const along = dx * c + dy * s;
      const perp2 = dx * dx + dy * dy - along * along;
      if (perp2 > r * r) continue;
      const entry0 = along - Math.sqrt(Math.max(0, r * r - perp2));
      const exit0 = along + Math.sqrt(Math.max(0, r * r - perp2));
      if (exit0 <= 0.1) continue;
      const tIn = Math.max(0.1, entry0);
      const tOut = Math.min(exit0, maxDist, wall);
      if (tOut < tIn) continue;
      const zBase = e.z || 0;
      const zTop = zBase + (e.height || 0.7);
      let enter = tIn;
      let exit = tOut;
      if (Math.abs(slope) < 1e-5) {
        if (oz < zBase || oz > zTop) continue;
      } else {
        const ta = (zBase - oz) / slope;
        const tb = (zTop - oz) / slope;
        enter = Math.max(tIn, Math.min(ta, tb));
        exit = Math.min(tOut, Math.max(ta, tb));
        if (exit < enter) continue;
      }
      const t = Math.max(0.1, enter);
      if (t < bestT) {
        bestT = t;
        best = e;
      }
    }
    const hitDist = best ? bestT : wall;
    return {
      enemy: best, dist: hitDist, wall, angle, slope, originZ: oz,
      z: oz + slope * hitDist,
    };
  }

  function pickEnemyInRay(angle, maxDist = 40, slope = aimSlope()) {
    return traceShot(angle, maxDist, slope).enemy;
  }

  function addStyle(amount) {
    G.style = Math.min(4000, G.style + amount);
    G.combo++;
    G.comboTimer = 3.8;
    G.styleIdle = 0;
  }

  function damageEnemy(e, amount, source = 'shot') {
    if (!e || e.dead || G.mode !== 'playing') return 0;
    if (e.boss && G.popups.size > 0) {
      e.flash = Math.max(e.flash, 0.45);
      if (G.bossBlockCooldown <= 0) {
        G.bossBlockCooldown = 0.8;
        sfx('bossShield');
        showFeed(`${G.boss.name} KALKANI: ${G.popups.size} PENCERE AÇIK — [F] KAPAT.`, 'bad');
        addShake(2);
      }
      ENGINE.burst(e.x + rand(-0.3, 0.3), e.y + rand(-0.3, 0.3), rand(0.4, 1.4), '#ff5b5b', 6, { speed: 1.5, size: 0.03, life: 0.5 });
      return 0;
    }
    let finalDamage = amount;
    if (e.type && e.type.armor) finalDamage *= (1 - e.type.armor);
    e.hp -= finalDamage;
    e.flash = 1;
    hitmarker();
    sfx('hit');
    addStyle(6 + Math.min(18, Math.floor(amount)));
    const z = e.z + (e.height || 0.6) * rand(0.35, 0.8);
    ENGINE.burst(e.x, e.y, z, e.color || '#b7ff7a', source === 'core' ? 12 : 5, {
      speed: source === 'core' ? 2.4 : 1.2, size: 0.035, life: 0.55,
    });
    if (e.hp <= 0) killEnemy(e, source);
    else if (e.boss) checkBossPhase(e);
    return finalDamage;
  }

  function killEnemy(e, source) {
    if (e.dead) return;
    e.dead = true;
    G.kills++;
    G.totalKills++;
    sfx('kill');
    addShake(e.boss ? 15 : 2.5);
    addStyle(e.boss ? 320 : Math.max(16, Math.round((e.type.score || 100) / 8)));
    G.combo += e.boss ? 8 : 1;
    G.comboTimer = 4.5;
    ENGINE.burst(e.x, e.y, (e.z || 0) + (e.height || 0.7) * 0.55, e.color || '#b7ff7a', e.boss ? 60 : 18, {
      speed: e.boss ? 3.4 : 1.8, size: 0.045, life: e.boss ? 1.6 : 0.9, gravity: 2.2,
    });
    spawnDataOrbs(e);
    if (e.boss) {
      bossDefeated(e);
      return;
    }
    if (!e.minion) {
      refreshObjective();
      checkLevelCleared();
    }
  }

  function spawnDataOrbs(e) {
    const count = e.boss ? 9 : e.typeKey === 'brute' ? 4 : 2;
    const value = e.boss ? 9 : e.typeKey === 'brute' ? 7 : Math.round(rand(3, 6));
    for (let i = 0; i < count; i++) {
      G.dataOrbs.push({
        x: e.x + rand(-0.2, 0.2), y: e.y + rand(-0.2, 0.2), z: e.z + rand(0.25, 0.7),
        vx: rand(-0.9, 0.9), vy: rand(-0.9, 0.9), vz: rand(0.5, 1.5),
        value: value + (e.boss ? 1 : 0), age: 0, delay: rand(0.15, 0.55),
        life: 9, color: e.color || '#b7ff7a', taken: false,
      });
    }
  }

  function updateDataOrbs(dt) {
    const p = G.player;
    if (!p) return;
    for (let i = G.dataOrbs.length - 1; i >= 0; i--) {
      const o = G.dataOrbs[i];
      o.age += dt;
      o.life -= dt;
      if (o.life <= 0) { G.dataOrbs.splice(i, 1); continue; }
      if (o.age < o.delay) continue;
      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < 7) {
        const pull = 7 + (7 - d) * 6;
        o.vx += (dx / Math.max(0.001, d)) * pull * dt;
        o.vy += (dy / Math.max(0.001, d)) * pull * dt;
        o.vz += (0.6 - o.z) * 3 * dt;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.z += o.vz * dt;
      o.vx *= 1 - 2.0 * dt;
      o.vy *= 1 - 2.0 * dt;
      o.vz *= 1 - 2.4 * dt;
      o.z = Math.max(0.1, o.z);
      if (d < 0.5) {
        p.hp = Math.min(p.maxHp, p.hp + o.value);
        sfx('pickup');
        addStyle(4);
        if (p.hp < p.maxHp) showNotify(`VERİ AKIŞI +${o.value}`, '', 900);
        G.dataOrbs.splice(i, 1);
      }
    }
    if (G.dataOrbs.length > 70) G.dataOrbs.splice(0, G.dataOrbs.length - 70);
  }

  function updatePickups(dt) {
    const p = G.player;
    for (const item of G.pickups) {
      if (item.taken) continue;
      item.bob += dt * 2.4;
      if (dist(p.x, p.y, item.x, item.y) < 0.58 && p.hp < p.maxHp) {
        item.taken = true;
        p.hp = Math.min(p.maxHp, p.hp + 30);
        sfx('pickup');
        showNotify('BÜTÜNLÜK +30', '', 1500);
        ENGINE.burst(item.x, item.y, 0.35, '#b8ff5a', 18, { speed: 1.4, size: 0.04, life: 0.8 });
      }
    }
  }

  function damagePlayer(amount, opts = {}) {
    if (G.mode !== 'playing' || !G.player) return;
    const p = G.player;
    if (p.iframe > 0 && !opts.ignoreIframe) return;
    if (p.dashTimer > 0.02 && !opts.ignoreIframe) {
      addStyle(14);
      showNotify('ATILMA // HASARSIZ', '', 700);
      return;
    }
    p.hp -= amount;
    p.iframe = opts.ignoreIframe ? 0.2 : 0.42;
    G.combo = 0;
    G.style = Math.max(0, G.style - 10);
    flashDamage();
    addShake(5 + amount * 0.12);
    sfx('hurt');
    triggerGlitch();
    if (p.hp <= 0) {
      p.hp = 0;
      die();
      return;
    }
    if (p.hp <= 30) {
      showSubtitle('// SİSTEM', WHISPERS[Math.floor(Math.random() * WHISPERS.length)], 4200);
    }
  }

  function checkBossPhase(boss) {
    if (!boss || boss.dead) return;
    const ratio = boss.hp / boss.maxHp;
    const desired = clamp(1 + Math.floor((1 - ratio) * boss.phases), 1, boss.phases);
    if (desired > boss.phase) {
      boss.phase = desired;
      const count = Math.min(3, boss.phase);
      spawnBossShield(count);
      sfx('bossShield');
      addShake(8);
      triggerGlitch();
      showNotify(`FAZ ${boss.phase} // KALKAN YENİLENDİ`, 'bad', 5000);
      showSubtitle('// YÖNETİCİ', 'YENİ PENCERELER AÇILDI. KALKANI KIRMAK İÇİN [F].', 4500);
      boss.vulnerable = 0;
      boss.wasShielded = true;
    }
    updateBossBar();
  }

  function bossDefeated(e) {
    G.boss = null;
    G.bossDead = true;
    G.exitOpen = true;
    sfx('bossSpawn');
    addShake(18);
    triggerGlitch();
    flashFreeze();
    showSubtitle('// SİSTEM', 'YÖNETİCİ SÜRECİ SONLANDI. KAPILAR AÇILIYOR.', 6000);
    showToast('YÖNETİCİ YOK EDİLDİ — ÇIKIŞA ULAŞ', 4600);
    updateBossBar();
    const lid = G.levelId;
    setTimeout(() => {
      if (G.levelId !== lid) return;
      closeExternalWindows();
      unlockExit('YÖNETİCİ SÜRECİ SONLANDI. ÇIKIŞA ULAŞ.');
    }, 1300);
    refreshObjective();
    checkLevelCleared();
  }

  function checkLevelCleared() {
    if (!G.level || G.mode !== 'playing') return;
    const lv = G.level;
    const alive = aliveEnemies();
    if (lv.boss) {
      if (!G.boss && G.bossDead && !G.exitOpen) unlockExit('ÇIKIŞ GEÇİDİ AÇILDI.');
      return;
    }
    if (lv.final) {
      if (!alive.length && !G.hudWarned) {
        G.hudWarned = true;
        showSubtitle('// KÖK', 'TERMİNAL MÜHÜRÜ KALKTI. DOSYA SENİ BEKLİYOR.', 5000);
      }
      refreshObjective();
      return;
    }
    if (lv.filesDetail || lv.terminal) {
      refreshObjective();
      return;
    }
    if (lv.waves) {
      checkWaveCleared();
      return;
    }
    if (!alive.length && !G.exitOpen) unlockExit('KATMAN TEMİZLENDİ. ÇIKIŞ GEÇİDİ AÇILDI.');
  }

  function checkWaveCleared() {
    if (!G.level || !G.level.waves) return;
    const waveAlive = G.enemies.filter((e) => !e.dead && !e.minion && e.wave === G.wave).length;
    if (waveAlive > 0) return;
    if (G.wave < G.waveTotal) {
      if (!G.wavePending) {
        G.wavePending = true;
        G.waveTimer = 2.7;
        showNotify(`DALGA ${G.wave} TEMİZLENDİ`, '', 2400);
        sfx('unlock');
        addShake(3);
      }
    } else if (!G.exitOpen) {
      unlockExit('TÜM DALGALAR TEMİZLENDİ. GEÇİT AÇILDI.');
    }
    refreshObjective();
  }

  // --------------------------------------------------------------- weapons
  function fireWeapon() {
    if (G.mode !== 'playing' || G.cooldown > 0 || G.overheat) return;
    const w = WEAPONS[G.weapon];
    if (!w) return;
    const p = G.player;
    if (w.key === 'blade') {
      G.cooldown = 0.4;
      G.swing = 1;
      G.recoil = 0.7;
      sfx('shot', 'blade');
      bladeStrike();
    } else if (w.key === 'rifle') {
      G.cooldown = 0.135;
      G.heat = Math.min(1, G.heat + 0.085);
      G.recoil = 1;
      G.flash = 1;
      G.muzzle = 0.65;
      sfx('shot', 'rifle');
      addShake(1.2);
      rifleStrike();
      if (G.heat >= 1) {
        G.overheat = true;
        G.firing = false;
        showFeed('SEKTÖR TÜFEĞİ AŞIRI ISINDI.', 'bad');
        sfx('denied');
      }
    } else {
      G.cooldown = 0.82;
      G.heat = Math.min(1, G.heat + 0.24);
      G.recoil = 1;
      G.flash = 1;
      G.muzzle = 1;
      sfx('shot', 'shotgun');
      addShake(3);
      const coreSpeed = 9.2;
      const coreSlope = aimSlope();
      G.projectiles.push({
        x: p.x + Math.cos(p.angle) * 0.52,
        y: p.y + Math.sin(p.angle) * 0.52,
        z: playerEyeZ() + coreSlope * 0.52,
        vx: Math.cos(p.angle) * coreSpeed,
        vy: Math.sin(p.angle) * coreSpeed,
        vz: coreSlope * coreSpeed,
        friendly: true, damage: 82, explodeRadius: 2.35,
        life: 2.6, radius: 0.2, color: '#c9ff8a', name: 'orb_big', age: 0,
      });
      if (G.heat >= 1) {
        G.overheat = true;
        G.firing = false;
        showFeed('ÇEKİRDEK MAKİNESİ AŞIRI ISINDI.', 'bad');
        sfx('denied');
      }
    }
    if (G.switchAnim > 0.5) G.switchAnim = 0.2;
  }

  function bladeStrike() {
    const p = G.player;
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    const eye = playerEyeZ();
    const slope = aimSlope();
    let hits = 0;
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.85 + e.radius) continue;
      const dot = (dx / Math.max(0.001, d)) * c + (dy / Math.max(0.001, d)) * s;
      if (dot < 0.24) continue;
      // Check the crosshair line against the enemy's vertical extent instead
      // of using a flat 2D cone, so looking far up/down really misses.
      const lineZ = eye + slope * d;
      const low = (e.z || 0) - 0.3;
      const high = (e.z || 0) + (e.height || 0.7) + 0.3;
      if (lineZ < low || lineZ > high) continue;
      if (!hasLOS(p.x, p.y, e.x, e.y)) continue;
      damageEnemy(e, 34 + rand(0, 7), 'blade');
      hits++;
      addShake(2.5);
      if (hits >= 3) break;
    }
    if (!hits) {
      const wd = Math.min(1.5, castWall(p.x, p.y, p.angle, 1.6));
      ENGINE.burst(p.x + c * wd, p.y + s * wd, eye + slope * wd, '#d8ffb0', 3, { speed: 0.9, size: 0.025, life: 0.35 });
    }
    p.vx += c * 1.9;
    p.vy += s * 1.9;
  }

  function rifleStrike() {
    const p = G.player;
    const moving = Math.hypot(p.vx, p.vy) > 1;
    const spread = (p.grounded ? 0.006 : 0.015) + (moving ? 0.008 : 0);
    const angle = p.angle + rand(-spread, spread);
    const slope = aimSlope(rand(-spread, spread) * 0.8);
    const shot = traceShot(angle, 40, slope);
    G.lastShot = shot;
    if (shot.enemy) {
      damageEnemy(shot.enemy, 17 + rand(0, 5), 'rifle');
      ENGINE.burst(shot.enemy.x, shot.enemy.y, shot.z, '#fff6c9', 5, { speed: 1.1, size: 0.03, life: 0.35 });
      return;
    }
    if (!Number.isFinite(shot.dist) || shot.dist >= 39.9) return;
    const hx = p.x + Math.cos(angle) * shot.dist;
    const hy = p.y + Math.sin(angle) * shot.dist;
    ENGINE.burst(hx - Math.cos(angle) * 0.06, hy - Math.sin(angle) * 0.06, shot.z, '#c9b16a', 6, {
      speed: 1.1, size: 0.025, life: 0.4, gravity: 1.5,
    });
  }

  function explodeProjectile(pr) {
    addShake(5);
    sfx('kill');
    ENGINE.burst(pr.x, pr.y, pr.z, '#d7ff9d', 30, { speed: 3.2, size: 0.05, life: 0.9 });
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      const ez = (e.z || 0) + (e.height || 0.7) * 0.5;
      const d = Math.hypot(pr.x - e.x, pr.y - e.y, (pr.z || 0) - ez);
      const reach = pr.explodeRadius + e.radius + (e.height || 0.7) * 0.35;
      if (d > reach) continue;
      const falloff = clamp(1 - (d / reach) * 0.7, 0.3, 1);
      damageEnemy(e, pr.damage * falloff, 'core');
    }
    triggerGlitch();
  }

  function updateProjectiles(dt) {
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const pr = G.projectiles[i];
      pr.age += dt;
      pr.life -= dt;
      if (pr.life <= 0) {
        if (pr.friendly) explodeProjectile(pr);
        G.projectiles.splice(i, 1);
        continue;
      }
      const speed = Math.hypot(pr.vx, pr.vy);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.14));
      const sx = (pr.vx * dt) / steps;
      const sy = (pr.vy * dt) / steps;
      const sz = ((pr.vz || 0) * dt) / steps;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        pr.x += sx;
        pr.y += sy;
        pr.z += sz;
        if (pr.z <= 0.04) {
          pr.z = 0.04;
          if (pr.friendly) explodeProjectile(pr);
          else ENGINE.burst(pr.x, pr.y, pr.z, pr.color || '#ff7b64', 6, { speed: 1.1, size: 0.028, life: 0.35 });
          hit = true;
          break;
        }
        if (isWallAt(pr.x, pr.y)) {
          if (pr.friendly) explodeProjectile(pr);
          else ENGINE.burst(pr.x, pr.y, pr.z, pr.color || '#ff7b64', 8, { speed: 1.2, size: 0.03, life: 0.4 });
          hit = true;
          break;
        }
        if (pr.friendly) {
          for (const e of G.enemies) {
            if (!e || e.dead) continue;
            const ez = e.z || 0;
            const eh = e.height || 0.7;
            const vertical = pr.z >= ez - pr.radius && pr.z <= ez + eh + pr.radius;
            if (vertical && dist(pr.x, pr.y, e.x, e.y) < e.radius + pr.radius) {
              explodeProjectile(pr);
              hit = true;
              break;
            }
          }
        } else {
          const p = G.player;
          const bodyLow = (p.z || 0) - 0.08;
          const bodyHigh = (p.z || 0) + 1.72 - (p.crouch || 0) * 0.6;
          const vertical = pr.z >= bodyLow && pr.z <= bodyHigh;
          if (vertical && dist(pr.x, pr.y, p.x, p.y) < 0.36) {
            damagePlayer(pr.damage, { source: 'projectile' });
            hit = true;
            break;
          }
        }
      }
      if (hit) G.projectiles.splice(i, 1);
    }
  }

  function enemyShoot(e, angle, opts = {}) {
    const speed = opts.speed || (e.type && e.type.projectileSpeed) || 4;
    const z = opts.z != null ? opts.z : (e.z || 0) + (e.height || 0.8) * 0.55;
    const sx = e.x + Math.cos(angle) * (e.radius + 0.12);
    const sy = e.y + Math.sin(angle) * (e.radius + 0.12);
    const p = G.player;
    const targetZ = p ? (p.z || 0) + 0.5 - (p.crouch || 0) * 0.105 : 0.5;
    const horiz = p ? Math.hypot(p.x - sx, p.y - sy) : 1;
    const vz = clamp(((targetZ - z) / Math.max(0.4, horiz)) * speed, -speed * 0.85, speed * 0.85);
    G.projectiles.push({
      x: sx,
      y: sy,
      z, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, vz,
      friendly: false, damage: opts.damage || e.damage || 10,
      life: 6.5, radius: 0.16, color: opts.color || e.color || '#ff7b64',
      name: opts.big ? 'orb_big' : 'orb', age: 0,
    });
    ENGINE.burst(e.x + Math.cos(angle) * 0.4, e.y + Math.sin(angle) * 0.4, z, opts.color || e.color || '#ff7b64', 4, {
      speed: 0.8, size: 0.025, life: 0.3,
    });
  }

  // --------------------------------------------------------------- enemy AI
  function updateEnemies(dtWorld, dtReal) {
    const p = G.player;
    if (!p) return;
    const frozen = G.freezeTimer > 0;
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      e.age += dtReal;
      e.flash = Math.max(0, e.flash - dtReal * 3.4);
      if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dtReal * 3);
      if (e.spawnGrace > 0) {
        e.spawnGrace -= dtReal;
        continue;
      }
      if (e.boss) {
        updateBoss(e, dtWorld, dtReal, frozen);
        continue;
      }
      if (frozen) continue;
      e.cooldown = Math.max(0, e.cooldown - dtWorld);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const los = hasLOS(e.x, e.y, p.x, p.y);
      const type = e.type;
      let speed = e.speed;
      if (G.hazard.buff === 'hunt' && G.hazard.active > 0) speed *= 1.34;
      if (e.behavior === 'stalker') speed *= 1 + Math.min(0.55, e.age * 0.028);
      if (e.behavior === 'watcher' && los && G.freezeTimer <= 0) speed *= 0.16;
      if (e.behavior === 'glitch') {
        speed *= 1.08;
        e.teleportCd -= dtWorld * 2.2;
      }

      if (type.teleport) {
        e.teleportCd -= dtWorld;
        if (e.teleportCd <= 0 && d < 7.5) {
          const dest = nearestOpenCellNear(p.x, p.y, 3.2, 6.6);
          ENGINE.burst(e.x, e.y, 0.6, e.color, 16, { speed: 1.8, size: 0.04, life: 0.7 });
          e.x = dest.x;
          e.y = dest.y;
          e.teleportCd = rand(6, 9.5);
          ENGINE.burst(e.x, e.y, 0.6, e.color, 20, { speed: 2.0, size: 0.04, life: 0.8 });
          sfx('glitch');
          continue;
        }
      }

      if (type.ranged) {
        if (d > (type.attackRange || 8) * 0.82) {
          moveWithCollision(e, (dx / d) * speed * dtWorld, (dy / d) * speed * dtWorld, e.radius * 0.8);
        } else if (d < 2.6) {
          moveWithCollision(e, (-dx / d) * speed * dtWorld, (-dy / d) * speed * dtWorld, e.radius * 0.8);
        } else {
          const strafe = Math.sin(e.age * 1.7 + e.x * 3) * 0.65;
          moveWithCollision(e, (-dy / d) * speed * strafe * dtWorld, (dx / d) * speed * strafe * dtWorld, e.radius * 0.8);
        }
        if (los && d <= (type.attackRange || 8) && e.cooldown <= 0) {
          e.cooldown = type.attackCd || 2;
          e.lunge = 1;
          const lead = Math.atan2(dy, dx) + rand(-0.045, 0.045);
          if (e.typeKey === 'mirror') {
            enemyShoot(e, lead, { damage: 9, color: e.color });
            setTimeout(() => {
              if (e.dead || G.mode !== 'playing') return;
              const pl = G.player;
              enemyShoot(e, Math.atan2(pl.y - e.y, pl.x - e.x) + rand(-0.03, 0.03), { damage: 9, color: e.color });
            }, 130);
          } else {
            enemyShoot(e, lead);
          }
          sfx('click');
        }
      } else if (d > (type.meleeRange || 0.85) * 0.82) {
        moveWithCollision(e, (dx / d) * speed * dtWorld, (dy / d) * speed * dtWorld, e.radius * 0.8);
      } else if (e.cooldown <= 0 && los) {
        e.cooldown = type.attackCd || 1;
        e.lunge = 1;
        damagePlayer(type.damage || 8, { source: e.typeKey });
        addShake(3);
      }
      if (type.flying) e.z = 0.46 + Math.sin(e.age * 1.7 + e.x) * 0.09;
      e.frame = Math.floor(e.age * (type.ranged ? 3 : 5)) % 2;
    }
  }

  function updateBoss(boss, dtWorld, dtReal, frozen) {
    if (!boss || boss.dead) return;
    const p = G.player;
    boss.flash = Math.max(0, boss.flash - dtReal * 2.6);
    boss.vulnerable = Math.max(0, boss.vulnerable - dtReal);
    boss.cooldown = Math.max(0, boss.cooldown - dtWorld);
    boss.popupTimer = Math.max(0, boss.popupTimer - dtReal);
    boss.summonCd = Math.max(0, boss.summonCd - dtWorld);
    if (!boss.initialShield && boss.age > 1.25) {
      boss.initialShield = true;
      spawnBossShield(2);
      showFeed('YÖNETİCİ KALKANI: 2 HARİCİ PENCERE AÇILDI. [F] İLE KAPAT.', 'bad');
      boss.wasShielded = true;
    }
    if (G.popups.size > 0) {
      boss.vulnerable = 0;
      boss.wasShielded = true;
    } else if (boss.popupTimer <= 0 && boss.initialShield && boss.vulnerable <= 0 && !frozen) {
      boss.popupTimer = boss.popupEvery;
      spawnBossShield(1);
      sfx('bossShield');
      showNotify('YÖNETİCİ YENİ KALKAN AÇTI', 'bad', 3500);
    }
    if (frozen) return;
    const dx = p.x - boss.x;
    const dy = p.y - boss.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const ph = 1 + (boss.phase - 1) * 0.16;
    if (d > 3.9) {
      moveWithCollision(boss, (dx / d) * boss.speed * ph * dtWorld, (dy / d) * boss.speed * ph * dtWorld, boss.radius * 0.75);
    } else if (d < 2.1) {
      moveWithCollision(boss, (-dx / d) * boss.speed * 0.8 * dtWorld, (-dy / d) * boss.speed * 0.8 * dtWorld, boss.radius * 0.75);
    } else {
      const strafe = Math.sin(boss.age * 1.1) * 0.8;
      moveWithCollision(boss, (-dy / d) * boss.speed * strafe * dtWorld, (dx / d) * boss.speed * strafe * dtWorld, boss.radius * 0.75);
    }
    const los = hasLOS(boss.x, boss.y, p.x, p.y);
    if (boss.cooldown <= 0 && los) {
      if (boss.typeKey === 'shadow_admin') {
        boss.cooldown = 2.4;
        const base = Math.atan2(dy, dx);
        for (let i = -2; i <= 2; i++) enemyShoot(boss, base + i * 0.12, { speed: 4.6, damage: 10, color: '#ff77c9' });
        sfx('shot', 'shotgun');
      } else if (boss.typeKey === 'core_warden') {
        boss.cooldown = 3.0;
        const base = boss.age * 0.7;
        for (let i = 0; i < 12; i++) enemyShoot(boss, base + (i / 12) * Math.PI * 2, { speed: 3.8, damage: 11, color: '#ffb04d' });
        sfx('bossSpawn');
        addShake(3);
      } else {
        boss.cooldown = 2.6;
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < 8; i++) enemyShoot(boss, base + (i / 8) * Math.PI * 2, { speed: 4.4, damage: 12, color: '#ff5b5b', big: true });
        for (let i = -1; i <= 1; i++) enemyShoot(boss, base + i * 0.08, { speed: 6.2, damage: 12, color: '#ffd7d7' });
        sfx('bossSpawn');
        addShake(5);
      }
    }
    if (boss.summonCd <= 0) {
      const minions = G.enemies.filter((e) => !e.dead && e.minion).length;
      if (minions < 3) {
        boss.summonCd = 10;
        const pos = randomOpenCell(3.5, true);
        const kind = boss.typeKey === 'root_king' ? 'wraith' : boss.typeKey === 'core_warden' ? 'drone' : 'crawler';
        spawnEnemy(kind, pos.x, pos.y, { minion: true });
        showNotify('YÖNETİCİ VARLIK ÇAĞIRDI', 'warn', 3000);
        sfx('glitch');
      }
    }
  }

  // --------------------------------------------------------------- pointer / pause
  function requestPointer() {
    if (G.debug || G.mode !== 'playing') return;
    if (G.cursorMode || G.mapOpen || G.takeover.active || G.kernel.active) return;
    const stage = $('stage');
    if (!stage || document.pointerLockElement === stage) {
      G.pointerLocked = Boolean(document.pointerLockElement);
      return;
    }
    G.expectUnlock = false;
    try {
      const result = stage.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          G.allowFreeAim = true;
          showNotify('SERBEST NİŞAN MODU // FARE KİLİDİ YOK', 'warn', 3200);
        });
      }
    } catch (_) {
      G.allowFreeAim = true;
    }
  }

  function releasePointer() {
    G.expectUnlock = true;
    G.pointerLocked = false;
    $('stage')?.classList.remove('cursor-hidden');
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (_) {}
    setTimeout(() => { G.expectUnlock = false; }, 320);
  }

  function pauseGame() {
    if (G.mode !== 'playing') return;
    G.firing = false;
    G.keys = Object.create(null);
    if (G.fileConsole.open) dismissFileConsole(true);
    if (G.keypadOpen) { G.keypadOpen = false; toggleHidden('keypad', true); }
    const pc = G.puzzleChallenge;
    if (pc.active && !pc.paused) {
      pc.remaining = Math.max(0, (pc.deadline - performance.now()) / 1000);
      pc.paused = true;
    }
    setMode('paused');
    releasePointer();
    showOverlay('pause');
    showHUD(false);
    closeExternalWindows();
    try { LimboAudio.setPaused(true); } catch (_) {}
    setText('appbarStatus', 'DURAKLATILDI // BEKLEMEDE');
    sfx('click');
  }

  function resumeGame() {
    if (G.mode !== 'paused') return;
    const pc = G.puzzleChallenge;
    if (pc.active && pc.paused) {
      pc.paused = false;
      pc.deadline = performance.now() + Math.max(0, pc.remaining) * 1000;
    }
    hideAllOverlays();
    setMode('playing');
    showHUD(true);
    setText('appbarStatus', `KATMAN ${pad2(G.levelId)} // ÇEVRİMİÇİ`);
    try { LimboAudio.setPaused(false); } catch (_) {}
    requestPointer();
    sfx('click');
  }

  // --------------------------------------------------------------- QTE / freeze
  function qteLabelFromCode(code) {
    if (code === 'KeyW' || code === 'ArrowUp') return 'W';
    if (code === 'KeyA' || code === 'ArrowLeft') return 'A';
    if (code === 'KeyS' || code === 'ArrowDown') return 'S';
    if (code === 'KeyD' || code === 'ArrowRight') return 'D';
    return '';
  }

  function buildQteKeys() {
    const box = $('qteKeys');
    if (!box) return;
    box.replaceChildren();
    for (let i = 0; i < G.qte.seq.length; i++) {
      const span = document.createElement('span');
      span.textContent = G.qte.seq[i];
      box.appendChild(span);
    }
  }

  function startQTE() {
    if (!G.level || !G.level.qte || G.mode !== 'playing') return;
    const pool = ['W', 'A', 'S', 'D'];
    const seq = [];
    for (let i = 0; i < 4; i++) {
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if (i > 0 && Math.random() < 0.45) {
        while (pick === seq[i - 1]) pick = pool[Math.floor(Math.random() * pool.length)];
      }
      seq.push(pick);
    }
    G.qte.active = true;
    G.qte.seq = seq;
    G.qte.idx = 0;
    G.qte.time = 5.6;
    buildQteKeys();
    toggleHidden('qtePanel', false);
    sfx('qte');
    addShake(2);
    triggerGlitch();
    showNotify('BELLEK SIZINTISI // KOMUT DİZİSİNİ GİR', 'bad', 3200);
  }

  function finishQTE(success) {
    if (!G.qte.active) return;
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    const p = G.player;
    if (success) {
      if (p) p.hp = Math.min(p.maxHp, p.hp + 18);
      G.projectiles = G.projectiles.filter((pr) => pr.friendly);
      G.style = Math.min(4000, G.style + 150);
      G.combo++;
      G.comboTimer = 4.2;
      sfx('qteHit');
      sfx('codeOk');
      showNotify('STABİLİZASYON TAMAM // VERİ AKIŞI +18', 'good', 3800);
      showFeed('BELLEK DENGELENDİ. SIZINTI KALICI OLARAK KAPATILDI.', 'good');
      ENGINE.burst(p.x, p.y, 0.7, '#b8ff5a', 24, { speed: 2.1, size: 0.04, life: 0.9 });
      G.qte.next = 19 + Math.random() * 7;
    } else {
      sfx('qteFail');
      triggerGlitch();
      flashDamage();
      showNotify('STABİLİZASYON BAŞARISIZ', 'bad', 3600);
      showSubtitle('// BELLEK', 'SENİ TUTAMADIK. BAZI ANILAR ŞİMDİ ÇOKTAN SİLİNDİ.', 4800);
      if (p) damagePlayer(17, { ignoreIframe: true, source: 'qte' });
      G.qte.next = 14 + Math.random() * 6;
    }
    G.qte.seq = [];
    G.qte.idx = 0;
    updateHud(true);
  }

  function handleQTEKey(code) {
    if (!G.qte.active) return false;
    const label = qteLabelFromCode(code);
    if (!label) return false;
    if (label === G.qte.seq[G.qte.idx]) {
      G.qte.idx++;
      sfx('qteHit');
      const spans = $('qteKeys')?.children || [];
      for (let i = 0; i < spans.length; i++) spans[i].classList.toggle('hit', i < G.qte.idx);
      if (G.qte.idx >= G.qte.seq.length) finishQTE(true);
    } else {
      G.qte.time = Math.max(0.6, G.qte.time - 1.4);
      sfx('denied');
      triggerGlitch();
      addShake(3);
      showFeed('YANLIŞ KOMUT // SIZINTI BÜYÜYOR.', 'bad');
    }
    return true;
  }

  function updateQTE(dtReal) {
    if (!G.level || !G.level.qte || !G.qte) return;
    if (!G.qte.active) {
      G.qte.next -= dtReal;
      if (G.qte.next <= 0) startQTE();
      return;
    }
    G.qte.time -= dtReal;
    if (G.qte.time <= 0) finishQTE(false);
  }

  function activateFreeze() {
    if (!G.level || !G.level.slow) {
      showFeed('DONMA PROTOKOLÜ BU KATMANDA KAPALI.', 'warn');
      return;
    }
    if (G.freezeCd > 0) {
      showNotify(`DONMA HAZIR DEĞİL // ${Math.ceil(G.freezeCd)}s`, 'warn', 1800);
      sfx('denied');
      return;
    }
    G.freezeTimer = 4.2;
    G.freezeCd = 22;
    flashFreeze();
    addShake(6);
    triggerGlitch();
    sfx('unlock');
    sfx('glitch');
    const p = G.player;
    if (p) ENGINE.burst(p.x, p.y, 0.5, '#9fe8ff', 38, { speed: 3.0, size: 0.045, life: 1.1 });
    showNotify('MUTLAK SIFIR // VARLIKLAR DONDURULDU', 'good', 3600);
    showSubtitle('// SICAKLIK', 'ZAMAN 4 SANİYE BOYUNCA SENİN. KULLAN.', 3200);
  }

  function updateFreeze(dtReal) {
    if (G.freezeTimer > 0) G.freezeTimer = Math.max(0, G.freezeTimer - dtReal);
    if (G.freezeCd > 0) G.freezeCd = Math.max(0, G.freezeCd - dtReal);
  }

  // --------------------------------------------------------------- player movement
  function tryJump() {
    const p = G.player;
    if (!p || G.mode !== 'playing' || !p.grounded) return;
    p.vz = G.level && G.level.lowGravity ? 2.0 : 3.05;
    p.grounded = false;
    p.z = Math.max(p.z, 0.01);
    sfx('jump');
    if (G.level && G.level.lowGravity) {
      ENGINE.burst(p.x, p.y, 0.12, '#7ee8ff', 10, { speed: 1.1, size: 0.03, life: 0.55, gravity: 0.4 });
    }
  }

  function tryDash() {
    const p = G.player;
    if (!p || G.mode !== 'playing') return;
    let slot = -1;
    for (let i = 0; i < p.dash.length; i++) {
      if (p.dash[i] >= 1) { slot = i; break; }
    }
    if (slot < 0) {
      sfx('denied');
      showNotify('ATILMA ŞARJI YOK', 'warn', 1100);
      return;
    }
    const f = (G.keys.KeyW || G.keys.ArrowUp ? 1 : 0) - (G.keys.KeyS || G.keys.ArrowDown ? 1 : 0);
    const s = (G.keys.KeyD || G.keys.ArrowRight ? 1 : 0) - (G.keys.KeyA || G.keys.ArrowLeft ? 1 : 0);
    let dx = Math.cos(p.angle) * f - Math.sin(p.angle) * s;
    let dy = Math.sin(p.angle) * f + Math.cos(p.angle) * s;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * 10.8;
    p.vy = (dy / d) * 10.8;
    p.dash[slot] = 0;
    p.dashRecharge[slot] = 4.4;
    p.dashTimer = 0.24;
    p.iframe = Math.max(p.iframe, 0.25);
    addShake(2.2);
    sfx('dash');
    ENGINE.burst(p.x, p.y, 0.25, '#b8ff5a', 12, { speed: 1.4, size: 0.035, life: 0.5 });
  }

  function trySlide() {
    const p = G.player;
    if (!p || G.mode !== 'playing' || p.slideCd > 0) return;
    const moving = Math.hypot(p.vx, p.vy) > 1.2;
    if (!moving) return;
    p.slideTimer = 0.62;
    p.slideCd = 0.95;
    p.vx *= 1.24;
    p.vy *= 1.24;
    sfx('slide');
    ENGINE.burst(p.x, p.y, 0.08, '#9fa88d', 10, { speed: 0.8, size: 0.03, life: 0.6, gravity: 0.3 });
  }

  function updatePlayer(dt, dtReal) {
    const p = G.player;
    if (!p) return;
    p.iframe = Math.max(0, p.iframe - dtReal);
    p.dashTimer = Math.max(0, p.dashTimer - dtReal);
    p.slideCd = Math.max(0, p.slideCd - dtReal);
    p.slideTimer = Math.max(0, p.slideTimer - dtReal);
    for (let i = 0; i < p.dash.length; i++) {
      if (p.dash[i] < 1) {
        p.dashRecharge[i] = Math.max(0, p.dashRecharge[i] - dtReal);
        if (p.dashRecharge[i] <= 0) p.dash[i] = 1;
      }
    }

    const f = (G.keys.KeyW || G.keys.ArrowUp ? 1 : 0) - (G.keys.KeyS || G.keys.ArrowDown ? 1 : 0);
    const s = (G.keys.KeyD || G.keys.ArrowRight ? 1 : 0) - (G.keys.KeyA || G.keys.ArrowLeft ? 1 : 0);
    const sliding = p.slideTimer > 0;
    const crouchHeld = Boolean(G.keys.KeyC);
    const crouching = sliding || crouchHeld || Boolean(G.keys.ControlLeft || G.keys.ControlRight);
    const sprinting = !crouching && p.grounded && Boolean(G.keys.ShiftLeft || G.keys.ShiftRight);
    let dx = Math.cos(p.angle) * f - Math.sin(p.angle) * s;
    let dy = Math.sin(p.angle) * f + Math.cos(p.angle) * s;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      dx /= len;
      dy /= len;
      const accel = (p.grounded ? 38 : 19) * (sliding ? 1.34 : crouchHeld ? 0.66 : sprinting ? 1.22 : 1);
      p.vx += dx * accel * dt;
      p.vy += dy * accel * dt;
    }
    const drag = p.grounded ? (sliding ? 5.2 : 8.4) : 1.9;
    const damp = Math.max(0, 1 - drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    const cap = p.dashTimer > 0 ? 12 : crouchHeld && p.grounded ? 3.35 : sprinting ? 9.35 : p.grounded ? 6.5 : 7.5;
    if (speed > cap) {
      p.vx = (p.vx / speed) * cap;
      p.vy = (p.vy / speed) * cap;
    }
    moveWithCollision(p, p.vx * dt, p.vy * dt, p.radius);

    const lowG = Boolean(G.level && G.level.lowGravity);
    const gravity = lowG ? 2.35 : 10.5;
    if (!p.grounded || p.z > 0 || p.vz !== 0) {
      p.vz -= gravity * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        const wasFalling = p.vz < -0.6;
        p.z = 0;
        p.vz = 0;
        if (!p.grounded && wasFalling) {
          sfx('land');
          addShake(1.2);
        }
        p.grounded = true;
      } else {
        p.grounded = false;
      }
    }
    p.z = clamp(p.z, 0, 0.78);

    const crouchTarget = crouching ? 1 : 0;
    p.crouch = lerp(p.crouch, crouchTarget, Math.min(1, dt * 12));
    const planar = Math.hypot(p.vx, p.vy);
    p.bobPhase += dt * (1.6 + planar * 2.2);
    p.bob = p.grounded ? Math.sin(p.bobPhase) * Math.min(2.1, planar * 0.42) : 0;
    p.pitch = clamp(p.pitch, -74, 74);
  }

  // --------------------------------------------------------------- timed popups / ambience
  const AMBIENT_POPUPS = [
    { title: 'SÜREÇ İZLEYİCİSİ', tag: 'MEMORY_WATCH', body: 'Bu oturumun sahibi hâlâ burada.\nOnu tanıyor musun?' },
    { title: 'KATMAN SENKRONU', tag: 'LAYER_SYNC', body: 'Aşağıda bir kapı daha açıldı.\nSen açmadın.' },
    { title: 'SİLİNEN DOSYA', tag: 'RECOVERY', body: 'Kurtarılabilecek bir dosya var.\nAdı seninkiyle aynı.' },
    { title: 'ARKA PLAN HATASI', tag: 'BACKGROUND_TASK', body: 'limbo.exe hâlâ çalışıyor.\nSen durduğunda bile.' },
  ];

  function updateTimedPopups(dtReal) {
    const lv = G.level;
    if (!lv) return;
    const list = lv.popups || [];
    for (let i = 0; i < list.length; i++) {
      const key = `${lv.id}:${i}`;
      if (G.popupsFired.has(key)) continue;
      if (G.levelTime >= (Number(list[i].at) || 0)) {
        G.popupsFired.add(key);
        spawnExternalPopup(list[i]);
      }
    }
    if (lv.boss || lv.final) return;
    if (!G.nextAmbientPopup) G.nextAmbientPopup = rand(30, 48);
    G.nextAmbientPopup -= dtReal;
    if (G.nextAmbientPopup <= 0) {
      G.nextAmbientPopup = rand(38, 62);
      if (G.levelTime < 22 || G.mode !== 'playing') return;
      const pick = AMBIENT_POPUPS[Math.floor(Math.random() * AMBIENT_POPUPS.length)];
      spawnExternalPopup({
        title: pick.title,
        tag: pick.tag,
        severity: Math.random() < 0.35 ? 'error' : 'warn',
        body: pick.body,
        buttons: ['TAMAM'],
        puzzle: lv.id >= 7 && Math.random() < 0.26 ? ['0', '0', '0', '9'] : null,
        life: 11000,
      });
    }
  }

  function updateAmbient(dtReal) {
    G.whisperTimer -= dtReal;
    if (G.whisperTimer <= 0) {
      G.whisperTimer = rand(26, 44);
      showSubtitle('// SİSTEM', WHISPERS[Math.floor(Math.random() * WHISPERS.length)], 5000);
    }
    G.ambientGlitch -= dtReal;
    if (G.ambientGlitch <= 0) {
      const theme = G.level ? CONTENT.THEMES[G.level.theme] : null;
      const glitch = (theme && theme.glitch) || 0.1;
      G.ambientGlitch = rand(20, 38) / (0.55 + glitch * 2.4);
      triggerGlitch();
    }
    G.noiseAcc += dtReal;
    if (G.noiseAcc >= 0.8) {
      G.noiseAcc = 0;
      if (G.audioReady) {
        const alive = aliveEnemies().length;
        const combat = clamp(alive / 7 + (G.boss ? 0.45 : 0), 0, 1);
        try { LimboAudio.setCombat(combat); } catch (_) {}
      }
    }
  }

  function updateWaves(dtReal) {
    if (!G.wavePending) return;
    G.waveTimer -= dtReal;
    if (G.waveTimer <= 0) {
      G.wavePending = false;
      G.waveTimer = 0;
      startNextWave();
    }
  }

  // --------------------------------------------------------------- effects / render
  function updateEffects(dtReal) {
    G.flash = Math.max(0, G.flash - dtReal * 7.5);
    G.muzzle = Math.max(0, G.muzzle - dtReal * 9);
    G.swing = Math.max(0, G.swing - dtReal * 5.5);
    G.recoil = Math.max(0, G.recoil - dtReal * 7);
    G.switchAnim = Math.max(0, G.switchAnim - dtReal * 4.2);
    G.cooldown = Math.max(0, G.cooldown - dtReal);
    G.bossBlockCooldown = Math.max(0, G.bossBlockCooldown - dtReal);
    G.heat = Math.max(0, G.heat - dtReal * (G.overheat ? 0.39 : 0.62));
    if (G.overheat && G.heat <= 0.04) {
      G.overheat = false;
      showNotify('SİLAH SOĞUDU // ATEŞ HAZIR', '', 1600);
      sfx('unlock');
    }
    G.comboTimer = Math.max(0, G.comboTimer - dtReal);
    if (G.comboTimer <= 0) {
      G.combo = 0;
      G.style = Math.max(0, G.style - dtReal * 42);
    }
    G.styleIdle += dtReal;
    G.shake = Math.max(0, G.shake - dtReal * 28);
    if (!G.firing) G.heat = Math.max(0, G.heat - dtReal * 0.2);
    const sx = G.swayX || 0;
    const sy = G.swayY || 0;
    G.swayX = Math.abs(sx) < 0.001 ? 0 : sx * Math.max(0, 1 - dtReal * 9);
    G.swayY = Math.abs(sy) < 0.001 ? 0 : sy * Math.max(0, 1 - dtReal * 9);
    const cameraTarget = G.camera.third ? 1 : 0;
    G.camera.blend = lerp(G.camera.blend, cameraTarget, Math.min(1, dtReal * 5.4));
    if (Math.abs(G.camera.blend - cameraTarget) < 0.002) G.camera.blend = cameraTarget;
  }

  function buildSprites() {
    const sprites = [];
    const frozen = G.freezeTimer > 0;
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      let z = e.z || 0;
      if (e.type && e.type.flying) z += Math.sin(e.age * 1.7 + e.x) * 0.04;
      sprites.push({
        x: e.x,
        y: e.y,
        z,
        name: e.sprite || 'tick',
        frame: e.frame || 0,
        height: e.height || 0.7,
        flash: e.flash || 0,
        tint: frozen ? '#8fe8ff' : (e.boss && G.boss && G.boss.vulnerable > 0 ? '#ffe9b0' : (e.variantColor || null)),
        shield: Boolean(e.boss && G.popups.size > 0),
        shieldColor: e.color || '#b8ff5a',
      });
    }
    for (const pr of G.projectiles) {
      sprites.push({
        x: pr.x,
        y: pr.y,
        z: pr.z,
        name: pr.name === 'orb_big' ? 'orb_big' : 'orb',
        frame: 0,
        height: pr.name === 'orb_big' ? 0.3 : 0.2,
        additive: true,
        tint: pr.color || null,
      });
    }
    for (const o of G.dataOrbs) {
      sprites.push({
        x: o.x, y: o.y, z: o.z,
        name: 'orb', frame: 0, height: 0.14,
        additive: true, tint: o.color || '#b7ff7a',
      });
    }
    for (const item of G.pickups) {
      if (item.taken) continue;
      sprites.push({
        x: item.x, y: item.y,
        z: 0.15 + Math.sin(item.bob) * 0.05,
        name: 'pickup', frame: 0, height: 0.48,
        additive: true, tint: '#b8ff5a',
      });
    }
    for (const item of G.itemPickups) {
      if (item.taken) continue;
      const def = item.def || CONTENT.ITEMS[item.id] || {};
      sprites.push({
        x: item.x, y: item.y,
        z: 0.14 + Math.sin(item.bob) * 0.05,
        name: def.sprite || 'pickup', frame: 0,
        height: def.height || 0.36,
        additive: def.kind !== 'note',
        tint: def.tint || '#b8ff5a',
      });
    }
    for (const gate of G.exits) {
      sprites.push({
        x: gate.x, y: gate.y, z: 0,
        name: 'gate', frame: 0, height: 2.15, widthScale: 1.28,
        tint: G.exitOpen ? '#d9ffd0' : '#687366',
        additive: G.exitOpen,
      });
    }
    for (const t of G.terminals) {
      sprites.push({
        x: t.x, y: t.y, z: 0,
        name: 'terminal', frame: 0, height: 1.55,
        tint: G.level && G.level.final ? '#ff6a6a' : '#b8ff5a',
      });
    }
    if (G.player && G.camera.blend > 0.015) {
      const camDist = G.camera.actualDist || 0;
      // When a wall forces the follow camera right up against the player the
      // body would cover the entire screen.  Fade it out instead of letting
      // it fill the viewport.
      const bodyAlpha = clamp(G.camera.blend, 0, 1) * clamp((camDist - 1.15) / 0.75, 0, 1);
      if (bodyAlpha > 0.015) {
        const walking = Math.hypot(G.player.vx || 0, G.player.vy || 0) > 0.4;
        sprites.push({
          x: G.player.x,
          y: G.player.y,
          z: 0,
          name: 'playerbody',
          frame: walking ? Math.floor(G.player.bobPhase * 2.2) % 2 : 0,
          height: 0.94 + (1 - (G.player.crouch || 0)) * 0.2,
          widthScale: 0.92,
          alpha: bodyAlpha,
          tint: null,
        });
      }
    }
    return sprites;
  }

  function buildHitboxData() {
    const boxes = [];
    for (const e of G.enemies) {
      if (!e || e.dead) continue;
      boxes.push({
        kind: e.boss ? 'boss' : 'enemy',
        x: e.x, y: e.y, z: e.z || 0,
        radius: e.radius || 0.3, height: e.height || 0.8,
        label: e.boss ? (e.name || 'YÖNETİCİ') : ((e.type && e.type.name) || e.name || 'VARLIK'),
        color: e.color || '#b8ff5a',
        hp: e.hp, maxHp: e.maxHp,
      });
    }
    for (const pr of G.projectiles) {
      boxes.push({
        kind: 'projectile',
        x: pr.x, y: pr.y, z: pr.z || 0,
        radius: pr.radius || 0.16, height: 0.18,
        color: pr.color || (pr.friendly ? '#c9ff8a' : '#ff7b64'),
      });
    }
    for (const o of G.dataOrbs) {
      boxes.push({
        kind: 'orb', x: o.x, y: o.y, z: o.z || 0,
        radius: 0.11, height: 0.15, color: o.color || '#b7ff7a',
      });
    }
    for (const item of G.pickups) {
      if (item.taken) continue;
      boxes.push({
        kind: 'pickup', x: item.x, y: item.y, z: 0.15,
        radius: 0.2, height: 0.48, label: 'VERİ ÖNBELLEĞİ', color: '#b8ff5a',
      });
    }
    for (const gate of G.exits) {
      boxes.push({
        kind: 'exit', x: gate.x, y: gate.y, z: 0,
        radius: 0.5, height: 2.15, label: 'ÇIKIŞ', color: '#d9ffd0',
      });
    }
    for (const t of G.terminals) {
      boxes.push({
        kind: 'terminal', x: t.x, y: t.y, z: 0,
        radius: 0.4, height: 1.55, label: 'TERMİNAL', color: '#b8ff5a',
      });
    }
    if (G.camera.third && G.player) {
      boxes.push({
        kind: 'player', x: G.player.x, y: G.player.y, z: 0,
        radius: G.player.radius || 0.22, height: 1.7,
        label: 'OYUNCU', color: '#7ee8ff', hp: G.player.hp, maxHp: G.player.maxHp,
      });
    }
    return boxes;
  }

  function applyRenderShake() {
    const layer = $('render-layer');
    if (!layer) return;
    if (G.shake > 0.2 && settings.shake) {
      const s = Math.min(9.5, G.shake);
      layer.style.transform = `translate3d(${rand(-s, s).toFixed(2)}px, ${rand(-s * 0.6, s * 0.6).toFixed(2)}px, 0) scale(1.008)`;
    } else if (layer.style.transform) {
      layer.style.transform = '';
    }
  }

  function renderScene() {
    const p = G.player;
    if (!p || !G.level) return;
    G.aimTarget = pickEnemyInRay(p.angle, 26, aimSlope());
    applyRenderShake();
    const lowHp = p.hp <= 27;
    const blend = clamp(G.camera.blend || 0, 0, 1);
    let camX = p.x;
    let camY = p.y;
    let camZ = Math.max(-0.08, p.z - p.crouch * 0.105);
    G.camera.actualDist = 0;
    if (blend > 0.002) {
      const back = p.angle + Math.PI;
      const hit = castWall(p.x, p.y, back, G.camera.dist + 0.9);
      const maxD = Math.max(0.28, hit - 0.24);
      const d = Math.min(G.camera.dist, maxD) * blend;
      camX = p.x + Math.cos(back) * d;
      camY = p.y + Math.sin(back) * d;
      camZ += 0.42 * blend;
      G.camera.actualDist = d;
    }
    ENGINE.render({
      player: {
        x: camX,
        y: camY,
        angle: p.angle,
        pitch: p.pitch,
        z: camZ,
        bob: p.bob * (1 - blend * 0.75),
      },
      sprites: buildSprites(),
      flashlight: G.flashlight,
      flashlightLevel: G.flashlightLevel,
      hitboxes: G.hitboxes ? buildHitboxData() : null,
      muzzle: G.muzzle,
      power: lowHp,
    });
    ENGINE.renderWeapon({
      weapon: G.weapon,
      fire: G.recoil,
      swing: G.swing,
      heat: G.heat,
      switch: G.switchAnim,
      swayX: (G.swayX || 0) * 0.55,
      swayY: (G.swayY || 0) * 0.55 + p.crouch * 2.2,
      time: G.animTime,
      hidden: blend > 0.55 || G.mapOpen,
      flash: G.flash,
    });
  }

  // --------------------------------------------------------------- completion / death
  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  }

  function buildStats(container, entries) {
    if (!container) return;
    container.replaceChildren();
    entries.forEach(([label, value]) => {
      const cell = document.createElement('div');
      const strong = document.createElement('b');
      strong.textContent = value;
      const span = document.createElement('span');
      span.textContent = label;
      cell.append(strong, span);
      container.appendChild(cell);
    });
  }

  function completeLevel() {
    if (G.mode !== 'playing' || !G.level) return;
    const lv = G.level;
    if (lv.final) return;
    G.completedLevel = lv.id;
    markCompleted(lv.id);
    G.firing = false;
    G.keys = Object.create(null);
    if (G.mapOpen) { G.mapOpen = false; document.body.classList.remove('map-open'); toggleHidden('mapOverlay', true); }
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    closeExternalWindows();
    closeTerminal();
    stopFilePoll();
    stopPuzzlePoll();
    stopFinalPoll();
    resetPuzzleChallenge();
    G.fileConsole.open = false;
    G.keypadOpen = false;
    toggleHidden('fileConsole', true);
    toggleHidden('keypad', true);
    releasePointer();
    showHUD(false);
    try { LimboAudio.setPaused(true); } catch (_) {}
    sfx('complete');
    if (lv.completeLies) showFakeEnding();
    else showCompletionScreen(lv);
  }

  function showCompletionScreen(lv) {
    if (!lv) return;
    setMode('complete');
    showOverlay('levelComplete');
    showHUD(false);
    const next = lv.id < 15 ? CONTENT.levelByNumber(lv.id + 1) : null;
    setText('completeKicker', lv.boss ? 'YÖNETİCİ SÜRECİ SONLANDIRILDI' : 'KATMAN TEMİZLENDİ');
    setText('completeTitle', lv.title);
    buildStats($('completeStats'), [
      ['SÜRE', formatTime(G.levelTime)],
      ['VARLIK', String(G.totalKills)],
      ['STİL', String(Math.floor(G.style))],
      ['KATMAN', pad2(lv.id) + ' / 15'],
    ]);
    let quote = lv.complete || '';
    if (lv.completeLies) quote = 'Çıkış sahteydi. Ama katman gerçekten temizlendi. Aşağısı seni bekliyor.';
    setText('completeQuote', quote);
    const btn = $('btnNextLevel');
    if (btn) {
      btn.textContent = next
        ? `KATMAN ${pad2(next.id)} // ${next.name.toUpperCase()} [ENTER]`
        : 'ANA MENÜ [ENTER]';
    }
    const overlay = $('levelComplete');
    if (overlay) {
      overlay.classList.remove('glitch-out');
      void overlay.offsetWidth;
      overlay.classList.add('glitch-out');
      setTimeout(() => overlay.classList.remove('glitch-out'), 700);
    }
    updateMenuInfo();
    sfx('complete');
  }

  function advanceFromComplete() {
    if (G.mode !== 'complete') return;
    const next = G.completedLevel + 1;
    if (next > 15) {
      showMenu();
      return;
    }
    beginLevel(next, true);
  }

  function die() {
    if (G.mode !== 'playing' || !G.player) return;
    G.firing = false;
    G.keys = Object.create(null);
    if (G.mapOpen) { G.mapOpen = false; document.body.classList.remove('map-open'); toggleHidden('mapOverlay', true); }
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    G.deaths++;
    progress.deaths++;
    saveProgress();
    closeExternalWindows();
    closeTerminal();
    stopFilePoll();
    stopPuzzlePoll();
    resetPuzzleChallenge();
    G.fileConsole.open = false;
    G.keypadOpen = false;
    toggleHidden('fileConsole', true);
    toggleHidden('keypad', true);
    setMode('dead');
    releasePointer();
    showHUD(false);
    showOverlay('death');
    try { LimboAudio.setPaused(true); } catch (_) {}
    sfx('death');
    addShake(12);
    triggerGlitch();
    const lv = G.level;
    const lines = [
      '> oturum: 0x0009',
      `> katman: ${lv ? lv.code : '??'} // ${lv ? lv.name.toUpperCase() : 'BİLİNMİYOR'}`,
      `> çalışma süresi: ${formatTime(G.levelTime)}`,
      `> temizlenen varlık: ${G.totalKills}`,
      '> bütünlük: 0%',
      '> yeniden yükleme noktası: YOK',
      '',
      `> ${WHISPERS[Math.floor(Math.random() * WHISPERS.length)]}`,
    ];
    setText('deathLog', lines.join('\n'));
    buildStats($('deathStats'), [
      ['KATMAN', pad2(G.levelId)],
      ['SÜRE', formatTime(G.levelTime)],
      ['ÖLDÜRME', String(G.totalKills)],
      ['ÖLÜM', String(G.deaths)],
    ]);
    setText('appbarStatus', 'SÜREÇ SONLANDI // YENİDEN DENEYİN');
    $('statusLed')?.classList.add('bad');
  }

  function respawn() {
    if (!G.level) return;
    const checkpoint = progress.checkpoint && progress.checkpoint.levelId === G.level.id
      ? Object.assign({}, progress.checkpoint) : null;
    hideAllOverlays();
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    $('statusLed')?.classList.remove('bad');
    startLevelNow(G.level);
    if (checkpoint) {
      progress.checkpoint = checkpoint;
      if (restoreCheckpoint()) saveProgress();
    }
    showNotify('YENİDEN YÜKLEME // KONTROL NOKTASINDAN', 'warn', 2600);
  }

  function restartLevel() {
    if (!G.level) return;
    hideAllOverlays();
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    $('statusLed')?.classList.remove('bad');
    startLevelNow(G.level);
    showNotify('KATMAN YENİDEN BAŞLATILDI', 'warn', 2400);
  }

  // --------------------------------------------------------------- ending sequences
  const endingTimers = [];
  function clearEndingTimers() {
    while (endingTimers.length) clearTimeout(endingTimers.pop());
  }

  function playEndingText(lines, done, speed = 26) {
    clearEndingTimers();
    const el = $('endingLine');
    if (!el) {
      if (done) done();
      return;
    }
    el.textContent = '';
    let lineIndex = 0;
    let charIndex = 0;
    const tick = () => {
      if (G.mode !== 'ending') return;
      if (lineIndex >= lines.length) {
        if (done) done();
        return;
      }
      const line = lines[lineIndex];
      if (charIndex < line.length) {
        el.textContent += line[charIndex];
        charIndex++;
        endingTimers.push(setTimeout(tick, speed + (Math.random() < 0.08 ? 40 : 0)));
      } else {
        el.textContent += '\n';
        lineIndex++;
        charIndex = 0;
        endingTimers.push(setTimeout(tick, line ? 480 : 160));
      }
    };
    tick();
  }

  function showFakeEnding() {
    if (G.endingStarted) return;
    G.endingStarted = true;
    setMode('ending');
    showOverlay('ending');
    showHUD(false);
    const overlay = $('ending');
    if (overlay) {
      overlay.classList.remove('final', 'void', 'glitch');
      overlay.classList.add('fake');
    }
    setText('endingSeed', '// KATMAN 0x05\n// OTURUM DURUMU: TEMİZ\n// ÇIKIŞ KAPISI: AÇIK');
    playEndingText([
      'KATMAN 0x05 TEMİZLENDİ.',
      'OTURUM KAYDEDİLDİ.',
      'ÇIKIŞ KAPISI AÇILDI.',
      'DIŞARIDASIN. HAVA GÜZEL.',
      'KİMSE SENİ ARAMIYOR.',
    ], () => {
      const t = setTimeout(() => {
        if (G.mode !== 'ending') return;
        if (overlay) overlay.classList.add('glitch');
        setText('endingSeed', '// SİSTEM UYARISI\n// SAHTE ÇIKIŞ TESPİT EDİLDİ\n// GERÇEK ÇIKIŞ: YOK');
        setText('endingLine', 'HAYIR.\n\nDIŞARI ÇIKMADIN.\nSADECE IŞIKLI BİR ODA GÖRDÜN.');
        sfx('glitch');
        flashFreeze();
        addShake(10);
        triggerGlitch();
        const t2 = setTimeout(() => {
          if (G.mode !== 'ending') return;
          if (overlay) overlay.classList.remove('fake', 'glitch');
          showCompletionScreen(G.level || CONTENT.levelByNumber(5));
        }, 3800);
        endingTimers.push(t2);
      }, 900);
      endingTimers.push(t);
    }, 22);
  }

  function triggerFinalEnding() {
    if (G.endingStarted) return;
    G.endingStarted = true;
    G.finale.active = false;
    G.finale.deleted = true;
    G.finale.finalizing = true;
    G.firing = false;
    G.keys = Object.create(null);
    G.qte.active = false;
    toggleHidden('qtePanel', true);
    stopFinalPoll();
    stopFilePoll();
    stopPuzzlePoll();
    closeExternalWindows();
    closeTerminal();
    releasePointer();
    showHUD(false);
    setMode('ending');
    showOverlay('ending');
    document.body.classList.add('final-mode');
    try { localStorage.removeItem(FINAL_KEY); } catch (_) {}
    if (window.limboOS) window.limboOS.finalizeMeta({ reason: 'root_anomaly_deleted' }).catch(() => {});
    progress.completed = CONTENT.LEVELS.map((l) => l.id);
    progress.last = 15;
    saveProgress();
    const overlay = $('ending');
    if (overlay) {
      overlay.classList.remove('fake', 'glitch');
      overlay.classList.add('final', 'void');
    }
    setText('endingSeed', '// root_anomaly.bin\n// DURUM: SİLİNDİ\n// GERİ YÜKLEME: TOKEN YOK\n// OTURUM: 0x0009');
    try { LimboAudio.stopMusic(); } catch (_) {}
    sfx('final');
    flashGpu(2200);
    playEndingText(CONTENT.EPILOGUE, () => {
      const t = setTimeout(() => {
        if (G.mode !== 'ending') return;
        G.meta.terminated = true;
        showTerminated(true);
      }, 1800);
      endingTimers.push(t);
    }, 34);
  }

  // --------------------------------------------------------------- input
  function switchWeapon(index) {
    if (G.mode !== 'playing' || !G.allowed.includes(index) || index === G.weapon) return;
    G.weapon = index;
    G.switchAnim = 1;
    G.heat = Math.min(G.heat, 0.55);
    sfx('click');
    updateHud(true);
  }

  function onKeyDown(e) {
    initAudio();

    const targetTag = e.target && e.target.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (G.fileConsole.open) closeFileConsole();
        else if (e.target.blur) e.target.blur();
      } else if (e.code === 'F4' && G.fileConsole.open) {
        e.preventDefault();
        closeFileConsole();
      }
      return;
    }

    if (G.kernel.active) {
      if (['Tab', 'Escape', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
      return;
    }

    if (G.takeover.active) {
      if (e.code === 'KeyT') {
        e.preventDefault();
        finishTakeover(true);
      }
      return;
    }

    if (e.code === 'F2') {
      if (G.fileConsole.open || G.keypadOpen) return;
      if (G.mode === 'finale') {
        e.preventDefault();
        openRootAnomaly();
      } else if (G.mode === 'playing') {
        e.preventDefault();
        openSandbox();
      }
      return;
    }

    if (e.code === 'F3') {
      if ((G.mode === 'playing' || G.mode === 'paused') && !e.repeat) {
        e.preventDefault();
        toggleHitboxes();
      }
      return;
    }

    if (e.code === 'F4') {
      if (G.keypadOpen) return;
      if (G.fileConsole.open) {
        e.preventDefault();
        closeFileConsole();
      } else if (G.mode === 'playing') {
        e.preventDefault();
        openFileConsole();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (G.fileConsole.open) { e.preventDefault(); closeFileConsole(); return; }
      if (G.keypadOpen) { e.preventDefault(); closeKeypad(); return; }
      if (G.mapOpen) { e.preventDefault(); toggleMap(false); return; }
      if (G.panel) { e.preventDefault(); closePanel(); return; }
      if (G.mode === 'inventory') { e.preventDefault(); closeInventory(); return; }
      if (G.mode === 'playing') { e.preventDefault(); pauseGame(); return; }
      if (G.mode === 'paused') { e.preventDefault(); resumeGame(); return; }
      if (G.mode === 'finale') { e.preventDefault(); closeFinale(); return; }
      if (G.mode === 'intro') { e.preventDefault(); showMenu(); return; }
      if (G.mode === 'dead') { e.preventDefault(); showMenu(); return; }
      return;
    }

    if (G.keypadOpen) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        keypadInput(e.key);
        return;
      }
      if (e.code === 'Backspace' || e.code === 'KeyC') {
        e.preventDefault();
        keypadInput('C');
        return;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        keypadInput('E');
        return;
      }
      if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault();
        return;
      }
    }

    if (e.code === 'KeyT' && G.mode === 'playing') {
      if (G.fileConsole.open || G.keypadOpen) return;
      e.preventDefault();
      if (G.mapOpen) toggleMap(false);
      setCursorMode(!G.cursorMode);
      return;
    }

    if (G.cursorMode) return;

    if (e.code === 'KeyI' && G.mode === 'playing') {
      if (G.fileConsole.open || G.keypadOpen) return;
      e.preventDefault();
      openInventory();
      return;
    }

    if (G.mode === 'inventory') {
      if (e.code === 'KeyI') { e.preventDefault(); closeInventory(); }
      return;
    }

    if (e.code === 'Tab' && G.mode === 'playing') {
      if (G.fileConsole.open || G.keypadOpen) return;
      e.preventDefault();
      toggleMap();
      return;
    }

    if (G.mapOpen) {
      e.preventDefault();
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        G.mapZoom = clamp(G.mapZoom + 0.15, 0.55, 2.8);
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        G.mapZoom = clamp(G.mapZoom - 0.15, 0.55, 2.8);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        G.mapPanX = clamp(G.mapPanX + 0.5 / G.mapZoom, -20, 20);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        G.mapPanX = clamp(G.mapPanX - 0.5 / G.mapZoom, -20, 20);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        G.mapPanY = clamp(G.mapPanY + 0.5 / G.mapZoom, -20, 20);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        G.mapPanY = clamp(G.mapPanY - 0.5 / G.mapZoom, -20, 20);
      } else if (e.code === 'Home') {
        G.mapZoom = 1; G.mapPanX = 0; G.mapPanY = 0;
      }
      drawMap(true);
      return;
    }

    if (e.code === 'KeyV' && G.mode === 'playing') {
      e.preventDefault();
      toggleCamera();
      return;
    }

    if (G.mode === 'intro') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        startPendingLevel();
      }
      return;
    }
    if (G.mode === 'complete') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        advanceFromComplete();
      }
      return;
    }
    if (G.mode === 'dead') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        respawn();
      }
      return;
    }
    if (G.mode === 'finale') {
      if (e.code === 'Enter') refreshFinalFiles(true);
      return;
    }
    if (G.mode !== 'playing') return;

    if (G.qte.active) handleQTEKey(e.code);

    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat && ['Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyE', 'KeyF', 'KeyQ'].includes(e.code)) return;

    G.keys[e.code] = true;
    if (e.code === 'KeyE') interact();
    else if (e.code === 'KeyF') {
      if (G.popups.size > 0 || (G.boss && G.takeover.active)) closeOnePopup();
      else toggleFlashlight();
    }
    else if (e.code === 'KeyQ') activateFreeze();
    else if (e.code === 'Space') tryJump();
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      const tap = performance.now();
      if (tap - (G.lastShiftTap || 0) < 280) {
        G.lastShiftTap = 0;
        tryDash();
      } else {
        G.lastShiftTap = tap;
      }
    }
    else if (e.code === 'ControlLeft' || e.code === 'ControlRight') trySlide();
    else if (e.code === 'Digit1' || e.code === 'Numpad1') switchWeapon(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') switchWeapon(1);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') switchWeapon(2);
    else if (e.code === 'KeyR' && e.shiftKey) restartLevel();
  }

  function onKeyUp(e) {
    G.keys[e.code] = false;
  }

  function onMouseMove(e) {
    if (G.mode !== 'playing' || !G.player) return;
    if (G.cursorMode || G.mapOpen || G.takeover.active || G.kernel.active) return;
    if (G.fileConsole.open || G.keypadOpen) return;
    const locked = document.pointerLockElement === $('stage') || G.pointerLocked;
    if (!locked && !G.allowFreeAim) return;
    const dx = locked ? e.movementX || 0 : e.movementX || 0;
    const dy = locked ? e.movementY || 0 : e.movementY || 0;
    if (!dx && !dy) return;
    const sens = 0.00215 * settings.sens;
    G.player.angle += dx * sens;
    G.player.pitch = clamp(G.player.pitch - dy * sens * 62, -74, 74);
    G.swayX = clamp((G.swayX || 0) + dx * 0.018, -1.4, 1.4);
    G.swayY = clamp((G.swayY || 0) + dy * 0.018, -1.4, 1.4);
  }

  function onMouseDown(e) {
    initAudio();
    if (G.mode !== 'playing' || G.cursorMode || G.mapOpen || G.takeover.active || G.kernel.active) return;
    if (G.fileConsole.open || G.keypadOpen) return;
    if (e.button === 0) {
      if (!document.pointerLockElement) G.allowFreeAim = true;
      G.firing = true;
      fireWeapon();
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) G.firing = false;
  }

  function onWheel(e) {
    if (G.mapOpen) {
      e.preventDefault();
      G.mapZoom = clamp(G.mapZoom + (e.deltaY > 0 ? -0.12 : 0.12), 0.55, 2.8);
      drawMap(true);
      return;
    }
    if (G.mode !== 'playing' || G.cursorMode) return;
    if (G.fileConsole.open || G.keypadOpen) return;
    e.preventDefault();
    if (!G.allowed.length) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    let idx = G.allowed.indexOf(G.weapon);
    idx = (idx + dir + G.allowed.length) % G.allowed.length;
    switchWeapon(G.allowed[idx]);
  }

  function setupInput() {
    document.addEventListener('keydown', onKeyDown, { passive: false });
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('contextmenu', (e) => {
      if (G.mode === 'playing') e.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => {
      const stage = $('stage');
      G.pointerLocked = Boolean(document.pointerLockElement);
      stage?.classList.toggle('cursor-hidden', G.pointerLocked && G.mode === 'playing');
      if (!G.pointerLocked && G.mode === 'playing' && !G.expectUnlock && !G.cursorMode && !G.mapOpen && !G.takeover.active && !G.kernel.active) pauseGame();
    });
    document.addEventListener('pointerlockerror', () => {
      G.allowFreeAim = true;
      showNotify('FARE KİLİDİ KURULAMADI // SERBEST NİŞAN', 'warn', 3200);
    });
    window.addEventListener('blur', () => {
      G.firing = false;
      G.keys = Object.create(null);
      if (G.mode === 'playing' && !G.debug && !G.cursorMode && !G.mapOpen && !G.takeover.active && !G.kernel.active) pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.mode === 'playing' && !G.debug && !G.cursorMode && !G.mapOpen && !G.takeover.active && !G.kernel.active) pauseGame();
    });
    $('stage')?.addEventListener('click', () => {
      if (G.mode === 'playing' && !G.cursorMode && !G.mapOpen && !G.takeover.active && !G.kernel.active) requestPointer();
    });
  }

  function setupExternalBridge() {
    if (!window.limboOS) return;
    if (window.limboOS.onPopupClosed) {
      window.limboOS.onPopupClosed((payload) => {
        const id = payload && payload.id;
        if (!id) return;
        const key = 'os' + id;
        if (G.popups.has(key)) removePopup(key);
      });
    }
    if (window.limboOS.onTerminalClosed) {
      window.limboOS.onTerminalClosed(() => {
        if (G.mode === 'playing' && G.level && G.level.terminal) {
          showFeed('YAN TERMİNAL KAPATILDI.', 'warn');
        }
      });
    }
    if (window.limboOS.onPopupSolved) {
      window.limboOS.onPopupSolved((payload) => {
        const key = `os${payload && payload.id}`;
        if (G.popups.has(key)) removePopup(key);
        addStyle(12);
        sfx('codeOk');
        showNotify('KISA DEVRE ÇÖZÜLDÜ // PENCERE TEMİZLENDİ', '', 3200);
        if (G.boss && G.popups.size === 0) afterPopupChange();
      });
    }
  }

  // --------------------------------------------------------------- loop / boot
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    const previous = G.lastFrame || timestamp;
    G.lastFrame = timestamp;
    let dtReal = (timestamp - previous) / 1000;
    if (!Number.isFinite(dtReal) || dtReal <= 0) dtReal = 0.016;
    dtReal = Math.min(0.05, dtReal);
    G.animTime += dtReal;
    updateSystemClock();
    updatePuzzleChallenge();

    if (G.mode === 'playing' && G.level && G.player) {
      G.levelTime += dtReal;
      scheduleMetaEvents(dtReal);
      updateFreeze(dtReal);
      updateEffects(dtReal);
      updateTimedPopups(dtReal);
      updateAmbient(dtReal);
      const frozenByScene = G.takeover.active || G.kernel.active;
      if (!frozenByScene) {
        updateQTE(dtReal);
        updateHazards(dtReal);
        if (!G.mapOpen) {
          updatePlayer(dtReal * G.timeScale, dtReal);
        }
        updateEnemies(dtReal * G.timeScale * (G.mapOpen ? 0.16 : 1), dtReal);
        updateProjectiles(dtReal * G.timeScale * (G.mapOpen ? 0.16 : 1));
        updateDataOrbs(dtReal * G.timeScale);
        updatePickups(dtReal * G.timeScale);
        updateItemPickups(dtReal * G.timeScale);
        updateWaves(dtReal);
        G.checkpointTimer += dtReal;
        if (G.checkpointTimer >= 8) {
          G.checkpointTimer = 0;
          updateCheckpoint();
        }
        G.mapExploreTimer += dtReal;
        if (G.mapExploreTimer >= 0.35) {
          G.mapExploreTimer = 0;
          markExplored(4.2);
        }
        if (G.mode === 'playing' && G.levelTime - G.lastObjectiveRefresh > 0.45) {
          G.lastObjectiveRefresh = G.levelTime;
          refreshObjective();
        }
        updateHud();
      }
      if (G.mapOpen) {
        drawMap();
      } else {
        renderScene();
      }
    } else if (G.mode === 'paused' && G.level && G.player) {
      renderScene();
    }
  }

  function installDebugApi() {
    window.LIMBO_DEBUG = {
      start(n) {
        G.debug = true;
        initAudio();
        beginLevel(clamp(Number(n) || 1, 1, 15), false);
      },
      menu() {
        G.debug = true;
        showMenu();
      },
      killAll() {
        for (const e of G.enemies.slice()) {
          if (!e.dead) {
            e.hp = 0;
            killEnemy(e, 'debug');
          }
        }
      },
      clearEnemies() {
        G.enemies = [];
        G.aimTarget = null;
      },
      spawn(type, x, y) {
        const e = spawnEnemy(type || 'crawler', Number(x) || G.player.x + 3, Number(y) || G.player.y, { burst: false });
        e.spawnGrace = 0;
        return { type: e.typeKey, x: e.x, y: e.y, z: e.z, height: e.height, radius: e.radius, hp: e.hp };
      },
      weapon(key) {
        const idx = typeof key === 'number' ? key : WEAPONS.findIndex((w) => w.key === key);
        if (idx >= 0 && idx < WEAPONS.length) {
          G.weapon = idx;
          G.cooldown = 0;
          G.heat = 0;
          G.overheat = false;
        }
        return { index: G.weapon, key: WEAPONS[G.weapon] && WEAPONS[G.weapon].key };
      },
      shoot() {
        G.cooldown = 0;
        fireWeapon();
        return {
          weapon: G.weapon,
          aim: { slope: aimSlope(), eyeZ: playerEyeZ() },
          lastShot: G.lastShot ? { dist: G.lastShot.dist, z: G.lastShot.z, enemy: Boolean(G.lastShot.enemy) } : null,
        };
      },
      warp(x, y, angle) {
        if (!G.player) return;
        G.player.x = Number(x) || G.player.x;
        G.player.y = Number(y) || G.player.y;
        if (Number.isFinite(angle)) G.player.angle = angle;
      },
      complete() { completeLevel(); },
      die() { die(); },
      finale() { openFinale(); },
      keypad() { openKeypad(); },
      fileConsole() { openFileConsole(); },
      puzzle(seconds) { startPuzzleChallenge('file', Number(seconds) || 60); },
      aim() {
        return {
          slope: aimSlope(),
          eyeZ: playerEyeZ(),
          target: G.aimTarget ? { x: G.aimTarget.x, y: G.aimTarget.y, z: G.aimTarget.z, hp: G.aimTarget.hp } : null,
          lastShot: G.lastShot ? { dist: G.lastShot.dist, z: G.lastShot.z, enemy: Boolean(G.lastShot.enemy) } : null,
        };
      },
      qte() { startQTE(); },
      freeze() { activateFreeze(); },
      cursor(on) { G.debug = true; setCursorMode(on === undefined ? !G.cursorMode : Boolean(on), false); },
      map(open) { toggleMap(open === undefined ? !G.mapOpen : Boolean(open)); },
      hitboxes(on) { toggleHitboxes(on); },
      camera(on) { if (Boolean(on) !== G.camera.third) toggleCamera(); },
      takeover(id) { startTakeover(Number(id) || G.levelId || 3); },
      hazard() { triggerHazard(); },
      kernel() { triggerKernelPanic(null, 2600); },
      gpu() { flashGpu(1200); },
      spill() { maybeTriggerSpill(true); },
      wallpaper() { maybeTriggerWallpaper(true); },
      user(name) { G.meta.user = String(name || 'OPERATÖR'); setText('sideUser', G.meta.user.toUpperCase()); },
      reset() { resetGameProgress(); },
      progress() { return JSON.parse(JSON.stringify(progress)); },
      save() { return savePayload(); },
      meta: G.meta,
      state: G,
    };
  }

  async function bootGame() {
    await loadGameState();
    applySettingsUI();
    setupButtons();
    setupSettingsInputs();
    setupHud();
    ENGINE.init();
    setupInput();
    setupExternalBridge();
    if (DEV_MODE) installDebugApi();
    G.lastFrame = performance.now();
    requestAnimationFrame(gameLoop);
    // The old localStorage flag is no longer authoritative.  Termination now
    // lives in userData/limbo_meta/terminated.json and can only be cleared by
    // the hidden reset token.
    try { localStorage.removeItem(FINAL_KEY); } catch (_) {}
    const finishBoot = () => {
      if (G.meta.terminated) {
        showTerminated(true);
        return;
      }
      setText('sideUser', String(G.meta.user || 'OPERATÖR').toUpperCase());
      runBootSequence();
    };
    if (window.limboOS) {
      refreshMeta(true).then(finishBoot).catch(finishBoot);
    } else {
      G.meta.ready = true;
      finishBoot();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGame, { once: true });
  } else {
    bootGame();
  }
})();
