/* Vérification du document : statistiques et anomalies (références cassées,
   formules incorrectes, éléments vides, images manquantes). */
(function () {

  const RICH = {
    paragraph: b => [b.html],
    heading: b => [b.html],
    list: b => (b.items || []).map(i => i.html),
    box: b => [b.title],
    table: b => [].concat(...(b.rows || []), [b.caption]),
    figure: b => [b.caption],
    pnote: b => [b.text],
  };

  const richOf = b => (RICH[b.type] ? RICH[b.type](b) : []).filter(x => typeof x === 'string');

  function texte(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    d.querySelectorAll('.imath, .xref, .cite, .fn, .timg').forEach(x => x.remove());
    return d.textContent.replace(/\s+/g, ' ').trim();
  }

  /* Analyse complète du document */
  L.checkDoc = function (doc) {
    const stats = { mots: 0, signes: 0, formules: 0, equations: 0, titres: 0, tableaux: 0, figures: 0, listes: 0, notes: 0, codes: 0, blocs: 0 };
    const pbs = [];
    const ids = new Set();
    const bib = new Set((doc.bib || []).map(b => b.id));
    L.walk(doc.blocks, b => { ids.add(b.id); });

    L.walk(doc.blocks, b => {
      stats.blocs++;
      if (b.type === 'heading') stats.titres++;
      if (b.type === 'equation') stats.equations++;
      if (b.type === 'table') stats.tableaux++;
      if (b.type === 'figure') stats.figures++;
      if (b.type === 'list') stats.listes++;
      if (b.type === 'code') stats.codes++;

      const html = richOf(b).join(' ');
      const t = texte(html);
      stats.signes += t.length;
      stats.mots += t ? t.split(/\s+/).length : 0;

      const d = document.createElement('div');
      d.innerHTML = html;
      d.querySelectorAll('.imath').forEach(x => {
        stats.formules++;
        const err = mathErreur(x.dataset.latex || '');
        if (err) pbs.push({ id: b.id, grave: true, quoi: 'Formule illisible', detail: (x.dataset.latex || '').slice(0, 60) + ' — ' + err });
      });
      d.querySelectorAll('.fn').forEach(() => stats.notes++);
      d.querySelectorAll('.xref').forEach(x => {
        if (!ids.has(x.dataset.ref)) pbs.push({ id: b.id, grave: true, quoi: 'Référence cassée', detail: 'l\'élément référencé n\'existe plus' });
      });
      d.querySelectorAll('.cite').forEach(x => {
        if (!bib.has(x.dataset.ref)) pbs.push({ id: b.id, grave: true, quoi: 'Citation inconnue', detail: 'aucune source « ' + x.dataset.ref + ' » dans la bibliographie' });
      });

      if (b.type === 'equation') {
        const err = mathErreur(b.latex || '');
        if (!String(b.latex || '').trim()) pbs.push({ id: b.id, quoi: 'Équation vide', detail: '' });
        else if (err) pbs.push({ id: b.id, grave: true, quoi: 'Équation illisible', detail: err });
      }
      if (b.type === 'figure' && !b.src) pbs.push({ id: b.id, quoi: 'Figure sans image', detail: 'cliquez sur le cadre pour choisir une image' });
      if (b.type === 'heading' && L.isEmptyHtml(b.html)) pbs.push({ id: b.id, quoi: 'Titre vide', detail: '' });
      if (b.type === 'table') {
        const n = (b.rows && b.rows[0] || []).length;
        (b.rows || []).forEach((r, i) => {
          if (r.length !== n) pbs.push({ id: b.id, quoi: 'Tableau irrégulier', detail: 'la ligne ' + (i + 1) + ' n\'a pas le même nombre de colonnes' });
        });
      }
      if (b.type === 'code' && !String(b.code || '').trim()) pbs.push({ id: b.id, quoi: 'Bloc de code vide', detail: '' });
    });

    stats.formules += stats.equations;
    return { stats, pbs };
  };

  /* KaTeX refuse-t-il cette formule ? */
  function mathErreur(latex) {
    if (!window.katex) return null;
    if (!String(latex).trim()) return 'formule vide';
    try {
      katex.renderToString(latex, { throwOnError: true, strict: false, macros: Object.assign({}, L.KATEX_MACROS) });
      return null;
    } catch (e) {
      return String(e && e.message || e).replace(/^KaTeX parse error:\s*/, '').slice(0, 90);
    }
  }

  /* ---------- Fenêtre « Vérifier le document » ---------- */
  L.dlgCheck = function () {
    const { stats, pbs } = L.checkDoc(App.doc);
    const pages = (L.lastPagination && L.lastPagination.total) || null;
    let dlg;

    const chiffre = (n, label) => L.h('div', { class: 'stat' }, L.h('b', { text: String(n) }), L.h('span', { text: label }));
    const grille = L.h('div', { class: 'stat-grid' },
      pages ? chiffre(pages, pages > 1 ? 'pages' : 'page') : null,
      chiffre(stats.mots, 'mots'),
      chiffre(stats.signes, 'signes'),
      chiffre(stats.formules, stats.formules > 1 ? 'formules' : 'formule'),
      chiffre(stats.titres, stats.titres > 1 ? 'titres' : 'titre'),
      chiffre(stats.tableaux, 'tableaux'),
      chiffre(stats.figures, 'images'),
      chiffre(stats.notes, 'notes'));

    const liste = L.h('div', { class: 'pb-list' });
    if (!pbs.length) {
      liste.appendChild(L.h('p', { class: 'pb-ok', text: '✓ Aucune anomalie détectée : références, citations et formules sont correctes.' }));
    } else {
      pbs.slice(0, 60).forEach(p => {
        const b = L.h('button', { class: 'pb' + (p.grave ? ' grave' : ''), onclick: () => { dlg.close(); aller(p.id); } },
          L.h('span', { class: 'pb-ic', text: p.grave ? '!' : '?' }),
          L.h('span', null, L.h('b', { text: p.quoi }), p.detail ? L.h('em', { text: p.detail }) : null));
        liste.appendChild(b);
      });
      if (pbs.length > 60) liste.appendChild(L.h('p', { class: 'pp-help', text: '… et ' + (pbs.length - 60) + ' autre(s).' }));
    }

    dlg = L.modal({
      title: 'Vérification du document', wide: true,
      body: L.h('div', null,
        grille,
        L.h('div', { class: 'set-h', text: pbs.length ? pbs.length + ' point(s) à vérifier' : 'Contrôles' }),
        liste,
        L.h('p', { class: 'pp-help', text: 'Cliquez sur une ligne pour aller directement à l\'élément concerné.' })),
      foot: [{ text: 'Fermer', cls: 'primary', onClick: c => c() }],
    });
  };

  function aller(id) {
    if (!L.find(App.doc, id)) return;
    App.sel = id;
    App.showPreview(false);
    App.render();
    const el = App.blockEl(id);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
  }
})();
