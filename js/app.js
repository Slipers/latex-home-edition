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
    // Document venu de « Mes fichiers en ligne » : il s'enregistre en ligne (Ctrl+Maj+S : sur le PC)
    if (!saveAs && L.Drive && L.Drive.linked()) return L.Drive.saveNow(false);
    this.commit();
    const data = this.serialize();
    if (window.lheDesktop) {
      let r;
      try { r = await lheDesktop.save({ path: this.filePath, name: this.baseName() + '.lhe', data, saveAs }); }
      catch (e) { r = { error: e && e.message }; }
      if (!r) return;
      // Écriture refusée (fichier en lecture seule, ouvert ailleurs, clé USB retirée…)
      if (r.error) return L.toast('Enregistrement impossible : ' + r.error + ' Essayez « Enregistrer sous » (Ctrl+Maj+S).', 'err');
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
  async open(confirmed) {
    if (!confirmed && this.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Continuer ?')) return;
    if (window.lheDesktop) {
      let r;
      try { r = await lheDesktop.open(); } catch (e) { r = { error: e && e.message }; }
      if (r && r.error) return L.toast('Impossible d\'ouvrir ce fichier : ' + r.error, 'err');
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
      // Un fichier reçu peut avoir été fabriqué à la main : on n'en garde que ce que l'éditeur produit
      this.load(L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib, assets: d.assets }), name);
      this.fileHandle = handle;
      this.filePath = filePath;
      this.saveInfo();
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
    // Retour à l'édition : les feuilles sont redessinées (une mise en page faite pendant
    // l'aperçu, éditeur caché, n'avait pas pu les mesurer)
    if (!on) { requestAnimationFrame(() => this.layoutSheets(true)); return; }
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
      try {
        const r = await lheDesktop.exportPdf(this.baseName());
        if (r && r.error) L.toast('Export PDF impossible : ' + r.error, 'err');
      } catch (e) { L.toast('Export PDF impossible : ' + ((e && e.message) || e), 'err'); }
      finally { document.title = old; }
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

/* Avant de fermer la fenêtre : la frappe des dernières secondes (pas encore validée dans
   l'historique) est prise en compte, et la sauvegarde automatique écrite tout de suite */
App.flushPending = function () {
  if (!App.doc) return false;
  try { App.commit(); } catch (e) { /* document en cours de chargement */ }
  App.autosaveNow();
  return !!App.dirty;
};

/* ---------- Version bureau (Electron) ---------- */
if (window.lheDesktop) {
  document.documentElement.classList.add('desktop');
  // Les exports passent par la boîte « Enregistrer sous » de Windows
  L.download = async (name, data) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    let r;
    try { r = await lheDesktop.exportFile(name, new Uint8Array(await blob.arrayBuffer())); }
    catch (e) { r = { error: (e && e.message) || String(e) }; }
    if (r && r.error) { L.toast('Export impossible : ' + r.error, 'err'); return null; }
    return r;
  };
  if (lheDesktop.onOpenLink) lheDesktop.onOpenLink(url => App.openAnyLink(url));
  lheDesktop.onOpenFile(f => {
    if (!f || f.error) return L.toast('Impossible d\'ouvrir ce fichier' + (f && f.error ? ' : ' + f.error : '.'), 'err');
    if (App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Ouvrir « ' + f.name + ' » quand même ?')) return;
    App.openText(f.text, f.name, null, f.path);
  });
  // Mises à jour obligatoires : téléchargement en arrière-plan (carte en bas à gauche),
  // puis installation après un compte à rebours (fenêtre bloquante), document conservé
  let countdown = null;
  lheDesktop.onUpdate(u => {
    const ov = L.$('#updOverlay'), card = L.$('#updMandatory');
    if (u.version) App._updVersion = u.version;
    const v = App._updVersion ? ' ' + App._updVersion : '';
    const showCard = (title, text, pct, acts) => {
      card.replaceChildren(...[
        L.h('div', { class: 'uc-h' }, L.h('span', { class: 'uc-dot' }), L.h('span', { text: title })),
        L.h('div', { class: 'uc-m', text }),
        pct === null ? null : L.h('div', { class: 'upd-bar small' }, L.h('i', { style: { width: (pct || 0) + '%' } })),
        acts || null].filter(Boolean));
      card.hidden = false;
    };
    if (u.state === 'downloading') {
      ov.hidden = true;
      showCard('Mise à jour obligatoire' + v, 'Téléchargement… ' + (u.percent || 0) + ' %. Vous pouvez continuer à travailler : l\'application redémarrera ensuite pour l\'installer.', u.percent || 0);
      return;
    }
    if (u.state === 'ready' || u.state === 'installing') {
      card.hidden = true;
      ov.hidden = false;
      L.$('#updIc').replaceChildren(L.svg('download', 26));
      L.$('#updBar').style.width = '100%';
      const acts = L.$('#updActs');
      if (u.state === 'installing') {
        clearInterval(countdown);
        L.$('#updTitle').textContent = 'Installation de la version' + v + '…';
        L.$('#updSub').textContent = 'L\'application va se fermer puis redémarrer automatiquement. Votre document est conservé.';
        acts.replaceChildren();
        return;
      }
      let left = u.seconds || 15;
      const paint = () => {
        L.$('#updTitle').textContent = 'Mise à jour obligatoire' + v;
        L.$('#updSub').textContent = 'L\'application redémarre dans ' + left + ' s pour installer la nouvelle version. Votre document est conservé et rouvert automatiquement.';
      };
      paint();
      acts.replaceChildren(L.h('button', { class: 'btn primary', text: 'Redémarrer maintenant', onclick: () => lheDesktop.installUpdate() }));
      clearInterval(countdown);
      countdown = setInterval(() => { left = Math.max(0, left - 1); paint(); if (!left) clearInterval(countdown); }, 1000);
      if (App.flushPending) App.flushPending();
      return;
    }
    if (u.state === 'manual') {
      // macOS : installation à la main (application non signée par Apple), rappel permanent
      showCard('Mise à jour obligatoire' + v, 'Téléchargez la nouvelle version et remplacez l\'application dans le dossier Applications. Vos documents ne sont pas touchés.', null,
        L.h('div', { class: 'uc-acts' }, L.h('button', { class: 'btn primary small', text: 'Télécharger', onclick: () => window.open(u.url || 'https://github.com/Slipers/latex-home-edition/releases/latest') })));
      return;
    }
    if (u.state === 'error' && u.mandatory) {
      showCard('Mise à jour obligatoire' + v, 'Le téléchargement n\'a pas abouti (' + (u.message || 'connexion') + '). Nouvel essai automatique dans 10 minutes.', null,
        L.h('div', { class: 'uc-acts' }, L.h('button', { class: 'btn small', text: 'Réessayer maintenant', onclick: () => lheDesktop.checkUpdates() })));
      return;
    }
    ov.hidden = true;
    const msg = {
      checking: 'Recherche de mises à jour…',
      none: 'Vous avez la dernière version (' + u.version + ').',
      dev: 'Mises à jour désactivées en mode développement.',
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

/* ---------- Colonne « Insérer » ----------
   Une ligne par élément (icône teintée selon la famille + nom), groupés par famille ;
   chaque groupe se replie (mémorisé). La recherche filtre sur le nom et les mots-clés,
   Entrée insère le premier résultat. */
App.buildInsertPanel = function () {
  const list = L.$('#insList'), search = L.$('#insSearch'), clear = L.$('#insSearchX');
  if (!list) return;
  let folded = {};
  try { folded = JSON.parse(L.store.get('lhe-ins-folded') || '{}') || {}; } catch (e) { folded = {}; }
  const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  list.replaceChildren();
  const rows = [];
  let sec = null, body = null, g = null;
  L.ITEMS.forEach(it => {
    if (it.g !== g) {
      g = it.g;
      const name = g;
      body = L.h('div', { class: 'ins-rows' });
      const head = L.h('button', { class: 'ins-h', 'aria-expanded': String(!folded[name]) },
        L.h('span', { class: 'ins-h-t', text: name }), L.h('span', { class: 'ins-h-chev', text: '›' }));
      sec = L.h('section', { class: 'ins-sec' + (folded[name] ? ' folded' : ''), 'data-g': name }, head, body);
      head.onclick = () => {
        const on = !sec.classList.contains('folded');
        sec.classList.toggle('folded', on);
        head.setAttribute('aria-expanded', String(!on));
        if (on) folded[name] = 1; else delete folded[name];
        L.store.set('lhe-ins-folded', JSON.stringify(folded));
      };
      list.appendChild(sec);
    }
    const b = L.h('button', { class: 'ins-item', title: it.label },
      L.h('span', { class: L.icClass(it.icon, it.fam), text: it.icon }), L.h('span', { class: 'lab', text: it.label }));
    b.onmousedown = e => e.preventDefault();   // garde le curseur dans le texte
    b.onclick = () => App.runItem(it);
    body.appendChild(b);
    rows.push({ it, b, sec, words: (nrm(it.label) + ' ' + it.kw + ' ' + nrm(it.g)).split(/[\s/()'’.-]+/).filter(Boolean) });
  });
  const empty = L.h('div', { class: 'ins-none', text: 'Aucun élément ne correspond.', hidden: true });
  list.appendChild(empty);
  const filter = () => {
    const q = nrm(search.value.trim());
    clear.hidden = !q;
    list.classList.toggle('searching', !!q);
    let n = 0;
    rows.forEach(r => {
      const ok = !q || nrm(r.it.label).includes(q) || r.words.some(w => w.startsWith(q));
      r.b.hidden = !ok;
      if (ok) n++;
    });
    L.$$('.ins-sec', list).forEach(s => { s.hidden = !!q && !L.$$('.ins-item:not([hidden])', s).length; });
    empty.hidden = n > 0;
  };
  search.oninput = filter;
  search.onkeydown = e => {
    if (e.key === 'Escape') { search.value = ''; filter(); search.blur(); }
    else if (e.key === 'Enter') { const r = rows.find(x => !x.b.hidden); if (r) { e.preventDefault(); App.runItem(r.it); search.value = ''; filter(); } }
  };
  clear.onclick = () => { search.value = ''; filter(); search.focus(); };
};

/* Barre d'état : nombre de mots du document */
App.updateWordCount = L.debounce(() => {
  const el = L.$('#wordCount');
  if (!el || !App.doc) return;
  let words = 0;
  L.walk(App.doc.blocks, b => {
    const t = b.html ? L.plain(b.html) : b.items ? b.items.map(i => L.plain(i.html)).join(' ') : b.type === 'table' && Array.isArray(b.rows) ? b.rows.map(r => (Array.isArray(r) ? r : []).map(c => typeof c === 'string' ? L.plain(c) : '').join(' ')).join(' ') : '';
    words += t ? t.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
  });
  el.textContent = words.toLocaleString('fr-FR') + (words > 1 ? ' mots' : ' mot');
}, 400);

/* ---------- Démarrage ---------- */
window.addEventListener('DOMContentLoaded', () => {
  L.MathDock.init();

  // Icônes vectorielles de l'interface
  L.$$('[data-ico]').forEach(el => el.replaceChildren(L.svg(el.dataset.ico, +el.dataset.size || 16)));
  // Colonne « Insérer » : liste par familles (repliables) et recherche
  App.buildInsertPanel();

  // Onglets Insérer / Plan
  App.showTab = tab => {
    L.$$('#left .tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    L.$$('#left .tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab));
  };
  L.$$('#left .tab').forEach(t => t.onclick = () => App.showTab(t.dataset.tab));
  // Panneaux latéraux repliables (mémorisé)
  App.foldPanel = (side, on) => {
    document.body.classList.toggle('fold-' + side, on);
    L.store.set('lhe-fold-' + side, on ? '1' : '');
    requestAnimationFrame(() => { App.layoutSheets && App.doc && App.layoutSheets(); App.fitToolbar && App.fitToolbar(); });
  };
  ['left', 'right'].forEach(side => { if (L.store.get('lhe-fold-' + side) === '1') document.body.classList.add('fold-' + side); });

  // Barre d'outils
  const acts = {
    new: () => L.Home.show(),
    home: () => L.Home.show(),
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
    'latex-menu': () => App.toggleMenu('#latexMenu'),
    'color-menu': () => App.toggleMenu('#colorMenu'),
    fbox: () => { App.closeMenus(); App.toggleFbox(); },
    'size-menu': () => App.toggleMenu('#sizeMenu'),
    'align-menu': () => App.toggleMenu('#alignMenu'),
    'list-menu': () => App.toggleMenu('#listMenu'),
    'corr-menu': () => App.toggleMenu('#corrMenu'),
    'corr-open': () => L.corrAction('corr-open'),
    'corr-back': () => L.corrAction('corr-back'),
    'corr-both': () => L.corrAction('corr-both'),
    find: () => L.FindBar.open(),
    hfill: () => { App.closeMenus(); App.insertHfill(); },
    rtag: () => { App.closeMenus(); App.rightTextDialog(); },
    tex: () => App.exportTex(),
    zip: () => App.exportZip(),
    viewtex: () => L.dlgViewTex(),
    importtex: () => L.dlgImportLatex(),
    importpdf: () => L.dlgImportPdf(),
    'share-menu': () => App.toggleMenu('#shareMenu'),
    share: () => L.dlgShare(),
    openshare: () => L.dlgOpenShare(),
    collab: () => L.dlgCollab(),
    clouddocs: () => { App.closeMenus(); L.Drive.dialog(); },
    drive: () => { App.closeMenus(); L.Drive.dialog(); },
    'account-menu': () => L.CollabUI.accountMenu(),
    account: () => L.dlgAccount(),
    login: () => L.dlgAuth('login'),
    signup: () => L.dlgAuth('signup'),
    logout: () => L.Cloud.signOut().then(() => L.toast('Déconnecté')),
    prefs: () => L.dlgPrefs(),
    newwindow: () => window.lheDesktop && lheDesktop.newWindow && lheDesktop.newWindow(),
    reagencer: () => L.dlgReagencer(),
    check: () => L.dlgCheck(),
    overleaf: () => L.dlgOverleaf(),
    help: () => L.dlgHelp(),
    'fold-left': () => App.foldPanel('left', true),
    'fold-right': () => App.foldPanel('right', true),
    'unfold-left': b => { App.foldPanel('left', false); if (b && b.dataset.tab) App.showTab(b.dataset.tab); },
    'unfold-right': () => App.foldPanel('right', false),
  };
  document.addEventListener('mousedown', e => {
    const b = e.target.closest('[data-act], [data-fmt]');
    if (b && (b.dataset.fmt || ['imath', 'xref', 'cite', 'footnote', 'symbols', 'color-menu', 'size-menu', 'align-menu', 'list-menu', 'hfill', 'rtag', 'fbox'].includes(b.dataset.act))) e.preventDefault();  // garde le curseur dans le texte
    if (e.target.closest('[data-color], [data-size], [data-align], [data-list]')) e.preventDefault();
    if (!e.target.closest('.dropdown')) App.closeMenus();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && acts[b.dataset.act]) {
      if (b.closest('.menu')) App.closeMenus();
      acts[b.dataset.act](b);
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
    // Fenêtre ouverte : raccourcis de l'éditeur inactifs, mais pas de « Enregistrer la page »
    // ou d'impression du navigateur à la place
    if (!L.$('#modal').hidden) { if (['s', 'p', 'o'].includes(k)) e.preventDefault(); return; }
    if (k === 'z' && !e.shiftKey) { if (document.activeElement && document.activeElement.tagName === 'MATH-FIELD') return; e.preventDefault(); App.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { if (document.activeElement && document.activeElement.tagName === 'MATH-FIELD') return; e.preventDefault(); App.redo(); }
    else if (k === 's') { e.preventDefault(); App.save(e.shiftKey); }
    else if (k === 'o' && e.shiftKey) { e.preventDefault(); L.Drive.dialog(); }
    else if (k === 'o') { e.preventDefault(); App.open(); }
    else if (k === 'p') { e.preventDefault(); App.print(); }
    else if (k === 'm' && e.shiftKey) { e.preventDefault(); App.insertBlock(L.newBlock('equation')); }
    else if (k === 'f' || k === 'h') { e.preventDefault(); L.FindBar.open(k === 'h'); }
    else if (['e', 'l', 'r', 'j'].includes(k) && !e.shiftKey && !e.altKey) { e.preventDefault(); App.setAlign({ e: 'center', l: 'left', r: 'right', j: 'justify' }[k]); }
    else if (k === 'n' && e.shiftKey && window.lheDesktop && lheDesktop.newWindow) { e.preventDefault(); lheDesktop.getPrefs().then(p => p.multiInstance ? lheDesktop.newWindow() : L.toast('Activez « plusieurs instances » dans les Préférences (menu du compte) pour ouvrir une nouvelle fenêtre.')); }
    else if (k === 'm') { e.preventDefault(); App.insertInlineMath(); }
    else if (k === '=' || k === '+' || k === '-' || k === '0') {
      e.preventDefault();
      const inPreview = !L.$('#previewWrap').hidden;
      const delta = k === '0' ? null : (k === '-' ? -0.1 : 0.1);
      if (inPreview) { App.zoom = delta === null ? 1 : Math.max(0.4, Math.min(2, App.zoom + delta)); App.applyZoom(); }
      else App.zoomStep(delta === null ? 0 : delta);
    }
  });

  // (la sauvegarde automatique est retardée pendant la frappe : on l'écrit maintenant)
  window.addEventListener('beforeunload', () => { App.flushPending(); });
  // Coller un lien de partage n'importe où (hors de la fenêtre d'import) propose d'en importer une copie
  document.addEventListener('paste', e => {
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!t || e.target.closest && e.target.closest('#modal')) return;
    if (!L.Share.isLink(t) && !(L.Cloud && L.Cloud.DOC_RE.test(t))) return;
    e.preventDefault(); e.stopPropagation();
    App.openAnyLink(t);
  }, true);
  // Fichier déposé hors de la feuille (barre d'outils, panneaux…) : le navigateur l'ouvrait
  // à la place de l'application. On l'ouvre ou l'importe comme sur la feuille.
  document.addEventListener('dragover', e => {
    if (e.defaultPrevented || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', e => {
    if (e.defaultPrevented) return;   // déjà traité (feuille, fenêtre d'import…)
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    if (!L.$('#modal').hidden) return;
    if (/\.(lhe|json)$/i.test(file.name)) {
      if (App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Ouvrir « ' + file.name + ' » quand même ?')) return;
      file.text().then(t => App.openText(t, file.name, null));
    } else if (/\.(pdf|tex)$/i.test(file.name)) L.dlgImportPdf(file);
    else if (/^image\//.test(file.type)) { const fig = App.insertBlock(L.newBlock('figure'), { noPick: true }); App.setImage(fig.id, file); }
    else L.toast('Ce type de fichier ne peut pas être ouvert ici.', 'err');
  });
  // Les menus sont ancrés à l'écran : on les referme si la barre bouge sous eux
  window.addEventListener('resize', () => App.closeMenus());
  L.$('.tb').addEventListener('scroll', () => App.closeMenus());

  App.bindEditor();
  L.Spell.init();
  App.showVersion();
  /* Barre d'outils sur une seule ligne : si elle déborde, on retire des libellés
     par niveaux (data-lv : d'abord les moins utiles ; l'icône et son info-bulle
     restent), jusqu'à ce que tout tienne. */
  App.fitToolbar = () => {
    const top = L.$('#topbar'), tb = L.$('#topbar .tb');
    if (!top || !tb) return;
    for (let k = 1; k <= 9; k++) top.classList.remove('fit' + k);
    for (let k = 1; k <= 9 && tb.scrollWidth > tb.clientWidth + 1; k++) top.classList.add('fit' + k);
  };
  const fitSoon = () => { cancelAnimationFrame(App._fitRaf); App._fitRaf = requestAnimationFrame(App.fitToolbar); };
  window.addEventListener('resize', fitSoon);
  if (window.ResizeObserver) new ResizeObserver(fitSoon).observe(L.$('#topbar .tb'));
  new MutationObserver(fitSoon).observe(L.$('#topbar'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);
  App.fitToolbar();
  // Compte (Live Modification) : la session enregistrée est rechargée en arrière-plan
  if (L.Cloud && L.Cloud.available()) { L.Cloud.onChange(() => L.CollabUI.paintAccount()); L.Cloud.init(); }
  L.CollabUI.paintAccount();
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
      if (d && d.blocks) {
        // Le document repris retrouve son fichier : Ctrl+S réenregistre au même endroit
        // (au lieu de redemander où enregistrer), et des modifications qui n'avaient pas
        // été enregistrées restent signalées comme telles (lu avant App.load, qui le réécrit)
        let info = null;
        try { info = JSON.parse(L.store.get('lhe-autosave-info') || 'null'); } catch (e) { info = null; }
        if (L.Drive) L.Drive.restoreLink();
        App.load(d, null); restored = true;
        if (info && !(L.Drive && L.Drive.linked())) {
          if (info.fileName) App.fileName = info.fileName;
          if (info.filePath && window.lheDesktop) App.filePath = info.filePath;
          App.updateName();
          if (info.dirty) App.setDirty(true);
        }
      }
    } catch (e) {}
  }
  if (!restored) App.load(L.TEMPLATES[0].make(), null);
  // Écran d'accueil (comme Google Docs) : modèles et documents récents ; le document
  // repris de la sauvegarde automatique attend derrière (« Retour au document »)
  L.Home.show();
  // Fichier .lhe ouvert par double-clic dans l'explorateur
  if (window.lheDesktop) lheDesktop.pendingFile().then(f => {
    if (!f) return;
    if (f.error) return L.toast('Impossible d\'ouvrir ce fichier : ' + f.error, 'err');
    L.$('#modal').hidden = true;
    App.openText(f.text, f.name, null, f.path);
  });
  // Application lancée par un clic sur un lien de partage
  if (window.lheDesktop && lheDesktop.pendingLink) lheDesktop.pendingLink().then(url => {
    if (!url) return;
    L.$('#modal').hidden = true;
    App.openAnyLink(url);
  });
});

/* Lien reçu (collé, cliqué) : document en Live Modification, ou lien de partage d'une copie */
App.openAnyLink = function (text) {
  const m = L.Cloud && String(text || '').match(L.Cloud.DOC_RE);
  if (m) return L.openLiveDoc(m[1].toLowerCase());
  if (L.Share.isLink(text)) L.dlgOpenShare(text);   // sinon (lhe://ouvrir…) : l'application est juste mise au premier plan
};
