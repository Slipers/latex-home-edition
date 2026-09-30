/* Commentaires d'un document en « Live Modification ».
   Sélectionner du texte fait apparaître « 💬 Commenter » (commentateurs,
   éditeurs, propriétaire). Les commentaires s'affichent dans un panneau à
   droite, par fils de discussion (réponses, résoudre / rouvrir, modifier,
   supprimer), et le passage commenté est surligné sur la feuille. Tout se met
   à jour en direct chez tout le monde (le serveur vérifie qui a le droit de
   faire quoi). */
(function () {
  const C = () => L.Cloud, K = () => L.Collab;
  let S = null;                  // session Live en cours
  let list = [];                 // commentaires (fils + réponses)
  let open = false, showResolved = false, active = null, draft = null;
  const rects = new Map();       // id du fil → rectangles surlignés (coordonnées de la feuille)

  const ago = t => {
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  const threads = () => list.filter(c => !c.parent);
  const replies = id => list.filter(c => c.parent === id);
  const count = () => threads().filter(t => !t.resolved).length;
  const mine = c => c.author === C().uid();
  const role = () => K().role();

  async function load() {
    if (!S) return;
    const s = S;
    try {
      const rows = await C().comments(s.id);
      if (S !== s) return;
      list = rows || [];
      if (active && !list.find(c => c.id === active)) active = null;
      render(); redraw();
      if (L.Collab.session()) L.Collab.redraw();
      paintCount();
    } catch (e) { console.warn('Commentaires', e); }
  }
  const refreshSoon = L.debounce(load, 250);
  function paintCount() { const n = L.$('#collabBar .live-cmt .n'); if (n) n.textContent = count() ? String(count()) : ''; }

  function start(session) { S = session; list = []; active = null; draft = null; load(); }
  function stop() { S = null; list = []; open = false; draft = null; active = null; const p = panel(false); if (p) p.hidden = true; clearLayer(); hideBtn(); document.body.classList.remove('cmt-open'); }

  /* ---------- Position des passages commentés ---------- */
  function locate(anchor) {
    if (!anchor || !anchor.b) return null;
    const field = K().fieldEl(anchor.b, anchor.f);
    if (!field) return null;
    const t = K().textOf(field);
    if (anchor.q && t.slice(anchor.a, anchor.h) === anchor.q) return { field, a: anchor.a, h: anchor.h };
    if (!anchor.q) return null;
    // Le texte a bougé : occurrence la plus proche de la position d'origine
    let best = -1, i = t.indexOf(anchor.q);
    while (i >= 0) { if (best < 0 || Math.abs(i - anchor.a) < Math.abs(best - anchor.a)) best = i; i = t.indexOf(anchor.q, i + 1); }
    return best >= 0 ? { field, a: best, h: best + anchor.q.length } : null;
  }
  function clearLayer() { const l = L.$('#paper > .cmt-layer'); if (l) l.remove(); rects.clear(); }
  function redraw() {
    if (!S) { clearLayer(); return; }
    const paper = L.$('#paper');
    let l = paper.querySelector(':scope > .cmt-layer');
    if (!l) { l = L.h('div', { class: 'cmt-layer', 'aria-hidden': 'true' }); paper.appendChild(l); }
    l.replaceChildren(); rects.clear();
    const pr = paper.getBoundingClientRect(), z = App.editZoom || 1;
    const all = threads().filter(t => !t.resolved || t.id === active);
    if (draft && draft.anchor) all.push({ id: '__draft', anchor: draft.anchor });
    for (const t of all) {
      const loc = locate(t.anchor);
      if (!loc) continue;
      const rs = Array.from(K().rangeAt(loc.field, loc.a, loc.h).getClientRects()).filter(r => r.width > 0.5)
        .map(r => ({ x: (r.left - pr.left) / z, y: (r.top - pr.top) / z, w: r.width / z, h: r.height / z }));
      rects.set(t.id, rs);
      rs.forEach(q => l.appendChild(L.h('div', { class: 'cmt-hl' + (t.id === active || t.id === '__draft' ? ' on' : ''), style: { left: q.x + 'px', top: q.y + 'px', width: q.w + 'px', height: q.h + 'px' } })));
    }
  }

  /* ---------- Bouton « Commenter » sur la sélection ---------- */
  let btn = null;
  function hideBtn() { if (btn) btn.hidden = true; }
  function selectionAnchor() {
    const s = window.getSelection();
    if (!s.rangeCount || s.isCollapsed) return null;
    const n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
    const field = el && el.closest && el.closest('#paper [data-b][data-f]');
    if (!field || !field.contains(s.focusNode)) return null;
    const o = K().selOffsets(field);
    if (!o || o.a === o.h) return null;
    const a = Math.min(o.a, o.h), h = Math.max(o.a, o.h);
    const q = K().textOf(field).slice(a, h);
    if (!q.trim()) return null;
    return { b: field.dataset.b, f: field.dataset.f, a, h, q: q.slice(0, 500) };
  }
  const onSel = L.debounce(() => {
    if (!S || !K().canComment()) { hideBtn(); return; }
    const anc = selectionAnchor();
    if (!anc) { hideBtn(); return; }
    const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
    if (!btn) {
      btn = L.h('button', { class: 'cmt-btn', text: '💬 Commenter', title: 'Commenter ce passage (Ctrl+Alt+M)' });
      btn.addEventListener('mousedown', e => e.preventDefault());   // garde la sélection
      btn.addEventListener('click', () => compose());
      document.body.appendChild(btn);
    }
    btn.hidden = false;
    btn.style.left = Math.min(window.innerWidth - 130, r.right + 6) + 'px';
    btn.style.top = Math.max(60, r.top - 34) + 'px';
  }, 120);
  document.addEventListener('selectionchange', onSel);
  document.addEventListener('keydown', e => {
    if (S && (e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); compose(); }
  });
  L.$ && document.addEventListener('DOMContentLoaded', () => {
    L.$('#desk').addEventListener('scroll', () => hideBtn());
    // Clic dans un passage commenté : on ouvre la discussion
    L.$('#paper').addEventListener('click', e => {
      if (!S || !rects.size) return;
      const pr = L.$('#paper').getBoundingClientRect(), z = App.editZoom || 1;
      const x = (e.clientX - pr.left) / z, y = (e.clientY - pr.top) / z;
      for (const [id, rs] of rects) if (id !== '__draft' && rs.some(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h)) { setActive(id, false); show(true); return; }
    });
  });

  function compose() {
    if (!S || !K().canComment()) return;
    const anc = selectionAnchor();
    draft = { anchor: anc };
    hideBtn();
    show(true);
    redraw();
    setTimeout(() => { const ta = L.$('#cmtPanel .cmt-new textarea'); if (ta) ta.focus(); }, 30);
  }

  /* ---------- Panneau ---------- */
  function panel(create) {
    let p = L.$('#cmtPanel');
    if (!p && create) {
      p = L.h('aside', { id: 'cmtPanel', class: 'cmt-panel', hidden: true });
      L.$('#main').appendChild(p);
    }
    return p;
  }
  function show(on) {
    open = on === undefined ? !open : on;
    const p = panel(true);
    p.hidden = !open;
    document.body.classList.toggle('cmt-open', open);
    if (open) render(); else { draft = null; redraw(); }
  }
  const toggle = () => show();
  function setActive(id, scroll) {
    active = id;
    render(); redraw();
    const t = list.find(c => c.id === id);
    const loc = t && locate(t.anchor);
    if (scroll !== false && loc) loc.field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const card = L.$('#cmtPanel [data-t="' + id + '"]');
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  /* Ordre des fils : celui du document */
  function order() {
    const pos = new Map();
    let i = 0;
    L.walk(App.doc.blocks, b => { pos.set(b.id, i++); });
    const key = t => { const a = t.anchor || {}; return (a.b === 'meta' ? -1 : pos.has(a.b) ? pos.get(a.b) : 1e9) * 1e6 + (a.a || 0); };
    return threads().slice().sort((x, y) => key(x) - key(y) || new Date(x.created_at) - new Date(y.created_at));
  }
  function avatar(c) { return L.h('span', { class: 'avatar sm', text: K().initials(c.pseudo), style: { background: K().colorOf(c.author) } }); }
  function commentEl(c, isReply) {
    const canEditBody = mine(c), canDel = mine(c) || role() === 'owner';
    const body = L.h('div', { class: 'cmt-body', text: c.body });
    const el = L.h('div', { class: 'cmt' + (isReply ? ' reply' : '') },
      L.h('div', { class: 'cmt-head' }, avatar(c), L.h('b', { text: c.pseudo || 'Anonyme' }), L.h('span', { class: 'cmt-time', text: ago(c.created_at) + (c.updated_at && new Date(c.updated_at) - new Date(c.created_at) > 5000 && !c.resolved ? ' · modifié' : '') })),
      body);
    const acts = L.h('div', { class: 'cmt-acts' });
    if (canEditBody) acts.appendChild(L.h('button', { class: 'linkish', text: 'Modifier', onclick: e => { e.stopPropagation(); editBody(c, body); } }));
    if (canDel) acts.appendChild(L.h('button', { class: 'linkish', text: 'Supprimer', onclick: async e => {
      e.stopPropagation();
      if (!confirm(isReply ? 'Supprimer cette réponse ?' : 'Supprimer ce commentaire et ses réponses ?')) return;
      try { await C().deleteComment(c.id); load(); } catch (x) { L.toast(C().fr(x), 'err'); }
    } }));
    if (acts.children.length) el.appendChild(acts);
    return el;
  }
  function editBody(c, bodyEl) {
    const ta = L.h('textarea', { class: 'cmt-ta', rows: 3 }); ta.value = c.body;
    const save = async () => {
      const v = ta.value.trim();
      if (!v) return;
      try { await C().updateComment(c.id, v); load(); } catch (x) { L.toast(C().fr(x), 'err'); }
    };
    bodyEl.replaceWith(L.h('div', { class: 'cmt-edit' }, ta, L.h('div', { class: 'cmt-row' },
      L.h('button', { class: 'btn primary small', text: 'Enregistrer', onclick: e => { e.stopPropagation(); save(); } }),
      L.h('button', { class: 'btn small', text: 'Annuler', onclick: e => { e.stopPropagation(); render(); } }))));
    ta.addEventListener('click', e => e.stopPropagation());
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); });
    ta.focus();
  }
  function threadEl(t) {
    const loc = locate(t.anchor);
    const canResolve = mine(t) || role() === 'owner' || role() === 'editor';
    const card = L.h('div', { class: 'cmt-thread' + (t.id === active ? ' on' : '') + (t.resolved ? ' done' : ''), 'data-t': t.id, onclick: () => setActive(t.id) },
      t.anchor && t.anchor.q ? L.h('div', { class: 'cmt-quote' + (loc ? '' : ' lost'), title: loc ? '' : 'Le passage commenté a été modifié ou supprimé', text: '« ' + t.anchor.q.slice(0, 140) + (t.anchor.q.length > 140 ? '…' : '') + ' »' }) : null,
      commentEl(t, false),
      ...replies(t.id).map(r => commentEl(r, true)));
    const bar = L.h('div', { class: 'cmt-row' });
    if (canResolve) bar.appendChild(L.h('button', { class: 'btn small', text: t.resolved ? 'Rouvrir' : '✓ Résoudre', onclick: async e => {
      e.stopPropagation();
      try { await C().updateComment(t.id, undefined, !t.resolved); if (!t.resolved && active === t.id) active = null; load(); } catch (x) { L.toast(C().fr(x), 'err'); }
    } }));
    if (K().canComment() && !t.resolved) {
      const ta = L.h('textarea', { class: 'cmt-ta', rows: 1, placeholder: 'Répondre…' });
      ta.addEventListener('click', e => e.stopPropagation());
      ta.addEventListener('focus', () => { ta.rows = 3; });
      const send = async () => {
        const v = ta.value.trim();
        if (!v) return;
        ta.disabled = true;
        try { await C().addComment(S.id, v, null, t.id); ta.value = ''; load(); } catch (x) { L.toast(C().fr(x), 'err'); }
        ta.disabled = false;
      };
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      card.appendChild(L.h('div', { class: 'cmt-reply' }, ta));
    }
    if (bar.children.length) card.appendChild(bar);
    return card;
  }
  function render() {
    const p = panel(false);
    if (!p || p.hidden || !S) return;
    const all = order();
    const openT = all.filter(t => !t.resolved), done = all.filter(t => t.resolved);
    const head = L.h('div', { class: 'cmt-top' },
      L.h('b', { text: 'Commentaires' }),
      L.h('button', { class: 'uc-x', title: 'Fermer', text: '×', onclick: () => show(false) }));
    const parts = [head];
    if (draft) {
      const ta = L.h('textarea', { class: 'cmt-ta', rows: 3, placeholder: 'Votre commentaire…' });
      const send = async () => {
        const v = ta.value.trim();
        if (!v) return;
        ta.disabled = true;
        try { await C().addComment(S.id, v, draft.anchor, null); draft = null; load(); }
        catch (x) { ta.disabled = false; L.toast(C().fr(x), 'err'); }
      };
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); if (e.key === 'Escape') { draft = null; render(); redraw(); } });
      parts.push(L.h('div', { class: 'cmt-new' },
        draft.anchor ? L.h('div', { class: 'cmt-quote', text: '« ' + draft.anchor.q.slice(0, 140) + (draft.anchor.q.length > 140 ? '…' : '') + ' »' }) : L.h('div', { class: 'cmt-hint', text: 'Commentaire général sur le document' }),
        ta,
        L.h('div', { class: 'cmt-row' },
          L.h('button', { class: 'btn primary small', text: 'Commenter', onclick: send }),
          L.h('button', { class: 'btn small', text: 'Annuler', onclick: () => { draft = null; render(); redraw(); } }))));
    } else if (K().canComment()) {
      parts.push(L.h('div', { class: 'cmt-hint', text: 'Sélectionnez un passage puis « 💬 Commenter » (Ctrl+Alt+M), ou ' },
        L.h('button', { class: 'linkish', text: 'commentez le document entier', onclick: () => { draft = { anchor: null }; render(); } }), '.'));
    } else {
      parts.push(L.h('div', { class: 'cmt-hint', text: 'Vous êtes Lecteur : vous voyez les commentaires sans pouvoir en ajouter.' }));
    }
    if (!openT.length && !draft) parts.push(L.h('div', { class: 'cmt-empty', text: 'Aucun commentaire ouvert.' }));
    openT.forEach(t => parts.push(threadEl(t)));
    if (done.length) {
      parts.push(L.h('button', { class: 'linkish cmt-toggle', text: (showResolved ? '▾ ' : '▸ ') + 'Résolus (' + done.length + ')', onclick: () => { showResolved = !showResolved; render(); } }));
      if (showResolved) done.forEach(t => parts.push(threadEl(t)));
    }
    p.replaceChildren(...parts);
  }

  L.Comments = { start, stop, refreshSoon, count, toggle, show, redraw, compose, _list: () => list };
})();
