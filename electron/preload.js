/* Pont sécurisé entre la page et le système (fichiers, PDF, mises à jour) */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

/* Dictionnaires du correcteur intégré (français + anglais, voir main.js) : la page
   souligne elle-même les fautes et propose les corrections (clic droit / survol) */
contextBridge.exposeInMainWorld('lheSpell', {
  misspelled: words => (Array.isArray(words) ? words : []).map(w => { try { return webFrame.isWordMisspelled(String(w)); } catch (e) { return false; } }),
  suggest: word => { try { return webFrame.getWordSuggestions(String(word)).slice(0, 8); } catch (e) { return []; } },
});

contextBridge.exposeInMainWorld('lheDesktop', {
  open: () => ipcRenderer.invoke('lhe:open'),
  save: opts => ipcRenderer.invoke('lhe:save', opts),
  rename: (path, name) => ipcRenderer.invoke('lhe:rename', { path, name }),
  recents: () => ipcRenderer.invoke('lhe:recents'),
  openRecent: path => ipcRenderer.invoke('lhe:open-recent', path),
  peekRecent: path => ipcRenderer.invoke('lhe:peek-recent', path),
  forgetRecent: path => ipcRenderer.invoke('lhe:forget-recent', path),
  pendingFile: () => ipcRenderer.invoke('lhe:pending'),
  pendingLink: () => ipcRenderer.invoke('lhe:pending-link'),
  getPrefs: () => ipcRenderer.invoke('lhe:prefs-get'),
  setPrefs: patch => ipcRenderer.invoke('lhe:prefs-set', patch),
  newWindow: () => ipcRenderer.invoke('lhe:new-window'),
  exportPdf: name => ipcRenderer.invoke('lhe:pdf', { name }),
  exportFile: (name, bytes) => ipcRenderer.invoke('lhe:export', { name, bytes }),
  version: () => ipcRenderer.invoke('lhe:version'),
  checkUpdates: () => ipcRenderer.invoke('lhe:check-updates'),
  onUpdate: cb => ipcRenderer.on('lhe:update', (e, info) => cb(info)),
  onOpenFile: cb => ipcRenderer.on('lhe:open-file', (e, f) => cb(f)),
  onOpenLink: cb => ipcRenderer.on('lhe:open-link', (e, url) => cb(url)),
  onSpellMenu: cb => ipcRenderer.on('lhe:spell-menu', (e, m) => cb(m)),
  spellReplace: text => ipcRenderer.invoke('lhe:spell-replace', text),
  spellAdd: word => ipcRenderer.invoke('lhe:spell-add', word),
});
