/* Application de bureau LaTeX Home Edition (Electron) */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { autoUpdater } = require('electron-updater');

let win = null;
let pendingFile = null;       // fichier .lhe passé au lancement (double-clic dans l'explorateur)
let allowClose = false;

const isMac = process.platform === 'darwin';
const REPO = 'Slipers/latex-home-edition';
const RELEASES_URL = 'https://github.com/' + REPO + '/releases/latest';

const fileFromArgs = argv => argv.slice(app.isPackaged ? 1 : 2).find(a => /\.lhe$/i.test(a) && fs.existsSync(a));

/* Exécute du code dans la fenêtre (entrées de menu macOS) */
const inPage = js => { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(js).catch(() => {}); };

/* Menu macOS : sans lui, Cmd+C, Cmd+V et Cmd+Q ne fonctionnent pas. */
function macMenu() {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'Fichier',
      submenu: [
        { label: 'Nouveau document…', accelerator: 'Cmd+N', click: () => inPage('L.dlgTemplates(false)') },
        { label: 'Ouvrir…', accelerator: 'Cmd+O', click: () => inPage('App.open()') },
        { label: 'Enregistrer', accelerator: 'Cmd+S', click: () => inPage('App.save()') },
        { label: 'Enregistrer sous…', accelerator: 'Shift+Cmd+S', click: () => inPage('App.save(true)') },
        { type: 'separator' },
        { label: 'Exporter en PDF…', accelerator: 'Cmd+P', click: () => inPage('App.print()') },
        { label: 'Télécharger le fichier .tex', click: () => inPage('App.exportTex()') },
        { label: 'Importer un PDF…', click: () => inPage('L.dlgImportPdf()') },
        { type: 'separator' },
        { role: 'close', label: 'Fermer la fenêtre' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { label: 'Annuler', accelerator: 'Cmd+Z', click: () => inPage('App.undo()') },
        { label: 'Rétablir', accelerator: 'Shift+Cmd+Z', click: () => inPage('App.redo()') },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'pasteAndMatchStyle', label: 'Coller sans mise en forme' },
        { role: 'selectAll', label: 'Tout sélectionner' },
        { type: 'separator' },
        { label: 'Rechercher…', accelerator: 'Cmd+F', click: () => inPage('L.FindBar.open()') },
        { label: 'Remplacer…', accelerator: 'Cmd+H', click: () => inPage('L.FindBar.open(true)') },
      ],
    },
    {
      label: 'Insertion',
      submenu: [
        { label: 'Formule dans le texte', accelerator: 'Cmd+M', click: () => inPage('App.insertInlineMath()') },
        { label: 'Équation centrée', accelerator: 'Shift+Cmd+M', click: () => inPage('App.insertBlock(L.newBlock("equation"))') },
        { label: 'Symboles…', click: () => inPage('App.openSymbols(null)') },
      ],
    },
    { role: 'viewMenu', label: 'Affichage' },
    { role: 'windowMenu', label: 'Fenêtre' },
    {
      label: 'Aide',
      submenu: [
        { label: 'Aide et raccourcis', click: () => inPage('L.dlgHelp()') },
        { label: 'Rechercher des mises à jour…', click: () => checkUpdates(true) },
        { label: 'Page du projet sur GitHub', click: () => shell.openExternal(RELEASES_URL) },
      ],
    },
  ]);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 1000, minHeight: 650,
    title: 'LaTeX Home Edition',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#e6e8ec',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.webContents.session.setSpellCheckerLanguages(['fr', 'en-US']);
  Menu.setApplicationMenu(isMac ? macMenu() : null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // Liens externes : navigateur par défaut ; Overleaf : fenêtre dédiée (formulaire POST)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://www.overleaf.com/')) return { action: 'allow', overrideBrowserWindowOptions: { width: 1400, height: 900, autoHideMenuBar: true } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });

  // Raccourcis utiles (menu masqué) : F12 outils, Ctrl+molette zoom géré par Chromium
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  // Confirmation avant de fermer s'il reste des modifications non enregistrées
  win.on('close', async e => {
    if (allowClose) return;
    e.preventDefault();
    let dirty = false;
    try { dirty = await win.webContents.executeJavaScript('!!(window.App && App.dirty)'); } catch (_) {}
    if (dirty) {
      const r = await dialog.showMessageBox(win, {
        type: 'question', buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'], defaultId: 0, cancelId: 2,
        title: 'Modifications non enregistrées',
        message: 'Le document contient des modifications non enregistrées.',
        detail: 'Une copie est conservée automatiquement et sera rouverte au prochain lancement, mais vous pouvez aussi l\'enregistrer dans un fichier.',
      });
      if (r.response === 2) return;
      if (r.response === 0) {
        const ok = await win.webContents.executeJavaScript('App.save().then(() => !App.dirty)').catch(() => false);
        if (!ok) return;
      }
    }
    allowClose = true;
    win.close();
  });
}

/* ---------- Fichiers .lhe (dialogues natifs) ---------- */
ipcMain.handle('lhe:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Ouvrir un document', filters: [{ name: 'Document LaTeX Home Edition', extensions: ['lhe', 'json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});
ipcMain.handle('lhe:save', async (e, { path: p, name, data, saveAs }) => {
  if (!p || saveAs) {
    const r = await dialog.showSaveDialog(win, { title: 'Enregistrer le document', defaultPath: name || 'document.lhe', filters: [{ name: 'Document LaTeX Home Edition', extensions: ['lhe'] }] });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  fs.writeFileSync(p, data, 'utf8');
  app.addRecentDocument(p);
  return { path: p, name: path.basename(p) };
});
ipcMain.handle('lhe:pending', () => {
  const p = pendingFile; pendingFile = null;
  if (!p) return null;
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});

/* ---------- Export PDF natif (sans fenêtre d'impression) ---------- */
ipcMain.handle('lhe:pdf', async (e, { name }) => {
  const r = await dialog.showSaveDialog(win, { title: 'Exporter en PDF', defaultPath: (name || 'document') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
  fs.writeFileSync(r.filePath, pdf);
  shell.openPath(r.filePath);
  return r.filePath;
});

/* ---------- Fichiers exportés (.tex, .zip) ---------- */
ipcMain.handle('lhe:export', async (e, { name, bytes }) => {
  const ext = path.extname(name).slice(1);
  const r = await dialog.showSaveDialog(win, { title: 'Exporter', defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

ipcMain.handle('lhe:version', () => app.getVersion());
ipcMain.handle('lhe:check-updates', () => checkUpdates(true));

/* ---------- Mises à jour automatiques (GitHub Releases) ----------
   Au lancement : vérification sur GitHub. Si une version plus récente existe, on propose
   de l'installer ; si l'utilisateur accepte, téléchargement (barre de progression),
   installation silencieuse puis relance automatique de l'application à jour. */
let manualCheck = false, busy = false, declined = null;
function send(ch, payload) { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); }
const NL = String.fromCharCode(10);
const errText = err => String((err && err.message) || err).split(NL)[0].slice(0, 200);
const plainNotes = n => {
  const t = Array.isArray(n) ? n.map(x => x.note || '').join(NL) : String(n || '');
  return t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/(\r?\n){3,}/g, NL + NL).trim().slice(0, 700);
};
/* Comparaison de numéros de version (1.9.0 > 1.10 ? non : 1.10 > 1.9.0) */
function plusRecente(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/* macOS : l'application n'est pas signée par Apple, l'installation automatique
   est donc impossible. On se contente de signaler la nouvelle version et
   d'ouvrir la page de téléchargement. */
function checkUpdatesMac(manual) {
  const req = https.get({
    host: 'api.github.com',
    path: '/repos/' + REPO + '/releases/latest',
    headers: { 'User-Agent': 'LaTeX-Home-Edition', Accept: 'application/vnd.github+json' },
  }, res => {
    let data = '';
    res.on('data', c => { data += c; });
    res.on('end', async () => {
      let info = null;
      try { info = JSON.parse(data); } catch (e) { /* ignoré */ }
      const tag = info && info.tag_name ? String(info.tag_name).replace(/^v/, '') : '';
      if (!tag) { if (manual) send('lhe:update', { state: 'error', message: 'réponse inattendue de GitHub' }); return; }
      if (!plusRecente(tag, app.getVersion())) { if (manual) send('lhe:update', { state: 'none', version: app.getVersion() }); return; }
      if (!manual && declined === tag) return;
      const r = await dialog.showMessageBox(win, {
        type: 'info', buttons: ['Télécharger', 'Plus tard'], defaultId: 0, cancelId: 1, noLink: true,
        title: 'Mise à jour disponible',
        message: 'La version ' + tag + ' de LaTeX Home Edition est disponible.',
        detail: 'Vous utilisez la version ' + app.getVersion() + '.' + NL + NL
          + 'Sur macOS, l’application n’étant pas signée par Apple, la mise à jour se fait à la main :'
          + ' téléchargez le fichier .dmg, ouvrez-le et glissez l’application dans le dossier Applications'
          + ' pour remplacer l’ancienne. Vos documents ne sont pas touchés.',
      });
      if (r.response !== 0) { declined = tag; return; }
      shell.openExternal(info.html_url || RELEASES_URL);
      send('lhe:update', { state: 'manual', version: tag });
    });
  });
  req.on('error', err => { if (manual) send('lhe:update', { state: 'error', message: errText(err) }); });
  req.setTimeout(15000, () => req.destroy(new Error('délai dépassé')));
}

function checkUpdates(manual = false) {
  if (!app.isPackaged) { if (manual) send('lhe:update', { state: 'dev' }); return; }
  if (busy) return;
  manualCheck = manual;
  if (isMac) { if (manual) send('lhe:update', { state: 'checking' }); checkUpdatesMac(manual); return; }
  if (process.env.LHE_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.LHE_UPDATE_URL });
  if (manual) send('lhe:update', { state: 'checking' });
  autoUpdater.checkForUpdates().catch(err => { if (manualCheck) send('lhe:update', { state: 'error', message: errText(err) }); });
}
autoUpdater.autoDownload = false;
autoUpdater.disableWebInstaller = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on('update-not-available', () => { if (manualCheck) send('lhe:update', { state: 'none', version: app.getVersion() }); });
autoUpdater.on('update-available', async info => {
  if (!manualCheck && declined === info.version) return;
  const notes = plainNotes(info.releaseNotes);
  // LHE_UPDATE_AUTO=1 : acceptation automatique (tests)
  const r = process.env.LHE_UPDATE_AUTO === '1' ? { response: 0 } : await dialog.showMessageBox(win, {
    type: 'info', buttons: ['Mettre à jour maintenant', 'Plus tard'], defaultId: 0, cancelId: 1, noLink: true,
    title: 'Mise à jour disponible',
    message: 'Une nouvelle version de LaTeX Home Edition est disponible : ' + info.version,
    detail: 'Vous utilisez la version ' + app.getVersion() + '.' + NL + NL + (notes ? 'Nouveautés :' + NL + notes + NL + NL : '') +
      'La mise à jour se télécharge puis s’installe toute seule, et l’application redémarre automatiquement. Votre document en cours est conservé.',
  });
  if (r.response !== 0) { declined = info.version; return; }
  busy = true;
  send('lhe:update', { state: 'downloading', version: info.version, percent: 0 });
  autoUpdater.downloadUpdate().catch(err => { busy = false; send('lhe:update', { state: 'error', message: errText(err) }); });
});
autoUpdater.on('download-progress', p => send('lhe:update', { state: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('error', err => { if (manualCheck || busy) send('lhe:update', { state: 'error', message: errText(err) }); busy = false; });
autoUpdater.on('update-downloaded', async info => {
  send('lhe:update', { state: 'installing', version: info.version });
  try { await win.webContents.executeJavaScript('App.autosaveNow && App.autosaveNow()'); } catch (_) {}
  setTimeout(() => {
    allowClose = true;
    // Installation silencieuse (/S) puis relance automatique de la nouvelle version
    autoUpdater.quitAndInstall(true, true);
  }, 1200);
});

/* ---------- Démarrage ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = fileFromArgs(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (f) send('lhe:open-file', { path: f, name: path.basename(f), text: fs.readFileSync(f, 'utf8') });
    }
  });
  // macOS : double-clic sur un .lhe dans le Finder
  app.on('open-file', (e, p) => {
    e.preventDefault();
    if (!/\.lhe$/i.test(p) || !fs.existsSync(p)) return;
    if (!win || win.isDestroyed()) { pendingFile = p; return; }
    try {
      if (win.isMinimized()) win.restore();
      win.focus();
      send('lhe:open-file', { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') });
    } catch (_) { /* ignoré */ }
  });
  pendingFile = fileFromArgs(process.argv);
  app.setAppUserModelId('com.slipers.latexhome');
  app.whenReady().then(() => {
    createWindow();
    setTimeout(() => checkUpdates(false), 2500);
    setInterval(() => checkUpdates(false), 4 * 60 * 60 * 1000);
  });
  app.on('window-all-closed', () => app.quit());
}
