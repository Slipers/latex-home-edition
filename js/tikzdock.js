/* Code d'un dessin TikZ : panneau en bas de l'éditeur, comme la console Python, et non
   plus sous le dessin dans la feuille (il y prenait la place d'une demi-page et poussait
   le dessin à la page suivante). Le panneau suit le dessin TikZ sélectionné ; le dessin
   se met à jour pendant la frappe. Les dessins construits à la souris (schéma-bloc,
   TikZ visuel, schéma de Lewis) gardent l'éditeur de leur module. */
(function () {
  let dock = null, pre = null, msg = null, hint = null;
  let blockId = null;     // dessin affiché dans le panneau
  let closedFor = null;   // panneau fermé pour ce dessin : il ne se rouvre pas tout seul
  let timer = 0;

  const maxH = () => (window.innerHeight > 400 ? window.innerHeight - 240 : 600);
  const H = {
    get: () => Math.max(110, Math.min(+(L.store.get('lhe-tkd-h') || 220), maxH())),
    set: h => L.store.set('lhe-tkd-h', String(Math.round(h))),
  };
  const isCode = b => !!b && b.type === 'tikz' && !b.sb && !b.td && !b.lw;
  const blockOf = id => { const f = id && window.App && App.doc && L.find(App.doc, id); return f && isCode(f.block) ? f.block : null; };
  const figOf = id => L.$('#paper .blk[data-id="' + id + '"] .tikz');
  const ro = () => document.body.classList.contains('ro');
  const textOf = () => L.codeText(pre).replace(/\n$/, '');

  const ICO = {
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  function ic(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', 14); s.setAttribute('height', 14);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICO[name];
    return s;
  }
  const btn = (icon, title, fn) => { const b = L.h('button', { class: 'tkd-btn', title, 'aria-label': title }, ic(icon)); b.onclick = fn; return b; };

  function build() {
    dock = L.h('section', { id: 'tikzDock', class: 'tkd', 'aria-label': 'Code TikZ', hidden: true });
    dock.style.height = H.get() + 'px';
    if (L.store.get('lhe-tkd-min') === '1') dock.classList.add('min');

    // Poignée : glisser pour agrandir ou réduire le panneau
    const grip = L.h('div', { class: 'tkd-grip', title: 'Glisser pour agrandir ou réduire le panneau' });
    grip.onpointerdown = e => {
      e.preventDefault();
      const y0 = e.clientY, h0 = dock.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      dock.classList.add('resizing');
      const mv = ev => { dock.style.height = Math.max(110, Math.min(h0 + (y0 - ev.clientY), maxH())) + 'px'; };
      const up = () => { grip.removeEventListener('pointermove', mv); dock.classList.remove('resizing'); H.set(dock.offsetHeight); };
      grip.addEventListener('pointermove', mv);
      grip.addEventListener('pointerup', up, { once: true });
      grip.addEventListener('pointercancel', up, { once: true });
    };

    hint = L.h('span', { class: 'tkd-hint' });
    const minBtn = btn('down', 'Réduire le panneau', () => {
      dock.classList.toggle('min');
      const m = dock.classList.contains('min');
      L.store.set('lhe-tkd-min', m ? '1' : '0');
      minBtn.replaceChildren(ic(m ? 'up' : 'down'));
      minBtn.title = m ? 'Agrandir le panneau' : 'Réduire le panneau';
      if (!m) pre.focus({ preventScroll: true });
    });
    if (dock.classList.contains('min')) { minBtn.replaceChildren(ic('up')); minBtn.title = 'Agrandir le panneau'; }
    const head = L.h('div', { class: 'tkd-head' },
      L.h('span', { class: 'tkd-title' }, L.h('span', { class: 'tkd-logo', text: 'TikZ' }), 'Code du dessin'),
      hint, L.h('span', { class: 'tkd-flex' }), minBtn,
      btn('x', 'Fermer (le panneau revient en sélectionnant de nouveau le dessin)', close));
    // Clic sur l'en-tête réduit : on rouvre
    head.addEventListener('dblclick', e => { if (!e.target.closest('button') && dock.classList.contains('min')) minBtn.click(); });

    pre = L.h('pre', { class: 'code-edit', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-f': 'code', 'data-ph': '\\draw[->] (0,0) -- (2,1);' });
    pre.addEventListener('input', onInput);
    pre.addEventListener('keydown', onKey);
    pre.addEventListener('paste', onPaste);
    msg = L.h('div', { class: 'tkd-msg', 'aria-live': 'polite' });
    dock.append(grip, head, L.h('div', { class: 'tkd-body' }, L.h('div', { class: 'tkd-code code' }, L.codeOverlay(pre, 'latex')), msg));

    const center = L.$('#center');
    center.insertBefore(dock, L.$('#pyConsole', center) || L.$('#statusBar', center));
  }

  /* ---------- Frappe : le modèle, puis le dessin ---------- */
  function onInput() {
    if (!blockOf(blockId)) return;
    App.syncField(pre);   // b.code (data-b / data-f, comme un champ de la feuille)
    App.commitSoon();
    clearTimeout(timer);
    timer = setTimeout(redraw, 160);
  }
  function redraw() {
    const b = blockOf(blockId), el = figOf(blockId);
    if (!b || !el || !el.__draw) return;
    showMsg(el.__draw(b.code || ''));
    App.pagesSoon();
    if (App.pagesStale && App.pagesStale()) App.layoutSheets();
  }
  function showMsg(r) {
    if (!r) r = {};
    const warn = r.warnings && r.warnings.length;
    msg.className = 'tkd-msg' + (r.error ? ' err' : warn ? ' warn' : '');
    msg.textContent = r.error ? '⚠ ' + r.error : warn ? 'ℹ ' + r.warnings.join(' · ') : '';
  }
  function onKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab' && !mod && !e.altKey) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    else if (e.key === 'Escape') { e.preventDefault(); pre.blur(); }
  }
  // Collage : texte brut, d'un seul morceau (rapide même pour un long code)
  function onPaste(e) {
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (t == null || ro()) return;
    e.preventDefault();
    const s = getSelection();
    if (!s.rangeCount || !pre.contains(s.anchorNode)) return;
    const r = s.getRangeAt(0);
    r.deleteContents();
    const n = document.createTextNode(t.replace(/\r\n?/g, '\n'));
    r.insertNode(n);
    r.setStartAfter(n); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
    pre.normalize();
    pre.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  }

  /* Texte du panneau remplacé (autre dessin, annulation, modification en Live) ; le
     curseur reste au même caractère si le panneau a le clavier */
  function setText(code) {
    const focused = document.activeElement === pre;
    let at = null;
    if (focused) {
      const s = getSelection();
      if (s.rangeCount) { const r = document.createRange(); r.selectNodeContents(pre); r.setEnd(s.anchorNode, s.anchorOffset); at = r.toString().length; }
    }
    pre.textContent = code;
    pre.classList.toggle('is-empty', !code);
    if (at !== null && pre.firstChild) {
      const r = document.createRange();
      r.setStart(pre.firstChild, Math.min(at, pre.firstChild.length)); r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }

  /* ---------- Suivre la sélection (appelé à chaque mise à jour du panneau de droite) ---------- */
  function follow() {
    const id = window.App && App.sel;
    if (closedFor && closedFor !== id) closedFor = null;
    const b = blockOf(id);
    if (!b || closedFor === id) { hide(); return; }
    show(b);
  }
  function show(b, focus) {
    if (!dock) build();
    const fresh = dock.hidden || blockId !== b.id;
    if (blockId !== b.id) {
      clearTimeout(timer);
      blockId = b.id;
      pre.dataset.b = b.id;
      setText(b.code || '');
      const el = figOf(b.id);
      showMsg(el && el.__last);
    } else if (textOf() !== (b.code || '')) {
      setText(b.code || '');
      const el = figOf(b.id);
      showMsg(el && el.__last);
    }
    pre.contentEditable = ro() ? 'false' : 'plaintext-only';
    hint.textContent = ro() ? 'lecture seule' : 'le dessin suit la frappe · exemples dans le panneau de droite';
    dock.hidden = false;
    if (fresh) {
      // Le dessin reste visible au-dessus du panneau
      requestAnimationFrame(() => {
        const el = App.blockEl && App.blockEl(b.id), desk = L.$('#desk');
        if (!el || !desk) return;
        const d = desk.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (r.bottom > d.bottom || r.top < d.top) el.scrollIntoView({ block: 'nearest' });
      });
    }
    // Nouveau dessin (vide) : on écrit tout de suite
    if ((focus || (fresh && !(b.code || '').trim())) && !ro()) {
      if (dock.classList.contains('min')) { dock.classList.remove('min'); L.store.set('lhe-tkd-min', '0'); }
      pre.focus({ preventScroll: true });
    }
  }
  function hide() {
    if (!dock || dock.hidden) return;
    if (blockId && document.activeElement === pre) { App.syncField(pre); App.commit(); }
    clearTimeout(timer);
    dock.hidden = true;
    blockId = null;
  }
  function close() {
    closedFor = blockId;
    if (document.activeElement === pre) { App.syncField(pre); App.commit(); }
    hide();
  }
  /* Bouton « Code TikZ » du panneau de droite : rouvre le panneau, curseur dans le code */
  function open(id) {
    const b = blockOf(id);
    if (!b) return;
    closedFor = null;
    show(b, true);
  }

  L.TikzDock = { follow, open, isOpen: () => !!dock && !dock.hidden };
})();
