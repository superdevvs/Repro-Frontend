'use strict';
const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { deepLink, inside } = require('./policy.cjs');
const { EditingStore } = require('./core.cjs');
const { HelperApi } = require('./api.cjs');
app.enableSandbox();
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
let window, store, api, vault = {}, vaultPath, pairingTimer, heartbeatTimer, pairingBusy = false;
const pendingLinks = [];
const rendererUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
const platform = process.platform + '-' + process.arch;
let globalMessage = '';
function saveVault() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable. Connect after OS secure storage is working.');
  const temporary = vaultPath + '.tmp';
  syncFs.writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(vault)), { mode: 0o600 }); syncFs.renameSync(temporary, vaultPath);
}
function emit() { if (window && !window.isDestroyed()) window.webContents.send('editing-state'); }
function show() { if (!window || window.isDestroyed()) createWindow(); window.show(); window.focus(); }
function snapshot() {
  return { connected: !!vault.credential, platform, photoshop: vault.photoshopPath || null, message: globalMessage,
    pairing: vault.pairing ? { code: vault.pairing.code, name: os.hostname() } : null,
    autoUpload: store?.state.autoUpload ?? false,
    sessions: Object.values(store?.state.sessions ?? {}).map(session => ({
      id: session.id, filename: session.filename, shootId: session.shoot_id, version: session.expected_version,
      status: session.status, message: session.message, progress: session.progress, autoUpload: session.autoUpload,
      queued: session.queue.filter(job => job.status !== 'done' && job.status !== 'withdrawn').length,
    })) };
}
function createWindow() {
  window = new BrowserWindow({ width: 940, height: 740, minWidth: 640, minHeight: 480, title: 'RePro Edit Helper',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== rendererUrl) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(path.join(__dirname, 'index.html'));
}
async function detectPhotoshop() {
  const candidates = [];
  if (process.platform === 'darwin') {
    for (const name of await fs.readdir('/Applications').catch(() => [])) {
      if (!/^Adobe Photoshop/i.test(name)) continue;
      const directory = path.join('/Applications', name);
      if (name.endsWith('.app')) candidates.push(directory);
      else for (const child of await fs.readdir(directory).catch(() => [])) if (/^Adobe Photoshop.*\.app$/i.test(child)) candidates.push(path.join(directory, child));
    }
  } else if (process.platform === 'win32') {
    for (const directory of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const adobe = path.join(directory, 'Adobe');
      for (const name of await fs.readdir(adobe).catch(() => [])) if (/^Adobe Photoshop/i.test(name)) candidates.push(path.join(adobe, name, 'Photoshop.exe'));
    }
  }
  for (const candidate of candidates.sort().reverse()) if (syncFs.existsSync(candidate)) return candidate;
  return null;
}
async function openPhotoshop(id) {
  const session = store.state.sessions[id]; if (!session) throw new Error('Unknown editing session.');
  const executable = vault.photoshopPath;
  if (!executable || !syncFs.existsSync(executable)) throw new Error('Photoshop was not found. Choose its installation in this helper, or edit manually and select Export file.');
  const file = store.workingPath(session);
  if (!inside(await fs.realpath(store.directory(id)), await fs.realpath(file))) throw new Error('Working file left its session folder.');
  const child = process.platform === 'darwin'
    ? spawn('/usr/bin/open', ['-a', executable, file], { stdio: 'ignore', detached: true })
    : spawn(executable, [file], { stdio: 'ignore', detached: true, windowsHide: true });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
}
async function pairPoll() {
  const pairing = vault.pairing; if (!pairing || pairingBusy) return;
  pairingBusy = true;
  try {
    const result = await api.json('/pairings/' + pairing.id + '/claim', { proof: pairing.proof, name: os.hostname().slice(0, 100), platform });
    if (vault.pairing?.id !== pairing.id) return;
    if (result.credential) {
      vault.credential = result.credential; delete vault.pairing; saveVault();
      globalMessage = 'Connected. Manual upload is the default.'; await heartbeat();
    } else { vault.pairing.code = result.comparison_code; saveVault(); globalMessage = 'Compare the pairing code with Settings → Desktop editing, then approve that device.'; }
  } catch (error) {
    if (vault.pairing?.id !== pairing.id) return;
    globalMessage = error.message;
    if ([401, 403, 409, 410].includes(error.status)) { delete vault.pairing; saveVault(); }
  } finally { pairingBusy = false; }
  emit();
}
async function heartbeat() {
  if (!vault.credential) return;
  try {
    await api.json('/heartbeat', { photoshop_detected: !!vault.photoshopPath && syncFs.existsSync(vault.photoshopPath), auto_upload: store.state.autoUpload });
    if (globalMessage.startsWith('Connection:')) globalMessage = '';
  } catch (error) { globalMessage = 'Connection: ' + error.message; }
  emit();
}
async function handleLink(value) {
  const link = deepLink(value);
  if (!store) { pendingLinks.push(value); return; }
  show();
  if (link.action === 'settings') return;
  if (link.action === 'pair') {
    if (vault.pairing?.id !== link.id) vault.pairing = { id: link.id, proof: crypto.randomBytes(48).toString('base64url') };
    saveVault(); await pairPoll();
  } else {
    if (!vault.credential) throw new Error('Connect this helper from Settings → Desktop editing first.');
    await store.open(link.id); emit(); await openPhotoshop(link.id);
  }
}
const linkError = error => { globalMessage = error.message; emit(); };
app.on('open-url', (event, url) => { event.preventDefault(); void handleLink(url).catch(linkError); });
app.on('second-instance', (_event, argv) => {
  const link = argv.find(value => value.startsWith('repro-edit:'));
  if (link) void handleLink(link).catch(linkError); else show();
});
app.on('activate', show);
app.on('window-all-closed', () => { /* Saves continue while the helper runs. Quit explicitly from the helper menu. */ });
app.on('before-quit', () => { clearInterval(pairingTimer); clearInterval(heartbeatTimer); store?.close(); });
function ipc(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.senderFrame?.url !== rendererUrl) throw new Error('Untrusted helper window.');
    try { return { ok: true, data: await handler(...args) }; }
    catch (error) { globalMessage = error.message; emit(); return { ok: false, error: error.message }; }
  });
}
if (lock) app.whenReady().then(async () => {
  if (!['darwin-arm64', 'darwin-x64', 'win32-x64'].includes(platform)) throw new Error('RePro Edit Helper supports Mac and Windows.');
  vaultPath = path.join(app.getPath('userData'), 'device.secure');
  if (syncFs.existsSync(vaultPath)) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS secure storage is unavailable. Your working copies have been preserved.');
    vault = JSON.parse(safeStorage.decryptString(await fs.readFile(vaultPath)));
  }
  if (!vault.photoshopPath || !syncFs.existsSync(vault.photoshopPath)) vault.photoshopPath = await detectPhotoshop();
  api = new HelperApi(() => vault.credential);
  store = new EditingStore(app.getPath('userData'), api, emit);
  if (app.isPackaged && !require('./package.json').reproQa) app.setAsDefaultProtocolClient('repro-edit');
  ipc('edit:state', snapshot);
  ipc('edit:photoshop', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Choose Adobe Photoshop', properties: [process.platform === 'darwin' ? 'openDirectory' : 'openFile'],
      ...(process.platform === 'win32' ? { filters: [{ name: 'Photoshop application', extensions: ['exe'] }] } : {}) });
    if (result.canceled) return;
    const selected = result.filePaths[0];
    if (process.platform === 'win32' ? path.basename(selected).toLowerCase() !== 'photoshop.exe' : !/^Adobe Photoshop.*\.app$/i.test(path.basename(selected))) throw new Error('Choose the Adobe Photoshop application.');
    vault.photoshopPath = selected; saveVault(); await heartbeat();
  });
  ipc('edit:open', openPhotoshop);
  ipc('edit:folder', async id => { if (!store.state.sessions[id]) throw new Error('Unknown session.'); await shell.openPath(store.directory(id)); });
  ipc('edit:export', async id => {
    if (!store.state.sessions[id]) throw new Error('Unknown session.');
    const chosen = await dialog.showOpenDialog(window, { title: 'Choose a finished JPEG, PNG or TIFF export', defaultPath: path.join(store.directory(id), 'Exports'), properties: ['openFile'], filters: [{ name: 'Exported image', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff'] }] });
    if (chosen.canceled) return;
    const candidate = await store.importExport(id, chosen.filePaths[0]);
    store.state.sessions[id].workingFile = path.relative(store.directory(id), candidate);
    store.state.sessions[id].message = 'Export selected. Choose Upload saved edit.'; store.save();
  });
  ipc('edit:upload', async id => { const session = store.state.sessions[id]; if (!session) throw new Error('Unknown session.'); await store.capture(id, store.workingPath(session)); await store.step(id); });
  ipc('edit:auto', async (id, enabled) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid preference.');
    if (id === null) store.state.autoUpload = enabled;
    else { if (!store.state.sessions[id]) throw new Error('Unknown session.'); store.state.sessions[id].autoUpload = enabled; }
    store.save(); await heartbeat();
  });
  ipc('edit:retry', async id => {
    const session = store.state.sessions[id]; if (!session) throw new Error('Unknown session.');
    const job = session.queue.find(value => !['done', 'withdrawn'].includes(value.status));
    if (job) { job.retryAt = 0; job.status = job.versionId ? 'processing' : 'pending'; store.save(); await store.step(id); }
  });
  ipc('edit:dashboard', async id => {
    const session = store.state.sessions[id];
    const url = session ? 'https://reprodashboard.com/dashboard?editingShootId=' + Number(session.shoot_id) + '&editingFileId=' + Number(session.file_id)
      : 'https://reprodashboard.com/settings?tab=desktop-editing';
    await shell.openExternal(url);
  });
  ipc('edit:quit', () => app.quit());
  createWindow(); store.resume();
  pairingTimer = setInterval(() => { if (vault.pairing) void pairPoll(); }, 5000);
  heartbeatTimer = setInterval(() => void heartbeat(), 60000);
  await heartbeat();
  for (const value of pendingLinks.splice(0)) await handleLink(value).catch(linkError);
  const firstLink = process.argv.find(value => value.startsWith('repro-edit:'));
  if (firstLink) await handleLink(firstLink).catch(linkError);
}).catch(error => { dialog.showErrorBox('RePro Edit Helper', error.message); app.quit(); });
