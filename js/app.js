/* Démarrage, barre d'outils, fichiers, aperçu et exports */

Object.assign(App, {
  /* ---------- Fichiers ---------- */
  serialize() {
    // Ne garde que les images réellement utilisées
    const used = {};
    const json = JSON.stringify(this.doc.blocks);
    Object.keys(this.doc.assets || {}).forEach(k => { if (json.includes(k)) used[k] = this.doc.assets[k]; });
    return JSON.stringify({ app: 'LaTeX Home Edition', version: 1, meta: this.doc.meta, blocks: this.doc.blocks, bib: this.doc.bib, assets: used });
  },
  baseName() { return (this.fileName || L.slug(L.plain(this.doc.meta.title))).replace(/\.lhe$/i, ''); },
  async save(saveAs = false) {
    this.commit();
    const data = this.serialize();
    if (window.lheDesktop) {
      const r = await lheDesktop.save({ path: this.filePath, name: this.baseName() + '.lhe', data, saveAs });
      if (!r) return;
      this.filePath = r.path; this.fileName = r.name;
      this.setDirty(false); this.updateName();
      L.toast('Document enregistré');
      return;
    }
    try {
      if (window.showSaveFilePicker) {
        if (!this.fileHandle) {
          this.fileHandle = await window.showSaveFilePicker({
            suggestedName: this.baseName() + '.lhe',
            types: [{ description: 'Document LaTeX Home Edition', accept: { 'application/json': ['.lhe'] } }],
          });
        }
        const w = await this.fileHandle.createWritable();
        await w.write(data); await w.close();
        this.fileName = this.fileHandle.name;
      } else {
        L.download(this.baseName() + '.lhe', data, 'application/json');
        this.fileName = this.baseName() + '.lhe';
      }
      this.setDirty(false);
      this.updateName();
      L.toast('Document enregistré');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      L.download(this.baseName() + '.lhe', data, 'application/json');
      this.setDirty(false);
    }
  },
  async open() {
    if (this.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Continuer ?')) return;
    if (window.lheDesktop) {
      const r = await lheDesktop.open();
      if (r) this.openText(r.text, r.name, null, r.path);
      return;
    }
    try {
      if (window.showOpenFilePicker) {
        const [h] = await window.showOpenFilePicker({ types: [{ description: 'Document LaTeX Home Edition', accept: { 'application/json': ['.lhe', '.json'] } }] });
        const file = await h.getFile();
        this.openText(await file.text(), file.name, h);
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const inp = L.$('#fileOpen');
    inp.value = '';
    inp.onchange = async () => { const f = inp.files[0]; if (f) this.openText(await f.text(), f.name, null); };
    inp.click();
  },
  openText(text, name, handle, filePath = null) {
    try {
      const d = JSON.parse(text);
      if (!d.blocks || !d.meta) throw new Error('format');
      this.fileHandle = handle;
      this.filePath = filePath;
      this.load({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} }, name);
      L.toast('Document ouvert : ' + name);
    } catch (e) { L.toast('Ce fichier n\'est pas un document LaTeX Home Edition valide.', 'err'); }
  },

  /* ---------- Exports ---------- */
  exportTex() {
    const r = L.docToLatex(this.doc);
    L.download(this.baseName() + '.tex', r.tex, 'text/x-tex');
    if (r.images.length) L.toast('Le document contient des images : utilisez plutôt « Projet complet (.zip) ».');
  },
  exportZip() {
    const r = L.docToLatex(this.doc);
    const files = [{ name: 'main.tex', data: r.tex }];
    r.images.forEach(im => files.push({ name: im.name, data: L.dataUrlToBytes(im.data) }));
    files.push({ name: 'LISEZMOI.txt', data: 'Projet LaTeX généré par LaTeX Home Edition.\r\n\r\nCompilez main.tex avec pdfLaTeX (TeX Live, MiKTeX) ou importez ce .zip sur overleaf.com\r\n(Nouveau projet > Importer un projet).\r\n' });
    L.download(this.baseName() + '-latex.zip', L.makeZip(files), 'application/zip');
  },

  /* ---------- Aperçu paginé ---------- */
  zoom: 1,
  async showPreview(on) {
    const wrap = L.$('#previewWrap');
    if (on === undefined) on = wrap.hidden;
    L.MathDock.cancel();
    L.$('#deskInner').hidden = on;
    wrap.hidden = !on;
    L.$('#btnPreview').classList.toggle('on', on);
    const ez = L.$('#editZoom'); if (ez) ez.hidden = on;
    if (!on) return;
    this.commit();
    const host = L.$('#pages');
    host.style.zoom = 1;
    host.innerHTML = '<div class="pages-loading">Mise en pages…</div>';
    const tmp = L.h('div', { style: { position: 'absolute', left: '-99999px', top: '0' } });
    document.body.appendChild(tmp);
    const n = await L.paginate(this.doc, tmp);
    host.replaceChildren(...tmp.childNodes);
    tmp.remove();
    L.$('#pageCount').textContent = n + ' page' + (n > 1 ? 's' : '') + ' A4';
    this.applyZoom();
    L.$('#desk').scrollTop = 0;
  },
  applyZoom() {
    L.$('#pages').style.zoom = this.zoom;
    L.$('#zoomVal').textContent = Math.round(this.zoom * 100) + ' %';
  },

  /* ---------- Zoom dans l'éditeur (hors aperçu) ---------- */
  editZoom: 1,
  /* La feuille est agrandie par transform: scale() et non par CSS zoom :
     la mise en page reste exactement celle à 100 % (mêmes retours à la
     ligne, mêmes sauts de page que le PDF, à tous les niveaux), et changer
     de zoom ne relance aucun calcul de mise en page — le navigateur se
     contente de redessiner, d'où un zoom fluide. #paperZoom réserve à côté
     la place de la feuille agrandie pour que le défilement suive. */
  zoomTarget: 1,
  setEditZoom(z, at, instant) {
    z = Math.max(0.5, Math.min(2, z));
    this.zoomTarget = z;
    const pill = L.$('#editZoom');
    if (pill) pill.querySelector('.ez-val').textContent = Math.round(z * 100) + ' %';
    try { localStorage.setItem('lhe-edit-zoom', String(z)); } catch (e) {}
    // Point de la feuille (en unités locales) à garder immobile sous `at`
    // (pointeur de la souris ; par défaut le centre de l'écran)
    const desk = L.$('#desk'), d = desk.getBoundingClientRect();
    const ax = at ? at.x : d.left + desk.clientWidth / 2, ay = at ? at.y : d.top + desk.clientHeight / 2;
    const pr = L.$('#paper').getBoundingClientRect(), old = this.editZoom;
    this._zAnchor = { ax, ay, lx: (ax - pr.left) / old, ly: (ay - pr.top) / old };
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) {
      if (this._zAnim) { cancelAnimationFrame(this._zAnim); this._zAnim = null; }
      this.applyZoomNow(z); this.zoomSettled(); return;
    }
    // Filet de sécurité : si l'animation ne peut pas tourner (fenêtre masquée…),
    // on termine directement au niveau visé.
    clearTimeout(this._zFallback);
    this._zFallback = setTimeout(() => { if (this._zAnim) this.setEditZoom(this.zoomTarget, null, true); }, 700);
    if (this._zAnim) return;
    // Animation douce vers le niveau visé ; will-change le temps de
    // l'animation : la feuille est mise à l'échelle par la carte graphique,
    // puis redessinée nette une fois le zoom stabilisé.
    L.$('#paper').style.willChange = 'transform';
    const frame = () => {
      const cur = this.editZoom, t = this.zoomTarget;
      const next = Math.abs(t - cur) < 0.002 ? t : cur + (t - cur) * 0.32;
      this.applyZoomNow(next);
      if (next !== t) this._zAnim = requestAnimationFrame(frame);
      else { this._zAnim = null; this.zoomSettled(); }
    };
    this._zAnim = requestAnimationFrame(frame);
  },
  applyZoomNow(z) {
    const paper = L.$('#paper'), desk = L.$('#desk');
    this.editZoom = z;
    paper.style.transform = z === 1 ? '' : 'scale(' + z + ')';
    this.sizeZoomBox();
    const a = this._zAnchor;
    if (!a) return;
    const pr = paper.getBoundingClientRect();
    desk.scrollLeft += pr.left + a.lx * z - a.ax;
    desk.scrollTop += pr.top + a.ly * z - a.ay;
  },
  sizeZoomBox() {
    const paper = L.$('#paper'), box = L.$('#paperZoom'), z = this.editZoom;
    if (!box) return;
    box.style.width = z === 1 ? '' : paper.offsetWidth * z + 'px';
    box.style.height = z === 1 ? '' : paper.offsetHeight * z + 'px';
  },
  zoomSettled() {
    L.$('#paper').style.willChange = '';
    this._zAnchor = null;
    this.updatePageIndicator();
  },
  /* Crans « ronds » (…, 90 %, 100 %, 110 %, …) pour les boutons et le clavier,
     comptés depuis le niveau visé : des clics rapprochés s'additionnent. */
  zoomStep(dir) {
    const z = this.zoomTarget;
    this.setEditZoom(dir === 0 ? 1 : dir > 0 ? Math.floor(z * 10 + 1e-6) / 10 + 0.1 : Math.ceil(z * 10 - 1e-6) / 10 - 0.1);
  },
  async preparePrint() {
    const root = L.$('#printRoot');
    root.style.display = 'block';
    root.style.position = 'absolute'; root.style.left = '-99999px'; root.style.top = '0';
    await L.paginate(this.doc, root);
    root.removeAttribute('style');
  },
  async print() {
    this.commit();
    L.MathDock.cancel();
    L.toast('Préparation du PDF…');
    await this.preparePrint();
    if (window.lheDesktop) {
      // Titre du PDF = nom du document (sans le nom de l'application)
      const old = document.title;
      document.title = L.plain(this.doc.meta.title) || this.baseName();
      try { await lheDesktop.exportPdf(this.baseName()); } finally { document.title = old; }
      return;
    }
    const old = document.title;
    document.title = L.plain(this.doc.meta.title) || this.baseName();
    setTimeout(() => {
      window.print();
      document.title = old;
    }, 60);
  },
});

/* ---------- Version bureau (Electron) ---------- */
App.autosaveNow = () => L.store.set('lhe-autosave', JSON.stringify(App.doc));
if (window.lheDesktop) {
  document.documentElement.classList.add('desktop');
  // Les exports passent par la boîte « Enregistrer sous » de Windows
  L.download = async (name, data) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    return lheDesktop.exportFile(name, new Uint8Array(await blob.arrayBuffer()));
  };
  lheDesktop.onOpenFile(f => {
    if (App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Ouvrir « ' + f.name + ' » quand même ?')) return;
    App.openText(f.text, f.name, null, f.path);
  });
  lheDesktop.onUpdate(u => {
    const ov = L.$('#updOverlay');
    if (u.state === 'downloading' || u.state === 'installing') {
      ov.hidden = false;
      if (u.version) App._updVersion = u.version;
      const v = App._updVersion ? ' ' + App._updVersion : '';
      L.$('#updTitle').textContent = u.state === 'installing' ? 'Installation de la version' + v + '…' : 'Téléchargement de la version' + v + '…';
      L.$('#updBar').style.width = (u.state === 'installing' ? 100 : (u.percent || 0)) + '%';
      L.$('#updSub').textContent = u.state === 'installing'
        ? 'L’application va se fermer puis redémarrer automatiquement avec la nouvelle version.'
        : (u.percent || 0) + ' % — vous pourrez continuer juste après.';
      return;
    }
    ov.hidden = true;
    const msg = {
      checking: 'Recherche de mises à jour…',
      none: 'Vous avez la dernière version (' + u.version + ').',
      dev: 'Mises à jour désactivées en mode développement.',
      manual: 'Version ' + u.version + ' disponible : la page de téléchargement vient de s\'ouvrir.',
      error: 'Mise à jour impossible (' + (u.message || 'erreur') + ').',
    }[u.state];
    if (msg) L.toast(msg, u.state === 'error' ? 'err' : '');
  });
}

/* Numéro de version discret dans le coin + confirmation après une mise à jour */
App.showVersion = async function () {
  const v = window.lheDesktop ? await lheDesktop.version() : L.VERSION;
  if (!v) return;
  const el = L.$('#appVersion');
  el.textContent = 'LaTeX Home Edition v' + v + (window.lheDesktop ? '' : ' (web)');
  el.hidden = false;
  const prev = L.store.get('lhe-version');
  if (prev && prev !== v && window.lheDesktop) setTimeout(() => L.toast('Mise à jour installée : vous utilisez maintenant la version ' + v + '.'), 800);
  L.store.set('lhe-version', v);
};

/* ---------- Démarrage ---------- */
window.addEventListener('DOMContentLoaded', () => {
  L.MathDock.init();

  // Colonne « Insérer »
  const pane = L.$('#pane-insert');
  let g = null, grid = null;
  L.ITEMS.forEach(it => {
    if (it.g !== g) {
      g = it.g;
      grid = L.h('div', { class: 'ins-grid' });
      pane.appendChild(L.h('div', { class: 'ins-sec' }, L.h('h4', { text: g }), grid));
    }
    const b = L.h('button', { class: 'ins-btn', title: it.label }, L.h('span', { class: 'ic', text: it.icon }), it.label);
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => App.runItem(it);
    grid.appendChild(b);
  });

  // Onglets
  L.$$('.tab').forEach(t => t.onclick = () => {
    L.$$('.tab').forEach(x => x.classList.toggle('active', x === t));
    L.$$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + t.dataset.tab));
  });

  // Barre d'outils
  const acts = {
    new: () => L.dlgTemplates(false),
    open: () => App.open(),
    save: () => App.save(),
    undo: () => App.undo(),
    redo: () => App.redo(),
    imath: () => App.insertInlineMath(),
    'ins-equation': () => App.insertBlock(L.newBlock('equation')),
    xref: () => App.insertXref(),
    cite: () => App.insertCite(),
    footnote: () => App.insertFootnote(),
    symbols: () => { const cr = App.currentRichRange(); App.openSymbols(cr ? cr.field : null); },
    settings: () => L.dlgSettings(),
    preview: () => App.showPreview(),
    pdf: () => App.print(),
    print: () => App.print(),
    'latex-menu': () => L.$('#latexMenu').classList.toggle('open'),
    'color-menu': () => App.toggleMenu('#colorMenu'),
    'size-menu': () => App.toggleMenu('#sizeMenu'),
    'align-menu': () => App.toggleMenu('#alignMenu'),
    'list-menu': () => App.toggleMenu('#listMenu'),
    'corr-menu': () => App.toggleMenu('#corrMenu'),
    'corr-open': () => L.corrAction('corr-open'),
    'corr-back': () => L.corrAction('corr-back'),
    'corr-both': () => L.corrAction('corr-both'),
    find: () => L.FindBar.open(),
    hfill: () => { App.closeMenus(); App.insertHfill(); },
    tex: () => App.exportTex(),
    zip: () => App.exportZip(),
    viewtex: () => L.dlgViewTex(),
    importtex: () => L.dlgImportLatex(),
    importpdf: () => L.dlgImportPdf(),
    reagencer: () => L.dlgReagencer(),
    check: () => L.dlgCheck(),
    overleaf: () => L.dlgOverleaf(),
    help: () => L.dlgHelp(),
  };
  document.addEventListener('mousedown', e => {
    const b = e.target.closest('[data-act], [data-fmt]');
    if (b && (b.dataset.fmt || ['imath', 'xref', 'cite', 'footnote', 'symbols', 'color-menu', 'size-menu', 'align-menu', 'list-menu', 'hfill'].includes(b.dataset.act))) e.preventDefault();  // garde le curseur dans le texte
    if (e.target.closest('[data-color], [data-size], [data-align], [data-list]')) e.preventDefault();
    if (!e.target.closest('.dropdown')) App.closeMenus();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && acts[b.dataset.act]) {
      if (b.closest('.menu')) App.closeMenus();
      acts[b.dataset.act]();
    }
    const cc = e.target.closest('[data-color]');
    if (cc) { App.closeMenus(); App.setColor(cc.dataset.color); }
    const sz = e.target.closest('[data-size]');
    if (sz) { App.closeMenus(); App.setSize(sz.dataset.size); }
    const al = e.target.closest('[data-align]');
    if (al) { App.closeMenus(); App.setAlign(al.dataset.align); }
    const li = e.target.closest('[data-list]');
    if (li) { App.closeMenus(); App.toList(li.dataset.list); }
    const f = e.target.closest('[data-fmt]');
    if (f) App.format(f.dataset.fmt);
    const z = e.target.closest('[data-zoom]');
    if (z) { App.zoom = Math.max(0.4, Math.min(2, App.zoom + (z.dataset.zoom === '+' ? 0.1 : -0.1))); App.applyZoom(); }
    const ez = e.target.closest('[data-ezoom]');
    if (ez) App.zoomStep(ez.dataset.ezoom === 'reset' ? 0 : ez.dataset.ezoom === '+' ? 1 : -1);
  });

  // Zoom de l'éditeur (hors aperçu) à la molette + Ctrl, comme dans un PDF.
  // Proportionnel au défilement : un cran de molette ≈ 10 %, et le pincement
  // du pavé tactile (qui envoie une rafale de petits événements Ctrl+molette)
  // zoome en douceur au lieu de sauter de 10 % à chaque événement.
  L.$('#desk').addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey) || !L.$('#previewWrap').hidden) return;
    e.preventDefault();
    const dy = Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)));
    App.setEditZoom(App.zoomTarget * Math.exp(-dy * 0.0012), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  // Raccourcis globaux
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && App.sel && !App.sel.startsWith('__') && document.activeElement === document.body && L.$('#modal').hidden) {
        const f = L.find(App.doc, App.sel);
        if (f && !['paragraph', 'heading', 'list'].includes(f.block.type)) { e.preventDefault(); App.removeBlock(App.sel); }
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (!L.$('#modal').hidden) return;
    if (k === 'z' && !e.shiftKey) { if (document.activeElement && document.activeElement.tagName === 'MATH-FIELD') return; e.preventDefault(); App.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { if (document.activeElement && document.activeElement.tagName === 'MATH-FIELD') return; e.preventDefault(); App.redo(); }
    else if (k === 's') { e.preventDefault(); App.save(e.shiftKey); }
    else if (k === 'o') { e.preventDefault(); App.open(); }
    else if (k === 'p') { e.preventDefault(); App.print(); }
    else if (k === 'm' && e.shiftKey) { e.preventDefault(); App.insertBlock(L.newBlock('equation')); }
    else if (k === 'f' || k === 'h') { e.preventDefault(); L.FindBar.open(k === 'h'); }
    else if (['e', 'l', 'r', 'j'].includes(k) && !e.shiftKey && !e.altKey) { e.preventDefault(); App.setAlign({ e: 'center', l: 'left', r: 'right', j: 'justify' }[k]); }
    else if (k === 'm') { e.preventDefault(); App.insertInlineMath(); }
    else if (k === '=' || k === '+' || k === '-' || k === '0') {
      e.preventDefault();
      const inPreview = !L.$('#previewWrap').hidden;
      const delta = k === '0' ? null : (k === '-' ? -0.1 : 0.1);
      if (inPreview) { App.zoom = delta === null ? 1 : Math.max(0.4, Math.min(2, App.zoom + delta)); App.applyZoom(); }
      else App.zoomStep(delta === null ? 0 : delta);
    }
  });

  window.addEventListener('beforeunload', e => { if (App.dirty) { App.autosave(); } });
  // Les menus sont ancrés à l'écran : on les referme si la barre bouge sous eux
  window.addEventListener('resize', () => App.closeMenus());
  L.$('.tb').addEventListener('scroll', () => App.closeMenus());

  App.bindEditor();
  App.showVersion();
  // Dernier niveau de zoom de l'éditeur utilisé
  try { const z0 = parseFloat(localStorage.getItem('lhe-edit-zoom')); if (z0 >= 0.5 && z0 <= 2 && z0 !== 1) App.setEditZoom(z0, null, true); } catch (e) {}
  // La place réservée à la feuille zoomée suit sa hauteur (frappe, sauts de page)
  if (window.ResizeObserver) new ResizeObserver(() => App.sizeZoomBox()).observe(L.$('#paper'));

  // Reprise du dernier document (sauvegarde automatique) ou écran d'accueil
  let restored = false;
  const q = new URLSearchParams(location.search);
  const suj = q.get('sujet') && L.sujetById(q.get('sujet'));
  const tpl = suj || (q.get('modele') && L.TEMPLATES.find(t => t.id === q.get('modele')));
  if (tpl) {
    App.load(suj ? L.sujetDoc(suj, q.get('mode') || 'sujet') : tpl.make(), null);
    if (q.get('pdf')) App.preparePrint().then(() => { document.body.dataset.ready = '1'; });
    if (q.get('apercu')) App.showPreview(true).then(() => { if (q.get('zoom')) { App.zoom = +q.get('zoom'); App.applyZoom(); } });
    return;
  }
  const saved = L.store.get('lhe-autosave');
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (d && d.blocks) { App.load(d, null); restored = true; }
    } catch (e) {}
  }
  if (!restored) {
    App.load(L.TEMPLATES[0].make(), null);
    L.dlgTemplates(true);
  }
  // Fichier .lhe ouvert par double-clic dans l'explorateur
  if (window.lheDesktop) lheDesktop.pendingFile().then(f => {
    if (!f) return;
    L.$('#modal').hidden = true;
    App.openText(f.text, f.name, null, f.path);
  });
});
