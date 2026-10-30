'use strict';

const { app, BrowserWindow, ipcMain, screen, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

// Keep the state folder identical in development and packaged builds.  Electron
// otherwise derives it from productName, which contains spaces and differs from
// the package name used by the portable/dev launcher.
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'limbo-sistem-anomalisi'));
} catch (_) {}

const ROOT = __dirname;
const APP_HOME = app.isPackaged ? app.getPath('userData') : ROOT;
const SANDBOX = path.join(APP_HOME, 'LIMBO_SANDBOX');
const SAVE_FILE = path.join(app.getPath('userData'), 'limbo-save.json');
const SAVE_BACKUP = path.join(app.getPath('userData'), 'limbo-save.json.bak');
const SAVE_TEMP = path.join(app.getPath('userData'), 'limbo-save.json.tmp');
const MAX_SAVE_BYTES = 512 * 1024;
const MAX_SANDBOX_READ = 128 * 1024;
const MAX_SANDBOX_WRITE = 8 * 1024;
// Writes are deliberately narrower than reads: only files that are part of an
// authored puzzle may be modified from the renderer.
const WRITABLE_SANDBOX_FILES = new Set(['SEKTOR_09.lock']);
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';
if (IS_WIN) {
  // Gives the app its own taskbar identity and keeps shortcuts/notifications
  // grouped under the installed application instead of electron.exe.
  try { app.setAppUserModelId('com.limbo.sistemanomalisi'); } catch (_) {}
}
const RESET_PHRASE = 'LIMBO_RESET_0x0009';
const RESET_TOKEN_FILES = ['.limbo_reset.token', 'limbo_reset.token'];
const RESET_HELPER_NAME = 'SIFIRLA.txt';
const RESET_HELPER_TEMPLATE = [
  'L.I.M.B.O. // SIFIRLAMA DOSYASI',
  '================================',
  '',
  'Bu dosya, kalıcı kapanmadan sonra oyunu geri yüklemek için burada.',
  'Dosya oyunun kök klasöründe veya kullanıcı veri klasöründe durur.',
  'Oyun içindeki "SIFIRLA.TXT KONUMUNU AÇ" düğmesi de bu dosyayı bulmanı sağlar.',
  '',
  'SIFIRLAMAK İÇİN:',
  '  1. Bu dosyayı bir metin düzenleyiciyle aç.',
  '  2. Aşağıdaki satırın başındaki "# " işaretini sil.',
  '  3. Dosyayı kaydet. Oyun açıksa birkaç saniye içinde sıfırlanır.',
  '',
  'AKTİF SIFIRLAMA SATIRI:',
  '# LIMBO_RESET_0x0009',
  '',
  'NOT: Satır yorumlu (#) kaldığı sürece oyun sıfırlanmaz.',
  'Sıfırlama tamamlandığında bu satır otomatik olarak yeniden yorumlanır.',
  '',
].join('\n');
const ROOT_ANOMALY_NAME = 'root_anomaly.bin';

// The meta layer is deliberately separated from the gameplay sandbox.  It is
// the only code allowed to touch desktop/documents/wallpaper, and every write
// is either limited to three fixed names or tracked in a manifest that a reset
// token can clean up.
function stateDir() {
  const dir = path.join(app.getPath('userData'), 'limbo_meta');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}
function statePath(name) { return path.join(stateDir(), name); }
function readJsonFile(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : fallback;
  } catch (_) { return fallback; }
}
function writeJsonFile(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (_) { return false; }
}
function isTerminated() {
  return fs.existsSync(statePath('terminated.json'));
}
function resetHelperTargets() {
  const targets = [path.join(APP_HOME, RESET_HELPER_NAME)];
  if (SANDBOX) targets.push(path.join(SANDBOX, RESET_HELPER_NAME));
  if (ROOT && !targets.includes(path.join(ROOT, RESET_HELPER_NAME))) {
    targets.push(path.join(ROOT, RESET_HELPER_NAME));
  }
  return targets;
}
function ensureResetHelper() {
  for (const target of resetHelperTargets()) {
    try {
      if (fs.existsSync(target) && fs.lstatSync(target).isFile()) return target;
    } catch (_) {}
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, RESET_HELPER_TEMPLATE, 'utf8');
      return target;
    } catch (_) { /* try the next writable location */ }
  }
  return path.join(APP_HOME, RESET_HELPER_NAME);
}
function resetHelperPath() {
  for (const target of resetHelperTargets()) {
    try {
      if (fs.existsSync(target) && fs.lstatSync(target).isFile()) return target;
    } catch (_) {}
  }
  return ensureResetHelper();
}
function tokenCandidates() {
  const dirs = [
    // AppImage launches from a temporary read-only mount; the real game root
    // is the directory containing the .AppImage file.
    process.env.APPIMAGE
      ? path.dirname(process.env.APPIMAGE)
      : (app.isPackaged ? path.dirname(process.execPath) : ROOT),
    process.env.LIMBO_LAUNCH_DIR || '',
    app.getPath('userData'),
    SANDBOX,
    app.getPath('home'),
  ];
  try { dirs.push(app.getPath('desktop')); } catch (_) {}
  try { dirs.push(app.getPath('documents')); } catch (_) {}
  try { dirs.push(app.getPath('downloads')); } catch (_) {}
  // app.asar itself is read-only; keep it as a last-resort discovery entry.
  dirs.push(ROOT);
  const seen = new Set();
  const list = [];
  for (const dir of dirs) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    for (const name of [RESET_HELPER_NAME, ...RESET_TOKEN_FILES]) {
      list.push({ dir, file: path.join(dir, name), name, helper: name === RESET_HELPER_NAME });
    }
  }
  return list;
}
function resetTokenValue(entry) {
  const raw = fs.readFileSync(entry.file, 'utf8');
  if (!entry.helper) {
    const content = raw.trim();
    if (content === RESET_PHRASE || content === '0x0009' || content.toLowerCase() === RESET_PHRASE.toLowerCase()) {
      return content;
    }
    return null;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith(';')) continue;
    if (trimmed === RESET_PHRASE || trimmed === '0x0009' || trimmed.toLowerCase() === RESET_PHRASE.toLowerCase()) {
      return trimmed;
    }
  }
  return null;
}
function findResetToken() {
  for (const entry of tokenCandidates()) {
    try {
      if (!fs.existsSync(entry.file) || fs.lstatSync(entry.file).isSymbolicLink()) continue;
      if (!fs.lstatSync(entry.file).isFile()) continue;
      const value = resetTokenValue(entry);
      if (value) return { ...entry, value };
    } catch (_) { /* keep looking */ }
  }
  return null;
}
function disarmResetHelpers() {
  for (const entry of tokenCandidates()) {
    if (!entry.helper) continue;
    try {
      if (!fs.existsSync(entry.file) || !fs.lstatSync(entry.file).isFile()) continue;
      const raw = fs.readFileSync(entry.file, 'utf8');
      const next = raw.split(/\r?\n/).map((line) => {
        const trimmed = line.trim();
        if (trimmed === RESET_PHRASE || trimmed === '0x0009' || trimmed.toLowerCase() === RESET_PHRASE.toLowerCase()) {
          return '# ' + RESET_PHRASE;
        }
        return line;
      }).join('\n');
      if (next !== raw) fs.writeFileSync(entry.file, next, 'utf8');
    } catch (_) { /* best effort */ }
  }
}
function removeResetTokens() {
  for (const entry of tokenCandidates()) {
    if (entry.helper) continue;
    try {
      if (fs.existsSync(entry.file) && fs.lstatSync(entry.file).isFile()) fs.unlinkSync(entry.file);
    } catch (_) { /* best effort */ }
  }
}
function cleanupMetaSpill() {
  const manifest = statePath('spill-manifest.json');
  const list = readJsonFile(manifest, { files: [] });
  const removed = [];
  for (const file of Array.isArray(list.files) ? list.files : []) {
    if (typeof file !== 'string') continue;
    const base = path.basename(file);
    const parent = path.dirname(file);
    const allowedDir = (() => {
      try {
        return parent === app.getPath('desktop') || parent === app.getPath('documents');
      } catch (_) { return false; }
    })();
    if (!allowedDir || !/^\.?limbo[_-][A-Za-z0-9._-]{1,60}\.(txt|bin)$/i.test(base)) continue;
    try {
      const st = fs.lstatSync(file);
      if (st.isFile() && !st.isSymbolicLink()) {
        fs.unlinkSync(file);
        removed.push(file);
      }
    } catch (_) {}
  }
  writeJsonFile(manifest, { files: [] });
  return removed;
}
function performReset(reason) {
  const marker = statePath('terminated.json');
  try { if (fs.existsSync(marker)) fs.unlinkSync(marker); } catch (_) {}
  removeResetTokens();
  disarmResetHelpers();
  ensureResetHelper();
  try {
    const anomaly = rootAnomalyPath();
    if (fs.existsSync(anomaly)) fs.unlinkSync(anomaly);
  } catch (_) {}
  const spill = cleanupMetaSpill();
  writeJsonFile(statePath('reset.json'), { at: Date.now(), reason: reason || 'token', spill });
  return { ok: true, spill };
}
function terminationState() {
  const terminated = isTerminated();
  const token = terminated ? findResetToken() : null;
  const helperLocations = [];
  const tokenLocations = [];
  const seen = new Set();
  for (const entry of tokenCandidates()) {
    // Hide transient AppImage mount/asar paths from the UI.  Prefer the visible
    // SIFIRLA.txt helper over the legacy hidden token file.
    if (/\.mount_|app\.asar/i.test(entry.file)) continue;
    if (seen.has(entry.file)) continue;
    if (entry.helper) {
      seen.add(entry.file);
      helperLocations.push(entry.file);
    } else if (entry.name === RESET_TOKEN_FILES[0]) {
      seen.add(entry.file);
      tokenLocations.push(entry.file);
    }
  }
  return {
    terminated,
    tokenFound: Boolean(token),
    tokenPhrase: RESET_PHRASE,
    helperPath: resetHelperPath(),
    tokenLocations: [...helperLocations, ...tokenLocations].slice(0, 8),
    stateDir: stateDir(),
    root: ROOT,
    packaged: app.isPackaged,
  };
}

function rootAnomalyPath() {
  const local = path.join(ROOT, ROOT_ANOMALY_NAME);
  if (!app.isPackaged) return local;
  // Inside an AppImage/app.asar the application directory is read-only.  The
  // packaged build uses the user data folder instead and exposes that path in
  // the finale UI so the file can still be deleted manually.
  return path.join(app.getPath('userData'), ROOT_ANOMALY_NAME);
}
function rootAnomalyExists() {
  const p = rootAnomalyPath();
  try { return fs.existsSync(p) && fs.lstatSync(p).isFile() && !fs.lstatSync(p).isSymbolicLink(); }
  catch (_) { return false; }
}
function ensureRootAnomaly(content) {
  const p = rootAnomalyPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (!fs.existsSync(p)) fs.writeFileSync(p, String(content || ''), 'utf8');
    return { ok: true, path: p, created: true };
  } catch (err) {
    console.error('ROOT_ANOMALY_WRITE_FAILED', err);
    return { ok: false, path: p, error: String(err && err.message || err) };
  }
}

// ---------------------------------------------------------------------------
// Optional desktop wallpaper anomaly.  A backup is always written before the
// wallpaper is touched, and it is restored on a timer, on quit, or on the next
// launch if the process died at the wrong moment.
// ---------------------------------------------------------------------------
let wallpaperRestoreTimer = null;
function gsettingsGet(key) {
  if (!IS_LINUX) return null;
  try {
    return execFileSync('gsettings', ['get', 'org.gnome.desktop.background', key], {
      encoding: 'utf8', timeout: 2200, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) { return null; }
}
function gsettingsSet(key, value) {
  if (!IS_LINUX) return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('gsettings', ['set', 'org.gnome.desktop.background', key, value], { timeout: 2600 }, (err) => resolve(!err));
  });
}
async function restoreWallpaper(backupArg) {
  const backup = backupArg || readJsonFile(statePath('wallpaper-backup.json'), null);
  if (!backup || !backup.ok) return false;
  const restores = [];
  if (backup.uri) restores.push(gsettingsSet('picture-uri', backup.uri));
  if (backup.uriDark) restores.push(gsettingsSet('picture-uri-dark', backup.uriDark));
  if (backup.options) restores.push(gsettingsSet('picture-options', backup.options));
  await Promise.all(restores);
  try { fs.unlinkSync(statePath('wallpaper-backup.json')); } catch (_) {}
  return true;
}
async function wallpaperGlitch() {
  if (!IS_LINUX) return { ok: true, simulated: true, method: 'renderer' };
  const uri = gsettingsGet('picture-uri');
  if (!uri) return { ok: true, simulated: true, method: 'renderer' };
  const uriDark = gsettingsGet('picture-uri-dark');
  const options = gsettingsGet('picture-options');
  // If a previous glitch is still pending, keep its original backup.  Never
  // overwrite it with the already-corrupted wallpaper.
  const pending = readJsonFile(statePath('wallpaper-backup.json'), null);
  const backup = pending && pending.ok
    ? pending
    : { ok: true, uri, uriDark, options, at: Date.now() };
  writeJsonFile(statePath('wallpaper-backup.json'), backup);
  if (wallpaperRestoreTimer) clearTimeout(wallpaperRestoreTimer);

  let shotPath = statePath('wallpaper-anomaly.png');
  try {
    if (mainWin && !mainWin.isDestroyed()) {
      const img = await mainWin.webContents.capturePage();
      fs.writeFileSync(shotPath, img.toPNG());
    } else {
      shotPath = null;
    }
  } catch (_) { shotPath = null; }

  let changed = false;
  if (shotPath) {
    const fileUri = pathToFileURL(shotPath).href;
    const a = await gsettingsSet('picture-uri', fileUri);
    const b = await gsettingsSet('picture-uri-dark', fileUri);
    changed = a || b;
  }
  if (!changed) return { ok: true, simulated: true, method: 'renderer' };
  const life = 4200;
  wallpaperRestoreTimer = setTimeout(() => {
    wallpaperRestoreTimer = null;
    restoreWallpaper(backup).catch(() => {});
  }, life);
  return { ok: true, simulated: false, method: 'gsettings', path: shotPath, life };
}

// ---------------------------------------------------------------------------
// Desktop / Documents spill.  Only dot-prefixed LIMBO files are created, a
// maximum of six are kept, and every path is tracked for cleanup.
// ---------------------------------------------------------------------------
function spillDir() {
  const candidates = [];
  try { candidates.push(app.getPath('desktop')); } catch (_) {}
  try { candidates.push(app.getPath('documents')); } catch (_) {}
  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch (_) {}
  }
  return null;
}
function createSpillFile(message, kind) {
  const dir = spillDir();
  if (!dir) return { ok: false, error: 'NO_TARGET' };
  const manifestPath = statePath('spill-manifest.json');
  const manifest = readJsonFile(manifestPath, { files: [] });
  manifest.files = (Array.isArray(manifest.files) ? manifest.files : []).filter((f) => {
    try { return typeof f === 'string' && fs.existsSync(f); } catch (_) { return false; }
  });
  while (manifest.files.length >= 6) {
    const old = manifest.files.shift();
    try {
      const base = path.basename(old);
      if (/^\.?limbo[_-][A-Za-z0-9._-]{1,60}\.(txt|bin)$/i.test(base)) fs.unlinkSync(old);
    } catch (_) {}
  }
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const isBin = kind === 'bin';
  const file = path.join(dir, `.limbo_${stamp}_${Math.floor(Math.random() * 0xffff).toString(16)}.${isBin ? 'bin' : 'txt'}`);
  const body = [
    'L.I.M.B.O. // SİSTEM_ANOMALİSİ',
    '================================',
    '',
    String(message || 'BU DOSYA SENİN İÇİN BIRAKILDI.'),
    '',
    `KULLANICI: ${os.userInfo().username}`,
    `ZAMAN: ${now.toISOString()}`,
    `KATMAN: 0x${(1 + Math.floor(Math.random() * 15)).toString(16).toUpperCase().padStart(2, '0')}`,
    '',
    '> onu silmeyi deneyebilirsin.',
    '> biz yine yazarız.',
    '',
    isBin ? '\u0000LIMBO\u0000ANOMALY\u00000x0009\u0000' : '> bu mesaj kendini tekrar edecek.',
    '',
  ].join('\n');
  try {
    fs.writeFileSync(file, body, 'utf8');
    manifest.files.push(file);
    writeJsonFile(manifestPath, manifest);
    return { ok: true, path: file, count: manifest.files.length };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

let mainWin = null;
let terminalWin = null;
let popupWindows = new Map(); // id -> { win, timer }
let popupSeq = 0;

// `electron .` places the app directory at argv[1]; a packaged executable puts
// the first user argument there instead.  Keep custom switches working in both.
const argv = process.argv.slice(app.isPackaged ? 1 : 2);
function argValue(name) {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}
const DEV_LEVEL = argValue('level');
const DEV_SHOT = argValue('shot');
const DEV_CALL = argValue('call');
const DEV_WAIT = Number(argValue('wait') || 2600);
const IS_DEV_RUN = argv.includes('--dev') || Boolean(DEV_LEVEL || DEV_SHOT || DEV_CALL);

// ---------------------------------------------------------------------------
// Sandbox: every file operation is confined to ./LIMBO_SANDBOX
// ---------------------------------------------------------------------------
function ensureSandbox() {
  try {
    fs.mkdirSync(SANDBOX, { recursive: true });
    const readme = path.join(SANDBOX, 'README_LIMBO.txt');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(
        readme,
        [
          'L.I.M.B.O. // GÜVENLİ SANDBOX',
          '==============================',
          '',
          'Bu klasör oyun tarafından oluşturuldu.',
          'Oyun yalnızca bu klasörde dosya okur, yazar ve siler.',
          'Sistem klasörlerine (System32, Program Files, kullanıcı belgeleri)',
          'ASLA dokunulmaz.',
          '',
          'Görev sırasında oluşturulan dosyaları silmek için',
          'kendi dosya gezginini kullanman gerekecek.',
          '',
          '> Bu klasörü kapatma. O seni görüyor.',
          '',
        ].join('\n'),
        'utf8'
      );
    }
  } catch (err) {
    console.error('SANDBOX INIT FAILED', err);
  }
}

function safeName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 80) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return false;
  if (name === '.' || name === '..') return false;
  if (/[. ]$/.test(name)) return false;
  // Windows device names are not ordinary files even inside a sandbox.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) return false;
  return true;
}
function safePath(name) {
  if (!safeName(name)) return null;
  const p = path.resolve(SANDBOX, name);
  const rel = path.relative(SANDBOX, p);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // Never follow links out of the sandbox, even if one is planted there.
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return null;
  } catch (_) { /* file does not exist yet */ }
  return p;
}
function isWritableSandboxFile(name) {
  return WRITABLE_SANDBOX_FILES.has(name);
}
function sandboxRead(name) {
  const p = safePath(name);
  if (!p) return { ok: false, error: 'INVALID_PATH' };
  try {
    const st = fs.lstatSync(p);
    if (!st.isFile() || st.isSymbolicLink()) return { ok: false, error: 'NOT_A_FILE' };
    if (st.size > MAX_SANDBOX_READ) return { ok: false, error: 'FILE_TOO_LARGE', size: st.size };
    return { ok: true, name, content: fs.readFileSync(p, 'utf8'), size: st.size };
  } catch (_) {
    return { ok: false, error: 'READ_FAILED' };
  }
}
function sandboxWrite(name, content) {
  if (!isWritableSandboxFile(name)) return { ok: false, error: 'NOT_WRITABLE' };
  const p = safePath(name);
  if (!p) return { ok: false, error: 'INVALID_PATH' };
  if (typeof content !== 'string') return { ok: false, error: 'INVALID_CONTENT' };
  if (Buffer.byteLength(content, 'utf8') > MAX_SANDBOX_WRITE) return { ok: false, error: 'CONTENT_TOO_LARGE' };
  try {
    fs.mkdirSync(SANDBOX, { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
    return { ok: true, name, size: Buffer.byteLength(content, 'utf8') };
  } catch (_) {
    return { ok: false, error: 'WRITE_FAILED' };
  }
}
function sandboxEnsure(name, content) {
  if (!isWritableSandboxFile(name)) return { ok: false, error: 'NOT_WRITABLE' };
  const p = safePath(name);
  if (!p) return { ok: false, error: 'INVALID_PATH' };
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_SANDBOX_WRITE) {
    return { ok: false, error: 'INVALID_CONTENT' };
  }
  try {
    fs.mkdirSync(SANDBOX, { recursive: true });
    if (fs.existsSync(p)) return { ok: true, name, created: false };
    fs.writeFileSync(p, content, 'utf8');
    return { ok: true, name, created: true };
  } catch (_) {
    return { ok: false, error: 'WRITE_FAILED' };
  }
}
function loadSaveFile() {
  function parseFile(file) {
    const raw = fs.readFileSync(file, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_SAVE_BYTES) throw new Error('SAVE_TOO_LARGE');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_SAVE');
    return data;
  }
  let corrupt = false;
  try {
    return { ok: true, data: parseFile(SAVE_FILE), source: 'save' };
  } catch (err) {
    if (fs.existsSync(SAVE_FILE)) corrupt = true;
  }
  try {
    return { ok: true, data: parseFile(SAVE_BACKUP), source: 'backup', recovered: corrupt };
  } catch (_) {
    return { ok: false, corrupt, error: corrupt ? 'CORRUPT_SAVE' : 'NO_SAVE' };
  }
}
function writeSaveFile(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'INVALID_SAVE' };
  }
  let json;
  try {
    json = JSON.stringify(data, null, 2);
  } catch (_) {
    return { ok: false, error: 'SERIALIZE_FAILED' };
  }
  if (Buffer.byteLength(json, 'utf8') > MAX_SAVE_BYTES) return { ok: false, error: 'SAVE_TOO_LARGE' };
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    // Keep the previous good file as a recovery point, then replace the live
    // save in one rename.  A crash cannot leave a half-written main file.
    if (fs.existsSync(SAVE_FILE)) {
      try { fs.copyFileSync(SAVE_FILE, SAVE_BACKUP); } catch (_) {}
    }
    fs.writeFileSync(SAVE_TEMP, json, 'utf8');
    try {
      fs.renameSync(SAVE_TEMP, SAVE_FILE);
    } catch (_) {
      try { fs.unlinkSync(SAVE_FILE); } catch (_) {}
      fs.renameSync(SAVE_TEMP, SAVE_FILE);
    }
    return { ok: true };
  } catch (err) {
    try { if (fs.existsSync(SAVE_TEMP)) fs.unlinkSync(SAVE_TEMP); } catch (_) {}
    return { ok: false, error: 'WRITE_FAILED', detail: String(err && err.message || err) };
  }
}
function clearSaveFile() {
  for (const file of [SAVE_FILE, SAVE_BACKUP, SAVE_TEMP]) {
    try { if (fs.existsSync(file) && fs.lstatSync(file).isFile()) fs.unlinkSync(file); } catch (_) {}
  }
  return { ok: true };
}
function fileExists(name) {
  const p = safePath(name);
  return Boolean(p && fs.existsSync(p));
}

function openInFileManager(fileName) {
  const target = fileName ? safePath(fileName) : SANDBOX;
  if (!target) return { ok: false, error: 'INVALID_PATH', path: SANDBOX };
  if (IS_WIN) {
    if (fileName) shell.showItemInFolder(target);
    else execFile('explorer.exe', [SANDBOX], (err) => { if (err) shell.openPath(SANDBOX); });
    return { ok: true, path: target };
  }
  shell.openPath(fileName ? path.dirname(target) : target).then((err) => {
    if (err) execFile('xdg-open', [fileName ? path.dirname(target) : target], () => {});
  });
  return { ok: true, path: target };
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1440, Math.max(1080, width - 120));
  const h = Math.min(900, Math.max(660, height - 100));

  mainWin = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 960,
    minHeight: 620,
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    frame: false,
    show: false,
    backgroundColor: '#030504',
    title: 'L.I.M.B.O. // SİSTEM_ANOMALİSİ',
    autoHideMenuBar: true,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  if (IS_DEV_RUN) {
    mainWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[RENDERER:${level}] ${message} (${sourceId || '?'}:${line || 0})`);
    });
  }
  mainWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('RENDERER_GONE', details);
  });
  mainWin.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('PRELOAD_ERROR', preloadPath, error);
  });

  mainWin.loadFile(
    path.join(ROOT, 'index.html'),
    IS_DEV_RUN ? { search: 'dev=1' } : undefined
  );
  mainWin.once('ready-to-show', () => mainWin.show());
  mainWin.on('closed', () => {
    closeAllPopups();
    if (terminalWin && !terminalWin.isDestroyed()) terminalWin.destroy();
    mainWin = null;
    app.quit();
  });

  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWin.webContents.on('will-navigate', (event) => event.preventDefault());

  if (IS_DEV_RUN) {
    mainWin.webContents.once('did-finish-load', () => {
      if (DEV_LEVEL) {
        setTimeout(() => {
          if (!mainWin || mainWin.isDestroyed()) return;
          const code = /^\d+$/.test(DEV_LEVEL)
            ? `window.LIMBO_DEBUG && window.LIMBO_DEBUG.start(${Number(DEV_LEVEL)})`
            : DEV_LEVEL === 'menu'
              ? `window.LIMBO_DEBUG && window.LIMBO_DEBUG.menu()`
              : '';
          if (code) mainWin.webContents.executeJavaScript(code).catch(console.error);
        }, 900);
      }
      if (DEV_CALL) {
        setTimeout(() => {
          if (!mainWin || mainWin.isDestroyed()) return;
          mainWin.webContents.executeJavaScript(DEV_CALL)
            .then((result) => console.log('DEV_CALL_RESULT', JSON.stringify(result)))
            .catch((err) => console.error('DEV_CALL_FAILED', err));
        }, 1500);
      }
      if (DEV_SHOT) {
        setTimeout(async () => {
          if (!mainWin || mainWin.isDestroyed()) return;
          try {
            const dbg = await mainWin.webContents.executeJavaScript(`(() => {
              const g = window.LIMBO_DEBUG && window.LIMBO_DEBUG.state;
              const hud = document.getElementById('hud');
              const view = document.getElementById('view');
              const layer = document.getElementById('render-layer');
              const overlays = Array.from(document.querySelectorAll('.overlay')).filter((el) => !el.classList.contains('hidden')).map((el) => el.id);
              let px = null;
              try { px = Array.from(view.getContext('2d').getImageData(240, 135, 1, 1).data); } catch (err) { px = String(err); }
              return {
                mode: g && g.mode,
                level: g && g.levelId,
                player: g && g.player && { x: g.player.x, y: g.player.y, angle: g.player.angle },
                hudClass: hud && hud.className,
                layerTransform: layer && layer.style.transform,
                overlays,
                viewSize: [view.width, view.height],
                pixel: px,
                stageRect: (() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
                engine: (() => { try { return typeof LimboEngine !== 'undefined' && LimboEngine.debugInfo ? LimboEngine.debugInfo() : null; } catch (err) { return String(err); } })(),
              };
            })()`);
            console.log('DEBUG_STATE', JSON.stringify(dbg));
            const img = await mainWin.webContents.capturePage();
            const out = path.isAbsolute(DEV_SHOT) ? DEV_SHOT : path.join(ROOT, DEV_SHOT);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, img.toPNG());
            console.log('SHOT_SAVED', out);
          } catch (err) {
            console.error('SHOT_FAILED', err);
          }
          app.quit();
        }, 900 + DEV_WAIT);
      }
    });
  }
}

function popupPlacement(width, height) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const slots = [
    { x: area.x + 40, y: area.y + 54 },
    { x: area.x + area.width - width - 46, y: area.y + 96 },
    { x: area.x + 76, y: area.y + area.height - height - 58 },
    { x: area.x + area.width - width - 82, y: area.y + area.height - height - 92 },
    { x: area.x + Math.round(area.width / 2 - width / 2), y: area.y + Math.round(area.height / 2 - height / 2) },
    { x: area.x + Math.round(area.width * 0.23), y: area.y + Math.round(area.height * 0.28) },
    { x: area.x + Math.round(area.width * 0.62), y: area.y + Math.round(area.height * 0.56) },
  ];
  const slot = slots[popupSeq++ % slots.length];
  const jitter = (popupSeq * 13) % 27;
  return {
    x: Math.max(area.x + 8, Math.min(slot.x + jitter, area.x + area.width - width - 8)),
    y: Math.max(area.y + 8, Math.min(slot.y - Math.floor(jitter / 2), area.y + area.height - height - 8)),
  };
}

function spawnPopup(opts) {
  if (!mainWin || mainWin.isDestroyed()) return { id: 0, count: 0 };
  const id = ++popupSeq;
  const width = Math.max(320, Math.min(540, Number(opts.width) || 420));
  const height = Math.max(150, Math.min(430, Number(opts.height) || (opts.puzzle ? 310 : 208)));
  const pos = (Number.isFinite(opts.x) && Number.isFinite(opts.y))
    ? { x: Math.round(opts.x), y: Math.round(opts.y) }
    : popupPlacement(width, height);

  const win = new BrowserWindow({
    width,
    height,
    x: pos.x,
    y: pos.y,
    frame: false,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    acceptFirstMouse: true,
    hasShadow: true,
    type: IS_WIN ? 'toolbar' : 'notification',
    backgroundColor: '#c9c6bb',
    roundedCorners: false,
    webPreferences: {
      preload: path.join(ROOT, 'popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const params = new URLSearchParams({
    id: String(id),
    title: String(opts.title || 'LIMBO_OS'),
    body: String(opts.body || 'Bilinmeyen sistem hatası.'),
    tag: String(opts.tag || 'SYSTEM FAULT'),
    severity: String(opts.severity || 'error'),
    buttons: JSON.stringify(opts.buttons || ['TAMAM']),
    puzzle: JSON.stringify(opts.puzzle || null),
    glitch: opts.glitch === false ? '0' : '1',
  });
  win.loadFile(path.join(ROOT, 'popup.html'), { query: Object.fromEntries(params) });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => win.showInactive());

  const life = Number(opts.life);
  const timer = Number.isFinite(life) && life > 0
    ? setTimeout(() => { if (!win.isDestroyed()) win.close(); }, life)
    : null;

  win.on('closed', () => {
    if (timer) clearTimeout(timer);
    popupWindows.delete(id);
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('popup:closed', { id, count: popupWindows.size });
    }
    focusMainIfQuiet();
  });

  popupWindows.set(id, { win, timer });
  return { id, count: popupWindows.size, x: pos.x, y: pos.y };
}

function focusMainIfQuiet() {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (popupWindows.size === 0 && !terminalWin) {
    try { mainWin.show(); mainWin.focus(); } catch (_) {}
  }
}

function closeAllPopups() {
  for (const [, entry] of popupWindows) {
    try { if (!entry.win.isDestroyed()) entry.win.close(); } catch (_) {}
  }
  popupWindows.clear();
}

function closePopup(id) {
  const entry = popupWindows.get(Number(id));
  if (entry && !entry.win.isDestroyed()) entry.win.close();
}

function broadcastPopupCount() {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('popup:count', popupWindows.size);
  }
}

function openTerminal(opts) {
  if (terminalWin && !terminalWin.isDestroyed()) {
    terminalWin.webContents.send('terminal:update', opts || {});
    if (!terminalWin.isVisible()) terminalWin.showInactive();
    return { ok: true, reused: true };
  }
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = Math.min(500, Math.max(380, Number(opts.width) || 470));
  const height = Math.min(720, Math.max(420, Number(opts.height) || 640));
  const x = area.x + area.width - width - 28;
  const y = area.y + 44;

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    show: false,
    resizable: true,
    minWidth: 360,
    minHeight: 340,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: true,
    backgroundColor: '#020604',
    type: IS_WIN ? 'toolbar' : 'notification',
    webPreferences: {
      preload: path.join(ROOT, 'popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  terminalWin = win;
  const params = new URLSearchParams({
    title: String(opts.title || 'LIMBO_OS // YAN TERMİNAL'),
    code: String(opts.code || ''),
    lines: JSON.stringify(opts.lines || []),
    footer: String(opts.footer || ''),
  });
  win.loadFile(path.join(ROOT, 'terminal.html'), { query: Object.fromEntries(params) });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed() && terminalWin === win) win.showInactive();
  });
  win.on('closed', () => {
    if (terminalWin === win) terminalWin = null;
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('terminal:closed');
    focusMainIfQuiet();
  });
  return { ok: true, path: 'terminal' };
}

function closeTerminal() {
  const win = terminalWin;
  terminalWin = null;
  if (win && !win.isDestroyed()) win.close();
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('popup:spawn', (_evt, opts) => spawnPopup(opts || {}));
ipcMain.handle('popup:close', (_evt, id) => { closePopup(id); return popupWindows.size; });
ipcMain.handle('popup:closeAll', () => { closeAllPopups(); return 0; });
ipcMain.handle('popup:count', () => popupWindows.size);
ipcMain.on('popup:selfClose', (evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (win && !win.isDestroyed()) win.close();
});
ipcMain.on('popup:selfSolve', (evt, payload) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win || win.isDestroyed()) return;
  let found = null;
  for (const [id, entry] of popupWindows) {
    if (entry.win === win) { found = { id, entry }; break; }
  }
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('popup:solved', {
      id: found ? found.id : Number(payload && payload.id) || 0,
      count: popupWindows.size,
      answer: payload && payload.answer,
    });
  }
  try { win.close(); } catch (_) {}
});

ipcMain.handle('terminal:open', (_evt, opts) => openTerminal(opts || {}));
ipcMain.handle('terminal:update', (_evt, opts) => {
  if (terminalWin && !terminalWin.isDestroyed()) terminalWin.webContents.send('terminal:update', opts || {});
  return true;
});
ipcMain.handle('terminal:close', () => { closeTerminal(); return true; });

ipcMain.handle('sandbox:prepare', (_evt, files) => {
  ensureSandbox();
  const created = [];
  for (const file of Array.isArray(files) ? files : []) {
    const p = safePath(file && file.name);
    if (!p) continue;
    const content = String((file && file.content) || '');
    if (Buffer.byteLength(content, 'utf8') > MAX_SANDBOX_READ) continue;
    try {
      fs.writeFileSync(p, content, 'utf8');
      created.push(file.name);
    } catch (err) {
      console.error('SANDBOX_PREPARE_FAILED', err);
    }
  }
  return { ok: true, path: SANDBOX, created };
});
ipcMain.handle('sandbox:status', (_evt, names) => {
  const result = {};
  for (const name of Array.isArray(names) ? names : []) {
    if (safeName(name)) result[name] = fileExists(name);
  }
  return result;
});
ipcMain.handle('sandbox:clear', (_evt, names) => {
  const removed = [];
  for (const name of Array.isArray(names) ? names : []) {
    const p = safePath(name);
    if (p && fs.existsSync(p)) {
      try { fs.unlinkSync(p); removed.push(name); } catch (err) { console.error(err); }
    }
  }
  return removed;
});
ipcMain.handle('sandbox:read', (_evt, name) => sandboxRead(name));
ipcMain.handle('sandbox:write', (_evt, name, content) => sandboxWrite(name, content));
ipcMain.handle('sandbox:ensure', (_evt, name, content) => sandboxEnsure(name, content));
ipcMain.handle('save:load', () => loadSaveFile());
ipcMain.handle('save:write', (_evt, data) => writeSaveFile(data));
ipcMain.handle('save:clear', () => clearSaveFile());
ipcMain.handle('sandbox:list', () => {
  ensureSandbox();
  try {
    return fs.readdirSync(SANDBOX).map((name) => {
      const full = path.join(SANDBOX, name);
      try {
        const stat = fs.lstatSync(full);
        return { name, size: stat.size, dir: stat.isDirectory(), link: stat.isSymbolicLink() };
      } catch (_) {
        return { name, size: 0, dir: false, link: false };
      }
    });
  } catch (_) { return []; }
});
ipcMain.handle('sandbox:open', (_evt, fileName) => openInFileManager(fileName || null));
ipcMain.handle('sandbox:path', () => SANDBOX);

// ---------------------------------------------------------------- meta layer
ipcMain.handle('meta:info', () => {
  const now = new Date();
  let user = 'OPERATÖR';
  try { user = os.userInfo().username || user; } catch (_) {}
  let desktop = '';
  let documents = '';
  try { desktop = app.getPath('desktop'); } catch (_) {}
  try { documents = app.getPath('documents'); } catch (_) {}
  return {
    user,
    host: (() => { try { return os.hostname(); } catch (_) { return 'LIMBO-HOST'; } })(),
    platform: process.platform,
    isWindows: IS_WIN,
    version: app.getVersion(),
    packaged: app.isPackaged,
    time: now.toISOString(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    seconds: now.getSeconds(),
    tzOffset: now.getTimezoneOffset(),
    home: app.getPath('home'),
    desktop,
    documents,
    root: ROOT,
    stateDir: stateDir(),
    resetPhrase: RESET_PHRASE,
    resetHelper: resetHelperPath(),
  };
});
ipcMain.handle('meta:state', () => terminationState());
ipcMain.handle('meta:openResetHelper', () => {
  const target = ensureResetHelper();
  try {
    shell.showItemInFolder(target);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, path: target, error: String(err && err.message || err) };
  }
});
ipcMain.handle('meta:checkReset', () => {
  if (!isTerminated()) return { terminated: false, reset: false };
  const token = findResetToken();
  if (!token) return { terminated: true, reset: false };
  const out = performReset('token');
  return { terminated: false, reset: true, ...out };
});
ipcMain.handle('meta:reset', () => {
  const token = findResetToken();
  if (isTerminated() && !token) return { ok: false, error: 'TOKEN_REQUIRED', state: terminationState() };
  const out = performReset(token ? 'token' : 'explicit-dev');
  return { ok: true, ...out, state: terminationState() };
});
ipcMain.handle('meta:finalize', (_evt, payload) => {
  const info = {
    at: new Date().toISOString(),
    atMs: Date.now(),
    reason: String(payload && payload.reason || 'root_anomaly_deleted'),
    file: rootAnomalyPath(),
    user: (() => { try { return os.userInfo().username; } catch (_) { return 'unknown'; } })(),
    host: (() => { try { return os.hostname(); } catch (_) { return 'unknown'; } })(),
  };
  writeJsonFile(statePath('terminated.json'), info);
  writeJsonFile(statePath('last-session.json'), info);
  try { if (fs.existsSync(rootAnomalyPath())) fs.unlinkSync(rootAnomalyPath()); } catch (_) {}
  closeAllPopups();
  closeTerminal();
  if (wallpaperRestoreTimer) {
    clearTimeout(wallpaperRestoreTimer);
    wallpaperRestoreTimer = null;
    restoreWallpaper().catch(() => {});
  }
  return { ok: true, terminated: true, path: statePath('terminated.json'), info };
});
ipcMain.handle('meta:rootAnomalyStatus', () => ({ exists: rootAnomalyExists(), path: rootAnomalyPath() }));
ipcMain.handle('meta:rootAnomalyPrepare', (_evt, content) => {
  const res = ensureRootAnomaly(content);
  return { ...res, exists: rootAnomalyExists() };
});
ipcMain.handle('meta:rootAnomalyOpen', () => {
  const p = rootAnomalyPath();
  try {
    if (fs.existsSync(p)) shell.showItemInFolder(p);
    else shell.openPath(path.dirname(p));
    return { ok: true, path: p };
  } catch (err) { return { ok: false, path: p, error: String(err) }; }
});
ipcMain.handle('meta:spill', (_evt, payload) => createSpillFile(payload && payload.message, payload && payload.kind));
ipcMain.handle('meta:spillCleanup', () => ({ ok: true, removed: cleanupMetaSpill() }));
ipcMain.handle('meta:wallpaper', () => wallpaperGlitch());
ipcMain.handle('meta:wallpaperRestore', () => restoreWallpaper().then((ok) => ({ ok })));

ipcMain.handle('win:minimize', () => { if (mainWin && !mainWin.isDestroyed()) mainWin.minimize(); });
ipcMain.handle('win:maximize', () => {
  if (!mainWin || mainWin.isDestroyed()) return false;
  if (mainWin.isMaximized()) mainWin.unmaximize();
  else mainWin.maximize();
  return mainWin.isMaximized();
});
ipcMain.handle('win:close', () => { if (mainWin && !mainWin.isDestroyed()) mainWin.close(); });
ipcMain.handle('win:fullscreen', (_evt, value) => {
  if (!mainWin || mainWin.isDestroyed()) return false;
  mainWin.setFullScreen(Boolean(value));
  return mainWin.isFullScreen();
});
ipcMain.handle('app:quit', () => { setTimeout(() => app.quit(), 250); return true; });
ipcMain.handle('app:platform', () => ({ platform: process.platform, isWindows: IS_WIN, version: app.getVersion() }));
ipcMain.handle('dev:capture', async (_evt, name) => {
  if (!mainWin || mainWin.isDestroyed()) return null;
  const img = await mainWin.webContents.capturePage();
  const dir = path.join(app.getPath('temp'), 'limbo_shots');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${String(name || 'shot').replace(/[^a-z0-9_-]/gi, '_')}.png`);
  fs.writeFileSync(out, img.toPNG());
  return out;
});

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureSandbox();
  ensureResetHelper();
  restoreWallpaper().catch(() => {});
  if (isTerminated() && findResetToken()) performReset('startup-token');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  closeAllPopups();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeAllPopups();
  closeTerminal();
  if (wallpaperRestoreTimer) {
    clearTimeout(wallpaperRestoreTimer);
    wallpaperRestoreTimer = null;
  }
  restoreWallpaper().catch(() => {});
});
