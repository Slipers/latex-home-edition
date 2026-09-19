/* Éditeur visuel : saisie directe sur la feuille, blocs, clavier, glisser-déposer */

const PUA = '\ue000';   // marqueur temporaire de position du curseur

window.App = {
  doc: null, sel: null, history: [], future: [], last: '', dirty: false,
  fileName: null, fileHandle: null, focusAfter: null, lastRange: null, lastCell: null,
};

/* ---------- Catalogue des éléments insérables ---------- */
L.ITEMS = [
  { g: 'Texte', key: 'paragraph', label: 'Paragraphe', icon: '¶', kw: 'texte paragraphe', make: () => L.newBlock('paragraph') },
  { g: 'Texte', key: 'h1', label: 'Section', icon: '1', kw: 'titre section chapitre partie', make: () => L.newBlock('heading', { level: 1 }) },
  { g: 'Texte', key: 'h2', label: 'Sous-section', icon: '1.1', kw: 'titre sous-section', make: () => L.newBlock('heading', { level: 2 }) },
  { g: 'Texte', key: 'h3', label: 'Sous-sous-section', icon: '1.1.1', kw: 'titre sous-sous-section', make: () => L.newBlock('heading', { level: 3 }) },
  { g: 'Texte', key: 'ul', label: 'Liste à puces', icon: '–', kw: 'liste puces tirets', make: () => L.newBlock('list', { style: 'bullet' }) },
  { g: 'Texte', key: 'ol', label: 'Liste numérotée', icon: '1.', kw: 'liste numerotee questions', make: () => L.newBlock('list', { style: 'number' }) },
  { g: 'Maths & sciences', key: 'equation', label: 'Équation', icon: '(1)', kw: 'equation formule math centree', make: () => L.newBlock('equation') },
  { g: 'Maths & sciences', key: 'imath', label: 'Formule dans le texte', icon: '∑', kw: 'formule inline math', action: () => App.insertInlineMath() },
  { g: 'Maths & sciences', key: 'theoreme', label: 'Théorème', icon: 'Th', kw: 'theoreme', make: () => L.newBlock('box', { kind: 'theoreme' }) },
  { g: 'Maths & sciences', key: 'definition', label: 'Définition', icon: 'Déf', kw: 'definition', make: () => L.newBlock('box', { kind: 'definition' }) },
  { g: 'Maths & sciences', key: 'proposition', label: 'Proposition', icon: 'Pr', kw: 'proposition', make: () => L.newBlock('box', { kind: 'proposition' }) },
  { g: 'Maths & sciences', key: 'propriete', label: 'Propriété', icon: 'Pté', kw: 'propriete', make: () => L.newBlock('box', { kind: 'propriete' }) },
  { g: 'Maths & sciences', key: 'lemme', label: 'Lemme', icon: 'Lm', kw: 'lemme', make: () => L.newBlock('box', { kind: 'lemme' }) },
  { g: 'Maths & sciences', key: 'corollaire', label: 'Corollaire', icon: 'Cor', kw: 'corollaire', make: () => L.newBlock('box', { kind: 'corollaire' }) },
  { g: 'Maths & sciences', key: 'preuve', label: 'Démonstration', icon: '□', kw: 'demonstration preuve', make: () => L.newBlock('box', { kind: 'preuve' }) },
  { g: 'Maths & sciences', key: 'exemple', label: 'Exemple', icon: 'Ex', kw: 'exemple', make: () => L.newBlock('box', { kind: 'exemple' }) },
  { g: 'Maths & sciences', key: 'remarque', label: 'Remarque', icon: 'Rq', kw: 'remarque note', make: () => L.newBlock('box', { kind: 'remarque' }) },
  { g: 'Maths & sciences', key: 'methode', label: 'Méthode', icon: 'M', kw: 'methode', make: () => L.newBlock('box', { kind: 'methode' }) },
  { g: 'Maths & sciences', key: 'tabvar', label: 'Tableau de variations', icon: '↗↘', kw: 'tableau variations fonction derivee tkz', make: () => L.newTabvar('variations') },
  { g: 'Maths & sciences', key: 'tabsign', label: 'Tableau de signes', icon: '+ −', kw: 'tableau signes produit quotient', make: () => L.newTabvar('signes') },
  { g: 'Maths & sciences', key: 'avancement', label: 'Tableau d\'avancement', icon: 'x', kw: 'tableau avancement chimie reaction xmax reactif limitant', action: () => L.dlgAvancement(b => App.insertBlock(b)) },
  { g: 'Exercices', key: 'exercice', label: 'Exercice', icon: '✎', kw: 'exercice', make: () => L.newBlock('box', { kind: 'exercice' }) },
  { g: 'Exercices', key: 'question', label: 'Question', icon: 'Q', kw: 'question', make: () => L.newBlock('box', { kind: 'question' }) },
  { g: 'Exercices', key: 'solution', label: 'Solution / corrigé', icon: '✓', kw: 'solution corrige correction', make: () => L.newBlock('box', { kind: 'solution' }) },
  { g: 'Objets', key: 'table', label: 'Tableau', icon: '▦', kw: 'tableau table mesures donnees', make: () => L.newBlock('table') },
  { g: 'Objets', key: 'figure', label: 'Image / figure', icon: '🖼', kw: 'image figure graphique photo schema', make: () => L.newBlock('figure') },
  { g: 'Objets', key: 'tables2', label: 'Tableaux côte à côte', icon: '▦▦', kw: 'tableaux cote a cote deux colonnes grille autoevaluation', make: () => L.newCols('table') },
  { g: 'Objets', key: 'figures2', label: 'Images côte à côte', icon: '🖼🖼', kw: 'images figures cote a cote deux photos', make: () => L.newCols('figure') },
  { g: 'Objets', key: 'cols2', label: 'Deux colonnes', icon: '▯▯', kw: 'deux colonnes cote a cote texte', make: () => L.newCols('paragraph') },
  { g: 'Objets', key: 'code', label: 'Code informatique', icon: '{ }', kw: 'code programme python algorithme', make: () => L.newBlock('code') },
  { g: 'Objets', key: 'resume', label: 'Résumé', icon: 'Rés', kw: 'resume abstract', make: () => L.newBlock('box', { kind: 'resume' }) },
  { g: 'Mise en page', key: 'importtex', label: 'Importer du code LaTeX', icon: 'TeX', kw: 'importer coller code latex convertir', action: () => L.dlgImportLatex() },
  { g: 'Mise en page', key: 'pnote', label: 'Texte en bas de page', icon: '↧', kw: 'bas de page pied note remarque texte page', make: () => L.newBlock('pnote') },
  { g: 'Mise en page', key: 'rule', label: 'Ligne de séparation', icon: '―', kw: 'ligne trait separation horizontale', make: () => L.newBlock('rule') },
  { g: 'Mise en page', key: 'vspace', label: 'Espace vertical', icon: '↕', kw: 'espace vertical blanc saut ligne', make: () => L.newBlock('vspace') },
  { g: 'Mise en page', key: 'hfill', label: 'Espace extensible', icon: '⟷', kw: 'espace extensible droite aligner hfill tabulation', action: () => App.insertHfill() },
  { g: 'Mise en page', key: 'pagebreak', label: 'Saut de page', icon: '⤓', kw: 'saut page nouvelle', make: () => L.newBlock('pagebreak') },
  { g: 'Mise en page', key: 'bibliography', label: 'Bibliographie', icon: '[1]', kw: 'bibliographie references sources', make: () => L.newBlock('bibliography') },
  { g: 'Mise en page', key: 'toc', label: 'Table des matières', icon: '≡', kw: 'table matieres sommaire', action: () => { App.doc.meta.toc = true; App.commit(); App.render(); L.toast('Table des matières ajoutée sous le titre'); } },
];

const TYPE_INFO = {
  paragraph: ['¶', 'Paragraphe'], heading: ['§', 'Titre'], equation: ['(1)', 'Équation'], list: ['1.', 'Liste'],
  box: ['Th', 'Encadré'], table: ['▦', 'Tableau'], figure: ['🖼', 'Figure'], code: ['{ }', 'Code'],
  tabvar: ['↗↘', 'Tableau de variations / signes'], cols: ['▯▯', 'Côte à côte'], rule: ['―', 'Ligne de séparation'], pnote: ['↧', 'Texte en bas de page'], vspace: ['↕', 'Espace vertical'], pagebreak: ['⤓', 'Saut de page'], bibliography: ['[1]', 'Bibliographie'],
};

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

Object.assign(App, {
  /* ================= État & historique ================= */
  load(doc, fileName) {
    doc.meta = L.fixMeta(Object.assign(L.defaultMeta(), doc.meta || {}));
    doc.bib = doc.bib || [];
    doc.assets = doc.assets || {};
    if (!doc.blocks || !doc.blocks.length) doc.blocks = [L.newBlock('paragraph')];
    this.doc = doc;
    this.sel = null;
    this.history = []; this.future = [];
    this.last = this.snapshot();
    this.dirty = false;
    if (fileName !== undefined) this.fileName = fileName;
    L.MathDock.cancel();
    this.render();
    this.updateName();
    L.$('#desk').scrollTop = 0;
    this.autosave();
  },
  snapshot() { const d = this.doc; return JSON.stringify({ meta: d.meta, blocks: d.blocks, bib: d.bib }); },
  commit() {
    const s = this.snapshot();
    if (s === this.last) return;
    this.history.push(this.last);
    if (this.history.length > 150) this.history.shift();
    this.last = s; this.future = [];
    this.setDirty(true);
    this.autosave();
  },
  commitSoon: L.debounce(() => App.commit(), 450),
  restore(s) {
    const o = JSON.parse(s);
    Object.assign(this.doc, { meta: o.meta, blocks: o.blocks, bib: o.bib });
    if (this.sel && !L.find(this.doc, this.sel)) this.sel = null;
    this.render();
    this.setDirty(true);
    this.autosave();
  },
  undo() {
    this.commit();
    if (!this.history.length) return L.toast('Rien à annuler');
    this.future.push(this.last);
    this.last = this.history.pop();
    this.restore(this.last);
  },
  redo() {
    if (!this.future.length) return L.toast('Rien à rétablir');
    this.history.push(this.last);
    this.last = this.future.pop();
    this.restore(this.last);
  },
  setDirty(v) { this.dirty = v; L.$('#docName').classList.toggle('dirty', v); },
  updateName() {
    const t = L.plain(this.doc.meta.title);
    L.$('#docName').textContent = this.fileName || (t ? t : 'Sans titre');
    document.title = (t || 'Sans titre') + ' — LaTeX Home Edition';
  },
  autosave: L.debounce(() => {
    if (!App.doc) return;
    const ok = L.store.set('lhe-autosave', JSON.stringify(App.doc));
    if (!ok && !App._warnedQuota) { App._warnedQuota = true; L.toast('Sauvegarde automatique impossible (images trop lourdes) : pensez à « Enregistrer ».', 'err'); }
  }, 800),

  /* ================= Rendu ================= */
  render() {
    const paper = L.$('#paper');
    const anchor = this.captureAnchor();
    paper.className = 'paper ' + L.pageClasses(this.doc.meta);
    const flow = L.renderDoc(this.doc, 'edit');
    paper.replaceChildren(flow);
    if (this.sel) { const el = this.blockEl(this.sel); if (el) el.classList.add('sel'); else this.sel = null; }
    this.updateOutline();
    this.updateProps();
    this.updateName();
    this.layoutSheets(true);
    this.restoreAnchor(anchor);
    if (this.focusAfter) {
      const fa = this.focusAfter; this.focusAfter = null;
      this.applyFocus(fa);
    }
    this.pagesSoon();
  },

  /* ================= Pas de défilement parasite =================
     Avant de redessiner, on retient où se trouve à l'écran le bloc en cours d'édition ;
     après, on remet ce bloc exactement au même endroit. */
  captureAnchor() {
    const desk = L.$('#desk');
    const ids = [];
    const ae = document.activeElement;
    const ab = ae && ae.closest && ae.closest('#paper .blk');
    if (ab) ids.push(ab.dataset.id);
    if (this.focusAfter && this.focusAfter.id) ids.push(this.focusAfter.id);
    if (this.sel) ids.push(this.sel);
    const top0 = desk.getBoundingClientRect().top;
    const list = [];
    ids.forEach(id => { const el = this.blockEl(id); if (el) list.push({ id, y: el.getBoundingClientRect().top - top0 }); });
    // Sinon : le premier bloc visible
    if (!list.length) {
      const vis = L.$$('#paper .flow > .blk').find(el => el.getBoundingClientRect().bottom > top0 + 10);
      if (vis) list.push({ id: vis.dataset.id, y: vis.getBoundingClientRect().top - top0 });
    }
    return { list, scroll: desk.scrollTop };
  },
  restoreAnchor(a) {
    if (!a) return;
    const desk = L.$('#desk');
    desk.scrollTop = a.scroll;
    const top0 = desk.getBoundingClientRect().top;
    for (const c of a.list) {
      const el = this.blockEl(c.id);
      if (!el) continue;
      desk.scrollTop += (el.getBoundingClientRect().top - top0) - c.y;
      return;
    }
  },
  /* Fait défiler du strict minimum (sans animation) pour que le curseur soit visible */
  ensureCaretVisible(target) {
    const desk = L.$('#desk');
    let r = null;
    const s = window.getSelection();
    if (!target && s.rangeCount && L.$('#paper').contains(s.anchorNode)) {
      r = s.getRangeAt(0).getBoundingClientRect();
      if (!r.top && !r.bottom) r = null;
    }
    if (!r && target) r = target.getBoundingClientRect();
    if (!r && s.rangeCount) { const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); if (el) r = el.getBoundingClientRect(); }
    if (!r) return;
    const d = desk.getBoundingClientRect();
    const dock = L.$('#mathdock');
    const bottomLimit = d.bottom - 40 - (dock && !dock.hidden ? dock.offsetHeight : 0);
    if (r.top < d.top + 30) desk.scrollTop -= (d.top + 30 - r.top);
    else if (r.bottom > bottomLimit) desk.scrollTop += Math.min(r.bottom - bottomLimit, r.top - d.top - 30);
  },

  /* ================= Changements de page visibles pendant l'écriture ================= */
  pagesSoon: L.debounce(() => App.computePages(), 350),
  async computePages() {
    if (this._paginating) { this._paginateAgain = true; return; }
    this._paginating = true;
    try {
      const host = this._pageHost || (this._pageHost = document.body.appendChild(L.h('div', { class: 'measure-host', 'aria-hidden': 'true' })));
      await L.paginate(this.doc, host);
      host.innerHTML = '';
      this.pageInfo = L.lastPagination;
      this.drawPageMarks();
    } catch (e) { console.warn('Pagination', e); }
    this._paginating = false;
    if (this._paginateAgain) { this._paginateAgain = false; this.pagesSoon(); }
  },
  /* Affiche le document en feuilles A4 séparées (comme Word) : des espaces invisibles sont
     insérés aux endroits exacts où la mise en page du PDF change de page, et les feuilles
     (avec en-tête et pied de page) sont dessinées derrière le texte. */
  drawPageMarks() { this.layoutSheets(); },
  layoutSheets(noAnchor) {
    const paper = L.$('#paper');
    const flow = paper.querySelector(':scope > .flow');
    if (!flow) return;
    // Point d'ancrage : le curseur (ou le premier bloc visible), pour garder l'écran immobile
    const desk = L.$('#desk'), dTop = desk.getBoundingClientRect().top;
    let anc = null;
    if (!noAnchor) {
      const s0 = window.getSelection();
      if (s0.rangeCount && paper.contains(s0.anchorNode)) {
        const rg = s0.getRangeAt(0).cloneRange(), rc = rg.getBoundingClientRect();
        if (rc.top || rc.bottom) anc = { range: rg, y: rc.top - dTop };
      }
      if (!anc) {
        const vis = L.$$('#paper .flow > .blk').find(el => el.getBoundingClientRect().bottom > dTop + 10);
        if (vis) anc = { el: vis, y: vis.getBoundingClientRect().top - dTop };
      }
    }
    // 1. On retire les espaces de la mise en page précédente
    paper.querySelectorAll('.pg-sp').forEach(x => x.remove());
    paper.querySelectorAll('.pg-float').forEach(x => { const p = x.parentNode; x.remove(); if (p) p.normalize(); });
    let layer = paper.querySelector(':scope > .sheets');
    if (!layer) { layer = L.h('div', { class: 'sheets', 'aria-hidden': 'true' }); paper.insertBefore(layer, paper.firstChild); }
    layer.innerHTML = '';
    const cs = getComputedStyle(paper);
    const mtop = parseFloat(cs.paddingTop), mbot = parseFloat(cs.paddingBottom);
    const P = paper.offsetWidth * 297 / 210, GAP = 26;
    const info = this.pageInfo;
    const pTop = () => paper.getBoundingClientRect().top;
    const sheets = [{ top: 0 }];
    let prevTop = 0;
    (info ? info.breaks : []).forEach(b => {
      const pos = this.breakPoint(paper, b);
      if (!pos) return;
      let sp;
      if (pos.kind === 'block') { sp = L.h('div', { class: 'pg-sp', contenteditable: 'false' }); pos.before.parentNode.insertBefore(sp, pos.before); }
      else { sp = L.h('span', { class: 'pg-float', contenteditable: 'false' }); pos.range.insertNode(sp); }
      const y = sp.getBoundingClientRect().top - pTop();
      const bottom = Math.max(prevTop + P, y + 12);
      const nextTop = bottom + GAP;
      sp.style.height = Math.max(0, nextTop + mtop - y) + 'px';
      sheets[sheets.length - 1].bottom = bottom;
      sheets.push({ top: nextTop });
      prevTop = nextTop;
    });
    const end = flow.getBoundingClientRect().bottom - pTop() + mbot;
    sheets[sheets.length - 1].bottom = Math.max(prevTop + P, end);
    paper.style.minHeight = sheets[sheets.length - 1].bottom + 'px';
    // 2. Dessin des feuilles, avec en-têtes et pieds de page
    const m = L.fixMeta(this.doc.meta);
    const nums = info && info.pageNums ? info.pageNums : [];
    const total = info && info.total !== undefined ? info.total : L.pageStart(m) + sheets.length - 1;
    const firstNum = nums.findIndex(n => n !== null && n !== undefined);
    sheets.forEach((sh, i) => {
      const el = L.h('div', { class: 'sheet', style: { top: sh.top + 'px', height: (sh.bottom - sh.top) + 'px' } });
      const n = info ? nums[i] : L.pageStart(m) + i;
      const skip = n === null || n === undefined || (i === firstNum && m.hfFirst === false && m.titleStyle !== 'pagegarde');
      if (!skip) L.renderHF(m, n, total).forEach(x => el.appendChild(x));
      el.addEventListener('dblclick', e => { if (e.target.closest('.page-head, .page-hfoot')) L.dlgSettings('hf'); });
      const pn = info && info.notes ? info.notes[i] : null;
      if (pn && pn.length) {
        const box = L.h('div', { class: 'sheet-notes' }, L.h('div', { class: 'fn-rule' }));
        pn.forEach(nt => {
          const p = L.h('p', { class: 'fn' + (nt.pnote !== null && nt.fn === null ? ' pn' : ''), html: nt.html, title: 'Cliquer pour modifier' });
          p.addEventListener('click', () => this.editNote(nt));
          box.appendChild(p);
        });
        el.appendChild(box);
      }
      layer.appendChild(el);
    });
    this.sheets = sheets;
    // Remet le point d'ancrage au même endroit de l'écran
    if (anc) {
      let y = null;
      if (anc.range) { try { const rc = anc.range.getBoundingClientRect(); if (rc.top || rc.bottom) y = rc.top; } catch (e) {} }
      else if (anc.el && document.contains(anc.el)) y = anc.el.getBoundingClientRect().top;
      if (y !== null) desk.scrollTop += (y - dTop) - anc.y;
    }
    this.updatePageIndicator();
    // Si le texte a été poussé sur la page suivante, on garde le curseur visible (sans animation)
    if (document.activeElement && paper.contains(document.activeElement)) this.ensureCaretVisible();
  },
  /* Où couper dans l'éditeur ? Début du bloc, ou début de la ligne correspondant à la coupure du PDF */
  breakPoint(paper, b) {
    const el = b.id && paper.querySelector('.blk[data-id="' + b.id + '"]');
    if (!el) return null;
    if (!b.offset) return { kind: 'block', before: el };
    const content = Array.from(el.children).find(c => !c.classList.contains('gutter')) || el;
    const yT = content.getBoundingClientRect().top + b.offset - 3;
    const blockish = '.blk, .li, .eq, .tvwrap, .tbl, .fig, .code, .qed-line, .bib-item, .toc-row, .bib-h, .toc-h';
    let found = null;
    const visit = node => {
      for (const n of Array.from(node.childNodes)) {
        if (found) return;
        if (n.nodeType === 1) {
          if (n.matches('.gutter, .pg-sp, .pg-float, .katex, .imath, .xref, .cite, .fn, .timg, .env-head-inline, .li-mark, .num')) {
            if (n.matches('.imath, .xref, .cite, .timg') && n.closest('[data-f]')) {
              const r = n.getBoundingClientRect();
              if (r.height && r.top >= yT) { const rg = document.createRange(); rg.setStartBefore(n); rg.collapse(true); found = { kind: 'float', range: rg }; }
            }
            continue;
          }
          if (n !== el && n.matches(blockish)) {
            const r = n.getBoundingClientRect();
            if (r.height && r.top >= yT) { found = { kind: 'block', before: n }; return; }
          }
          if (n.matches('[data-f]') && n.matches('p, div') && !n.closest('td')) {
            const r = n.getBoundingClientRect();
            if (r.height && r.top >= yT) { found = { kind: 'block', before: n.closest('.li') || n }; return; }
          }
          if (n.tagName === 'TABLE' || n.tagName === 'svg') continue;
          visit(n);
        } else if (n.nodeType === 3 && n.parentElement && n.parentElement.closest('[data-f]')) {
          const t = n.nodeValue;
          for (let i = 0; i < t.length; i++) {
            if (i > 0 && !/\s/.test(t[i - 1])) continue;
            if (/\s/.test(t[i])) continue;
            const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
            const rc = rg.getClientRects()[0];
            if (rc && rc.top >= yT) { rg.collapse(true); found = { kind: 'float', range: rg }; return; }
          }
        }
      }
    };
    visit(el);
    if (found) return found;
    return el.nextElementSibling && el.nextElementSibling.matches('.blk') ? { kind: 'block', before: el.nextElementSibling } : { kind: 'block', before: el };
  },
  updatePageIndicator() {
    const pill = L.$('#pageIndicator');
    if (!pill || !this.sheets || !L.$('#previewWrap').hidden) { if (pill) pill.hidden = true; return; }
    let y = null;
    const paper = L.$('#paper');
    const s = window.getSelection();
    if (s.rangeCount && paper.contains(s.anchorNode)) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.top || r.bottom) y = r.top - paper.getBoundingClientRect().top;
    }
    if (y === null) { const d = L.$('#desk'); y = d.getBoundingClientRect().top + d.clientHeight / 3 - paper.getBoundingClientRect().top; }
    const page = Math.max(1, this.sheets.filter(sh => sh.top <= y + 2).length);
    pill.textContent = 'Page ' + page + ' sur ' + this.sheets.length;
    pill.hidden = false;
  },
  refreshAux: L.debounce(() => {
    // Met à jour le sommaire et le plan pendant la frappe, sans toucher au texte en cours
    const old = L.$('#paper .meta-blk[data-id="__toc"]');
    if (old) {
      const info = L.computeNumbers(App.doc);
      const ctx = { doc: App.doc, mode: 'edit', nums: info.nums, toc: info.toc, bib: info.bib, lang: App.doc.meta.lang, meta: App.doc.meta };
      old.replaceWith(L.renderToc(ctx));
    }
    App.updateOutline();
    App.updateName();
  }, 350),
  blockEl(id) { return L.$('#paper .blk[data-id="' + id + '"]'); },

  /* ================= Focus & curseur ================= */
  fieldsOf(el) { return L.$$('[data-f]', el).filter(f => !f.closest('.blk') || f.closest('.blk') === el || !el.classList.contains('blk') || true); },
  allFields() { return L.$$('#paper [data-f]'); },
  applyFocus(fa) {
    const el = this.blockEl(fa.id);
    if (!el) return;
    let field = null;
    if (fa.f) field = el.querySelector('[data-f="' + fa.f + '"]');
    if (!field) {
      const own = L.$$('[data-f]', el);
      field = fa.where === 'end' ? own[own.length - 1] : own[0];
    }
    if (!field) { this.select(fa.id); return; }
    this.focusField(field, fa.where || 'start');
  },
  focusField(field, where) {
    field.focus({ preventScroll: true });
    const sel = window.getSelection();
    const r = document.createRange();
    // Recherche du marqueur de position
    const tw = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    let n, found = false;
    while ((n = tw.nextNode())) {
      const i = n.nodeValue.indexOf(PUA);
      if (i >= 0) { n.nodeValue = n.nodeValue.replace(PUA, ''); r.setStart(n, i); found = true; break; }
    }
    if (!found) { r.selectNodeContents(field); r.collapse(where !== 'end'); }
    else r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
    if (found) this.syncField(field);
    this.ensureCaretVisible();
  },
  placeCaretAfter(node) {
    const field = node.closest('[data-f]') || node.closest('[contenteditable="true"]');
    if (!field) return;
    let next = node.nextSibling;
    if (!next || next.nodeType !== 3) { next = document.createTextNode('\u200b'); node.after(next); }
    field.focus({ preventScroll: true });
    const r = document.createRange();
    r.setStart(next, next.nodeValue.startsWith('\u200b') ? 1 : 0);
    r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  },
  caretAt(field, edge) {
    const s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed) return false;
    const r = s.getRangeAt(0);
    const probe = document.createRange();
    probe.selectNodeContents(field);
    if (edge === 'start') probe.setEnd(r.startContainer, r.startOffset);
    else probe.setStart(r.endContainer, r.endOffset);
    const frag = probe.cloneContents();
    const txt = frag.textContent.replace(/[\u200b\n]/g, '');
    return !txt.length && !frag.querySelector('.imath, .xref, .cite, .fn, br');
  },
  splitAtCaret(field) {
    const s = window.getSelection();
    const r = s.getRangeAt(0);
    if (!r.collapsed) r.deleteContents();
    const tail = document.createRange();
    tail.selectNodeContents(field);
    tail.setStart(r.endContainer, r.endOffset);
    const frag = tail.extractContents();
    const d = document.createElement('div');
    d.appendChild(frag);
    return [L.serializeRich(field), L.serializeRich(d)];
  },

  /* ================= Synchronisation texte → modèle ================= */
  target(field) {
    const b = field.dataset.b;
    if (b === 'meta') return this.doc.meta;
    const f = L.find(this.doc, b);
    return f ? f.block : null;
  },
  setPath(obj, path, v) {
    const p = path.split('.');
    let o = obj;
    for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = v;
  },
  syncField(field) {
    const t = this.target(field);
    if (!t) return;
    const f = field.dataset.f;
    let v;
    if (f === 'code') { v = field.innerText.replace(/\n$/, ''); field.classList.toggle('is-empty', !v); }
    else { v = L.serializeRich(field); field.classList.toggle('is-empty', L.isEmptyHtml(v)); }
    this.setPath(t, f, v);
  },

  /* ================= Sélection & panneaux ================= */
  select(id) {
    if (this.sel === id) return;
    L.$$('#paper .blk.sel').forEach(x => x.classList.remove('sel'));
    this.sel = id;
    if (id) { const el = this.blockEl(id); if (el) el.classList.add('sel'); }
    this.updateProps();
  },

  /* ================= Opérations sur les blocs ================= */
  insertBlock(block, opts = {}) {
    const doc = this.doc;
    let list = doc.blocks, index = list.length;
    const refId = opts.after || this.sel;
    let ref = refId && refId !== '__title' && refId !== '__toc' ? L.find(doc, refId) : null;
    // pas d'encadré dans un encadré, pas de colonnes dans des colonnes
    if (ref && (block.type === 'box' || block.type === 'cols')) while (ref.parent) ref = L.find(doc, ref.parent.type === 'col' ? L.find(doc, ref.parent.id).parent.id : ref.parent.id);
    if (opts.into) { const bx = L.find(doc, opts.into); list = bx.block.children; index = list.length; }
    else if (ref) {
      list = ref.list; index = ref.index + 1;
      const rb = ref.block;
      if (opts.replaceEmpty !== false && rb.type === 'paragraph' && L.isEmptyHtml(rb.html) && block.type !== 'paragraph') { list.splice(ref.index, 1); index = ref.index; }
    } else if (refId === '__title' || refId === '__toc') { index = 0; }
    list.splice(index, 0, block);
    this.sel = block.id;
    this.commit();
    const focusMap = { paragraph: 'start', heading: 'start', list: 'start', box: 'start', table: 'start', code: 'start' };
    if (focusMap[block.type]) this.focusAfter = { id: block.id, where: 'start' };
    this.render();
    if (block.type === 'equation') L.MathDock.open({ kind: 'block', blockId: block.id, isNew: true });
    if (block.type === 'figure' && !opts.noPick) this.pickImage(block.id);
    if (block.type === 'pnote' && L.isEmptyHtml(L.pnoteHtml(block))) L.dlgFootnote('', v => { block.html = v; delete block.text; this.commit(); this.render(); }, () => this.removeBlock(block.id, false), true);
    const el = this.blockEl(block.id);
    if (el && !focusMap[block.type]) this.ensureCaretVisible(el);
    return block;
  },
  removeBlock(id, focusPrev = true) {
    const f = L.find(this.doc, id);
    if (!f) return;
    const prevId = f.index > 0 ? f.list[f.index - 1].id : (f.parent ? f.parent.id : (f.list[1] ? f.list[1].id : null));
    f.list.splice(f.index, 1);
    if (f.parent && !f.parent.children.length) f.parent.children.push(L.newBlock('paragraph'));
    if (!this.doc.blocks.length) this.doc.blocks.push(L.newBlock('paragraph'));
    this.sel = null;
    if (focusPrev && prevId) this.focusAfter = { id: prevId, where: 'end' };
    this.commit();
    this.render();
  },
  moveBlock(id, dir) {
    const f = L.find(this.doc, id);
    if (!f) return;
    const j = f.index + dir;
    if (j < 0 || j >= f.list.length) return;
    [f.list[f.index], f.list[j]] = [f.list[j], f.list[f.index]];
    this.commit(); this.render();
    const el = this.blockEl(id); if (el) this.ensureCaretVisible(el);
  },
  duplicate(id) {
    const f = L.find(this.doc, id);
    if (!f) return;
    const c = L.cloneBlock(f.block);
    f.list.splice(f.index + 1, 0, c);
    this.sel = c.id;
    this.commit(); this.render();
  },
  replaceBlock(id, nb, where = 'start') {
    const f = L.find(this.doc, id);
    if (!f) return;
    f.list.splice(f.index, 1, nb);
    this.sel = nb.id;
    this.focusAfter = { id: nb.id, where };
    this.commit(); this.render();
  },
  convertParagraph(id, type) {
    const f = L.find(this.doc, id);
    if (!f) return;
    const html = f.block.html || '';
    let nb;
    if (type === 'h1' || type === 'h2' || type === 'h3') nb = L.newBlock('heading', { level: +type[1], html });
    else if (type === 'ul' || type === 'ol') nb = L.newBlock('list', { style: type === 'ul' ? 'bullet' : 'number', items: [{ html, level: 0 }] });
    else if (type === 'paragraph') nb = L.newBlock('paragraph', { html: f.block.html || (f.block.items ? f.block.items.map(i => i.html).join('<br>') : '') });
    else if (L.KINDS[type]) nb = L.newBlock('box', { kind: type, children: [L.newBlock('paragraph', { html })] });
    if (nb) this.replaceBlock(id, nb, 'end');
  },
  ensureBibliography() {
    let has = false;
    L.walk(this.doc.blocks, b => { if (b.type === 'bibliography') has = true; });
    if (!has) { this.doc.blocks.push(L.newBlock('bibliography')); L.toast('Une section « Références » a été ajoutée à la fin du document.'); }
  },

  /* ================= Images ================= */
  pickImage(id) {
    const inp = L.$('#fileImg');
    inp.value = '';
    inp.onchange = () => { if (inp.files[0]) this.setImage(id, inp.files[0]); };
    inp.click();
  },
  async setImage(id, file) {
    if (!file || !/^image\//.test(file.type)) return L.toast('Ce fichier n\'est pas une image.', 'err');
    try {
      const data = await L.readImage(file);
      const f = L.find(this.doc, id);
      if (!f) return;
      const aid = 'img' + L.uid('');
      this.doc.assets[aid] = data;
      f.block.src = aid;

      this.sel = id;
      this.commit(); this.render();
    } catch (e) { L.toast('Impossible de lire cette image.', 'err'); }
  },

  /* ================= Éléments en ligne ================= */
  currentRichRange() {
    const r = this.lastRange;
    if (!r) return null;
    const field = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement)?.closest?.('[data-f]');
    if (!field || !document.contains(field) || field.dataset.f === 'code') return null;
    return { r, field };
  },
  insertChip(chip) {
    let cr = this.currentRichRange();
    if (!cr) {
      // Pas de curseur : on ajoute à la fin du paragraphe sélectionné, sinon un nouveau paragraphe
      const f = this.sel && L.find(this.doc, this.sel);
      let id;
      if (f && f.block.type === 'paragraph') id = f.block.id;
      else id = this.insertBlock(L.newBlock('paragraph'), {}).id;
      const field = this.blockEl(id).querySelector('[data-f]');
      field.appendChild(chip);
      this.syncField(field);
      return chip;
    }
    const { r, field } = cr;
    r.deleteContents();
    r.insertNode(chip);
    if (!chip.previousSibling) chip.before(document.createTextNode('\u200b'));
    this.syncField(field);
    field.classList.remove('is-empty');
    return chip;
  },
  insertInlineMath() {
    const chip = L.h('span', { class: 'imath', 'data-latex': '', contenteditable: 'false' });
    chip.innerHTML = '<span class="chip-empty">formule</span>';
    this.insertChip(chip);
    L.MathDock.open({ kind: 'inline', chip, isNew: true });
  },
  insertXref() {
    const cr = this.currentRichRange();
    L.dlgXref(id => {
      if (cr) this.lastRange = cr.r;
      const chip = L.h('span', { class: 'xref', 'data-ref': id });
      this.insertChip(chip);
      this.hydrateChips();
      this.placeCaretAfter(chip);
      this.commit();
    });
  },
  insertCite() {
    const cr = this.currentRichRange();
    L.dlgCite(id => {
      if (cr) this.lastRange = cr.r;
      const chip = L.h('span', { class: 'cite', 'data-ref': id });
      this.insertChip(chip);
      this.commit();
      this.render();
    });
  },
  insertFootnote() {
    const cr = this.currentRichRange();
    L.dlgFootnote('', text => {
      if (cr) this.lastRange = cr.r;
      const chip = L.h('span', { class: 'fn', 'data-text': L.plain(text), 'data-html': text });
      this.insertChip(chip);
      this.commit();
      this.render();
    });
  },
  /* Menu de symboles (touche Tab) dans le texte */
  openSymbols(field) {
    const s = window.getSelection();
    let r = s.rangeCount && field && field.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : (this.currentRichRange() || {}).r;
    let rect = r ? r.getBoundingClientRect() : null;
    if (!rect || (!rect.top && !rect.left)) rect = (field || L.$('#paper')).getBoundingClientRect();
    L.SymbolPicker.open({
      context: 'text', x: rect.left - 20, y: rect.bottom + 8, above: rect.top,
      onPick: sym => {
        if (r) this.lastRange = r;
        this.insertSymbol(sym);
      },
      onClose: picked => {
        if (picked || !field || !document.contains(field)) return;
        field.focus({ preventScroll: true });
        if (r) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      },
    });
  },
  insertSymbol(sym) {
    const tpl = sym.latex;
    if (/#[?0@]/.test(tpl)) {
      // Modèle à compléter : on ouvre l'éditeur de formules avec le modèle
      const chip = L.h('span', { class: 'imath', 'data-latex': '', contenteditable: 'false' });
      chip.innerHTML = '<span class="chip-empty">formule</span>';
      this.insertChip(chip);
      L.MathDock.open({ kind: 'inline', chip, isNew: true, template: tpl });
      return;
    }
    const chip = L.h('span', { class: 'imath', 'data-latex': tpl.replace(/^\\,/, ''), contenteditable: 'false' });
    chip.innerHTML = L.katex(chip.dataset.latex);
    this.insertChip(chip);
    this.placeCaretAfter(chip);
    this.commit();
  },
  /* Image dans une case de tableau (ou dans le texte) */
  pickInlineImage() {
    const cr = this.currentRichRange();
    const inp = L.$('#fileImg');
    inp.value = '';
    inp.onchange = () => { if (inp.files[0]) { if (cr) this.lastRange = cr.r; this.insertInlineImage(inp.files[0]); } };
    inp.click();
  },
  async insertInlineImage(file) {
    try {
      const data = await L.readImage(file, 1400);
      const aid = 'img' + L.uid('');
      this.doc.assets[aid] = data;
      const chip = L.h('span', { class: 'timg', 'data-src': aid, 'data-w': '3', contenteditable: 'false' });
      this.insertChip(chip);
      L.hydrate(chip.parentNode, { mode: 'edit', nums: {}, bib: {}, doc: this.doc });
      this.syncField(chip.closest('[data-f]'));
      this.commit();
      this.pagesSoon();
    } catch (e) { L.toast('Impossible de lire cette image.', 'err'); }
  },
  editInlineImage(chip) {
    const field = chip.closest('[data-f]');
    const inp = L.h('input', { type: 'range', min: 1, max: 16, step: 0.5, value: chip.dataset.w || 3 });
    const lab = L.h('span', { text: (chip.dataset.w || 3) + ' cm' });
    inp.oninput = () => { chip.dataset.w = inp.value; lab.textContent = inp.value + ' cm'; const im = chip.querySelector('img'); if (im) im.style.width = inp.value + 'cm'; };
    L.modal({
      title: 'Image', body: L.h('div', { class: 'field' }, L.h('label', { text: 'Largeur de l\'image' }), inp, lab),
      foot: [
        { text: 'Supprimer l\'image', cls: 'danger', onClick: c => { c(); chip.remove(); this.syncField(field); this.commit(); this.pagesSoon(); } },
        { text: 'Terminé', cls: 'primary', onClick: c => { c(); this.syncField(field); this.commit(); this.pagesSoon(); } },
      ],
    });
  },
  /* Couleur du texte sélectionné */
  setColor(col) {
    const cr = this.currentRichRange();
    if (!cr) return L.toast('Sélectionnez d\'abord du texte.');
    const s = window.getSelection();
    if (!s.rangeCount || !cr.field.contains(s.anchorNode)) { s.removeAllRanges(); s.addRange(cr.r); }
    const r = s.getRangeAt(0);
    if (r.collapsed) return L.toast('Sélectionnez d\'abord du texte.');
    const frag = r.extractContents();
    frag.querySelectorAll('span[class^="c-"]').forEach(x => x.replaceWith(...x.childNodes));
    let node = frag;
    if (col) { const sp = document.createElement('span'); sp.className = 'c-' + col; sp.appendChild(frag); node = sp; }
    r.insertNode(node);
    this.syncField(cr.field);
    this.commit();
  },
  /* Insère du code LaTeX converti en blocs (remplace un bloc, ou après la sélection) */
  insertLatex(src, opts = {}) {
    const blocks = L.latexToBlocks(src);
    if (!blocks.length) { L.toast('Rien à convertir.'); return 0; }
    const doc = this.doc;
    const ref = opts.replace ? L.find(doc, opts.replace) : (opts.after || this.sel) && !String(opts.after || this.sel).startsWith('__') ? L.find(doc, opts.after || this.sel) : null;
    if (ref && (opts.replace || (ref.block.type === 'paragraph' && L.isEmptyHtml(ref.block.html)))) ref.list.splice(ref.index, 1, ...blocks);
    else if (ref) ref.list.splice(ref.index + 1, 0, ...blocks);
    else doc.blocks.push(...blocks);
    this.sel = blocks[blocks.length - 1].id;
    this.commit(); this.render();
    const el = this.blockEl(blocks[0].id); if (el) this.ensureCaretVisible(el);
    const n = t => blocks.filter(b => b.type === t).length;
    L.toast('Code LaTeX converti : ' + n('paragraph') + ' paragraphe(s), ' + n('equation') + ' équation(s)' + (n('heading') ? ', ' + n('heading') + ' titre(s)' : '') + '. Ctrl+Z pour annuler.');
    return blocks.length;
  },
  hydrateChips() {
    const info = L.computeNumbers(this.doc);
    L.hydrate(L.$('#paper'), { mode: 'edit', nums: info.nums, bib: info.bib, fn: 0, doc: this.doc });
  },
  format(cmd) {
    const cr = this.currentRichRange();
    if (!cr) return L.toast('Sélectionnez d\'abord du texte.');
    const s = window.getSelection();
    if (!s.rangeCount || !cr.field.contains(s.anchorNode)) { s.removeAllRanges(); s.addRange(cr.r); }
    if (cmd === 'code') {
      const r = s.getRangeAt(0);
      if (r.collapsed) return;
      const c = document.createElement('code');
      c.appendChild(r.extractContents());
      r.insertNode(c);
    } else document.execCommand(cmd, false, null);
    this.syncField(cr.field);
    this.commitSoon();
  },

  /* ================= Plan & propriétés ================= */
  updateOutline() {
    const box = L.$('#outline');
    const info = L.computeNumbers(this.doc);
    box.innerHTML = '';
    if (!info.toc.length) box.appendChild(L.h('div', { class: 'ol-empty', text: 'Le plan de votre document apparaîtra ici dès que vous ajouterez des sections.' }));
    info.toc.forEach(t => box.appendChild(L.h('div', {
      class: 'ol-item l' + t.level, onclick: () => { const el = this.blockEl(t.id); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); this.select(t.id); } },
    }, L.h('span', { class: 'n', text: t.num }), L.h('span', { text: L.plain(t.html) || '(sans titre)' }))));
    let words = 0, eqs = 0, figs = 0, tabs = 0, ex = 0;
    L.walk(this.doc.blocks, b => {
      if (b.type === 'equation') eqs++; else if (b.type === 'figure') figs++; else if (b.type === 'table') tabs++;
      else if (b.type === 'box' && b.kind === 'exercice') ex++;
      const t = b.html ? L.plain(b.html) : b.items ? b.items.map(i => L.plain(i.html)).join(' ') : '';
      words += t ? t.split(/\s+/).filter(Boolean).length : 0;
    });
    box.appendChild(L.h('div', { class: 'ol-stats', html:
      '<b>' + words + '</b> mots · <b>' + eqs + '</b> équation' + (eqs > 1 ? 's' : '') + '<br><b>' + figs + '</b> figure' + (figs > 1 ? 's' : '') +
      ' · <b>' + tabs + '</b> tableau' + (tabs > 1 ? 'x' : '') + (ex ? ' · <b>' + ex + '</b> exercice' + (ex > 1 ? 's' : '') : '') }));
  },

  updateProps() {
    const P = L.$('#props');
    P.innerHTML = '';
    const doc = this.doc;
    const f = this.sel && !this.sel.startsWith('__') ? L.find(doc, this.sel) : null;
    const row = (label, ...c) => L.h('div', { class: 'pp-row' }, label ? L.h('span', { class: 'pp-lab', text: label }) : null, ...c);
    const seg = (opts, val, on) => {
      const s = L.h('div', { class: 'seg' });
      opts.forEach(([v, t, title]) => s.appendChild(L.h('button', { class: v === val ? 'on' : '', text: t, title: title || null, onclick: () => on(v) })));
      return s;
    };
    const chk = (label, val, on) => {
      const i = L.h('input', { type: 'checkbox' }); i.checked = !!val; i.onchange = () => on(i.checked);
      return L.h('label', { class: 'chk' }, i, label);
    };
    const btn = (text, on, cls = '') => L.h('button', { class: 'btn ' + cls, text, onclick: on });
    const upd = fn => { fn(); this.commit(); this.render(); };

    if (!f) {
      const m = doc.meta;
      P.append(
        L.h('div', { class: 'pp-type' }, L.h('span', { class: 'ic', text: '📄' }), 'Document'),
        row('', btn('⚙  Titre, police, marges…', () => L.dlgSettings(), 'primary')),
        row('Options rapides',
          chk('Table des matières', m.toc, v => upd(() => { m.toc = v; })),

          chk('Encadrer les théorèmes', m.boxedThm, v => upd(() => { m.boxedThm = v; }))),
        row('Taille du texte', seg([[10, '10 pt'], [11, '11 pt'], [12, '12 pt']], m.fontSize, v => upd(() => { m.fontSize = v; }))),
        row('Numéros de page', (() => { const s = L.h('select', null, ...L.NUM_FORMATS.map(([v, t]) => { const o = L.h('option', { value: v, text: t }); if ((m.numFormat || 'arabic') === v) o.selected = true; return o; })); s.onchange = () => upd(() => { m.numFormat = s.value; }); return s; })(),
          btn('En-tête et pied de page…', () => L.dlgSettings('hf'))),
        row('Sources', btn('Gérer la bibliographie (' + (doc.bib || []).length + ')', () => L.dlgBib())),
        L.h('hr', { class: 'pp-sep' }),
        L.h('div', { class: 'pp-help' },
          L.h('p', { html: '<b>Pour commencer :</b> cliquez dans la feuille et écrivez. Ajoutez des éléments avec la colonne de gauche, le bouton <b>+</b> au survol d\'un bloc, ou en tapant <kbd>/</kbd> sur une ligne vide.' }),
          L.h('p', { html: 'Cliquez sur un bloc pour afficher ici ses réglages.' })));
      return;
    }
    const b = f.block;
    const [ic, name] = TYPE_INFO[b.type] || ['?', b.type];
    P.appendChild(L.h('div', { class: 'pp-type' }, L.h('span', { class: 'ic', text: b.type === 'box' ? '▢' : ic }),
      b.type === 'box' ? L.kindName(b.kind, doc.meta.lang) : name,
      f.parent ? L.h('span', { style: { fontWeight: 400, color: 'var(--mut)', fontSize: '12px' }, text: f.parent.type === 'col' ? ' (dans une colonne)' : ' (dans l\'encadré)' }) : null));
    // Numéro forcé (ex. commencer à 0)
    const forceRow = () => {
      const i = L.h('input', { type: 'number', value: b.forceNum ?? '', placeholder: 'auto', style: { width: '90px' } });
      i.onchange = () => upd(() => { if (i.value === '') delete b.forceNum; else b.forceNum = Math.trunc(+i.value); });
      return row('Forcer le numéro', L.h('div', { class: 'btn-row', style: { alignItems: 'center' } }, i,
        L.h('span', { class: 'pp-help', text: 'Vide = automatique. La suite continue à partir de ce numéro.' })));
    };
    const capRow = () => row('Légende', seg([['num', 'Numérotée'], ['nonum', 'Sans numéro'], ['none', 'Aucune']], b.capMode || 'num', v => upd(() => { b.capMode = v; })));

    if (b.type === 'heading') {
      P.append(
        row('Niveau', seg([[1, 'Section'], [2, 'Sous-sect.'], [3, 'Sous-sous'], [4, 'Paragr.']], b.level, v => upd(() => { b.level = v; }))),
        row('', chk('Numéroté automatiquement', b.numbered, v => upd(() => { b.numbered = v; }))));
      if (b.numbered && b.level <= 3) P.append(forceRow());
    } else if (b.type === 'paragraph') {
      P.append(
        row('Alignement', seg([['justify', 'Justifié'], ['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']], b.align || 'justify', v => upd(() => { b.align = v; }))),
        row('', chk('Sans alinéa (pas de retrait)', b.noindent, v => upd(() => { b.noindent = v; }))),
        row('Transformer en', L.h('div', { class: 'btn-row' },
          btn('Section', () => this.convertParagraph(b.id, 'h1')), btn('Sous-section', () => this.convertParagraph(b.id, 'h2')),
          btn('Liste', () => this.convertParagraph(b.id, 'ul')), btn('Théorème', () => this.convertParagraph(b.id, 'theoreme')),
          btn('Définition', () => this.convertParagraph(b.id, 'definition')), btn('Remarque', () => this.convertParagraph(b.id, 'remarque')))));
    } else if (b.type === 'equation') {
      P.append(
        row('', btn('✎  Modifier l\'équation', () => L.MathDock.open({ kind: 'block', blockId: b.id }), 'primary')),
        row('', chk('Numérotée — (1), (2)…', b.numbered, v => upd(() => { b.numbered = v; }))),
        b.numbered ? forceRow() : '',
        L.h('div', { class: 'pp-help', html: '<p>Pour écrire plusieurs lignes alignées, utilisez « Calcul sur plusieurs lignes » dans l\'onglet <i>Matrices &amp; systèmes</i> de l\'éditeur.</p>' }));
    } else if (b.type === 'list') {
      P.append(
        row('Style', seg([['bullet', '–  Puces'], ['number', '1.'], ['alpha', 'a)'], ['roman', 'i)']], b.style, v => upd(() => { b.style = v; }))),
        b.style !== 'bullet' ? row('Commencer à', (() => { const i = L.h('input', { type: 'number', value: b.start ?? 1, style: { width: '90px' } }); i.onchange = () => upd(() => { if (i.value === '' || +i.value === 1) delete b.start; else b.start = Math.trunc(+i.value); }); return i; })()) : '',
        this.listItemRow(b, row, btn, upd),
        row('', btn('+ Ajouter un élément', () => { b.items.push({ html: '', level: 0 }); this.focusAfter = { id: b.id, f: 'items.' + (b.items.length - 1) + '.html' }; upd(() => {}); })),
        L.h('div', { class: 'pp-help', html: '<p><kbd>Tab</kbd> décale un élément vers la droite (sous-question), <kbd>Maj</kbd>+<kbd>Tab</kbd> vers la gauche. <kbd>Entrée</kbd> sur un élément vide termine la liste.</p>' }));
    } else if (b.type === 'box') {
      const kinds = L.h('div', { class: 'kind-grid' });
      Object.keys(L.KINDS).forEach(k => kinds.appendChild(L.h('button', {
        class: k === b.kind ? 'on' : '', text: L.kindName(k, doc.meta.lang),
        onclick: () => upd(() => { b.kind = k; b.numbered = L.KINDS[k].numbered; }),
      })));
      const title = L.h('input', { type: 'text', value: b.title || '', placeholder: 'Ex. : de Pythagore' });
      title.oninput = () => { b.title = title.value; this.commitSoon(); this.renderSoon(); };
      P.append(row('Type', kinds));
      const cname = L.h('input', { type: 'text', value: b.customName || '', placeholder: L.kindName(b.kind, doc.meta.lang) + ' (par défaut)' });
      cname.oninput = () => { b.customName = cname.value; this.commitSoon(); this.renderSoon(); };
      if (b.kind !== 'resume') P.append(row('Nom affiché', cname, L.h('div', { class: 'pp-help', text: 'Ex. : « Attention », « Loi », « À retenir »… Il remplace « ' + L.kindName(b.kind, doc.meta.lang) + ' ».' })));
      if (b.kind !== 'resume') P.append(row('Titre (facultatif)', title));
      if (!(L.KINDS[b.kind] || {}).fixed) P.append(row('', chk('Numéroté', b.numbered, v => upd(() => { b.numbered = v; }))));
      if (b.numbered && !(L.KINDS[b.kind] || {}).fixed) P.append(forceRow());
      P.append(row('Ajouter dans l\'encadré', L.h('div', { class: 'btn-row' },
        btn('Paragraphe', () => this.insertBlock(L.newBlock('paragraph'), { into: b.id })),
        btn('Équation', () => this.insertBlock(L.newBlock('equation'), { into: b.id })),
        btn('Liste', () => this.insertBlock(L.newBlock('list', { style: 'number' }), { into: b.id })),
        btn('Tableau', () => this.insertBlock(L.newBlock('table'), { into: b.id })),
        btn('Image', () => this.insertBlock(L.newBlock('figure'), { into: b.id })))));
    } else if (b.type === 'table') {
      const cols = Math.max(...b.rows.map(r => r.length));
      const cell = this.lastCell && this.lastCell.id === b.id ? this.lastCell : { r: b.rows.length - 1, c: cols - 1 };
      const alignRow = L.h('div', { class: 'btn-row' });
      for (let c = 0; c < cols; c++) {
        const s = L.h('select', { title: 'Colonne ' + (c + 1), style: { flex: '1', minWidth: '0', padding: '5px' } },
          ...[['l', 'Gauche'], ['c', 'Centre'], ['r', 'Droite']].map(([v, t]) => { const o = L.h('option', { value: v, text: (c + 1) + ' : ' + t }); if ((b.align[c] || 'c') === v) o.selected = true; return o; }));
        s.onchange = () => upd(() => { b.align[c] = s.value; });
        alignRow.appendChild(s);
      }
      const sw = L.h('div', { class: 'swatches' });
      [['', 'Aucune', '#fff'], ...Object.entries(L.HEAD_COLORS).map(([k, v]) => [k, k, '#' + v])].forEach(([k, t, c]) =>
        sw.appendChild(L.h('button', { class: (b.headColor || '') === k ? 'on' : '', title: t, style: { background: c }, text: k ? '' : '∅', onclick: () => upd(() => { b.headColor = k; }) })));
      const wRow = L.h('div', { class: 'btn-row' });
      for (let c = 0; c < cols; c++) {
        const s = L.h('select', { title: 'Colonne ' + (c + 1), style: { flex: '1', minWidth: '0', padding: '5px' } },
          ...[['auto', 'ajustée'], ['fill', 'large']].map(([v, t]) => { const o = L.h('option', { value: v, text: (c + 1) + ' : ' + t }); if (((b.colw || [])[c] || 'auto') === v) o.selected = true; return o; }));
        s.onchange = () => upd(() => { b.colw = b.colw || []; b.colw[c] = s.value; });
        wRow.appendChild(s);
      }
      P.append(
        capRow(),
        (b.capMode || 'num') === 'num' ? this.capLabelRow(b, row, 'table') : '',
        (b.capMode || 'num') === 'num' ? forceRow() : '',
        row('Style', seg([['pro', 'Professionnel'], ['grille', 'Grille'], ['simple', 'Simple']], b.style, v => upd(() => { b.style = v; }))),
        row('', chk('Première ligne en en-tête (gras)', b.head, v => upd(() => { b.head = v; }))),
        row('Couleur de la première ligne', sw),
        row('Largeur des colonnes', wRow, L.h('div', { class: 'pp-help', html: '« large » : la colonne prend toute la place restante et le texte passe à la ligne (comme une grille de consignes).' })),
        row('Image dans une case', btn('🖼  Insérer une image dans la case', () => this.pickInlineImage()), L.h('div', { class: 'pp-help', text: 'Ou copiez une capture d\'écran puis collez-la (Ctrl+V) dans la case.' })),
        row('Cases fusionnées', L.h('div', { class: 'btn-row' },
          btn('Fusionner avec la case de droite', () => {
            const sp = b.spans || (b.spans = {});
            const k = cell.r + ':' + cell.c, cur = sp[k] || 1;
            if (cell.c + cur >= cols) return L.toast('Pas de case à droite à fusionner.');
            const nk = cell.r + ':' + (cell.c + cur);
            upd(() => { sp[k] = cur + (sp[nk] || 1); delete sp[nk]; });
          }),
          btn('Séparer', () => { if (b.spans && b.spans[cell.r + ':' + cell.c]) upd(() => { delete b.spans[cell.r + ':' + cell.c]; }); }))),
        row('Lignes et colonnes', L.h('div', { class: 'btn-row' },
          btn('+ Ligne', () => upd(() => { b.rows.splice(cell.r + 1, 0, Array(cols).fill('')); L.shiftSpans(b, cell.r + 1, 1); })),
          btn('+ Colonne', () => upd(() => { b.rows.forEach(r => r.splice(cell.c + 1, 0, '')); b.align.splice(cell.c + 1, 0, 'c'); b.spans = {}; })),
          btn('− Ligne', () => { if (b.rows.length > 1) upd(() => { b.rows.splice(cell.r, 1); L.shiftSpans(b, cell.r, -1); this.lastCell = null; }); }, 'danger'),
          btn('− Colonne', () => { if (cols > 1) upd(() => { b.rows.forEach(r => r.splice(cell.c, 1)); b.align.splice(cell.c, 1); b.spans = {}; this.lastCell = null; }); }, 'danger'))),
        L.h('div', { class: 'pp-help', html: '<p>Les ajouts et suppressions se font à côté de la case où se trouve le curseur (ligne ' + (cell.r + 1) + ', colonne ' + (cell.c + 1) + ').</p>' }),
        row('Alignement des colonnes', alignRow));
    } else if (b.type === 'figure') {
      const rng = L.h('input', { type: 'range', min: 10, max: 100, step: 5, value: b.width || 60 });
      const lab = L.h('span', { text: (b.width || 60) + ' % de la largeur du texte' });
      rng.oninput = () => { b.width = +rng.value; lab.textContent = b.width + ' % de la largeur du texte'; const img = this.blockEl(b.id)?.querySelector('img'); if (img) img.style.width = b.width + '%'; this.commitSoon(); };
      P.append(
        row('', btn(b.src ? '🖼  Changer l\'image' : '🖼  Choisir une image', () => this.pickImage(b.id), 'primary')),
        row('Taille', rng, lab),
        capRow(),
        (b.capMode || 'num') === 'num' ? this.capLabelRow(b, row, 'figure') : '',
        row('', L.h('div', { class: 'pp-help', text: 'Le texte de la légende se modifie directement sous l\'image, sur la feuille.' })),
        (b.capMode || 'num') === 'num' ? forceRow() : '');
    } else if (b.type === 'code') {
      const s = L.h('select', null, ...[['python', 'Python'], ['c', 'C'], ['cpp', 'C++'], ['java', 'Java'], ['javascript', 'JavaScript'], ['matlab', 'Matlab / Octave'], ['r', 'R'], ['sql', 'SQL'], ['bash', 'Terminal (bash)'], ['html', 'HTML'], ['texte', 'Texte brut']]
        .map(([v, t]) => { const o = L.h('option', { value: v, text: t }); if (b.lang === v) o.selected = true; return o; }));
      s.onchange = () => upd(() => { b.lang = s.value; });
      P.append(row('Langage', s), row('', chk('Numéroter les lignes', b.numbers, v => upd(() => { b.numbers = v; }))));
    } else if (b.type === 'pnote') {
      const prev = L.h('div', { class: 'pnote-prev paper ' + L.pageClasses(doc.meta), html: L.pnoteHtml(b) || '<i style="color:#999">(vide)</i>' });
      L.hydrate(prev, { mode: 'view', nums: {}, bib: {}, fn: 0, doc, meta: doc.meta });
      P.append(row('Texte en bas de page', prev, btn('✎  Modifier (texte, formules, symboles)', () => this.editNote({ pnote: b.id }), 'primary')), L.h('div', { class: 'pp-help', html: '<p>Ce texte, sans numéro, apparaît en bas de la page où se trouve ce repère ↧. Pour une note numérotée liée à un mot, utilisez plutôt le bouton <b>¹ Note</b>.</p>' }));
    } else if (b.type === 'vspace') {
      P.append(row('Hauteur', seg(Object.entries(L.VSPACES).map(([k, v]) => [k, v[0]]), b.size || 'moyen', v => upd(() => { b.size = v; }))));
    } else if (b.type === 'cols') {
      const addTo = (i, lab) => row('Ajouter dans la colonne ' + lab, L.h('div', { class: 'btn-row' },
        ...[['Tableau', 'table'], ['Image', 'figure'], ['Paragraphe', 'paragraph'], ['Équation', 'equation'], ['Liste', 'list']].map(([t, ty]) =>
          btn(t, () => this.insertBlock(L.newBlock(ty), { into: b.children[i].id })))));
      P.append(
        row('Largeurs', seg([[50, '50 / 50'], [60, '60 / 40'], [40, '40 / 60'], [65, '65 / 35'], [35, '35 / 65']], b.ratio || 50, v => upd(() => { b.ratio = v; }))),
        addTo(0, 'de gauche'), addTo(1, 'de droite'),
        row('', btn('⇄ Échanger les deux colonnes', () => upd(() => { b.children.reverse(); }))),
        L.h('div', { class: 'pp-help', html: '<p>En LaTeX, chaque colonne devient une <i>minipage</i>. Les tableaux et figures gardent leur légende numérotée.</p>' }));
    } else if (b.type === 'tabvar') {
      P.append(row('', btn('✎  Modifier le tableau', () => L.dlgTabvar(b), 'primary')),
        L.h('div', { class: 'pp-help', html: '<p>Exporté en LaTeX avec le paquet <i>tkz-tab</i>, la référence pour les tableaux de variations.</p>' }));
    } else if (b.type === 'bibliography') {
      P.append(row('', btn('Gérer les sources (' + (doc.bib || []).length + ')', () => L.dlgBib(), 'primary')),
        L.h('div', { class: 'pp-help', html: '<p>Citez une source dans le texte avec le bouton « Citation » de la barre d\'outils.</p>' }));
    }

    P.append(L.h('hr', { class: 'pp-sep' }), row('Actions', L.h('div', { class: 'btn-row' },
      btn('↑ Monter', () => this.moveBlock(b.id, -1)), btn('↓ Descendre', () => this.moveBlock(b.id, 1)),
      btn('Dupliquer', () => this.duplicate(b.id)), btn('Supprimer', () => this.removeBlock(b.id), 'danger'))));
  },
  renderSoon: L.debounce(() => App.render(), 250),
});

/* ================= Menus d'insertion ================= */
L.InsertMenu = (function () {
  let items = [], idx = 0, onPick = null, open = false, groups = true;
  const box = () => L.$('#slashMenu');
  function show(x, y, query, pick) {
    onPick = pick;
    const q = norm(query || '');
    // Un élément correspond si un mot de son nom ou de ses mots-clés commence par la saisie
    const score = it => {
      if (!q) return 1;
      if (norm(it.label).startsWith(q)) return 3;
      if ((norm(it.label) + ' ' + it.kw).split(/[\s/-]+/).some(w => w.startsWith(q))) return 2;
      return 0;
    };
    items = L.ITEMS.filter(it => score(it) > 0);
    if (q) items.sort((a, b) => score(b) - score(a));
    groups = !q;
    idx = 0;
    draw();
    const b = box();
    b.hidden = false; open = true;
    const h = Math.min(360, b.scrollHeight);
    b.style.left = Math.min(x, window.innerWidth - 300) + 'px';
    b.style.top = (y + h > window.innerHeight - 10 ? Math.max(10, y - h - 30) : y) + 'px';
  }
  function draw() {
    const b = box();
    b.innerHTML = '';
    if (!items.length) { b.appendChild(L.h('div', { class: 'pm-none', text: 'Aucun élément ne correspond.' })); return; }
    let g = null;
    items.forEach((it, i) => {
      if (groups && it.g !== g) { g = it.g; b.appendChild(L.h('div', { class: 'pm-h', text: g })); }
      const el = L.h('button', { class: 'pm-item' + (i === idx ? ' act' : '') }, L.h('span', { class: 'ic', text: it.icon }), L.h('span', null, it.label));
      el.onmousedown = e => { e.preventDefault(); pick(i); };
      b.appendChild(el);
    });
    const act = b.querySelector('.act'); if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function pick(i) { const it = items[i]; hide(); if (it && onPick) onPick(it); }
  function hide() { box().hidden = true; open = false; }
  function key(e) {
    if (!open) return false;
    if (e.key === 'ArrowDown') { idx = (idx + 1) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + items.length) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { pick(idx); }
    else if (e.key === 'Escape') hide();
    else return false;
    e.preventDefault();
    return true;
  }
  return { show, hide, key, isOpen: () => open };
})();

App.runItem = function (it, afterId, into) {
  if (into && !it.action) { this.insertBlock(it.make(), { into }); return; }
  if (it.action) { it.action(); return; }
  this.insertBlock(it.make(), { after: afterId });
};

/* ================= Événements de la feuille ================= */
App.bindEditor = function () {
  const paper = L.$('#paper');

  document.addEventListener('selectionchange', () => {
    this.updatePageIndicator();
    const s = window.getSelection();
    if (!s.rangeCount) return;
    const n = s.anchorNode;
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const field = el && el.closest && el.closest('#paper [data-f]');
    if (field) {
      this.lastRange = s.getRangeAt(0).cloneRange();
      const blk = field.closest('.blk');
      if (blk) this.select(blk.dataset.id);
      const li = /^items\.(\d+)\./.exec(field.dataset.f || '');
      if (li && (this._lastItem !== field.dataset.b + ':' + li[1])) { this._lastItem = field.dataset.b + ':' + li[1]; this.updateProps(); }
      if (field.tagName === 'TD') {
        const nl = { id: field.dataset.b, r: +field.dataset.r, c: +field.dataset.c };
        const changed = !this.lastCell || this.lastCell.id !== nl.id || this.lastCell.r !== nl.r || this.lastCell.c !== nl.c;
        this.lastCell = nl;
        if (changed) this.updateProps();
      }
    }
  });

  paper.addEventListener('input', e => {
    const field = e.target.closest('[data-f]');
    if (!field) return;
    this.syncField(field);
    this.commitSoon();
    this.pagesSoon();
    const blk = field.closest('.blk');
    const type = blk && blk.dataset.type;
    if (type === 'heading' || field.dataset.b === 'meta') this.refreshAux();
    if (field.dataset.f === 'code') return;
    // « $ » ouvre l'éditeur de formule
    if (e.inputType === 'insertText' && e.data === '$') {
      document.execCommand('delete');
      this.lastRange = window.getSelection().getRangeAt(0).cloneRange();
      this.insertInlineMath();
      return;
    }
    if (type !== 'paragraph') return;
    const id = blk.dataset.id;
    const text = field.textContent.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
    const md = { '# ': 'h1', '## ': 'h2', '### ': 'h3', '- ': 'ul', '* ': 'ul', '1. ': 'ol', '1) ': 'ol', 'a) ': 'alpha' };
    if (md[text]) {
      const k = md[text];
      const nb = k[0] === 'h' ? L.newBlock('heading', { level: +k[1] })
        : L.newBlock('list', { style: k === 'ul' ? 'bullet' : k === 'ol' ? 'number' : 'alpha' });
      this.replaceBlock(id, nb);
      return;
    }
    if (text === '$$') { this.replaceBlock(id, L.newBlock('equation')); L.MathDock.open({ kind: 'block', blockId: this.sel, isNew: true }); return; }
    if (/^\/[\p{L}\- ]{0,20}$/u.test(text) && !field.querySelector('.imath,.xref,.cite,.fn')) {
      const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
      const fr = field.getBoundingClientRect();
      L.InsertMenu.show((r.left || fr.left), (r.bottom || fr.bottom) + 6, text.slice(1), it => {
        const f = L.find(this.doc, id);
        if (f) f.block.html = '';
        if (it.action) { field.innerHTML = ''; this.syncField(field); this.lastRange = null; it.action(); }
        else this.insertBlock(it.make(), { after: id });
      });
    } else L.InsertMenu.hide();
  });

  paper.addEventListener('keydown', e => {
    if (L.InsertMenu.key(e)) return;
    const field = e.target.closest && e.target.closest('[data-f]');
    if (!field) return;
    const blk = field.closest('.blk');
    const id = blk && blk.dataset.id;
    const fd = field.dataset.f;
    const f = id && !id.startsWith('__') ? L.find(this.doc, id) : null;
    const b = f && f.block;
    const mod = e.ctrlKey || e.metaKey;

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && b) { e.preventDefault(); this.moveBlock(b.id, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (mod && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace') && b) { e.preventDefault(); this.removeBlock(b.id); return; }

    if (fd === 'code') {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
      return;
    }

    if (e.key === 'Enter') {
      if (e.shiftKey && b && (b.type === 'paragraph' || b.type === 'list')) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
      e.preventDefault();
      if (!b) { // champs du titre : passer au premier bloc
        if (field.dataset.b === 'meta') { const nx = this.allFields().find(x => x.dataset.b !== 'meta'); if (nx) this.focusField(nx, 'start'); }
        return;
      }
      if (b.type === 'paragraph') {
        this.syncField(field);
        if (L.isEmptyHtml(b.html) && f.parent && f.parent.type !== 'col' && f.index === f.list.length - 1 && f.list.length > 1) {
          // Sortir de l'encadré
          f.list.splice(f.index, 1);
          const pf = L.find(this.doc, f.parent.id);
          pf.list.splice(pf.index + 1, 0, b);
          this.focusAfter = { id: b.id }; this.commit(); this.render();
          return;
        }
        const [a, t] = this.splitAtCaret(field);
        b.html = a;
        const nb = L.newBlock('paragraph', { html: t });
        f.list.splice(f.index + 1, 0, nb);
        this.sel = nb.id; this.focusAfter = { id: nb.id, where: 'start' };
        this.commit(); this.render();
      } else if (b.type === 'heading') {
        const atStart = this.caretAt(field, 'start') && !L.isEmptyHtml(b.html);
        const nb = L.newBlock('paragraph');
        if (atStart) { f.list.splice(f.index, 0, nb); this.focusAfter = { id: b.id, where: 'start' }; }
        else { const [a, t] = this.splitAtCaret(field); b.html = a; nb.html = t; f.list.splice(f.index + 1, 0, nb); this.sel = nb.id; this.focusAfter = { id: nb.id, where: 'start' }; }
        this.commit(); this.render();
      } else if (b.type === 'list') {
        const i = +fd.split('.')[1];
        const it = b.items[i];
        this.syncField(field);
        if (L.isEmptyHtml(it.html)) {
          if (it.level > 0) { it.level--; this.focusAfter = { id: b.id, f: fd }; }
          else {
            const rest = b.items.splice(i);
            rest.shift();
            const p = L.newBlock('paragraph');
            const ins = [p];
            if (rest.length) ins.push(L.newBlock('list', { style: b.style, items: rest }));
            f.list.splice(f.index + 1, 0, ...ins);
            if (!b.items.length) f.list.splice(f.index, 1);
            this.sel = p.id; this.focusAfter = { id: p.id };
          }
        } else {
          const [a, t] = this.splitAtCaret(field);
          it.html = a;
          b.items.splice(i + 1, 0, { html: t, level: it.level });
          this.focusAfter = { id: b.id, f: 'items.' + (i + 1) + '.html', where: 'start' };
        }
        this.commit(); this.render();
      } else if (field.tagName === 'TD') {
        const r = +field.dataset.r, c = +field.dataset.c;
        const nx = blk.querySelector('td[data-r="' + (r + 1) + '"][data-c="' + c + '"]');
        if (nx) this.focusField(nx, 'end');
      }
      return;
    }

    // Suppr à la fin d'une question : rattache la question suivante
    if (e.key === 'Delete' && b && b.type === 'list' && this.caretAt(field, 'end')) {
      const i = +fd.split('.')[1];
      if (i < b.items.length - 1) {
        e.preventDefault();
        this.syncField(field);
        b.items[i].html = (b.items[i].html || '') + PUA + (b.items[i + 1].html || '');
        b.items.splice(i + 1, 1);
        this.focusAfter = { id: b.id, f: 'items.' + i + '.html' };
        this.commit(); this.render();
      }
      return;
    }
    if (e.key === 'Backspace' && b && this.caretAt(field, 'start')) {
      if (b.type === 'paragraph') {
        e.preventDefault();
        this.syncField(field);
        const prev = f.index > 0 ? f.list[f.index - 1] : null;
        if (L.isEmptyHtml(b.html)) {
          if (f.parent && f.list.length === 1) { if (f.parent.type !== 'col') this.removeBlock(f.parent.id); return; }
          this.removeBlock(b.id); return;
        }
        if (prev && (prev.type === 'paragraph' || prev.type === 'heading')) {
          prev.html = (prev.html || '') + PUA + b.html;
          f.list.splice(f.index, 1);
          this.sel = prev.id; this.focusAfter = { id: prev.id, where: 'end' };
          this.commit(); this.render();
        } else if (prev && prev.type === 'list') {
          const last = prev.items[prev.items.length - 1];
          last.html = (last.html || '') + PUA + b.html;
          f.list.splice(f.index, 1);
          this.sel = prev.id; this.focusAfter = { id: prev.id, f: 'items.' + (prev.items.length - 1) + '.html' };
          this.commit(); this.render();
        } else if (prev) { this.select(prev.id); }
      } else if (b.type === 'heading') {
        e.preventDefault();
        this.syncField(field);
        this.replaceBlock(b.id, L.newBlock('paragraph', { html: PUA + b.html }));
      } else if (b.type === 'list') {
        e.preventDefault();
        this.syncField(field);
        const i = +fd.split('.')[1];
        const it = b.items[i];
        if (it.level > 0) { it.level--; this.focusAfter = { id: b.id, f: fd, where: 'start' }; }
        else if (i > 0) {
          const pv = b.items[i - 1];
          pv.html = (pv.html || '') + PUA + it.html;
          b.items.splice(i, 1);
          this.focusAfter = { id: b.id, f: 'items.' + (i - 1) + '.html' };
        } else {
          b.items.shift();
          const p = L.newBlock('paragraph', { html: PUA + it.html });
          f.list.splice(f.index, 0, p);
          if (!b.items.length) f.list.splice(f.index + 1, 1);
          this.sel = p.id; this.focusAfter = { id: p.id };
        }
        this.commit(); this.render();
      }
      return;
    }

    // Tab : menu de symboles (sauf en début d'élément de liste, où Tab décale l'élément)
    if (e.key === 'Tab' && !(b && b.type === 'list' && (e.shiftKey || this.caretAt(field, 'start')))) {
      e.preventDefault();
      if (!e.shiftKey) this.openSymbols(field);
      return;
    }
    if (e.key === 'Tab' && b && b.type === 'list') {
      e.preventDefault();
      this.syncField(field);
      const i = +fd.split('.')[1];
      const it = b.items[i];
      const max = i > 0 ? Math.min(2, (b.items[i - 1].level || 0) + 1) : 0;
      it.level = e.shiftKey ? Math.max(0, (it.level || 0) - 1) : Math.min(max, (it.level || 0) + 1);
      this.lastRange = null;
      const s = window.getSelection();
      if (s.rangeCount) { const r = s.getRangeAt(0); r.insertNode(document.createTextNode(PUA)); this.syncField(field); }
      this.focusAfter = { id: b.id, f: fd };
      this.commit(); this.render();
      return;
    }

    if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && this.caretAt(field, 'end') || (e.key === 'ArrowUp' || e.key === 'ArrowLeft') && this.caretAt(field, 'start')) {
      if (field.tagName === 'TD' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;
      const all = this.allFields();
      const i = all.indexOf(field);
      const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      const nx = all[i + (fwd ? 1 : -1)];
      if (nx) { e.preventDefault(); this.focusField(nx, fwd ? 'start' : 'end'); }
    }
  });

  paper.addEventListener('paste', e => {
    const field = e.target.closest && e.target.closest('[data-f]');
    const cd = e.clipboardData;
    const img = cd && Array.from(cd.files || []).find(x => /^image\//.test(x.type));
    if (img && field && field.tagName === 'TD') {
      e.preventDefault();
      this.lastRange = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
      this.insertInlineImage(img);
      return;
    }
    if (img) {
      e.preventDefault();
      const blk = e.target.closest && e.target.closest('.blk');
      const fig = this.insertBlock(L.newBlock('figure'), { after: blk ? blk.dataset.id : null, noPick: true });
      this.setImage(fig.id, img);
      return;
    }
    if (!field || field.dataset.f === 'code') return;
    e.preventDefault();
    let text = (cd.getData('text/plain') || '').replace(/\r/g, '');
    // Code LaTeX (texte + formules) collé : conversion en paragraphes et équations
    if (L.looksLikeLatexDoc(text) && field.dataset.b !== 'meta' && field.tagName !== 'TD') {
      const blk0 = field.closest('.blk');
      this.syncField(field);
      this.insertLatex(text, { after: blk0 ? blk0.dataset.id : null });
      return;
    }
    const blk = field.closest('.blk');
    const f = blk && L.find(this.doc, blk.dataset.id);
    const paras = text.split(/\n\s*\n/).map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    if (f && f.block.type === 'paragraph' && paras.length > 1) {
      document.execCommand('insertText', false, paras[0]);
      this.syncField(field);
      const nbs = paras.slice(1).map(t => L.newBlock('paragraph', { html: L.escHtml(t) }));
      f.list.splice(f.index + 1, 0, ...nbs);
      this.focusAfter = { id: nbs[nbs.length - 1].id, where: 'end' };
      this.commit(); this.render();
    } else {
      document.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
    }
  });

  paper.addEventListener('mousedown', e => {
    const blk = e.target.closest('.blk');
    if (blk && !e.target.closest('[data-f]')) {
      if (!blk.dataset.id.startsWith('__')) this.select(blk.dataset.id);
      else this.select(null);
    }
    if (e.target.closest('.imath, .xref, .cite, .fn, .timg, .g-add, .col-add')) e.preventDefault();
  });

  paper.addEventListener('click', e => {
    const t = e.target;
    const chip = t.closest('.imath, .xref, .cite, .fn');
    if (chip && paper.contains(chip)) {
      const field = chip.closest('[data-f]');
      if (chip.classList.contains('imath')) L.MathDock.open({ kind: 'inline', chip });
      else if (chip.classList.contains('xref')) L.dlgXref(id => { chip.dataset.ref = id; this.syncField(field); this.commit(); this.hydrateChips(); });
      else if (chip.classList.contains('cite')) L.dlgCite(id => { chip.dataset.ref = id; this.syncField(field); this.commit(); this.render(); });
      else if (chip.classList.contains('fn')) L.dlgFootnote(L.noteHtml(chip),
        v => { chip.dataset.html = v; chip.dataset.text = L.plain(v); this.syncField(field); this.commit(); this.pagesSoon(); },
        () => { chip.remove(); this.syncField(field); this.commit(); this.render(); });
      return;
    }
    const pna = t.closest('.pnote-anchor');
    if (pna) { const f = L.find(this.doc, pna.closest('.blk').dataset.id); if (f) this.editNote({ pnote: f.block.id }); return; }
    const timg = t.closest('.timg');
    if (timg && paper.contains(timg)) { this.editInlineImage(timg); return; }
    const cadd = t.closest('.col-add');
    if (cadd) {
      const r = cadd.getBoundingClientRect();
      L.InsertMenu.show(r.left, r.bottom + 4, '', it => this.runItem(it, null, cadd.dataset.col));
      return;
    }
    const add = t.closest('.g-add');
    if (add) {
      const blk = add.closest('.blk');
      const r = add.getBoundingClientRect();
      L.InsertMenu.show(r.right + 6, r.top, '', it => this.runItem(it, blk.dataset.id));
      return;
    }
    const tv = t.closest('.tvwrap');
    if (tv) { const f = L.find(this.doc, tv.closest('.blk').dataset.id); if (f) L.dlgTabvar(f.block); return; }
    const eq = t.closest('.eq');
    if (eq) { const blk = eq.closest('.blk'); L.MathDock.open({ kind: 'block', blockId: blk.dataset.id }); return; }
    const drop = t.closest('.fig-drop');
    if (drop) { this.pickImage(drop.closest('.blk').dataset.id); return; }
    const row = t.closest('.toc-row');
    if (row) { const el = this.blockEl(row.dataset.target); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (t.closest('.meta-blk') && !t.closest('[data-f]') && t.closest('.meta-blk').dataset.id === '__title') L.dlgSettings();
  });

  L.$('#desk').addEventListener('scroll', L.debounce(() => this.updatePageIndicator(), 60));
  L.$('#desk').addEventListener('mousedown', e => {
    if (e.target.id === 'desk' || e.target.id === 'deskInner') { this.select(null); L.InsertMenu.hide(); }
  });
  document.addEventListener('mousedown', e => { if (!e.target.closest('#slashMenu')) L.InsertMenu.hide(); });

  /* ---------- Glisser-déposer ---------- */
  let dragId = null;
  const clearDrop = () => L.$$('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
  const dropTarget = e => {
    let blk = e.target.closest && e.target.closest('.blk');
    if (!blk || blk.dataset.id.startsWith('__')) return null;
    const r = blk.getBoundingClientRect();
    return { blk, after: e.clientY > r.top + r.height / 2 };
  };
  paper.addEventListener('dragstart', e => {
    const h = e.target.closest && e.target.closest('.g-drag');
    if (!h) return;
    const blk = h.closest('.blk');
    dragId = blk.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    e.dataTransfer.setDragImage(blk, 20, 12);
    setTimeout(() => blk.classList.add('dragging'), 0);
  });
  paper.addEventListener('dragend', () => { dragId = null; clearDrop(); L.$$('.dragging').forEach(x => x.classList.remove('dragging')); });
  paper.addEventListener('dragover', e => {
    const files = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    if (!dragId && !files) return;
    e.preventDefault();
    clearDrop();
    const fd = e.target.closest && e.target.closest('.fig-drop');
    L.$$('.fig-drop.over').forEach(x => x.classList.remove('over'));
    if (files && fd) { fd.classList.add('over'); return; }
    const t = dropTarget(e);
    if (t) t.blk.classList.add(t.after ? 'drop-after' : 'drop-before');
  });
  paper.addEventListener('drop', e => {
    const t = dropTarget(e);
    clearDrop();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && !dragId) {
      e.preventDefault();
      const fd = e.target.closest('.fig-drop');
      if (fd) { this.setImage(fd.closest('.blk').dataset.id, file); return; }
      const fig = this.insertBlock(L.newBlock('figure'), { after: t ? t.blk.dataset.id : null, noPick: true });
      this.setImage(fig.id, file);
      return;
    }
    if (!dragId || !t) return;
    e.preventDefault();
    const src = L.find(this.doc, dragId), dst = L.find(this.doc, t.blk.dataset.id);
    if (!src || !dst || src.block === dst.block) return;
    let inside = false;
    L.walk([src.block], x => { if (x.id === dst.block.id) inside = true; });
    if (inside || ((src.block.type === 'box' || src.block.type === 'cols') && dst.parent)) return L.toast('Impossible de placer cet élément à l\'intérieur d\'un autre.');
    src.list.splice(src.index, 1);
    const d2 = L.find(this.doc, dst.block.id);
    d2.list.splice(d2.index + (t.after ? 1 : 0), 0, src.block);
    if (src.parent && !src.parent.children.length) src.parent.children.push(L.newBlock('paragraph'));
    this.sel = src.block.id;
    dragId = null;
    this.commit(); this.render();
  });
};

/* Deux colonnes préremplies : deux tableaux, deux images ou deux paragraphes */
L.newCols = function (type) {
  const c = L.newBlock('cols');
  c.children.forEach((col, i) => {
    if (type === 'table') col.children = [L.newBlock('table', {
      head: false, style: 'grille', align: ['l', 'c'], colw: ['fill', 'auto'], headColor: 'bleu', capMode: 'none',
      rows: [['Consigne', 'Check'], ['', ''], ['', ''], ['', '']],
    })];
    else if (type === 'figure') col.children = [L.newBlock('figure', { width: 90 })];
    else col.children = [L.newBlock('paragraph')];
  });
  return c;
};

/* ================= Mise en forme (barre d'outils) ================= */
Object.assign(App, {
  toggleMenu(sel) { const m = L.$(sel); const was = m.classList.contains('open'); this.closeMenus(); if (!was) m.classList.add('open'); },
  closeMenus() { L.$$('.tb .menu.open').forEach(m => m.classList.remove('open')); },
  /* Bloc(s) où se trouve le curseur */
  caretBlock() {
    const cr = this.currentRichRange();
    const blk = cr && cr.field.closest('.blk');
    return blk && !blk.dataset.id.startsWith('__') ? L.find(this.doc, blk.dataset.id) : (this.sel && !this.sel.startsWith('__') ? L.find(this.doc, this.sel) : null);
  },
  setAlign(a) {
    const f = this.caretBlock();
    if (!f || f.block.type !== 'paragraph') return L.toast('Placez le curseur dans un paragraphe.');
    const cr = this.currentRichRange();
    if (cr) { const s = window.getSelection(); if (s.rangeCount) { const r = s.getRangeAt(0); r.insertNode(document.createTextNode('\uE000')); this.syncField(cr.field); } }
    f.block.align = a;
    this.focusAfter = { id: f.block.id };
    this.commit(); this.render();
  },
  setSize(cls) {
    const cr = this.currentRichRange();
    if (!cr) return L.toast('Sélectionnez d\'abord du texte.');
    const s = window.getSelection();
    if (!s.rangeCount || !cr.field.contains(s.anchorNode)) { s.removeAllRanges(); s.addRange(cr.r); }
    const r = s.getRangeAt(0);
    if (r.collapsed) return L.toast('Sélectionnez d\'abord du texte.');
    const frag = r.extractContents();
    frag.querySelectorAll('span.s-small, span.s-large, span.s-Large, span.s-LARGE').forEach(x => x.replaceWith(...x.childNodes));
    let node = frag;
    if (cls) { const sp = document.createElement('span'); sp.className = cls; sp.appendChild(frag); node = sp; }
    r.insertNode(node);
    this.syncField(cr.field);
    this.commit(); this.pagesSoon();
  },
  toList(style) {
    const f = this.caretBlock();
    if (f && f.block.type === 'list') { f.block.style = style; this.commit(); this.render(); return; }
    if (f && f.block.type === 'paragraph') {
      const nb = L.newBlock('list', { style, items: [{ html: f.block.html || '', level: 0 }] });
      this.replaceBlock(f.block.id, nb, 'end');
      return;
    }
    this.insertBlock(L.newBlock('list', { style }));
  },
  insertHfill() {
    const cr = this.currentRichRange();
    if (!cr || !cr.field.matches('p')) return L.toast('Placez le curseur dans un paragraphe, là où la suite doit être poussée à droite.');
    const chip = L.h('span', { class: 'hfill', contenteditable: 'false' });
    this.insertChip(chip);
    this.syncField(cr.field);
    const blk = cr.field.closest('.blk');
    this.commit();
    if (blk) this.focusAfter = { id: blk.dataset.id, where: 'end' };
    this.render();
  },
  /* Question (élément de liste) où se trouve le curseur : numéro, déplacement, suppression */
  listItemRow(b, row, btn, upd) {
    const cr = this.currentRichRange();
    const fd = cr && cr.field.dataset.b === b.id ? cr.field.dataset.f : null;
    const i = fd && /^items\.(\d+)\./.test(fd) ? +fd.split('.')[1] : null;
    if (i === null || !b.items[i]) return L.h('div', { class: 'pp-help', text: 'Cliquez dans une question pour choisir son numéro, la déplacer ou la supprimer.' });
    const it = b.items[i];
    const box = L.h('div', { class: 'pp-sub' });
    const numIn = L.h('input', { type: 'number', value: it.num ?? '', placeholder: 'auto', style: { width: '80px' } });
    numIn.onchange = () => upd(() => { if (numIn.value === '') delete it.num; else it.num = Math.trunc(+numIn.value); });
    const keep = n => { this.focusAfter = { id: b.id, f: 'items.' + n + '.html', where: 'end' }; };
    if (b.style !== 'bullet') box.appendChild(row('Numéro de cette question', L.h('div', { class: 'btn-row', style: { alignItems: 'center' } }, numIn, L.h('span', { class: 'pp-help', text: 'vide = automatique ; les suivantes continuent.' }))));
    box.appendChild(L.h('div', { class: 'btn-row' },
      btn('↑', () => { if (i > 0) upd(() => { b.items.splice(i - 1, 0, b.items.splice(i, 1)[0]); keep(i - 1); }); }),
      btn('↓', () => { if (i < b.items.length - 1) upd(() => { b.items.splice(i + 1, 0, b.items.splice(i, 1)[0]); keep(i + 1); }); }),
      btn('→ Décaler', () => upd(() => { it.level = Math.min(2, (it.level || 0) + 1); keep(i); })),
      btn('← Ramener', () => upd(() => { it.level = Math.max(0, (it.level || 0) - 1); keep(i); })),
      btn('Supprimer cette question', () => {
        if (b.items.length === 1) { this.removeBlock(b.id); return; }
        upd(() => { b.items.splice(i, 1); this.lastRange = null; keep(Math.max(0, i - 1)); });
      }, 'danger')));
    return row('Question ' + (i + 1) + ' (où se trouve le curseur)', box);
  },
  /* Modifier une note depuis le bas de la feuille */
  editNote(nt) {
    if (nt.fn) {
      const chip = L.$('#paper .fn[data-n="' + nt.fn + '"]');
      if (!chip) return;
      const field = chip.closest('[data-f]');
      L.dlgFootnote(L.noteHtml(chip), v => { chip.dataset.html = v; chip.dataset.text = L.plain(v); this.syncField(field); this.commit(); this.render(); },
        () => { chip.remove(); this.syncField(field); this.commit(); this.render(); });
      return;
    }
    const f = nt.pnote && L.find(this.doc, nt.pnote);
    if (!f) return;
    L.dlgFootnote(L.pnoteHtml(f.block), v => { f.block.html = v; delete f.block.text; this.commit(); this.render(); }, () => this.removeBlock(f.block.id, false), true);
  },
  capLabelRow(b, row, kind) {
    const i = L.h('input', { type: 'text', value: b.capLabel || '', placeholder: L.capName(this.doc.meta, kind).text + ' (par défaut)' });
    i.oninput = () => { b.capLabel = i.value; this.commitSoon(); this.renderSoon(); };
    return row('Nom devant le numéro', i, L.h('div', { class: 'pp-help', text: 'Pour cet objet seulement (ex. « Graphique », « Schéma », « Photo »).' }));
  },
});
