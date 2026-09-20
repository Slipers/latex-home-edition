/* Application de bureau LaTeX MolecularChemistry Edition (Electron) */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win = null;
let pendingFile = null;      // fichier passé au lancement (double-clic dans l'explorateur)
let allowClose = false;

const EXT = /\.(lmc|xyz|mol|sdf|pdb|smi)$/i;
const fileFromArgs = argv => argv.slice(app.isPackaged ? 1 : 2).find(a => EXT.test(a) && fs.existsSync(a));

function createWindow() {
  win = new BrowserWindow({
    width: 1560, height: 980, minWidth: 1080, minHeight: 680,
    title: 'LaTeX MolecularChemistry Edition',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#eef1f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,        // la page ne partage rien avec le préchargement
      sandbox: true,                 // le rendu tourne dans un bac à sable
      nodeIntegration: false,        // aucun accès à Node depuis la page
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  /* Aucune fenêtre ne s'ouvre depuis la page, et seuls les liens https partent vers le
     navigateur : tout autre schéma (file:, smb:, ms-msdt:…) est refusé sans être transmis
     au système, car shell.openExternal exécuterait la cible choisie par le système. */
  const externeAutorise = url => { try { return new URL(url).protocol === 'https:'; } catch (e) { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (externeAutorise(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;          // navigation interne de l'application
    e.preventDefault();
    if (externeAutorise(url)) shell.openExternal(url);
  });
  win.webContents.on('will-attach-webview', e => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') win.webContents.toggleDevTools();
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  /* Confirmation avant fermeture s'il reste des modifications non enregistrées */
  win.on('close', async e => {
    if (allowClose) return;
    e.preventDefault();
    let modifie = false;
    try { modifie = await win.webContents.executeJavaScript('!!(window.M && M.app && M.app.doc && M.app.doc.dirty)'); } catch (_) {}
    if (modifie) {
      const r = await dialog.showMessageBox(win, {
        type: 'question', buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'], defaultId: 0, cancelId: 2,
        title: 'Modifications non enregistrées',
        message: 'La molécule en cours comporte des modifications non enregistrées.',
        detail: 'Une copie est conservée automatiquement et sera rouverte au prochain lancement, '
          + 'mais vous pouvez aussi l’enregistrer dans un fichier.',
      });
      if (r.response === 2) return;
      if (r.response === 0) {
        const ok = await win.webContents.executeJavaScript('M.app.enregistrer().then(() => !M.app.doc.dirty)').catch(() => false);
        if (!ok) return;
      }
    }
    allowClose = true;
    win.close();
  });
}

/* ---------- Fichiers ---------- */
const FILTRES = [
  { name: 'Tous les formats moléculaires', extensions: ['lmc', 'xyz', 'mol', 'sdf', 'pdb', 'smi'] },
  { name: 'Document MolecularChemistry', extensions: ['lmc'] },
  { name: 'Coordonnées XYZ', extensions: ['xyz'] },
  { name: 'MDL Molfile', extensions: ['mol', 'sdf'] },
  { name: 'Protein Data Bank', extensions: ['pdb'] },
  { name: 'SMILES', extensions: ['smi'] },
];

ipcMain.handle('lmc:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Ouvrir une molécule', filters: FILTRES, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  if (fs.statSync(p).size > 40 * 1024 * 1024) {
    await dialog.showMessageBox(win, { type: 'error', title: 'Fichier trop volumineux',
      message: 'Ce fichier dépasse 40 Mo et ne peut pas être ouvert.' });
    return null;
  }
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});

/* Le nom proposé vient du rendu : on ne garde que le nom de fichier, jamais un chemin. */
const nomSur = (n, extAutorisees) => {
  const base = path.basename(String(n || '')).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 120);
  const ext = path.extname(base).slice(1).toLowerCase();
  return extAutorisees.includes(ext) ? base : null;
};
const EXT_EXPORT = ['lmc', 'xyz', 'mol', 'sdf', 'pdb', 'smi', 'tex', 'png', 'svg'];

ipcMain.handle('lmc:save', async (e, { path: p, name, data, saveAs }) => {
  // Un chemin transmis par le rendu n'est réutilisé que s'il pointe sur un .lmc existant,
  // ouvert ou enregistré plus tôt ; sinon on repasse par la boîte de dialogue native.
  if (p && (path.extname(p).toLowerCase() !== '.lmc' || !path.isAbsolute(p))) p = null;
  if (typeof data !== 'string' || data.length > 40 * 1024 * 1024) return null;
  if (!p || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Enregistrer la molécule', defaultPath: nomSur(name, ['lmc']) || 'molecule.lmc',
      filters: [{ name: 'Document MolecularChemistry', extensions: ['lmc'] }],
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  fs.writeFileSync(p, data, 'utf8');
  app.addRecentDocument(p);
  return { path: p, name: path.basename(p) };
});

ipcMain.handle('lmc:export', async (e, { name, bytes }) => {
  const base = nomSur(name, EXT_EXPORT);
  if (!base || !Array.isArray(bytes) || bytes.length > 80 * 1024 * 1024) return null;
  const ext = path.extname(base).slice(1).toLowerCase();
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter', defaultPath: base, filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(Uint8Array.from(bytes)));
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

ipcMain.handle('lmc:pending', () => {
  const p = pendingFile; pendingFile = null;
  if (!p) return null;
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('lmc:version', () => app.getVersion());
ipcMain.handle('lmc:check-updates', () => checkUpdates(true));

/* ---------- Mises à jour automatiques ----------
   Les binaires sont publiés dans une release GitHub de tag fixe (« molecular-latest »),
   sur un canal distinct de celui de LaTeX Home Edition : les deux applications
   partagent le dépôt sans jamais se gêner. */
let manualCheck = false, busy = false, declined = null;
const NL = String.fromCharCode(10);
function send(ch, payload) { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); }
const errText = err => String((err && err.message) || err).split(NL)[0].slice(0, 200);
const plainNotes = n => {
  const t = Array.isArray(n) ? n.map(x => x.note || '').join(NL) : String(n || '');
  return t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/(\r?\n){3,}/g, NL + NL).trim().slice(0, 700);
};

function checkUpdates(manual = false) {
  if (!app.isPackaged) { if (manual) send('lmc:update', { state: 'dev' }); return; }
  if (busy) return;
  manualCheck = manual;
  if (process.env.LMC_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.LMC_UPDATE_URL, channel: 'molecular' });
  if (manual) send('lmc:update', { state: 'checking' });
  autoUpdater.checkForUpdates().catch(err => { if (manualCheck) send('lmc:update', { state: 'error', message: errText(err) }); });
}
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on('update-not-available', () => { if (manualCheck) send('lmc:update', { state: 'none', version: app.getVersion() }); });
autoUpdater.on('update-available', async info => {
  if (!manualCheck && declined === info.version) return;
  const notes = plainNotes(info.releaseNotes);
  const r = process.env.LMC_UPDATE_AUTO === '1' ? { response: 0 } : await dialog.showMessageBox(win, {
    type: 'info', buttons: ['Mettre à jour maintenant', 'Plus tard'], defaultId: 0, cancelId: 1, noLink: true,
    title: 'Mise à jour disponible',
    message: 'Une nouvelle version de LaTeX MolecularChemistry Edition est disponible : ' + info.version,
    detail: 'Vous utilisez la version ' + app.getVersion() + '.' + NL + NL
      + (notes ? 'Nouveautés :' + NL + notes + NL + NL : '')
      + 'La mise à jour se télécharge puis s’installe toute seule, et l’application redémarre automatiquement. '
      + 'Votre molécule en cours est conservée.',
  });
  if (r.response !== 0) { declined = info.version; return; }
  busy = true;
  send('lmc:update', { state: 'downloading', version: info.version, percent: 0 });
  autoUpdater.downloadUpdate().catch(err => { busy = false; send('lmc:update', { state: 'error', message: errText(err) }); });
});
autoUpdater.on('download-progress', p => send('lmc:update', { state: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('error', err => { if (manualCheck || busy) send('lmc:update', { state: 'error', message: errText(err) }); busy = false; });
autoUpdater.on('update-downloaded', async info => {
  send('lmc:update', { state: 'installing', version: info.version });
  try { await win.webContents.executeJavaScript('M.app.autosaveNow && M.app.autosaveNow()'); } catch (_) {}
  setTimeout(() => { allowClose = true; autoUpdater.quitAndInstall(true, true); }, 1200);
});

/* ---------- Démarrage ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = fileFromArgs(argv);
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    if (f) send('lmc:open-file', { path: f, name: path.basename(f), text: fs.readFileSync(f, 'utf8') });
  });
  pendingFile = fileFromArgs(process.argv);
  app.setAppUserModelId('com.slipers.molecularchemistry');
  app.whenReady().then(() => {
    createWindow();
    setTimeout(() => checkUpdates(false), 2500);
    setInterval(() => checkUpdates(false), 4 * 60 * 60 * 1000);
  });
  app.on('window-all-closed', () => app.quit());
}
