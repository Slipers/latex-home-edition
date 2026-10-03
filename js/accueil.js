/* Écran d'accueil (dans l'esprit de Google Docs) :
   « Créer un document » à partir des modèles, puis « Documents récents » — fichiers
   en ligne, documents partagés (Live), fichiers récents du PC et document en cours —
   avec aperçu de la première page, recherche, filtres, vue grille / liste et tri. */
(function () {
  const C = () => L.Cloud, D = () => L.Drive;
  const desktop = () => !!(window.lheDesktop && lheDesktop.recents);
  const pref = {
    get: (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };
  let view = pref.get('lhe-accueil-vue', 'grid');   // 'grid' | 'list'
  let sort = pref.get('lhe-accueil-tri', 'date');   // 'date' | 'name'
  let filter = 'all';
  let root = null, list = null, search = null, items = [], loading = false, token = 0;
  const docCache = new Map();

  /* ---------- Icônes (traits, couleur du texte) ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    cloud: '<path d="M17.5 19H8.5a6 6 0 1 1 5.66-8h1.34a4.5 4.5 0 1 1 2 8Z"/>',
    users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
    pen: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M14 10a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9"/><circle cx="4.5" cy="12" r=".9"/><circle cx="4.5" cy="18" r=".9"/>',
    az: '<path d="M4 15l3 4 3-4M7 19V5"/><path d="M14 11V7.5a2.5 2.5 0 0 1 5 0V11M14 9h5"/><path d="M14 14h5l-5 5h5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    back: '<path d="M11 18l-6-6 6-6"/><path d="M5 12h14"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    leave: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6a17 17 0 0 1-2.6 3.2M6.6 7.6A16.6 16.6 0 0 0 2.5 12c1 1.5 4.5 6 9.5 6a9.7 9.7 0 0 0 4-.9"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  };
  function ico(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'h-ico' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }
  // Le grand « + » du document vierge
  function plus() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('class', 'home-plus'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="6" y="21" width="18" height="6" rx="1.6" fill="#e8913a"/><rect x="21" y="24" width="6" height="18" rx="1.6" fill="#6c98dd"/>'
      + '<rect x="24" y="21" width="18" height="6" rx="1.6" fill="#2b4c7e"/><rect x="21" y="6" width="6" height="18" rx="1.6" fill="#3f6bb0"/>';
    return s;
  }

  /* ---------- Aperçu de la première page ---------- */
  const W = 794;   // largeur d'une page A4 (96 ppp)
  function pageOf(doc) {
    const pg = L.h('div', { class: 'paper home-page ' + L.pageClasses(doc.meta) });
    try { pg.appendChild(L.renderDoc(doc, 'view')); } catch (e) { /* aperçu impossible */ }
    return pg;
  }
  // Dessinée quand la carte devient visible, une à la fois (l'écran reste fluide)
  const queue = [];
  let pumping = false;
  const pump = () => {
    if (pumping || !queue.length) return;
    pumping = true;
    const job = queue.shift();
    Promise.resolve().then(job).catch(() => {}).then(() => { pumping = false; (window.requestIdleCallback || setTimeout)(pump, { timeout: 100 }); });
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target._draw) { queue.push(e.target._draw); pump(); }
  }), { rootMargin: '300px' }) : null;
  function thumb(getDoc, fallback, cls) {
    const box = L.h('div', { class: 'home-thumb' + (cls ? ' ' + cls : '') });
    const fall = () => { if (fallback) box.appendChild(fallback()); box.classList.add('ready'); };
    if (!getDoc) { fall(); return box; }
    box._draw = async () => {
      if (!root || root.hidden || !box.isConnected) return;
      let doc = null;
      try { doc = await getDoc(); } catch (e) { doc = null; }
      if (!doc || !box.isConnected) return fall();
      const pg = pageOf(doc);
      const sc = L.h('div', { class: 'home-scale' }, pg);
      box.appendChild(sc);
      // On rogne une partie des (larges) marges LaTeX : l'aperçu est plus lisible
      const cs = getComputedStyle(pg);
      const cx = (parseFloat(cs.paddingLeft) || 0) * 0.55, cy = (parseFloat(cs.paddingTop) || 0) * 0.45;
      const k = (box.clientWidth || 160) / (W - 2 * cx);
      sc.style.transform = 'scale(' + k + ') translate(' + (-cx) + 'px, ' + (-cy) + 'px)';
      requestAnimationFrame(() => box.classList.add('ready'));
    };
    if (io) io.observe(box); else { queue.push(box._draw); pump(); }
    return box;
  }
  const cached = (key, fn) => () => { if (!docCache.has(key)) docCache.set(key, Promise.resolve().then(fn).catch(() => null)); return docCache.get(key); };
  const placeholder = (icon, text) => () => L.h('div', { class: 'home-ph' }, ico(icon, 'big'), text ? L.h('span', { text }) : null);

  /* ---------- Ne rien perdre en changeant de document ---------- */
  const docLabel = () => (App.fileName || L.plain(App.doc.meta.title) || 'Sans titre').replace(/\.(lhe|json)$/i, '');
  async function canLeave() {
    if (!App.doc) return true;
    if (D() && D().linked() && !(await D().flush()))
      return confirm('Les dernières modifications de « ' + docLabel() + ' » n\'ont pas pu être envoyées en ligne (pas de connexion ?). Ouvrir un autre document quand même ? (Une copie reste dans la sauvegarde automatique de l\'ordinateur.)');
    if (App.dirty && !(L.Collab && L.Collab.active()) && !(D() && D().linked()))
      return confirm('Le document en cours (« ' + docLabel() + ' ») contient des modifications non enregistrées. Ouvrir un autre document quand même ?\n\nPour le garder : Annuler, puis « Enregistrer » ou « ☁ Mes fichiers ».');
    return true;
  }

  /* ---------- Créer un document ---------- */
  const SUB = { vierge: 'Page blanche', 'tp-vierge': 'Page de garde à remplir', tp: 'Exemple complet', exos: 'Banque de fiches', cours: 'Cours structuré', article: 'Article scientifique', controle: 'Banque de sujets' };
  const NAME = { vierge: 'Document vierge', 'tp-vierge': 'Compte rendu de TP', tp: 'Compte rendu de TP', exos: 'Feuille d\'exercices', cours: 'Cours de maths', article: 'Article', controle: 'Contrôle' };
  function templateCards() {
    return L.TEMPLATES.map(t => {
      const isBlank = t.id === 'vierge';
      const th = isBlank ? L.h('div', { class: 'home-thumb home-blank ready' }, plus()) : thumb(cached('tpl:' + t.id, () => t.make()));
      if (t.bank) th.appendChild(L.h('span', { class: 'home-badge' }, ico('book'), 'Banque'));
      const c = L.h('button', { class: 'home-tpl', title: t.name + ' — ' + t.desc }, th,
        L.h('b', { text: NAME[t.id] || t.name }), L.h('span', { text: SUB[t.id] || t.desc.split(/[.:(]/)[0] }));
      c.onclick = async () => {
        if (t.bank) { L.dlgBank(t.bank); return; }
        if (!(await canLeave())) return;
        App.load(t.make(), null);
        App.fileName = null; App.updateName();
        hide();
      };
      return c;
    });
  }

  /* Les modèles sur une seule rangée ; s'ils ne tiennent pas, flèches de défilement */
  function tplRow() {
    const track = L.h('div', { class: 'home-tpls' }, ...templateCards());
    const prev = L.h('button', { class: 'home-arrow l', title: 'Modèles précédents', 'aria-label': 'Modèles précédents' }, ico('back'));
    const next = L.h('button', { class: 'home-arrow r', title: 'Modèles suivants', 'aria-label': 'Modèles suivants' }, ico('back'));
    const wrap = L.h('div', { class: 'home-tpl-row' }, prev, track, next);
    const step = () => Math.max(150, track.clientWidth * 0.8);
    prev.onclick = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
    next.onclick = () => track.scrollBy({ left: step(), behavior: 'smooth' });
    const upd = () => {
      const max = track.scrollWidth - track.clientWidth;
      wrap.classList.toggle('can-l', track.scrollLeft > 12);
      wrap.classList.toggle('can-r', track.scrollLeft < max - 12);
    };
    track.addEventListener('scroll', upd, { passive: true });
    // Molette verticale → défilement horizontal de la rangée
    track.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || track.scrollWidth <= track.clientWidth) return;
      const max = track.scrollWidth - track.clientWidth;
      if ((e.deltaY < 0 && track.scrollLeft <= 0) || (e.deltaY > 0 && track.scrollLeft >= max)) return;
      e.preventDefault(); track.scrollLeft += e.deltaY;
    }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(upd).observe(track);
    setTimeout(upd, 50);
    return wrap;
  }

  /* ---------- Documents récents ---------- */
  async function collect() {
    const out = [];
    const curFile = D() && D().linked() && D().link();
    const curLive = L.Collab && L.Collab.active() && L.Collab.session();
    if (App.doc) {
      const snap = JSON.parse(JSON.stringify(App.doc));
      out.push({ kind: 'current', name: docLabel(), t: Date.now(), doc: () => snap,
        where: curLive ? 'Partagé (Live)' : curFile ? 'Mes fichiers en ligne' : App.filePath ? 'Sur ce PC' : 'Pas encore enregistré',
        shared: !!curLive });
    }
    const jobs = [];
    if (D() && D().available()) {
      jobs.push(D().list().then(fs => fs.filter(f => !f.deleted_at && !(curFile && curFile.id === f.id)).forEach(f => out.push({
        kind: 'file', id: f.id, name: f.name, t: Date.parse(f.updated_at), where: 'Mes fichiers en ligne', owner: 'Moi',
        doc: cached('file:' + f.id + ':' + f.version, () => D().fetchDoc(f.id)),
      }))).catch(e => { out.err = D().frErr(e); }));
      jobs.push(C().myDocs().then(ds => ds.filter(d => !(curLive && curLive.id === d.id)).forEach(d => out.push({
        kind: 'live', id: d.id, name: d.title || 'Sans titre', t: Date.parse(d.updated_at), d, shared: true,
        where: 'Partagé (Live)', owner: d.is_owner ? 'Moi' : (d.owner_pseudo || '?'),
      }))).catch(() => {}));
    }
    if (desktop()) {
      jobs.push(lheDesktop.recents().then(rs => rs.filter(r => r.path !== App.filePath).forEach(r => out.push({
        kind: 'pc', path: r.path, name: r.name.replace(/\.(lhe|json)$/i, ''), t: Math.max(r.mtime || 0, r.at || 0), where: 'Sur ce PC', owner: 'Ce PC',
        doc: cached('pc:' + r.path + ':' + r.mtime, async () => {
          const tx = await lheDesktop.peekRecent(r.path);
          const d = tx && JSON.parse(tx);
          return d && d.blocks && d.meta ? L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} }) : null;
        }),
      }))).catch(() => {}));
    }
    await Promise.all(jobs);
    return out;
  }

  const KIND = {
    current: { icon: 'pen', label: 'Document ouvert' },
    file: { icon: 'cloud', label: 'Dans vos fichiers en ligne' },
    live: { icon: 'users', label: 'Document partagé (Live Modification)' },
    pc: { icon: 'laptop', label: 'Sur ce PC' },
  };
  const day0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function when(t) {
    const d = new Date(t);
    if (t >= day0()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function groupOf(t) {
    const d = day0();
    if (t >= d) return 'Aujourd\'hui';
    if (t >= d - 6 * 864e5) return '7 derniers jours';
    if (t >= d - 29 * 864e5) return '30 derniers jours';
    return 'Plus ancien';
  }
  const ROLE = { owner: 'Propriétaire', editor: 'Éditeur', commenter: 'Commentateur', viewer: 'Lecteur' };
  const sharedTag = it => it.shared ? L.h('span', { class: 'shared-tag', text: 'Fichier partagé',
    title: it.d && !it.d.is_owner ? 'Partagé avec vous par ' + (it.d.owner_pseudo || '?') + ' — votre rôle : ' + (ROLE[it.d.role] || '') : 'Document modifié à plusieurs (Live Modification)' }) : null;
  const typeIcon = it => L.h('span', { class: 'home-kind k-' + it.kind, title: KIND[it.kind].label }, ico(KIND[it.kind].icon));
  const metaText = it => it.kind === 'current' ? it.where : it.kind === 'live' && !it.d.is_owner ? it.owner + ' · ' + when(it.t) : when(it.t);

  function bindOpen(el, it, nameEl, moreBtn) {
    el.addEventListener('click', e => { if (e.target.closest('.home-more, input')) return; openItem(it); });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); openItem(it); } });
    el.addEventListener('contextmenu', e => { e.preventDefault(); menu(it, moreBtn, nameEl, e); });
    moreBtn.addEventListener('click', e => { e.stopPropagation(); menu(it, moreBtn, nameEl); });
  }
  function card(it, i) {
    const nameEl = L.h('b', { text: it.name });
    const more = L.h('button', { class: 'home-more', title: 'Plus d\'actions', 'aria-label': 'Plus d\'actions' }, ico('more'));
    const th = thumb(it.doc || null, placeholder(it.kind === 'live' ? 'users' : 'pen', it.kind === 'live' ? 'Document partagé' : ''));
    if (it.kind === 'current') th.appendChild(L.h('span', { class: 'home-ribbon', text: 'Ouvert' }));
    const c = L.h('div', { class: 'home-doc' + (it.kind === 'current' ? ' cur' : ''), tabindex: '0', role: 'button', title: it.kind === 'pc' ? it.path : it.name },
      th,
      L.h('div', { class: 'home-doc-i' }, nameEl,
        L.h('div', { class: 'home-doc-m' }, typeIcon(it), sharedTag(it), L.h('span', { class: 'home-when', text: metaText(it) }), more)));
    c.style.setProperty('--i', Math.min(i, 14));
    bindOpen(c, it, nameEl, more);
    return c;
  }
  function row(it, i) {
    const nameEl = L.h('b', { text: it.name });
    const more = L.h('button', { class: 'home-more', title: 'Plus d\'actions', 'aria-label': 'Plus d\'actions' }, ico('more'));
    const r = L.h('div', { class: 'home-row' + (it.kind === 'current' ? ' cur' : ''), tabindex: '0', role: 'button', title: it.kind === 'pc' ? it.path : it.name },
      L.h('div', { class: 'home-row-n' }, typeIcon(it), nameEl, sharedTag(it), it.kind === 'current' ? L.h('span', { class: 'home-pill', text: 'Ouvert' }) : null),
      L.h('div', { class: 'home-row-o', text: it.kind === 'current' ? it.where : it.owner }),
      L.h('div', { class: 'home-row-d', text: it.kind === 'current' ? 'maintenant' : when(it.t) }),
      more);
    r.style.setProperty('--i', Math.min(i, 14));
    bindOpen(r, it, nameEl, more);
    return r;
  }

  async function openItem(it) {
    closeMenu();
    if (it.kind === 'current') return hide();
    if (!(await canLeave())) return;
    if (it.kind === 'file') { if (await D().openFile(it.id) !== false) hide(); return; }
    if (it.kind === 'live') { await L.openLiveDoc(it.id); return; }   // App.load ferme l'accueil
    if (it.kind === 'pc') {
      const r = await lheDesktop.openRecent(it.path);
      if (!r) { L.toast('Ce fichier est introuvable : déplacé, renommé ou supprimé en dehors de l\'application.', 'err'); refresh(); return; }
      App.openText(r.text, r.name, null, r.path);
    }
  }

  /* ---------- Menu « ⋮ » (et clic droit) ---------- */
  function menu(it, anchor, nameEl, ev) {
    closeMenu();
    const A = [];
    const add = (icon, text, fn, cls, sub) => A.push({ icon, text, fn, cls, sub });
    add('open', it.kind === 'current' ? 'Reprendre' : 'Ouvrir', () => openItem(it));
    if (it.kind === 'current') add('pen', 'Renommer', () => { hide(); setTimeout(() => D().startRenameCurrent(), 60); });
    if (it.kind === 'file') {
      add('pen', 'Renommer', () => D().inlineEdit(nameEl, it.name, async n => { const r = await D().renameFile(it.id, n); if (r.name !== n) L.toast('Ce nom est déjà pris : renommé « ' + r.name + ' »'); docCache.clear(); refresh(); }));
      add('trash', 'Mettre à la corbeille', async () => {
        if (!confirm('Mettre « ' + it.name + ' » à la corbeille ? Vous pourrez le restaurer pendant 30 jours depuis « Mes fichiers ».')) return;
        try { await D().trashFile(it.id); refresh(); } catch (e) { L.toast(D().frErr(e), 'err'); }
      }, 'danger');
    }
    if (it.kind === 'live') {
      if (it.d.role === 'owner' || it.d.role === 'editor') add('pen', 'Renommer', () => D().inlineEdit(nameEl, it.name, async n => { await C().renameDoc(it.id, n); refresh(); }));
      if (it.d.is_owner) add('trash', 'Supprimer pour tout le monde', async () => {
        if (!confirm('Supprimer « ' + it.name + ' » ? Ce document partagé disparaîtra pour toutes les personnes invitées, sans passer par la corbeille.')) return;
        try { await C().deleteDoc(it.id); refresh(); } catch (e) { L.toast(C().fr(e), 'err'); }
      }, 'danger');
      else add('leave', 'Quitter le document', async () => {
        if (!confirm('Quitter « ' + it.name + ' » ? Vous n\'y aurez plus accès, sauf nouvelle invitation.')) return;
        try { await C().removeMember(it.id, C().email()); refresh(); } catch (e) { L.toast(C().fr(e), 'err'); }
      });
    }
    if (it.kind === 'pc') add('hide', 'Retirer de la liste', async () => { await lheDesktop.forgetRecent(it.path); refresh(); }, null, 'Le fichier reste sur le PC');
    add('folder', 'Tous mes fichiers en ligne…', () => D().dialog());
    const m = L.h('div', { class: 'home-menu', role: 'menu' }, ...A.map(a => L.h('button', { class: a.cls || '', role: 'menuitem', onclick: e => { e.stopPropagation(); closeMenu(); a.fn(); } },
      ico(a.icon), L.h('span', null, a.text, a.sub ? L.h('small', { text: a.sub }) : null))));
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const x = ev ? ev.clientX : r.right - m.offsetWidth, y = ev ? ev.clientY : r.bottom + 4;
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, x)) + 'px';
    m.style.top = Math.max(8, Math.min(window.innerHeight - m.offsetHeight - 8, y)) + 'px';
    const first = m.querySelector('button'); if (first) first.focus();
    m.addEventListener('keydown', e => {
      const bs = [...m.querySelectorAll('button')], k = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(k + 1) % bs.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(k - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); anchor.focus(); }
    });
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  }
  const outside = e => { if (!e.target.closest('.home-menu')) closeMenu(); };
  function closeMenu() { L.$$('.home-menu').forEach(m => m.remove()); document.removeEventListener('mousedown', outside, true); }

  /* ---------- Liste des récents ---------- */
  function visibleItems() {
    const q = (search.value || '').trim().toLowerCase();
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const nq = norm(q);
    const out = items.filter(it => (!q || norm(it.name).includes(nq)) &&
      (filter === 'all' || (filter === 'online' && it.kind === 'file') || (filter === 'shared' && it.kind === 'live') || (filter === 'pc' && it.kind === 'pc') || (it.kind === 'current' && !q && filter === 'all')));
    return out.sort((a, b) => (a.kind === 'current') !== (b.kind === 'current') ? (a.kind === 'current' ? -1 : 1)
      : sort === 'name' ? a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }) : b.t - a.t);
  }
  function paintList() {
    if (!list) return;
    const vis = visibleItems();
    const logged = D() && D().available();
    const kids = [];
    if (!logged) kids.push(L.h('div', { class: 'home-banner' },
      L.h('span', { class: 'home-banner-ic' }, ico('cloud')),
      L.h('div', { class: 'home-banner-t' }, L.h('b', { text: 'Retrouvez vos documents partout' }),
        L.h('span', { text: 'Connectez-vous pour voir ici vos fichiers en ligne et les documents partagés avec vous, depuis n\'importe quel ordinateur.' })),
      L.h('button', { class: 'btn', text: 'Créer un compte', onclick: () => L.dlgAuth('signup', () => refresh()) }),
      L.h('button', { class: 'btn primary', text: 'Se connecter', onclick: () => L.dlgAuth('login', () => refresh()) })));
    if (items.err) kids.push(L.h('div', { class: 'home-note', text: items.err }));
    if (view === 'list') {
      const box = L.h('div', { class: 'home-table' },
        L.h('div', { class: 'home-row head' }, L.h('div', { text: 'Nom' }), L.h('div', { text: 'Propriétaire / emplacement' }), L.h('div', { text: sort === 'name' ? 'Modifié' : 'Dernière modification' }), L.h('div')));
      let g = null, i = 0;
      vis.forEach(it => {
        const gg = sort === 'date' ? (it.kind === 'current' ? 'Document ouvert' : groupOf(it.t)) : null;
        if (gg && gg !== g) { g = gg; box.appendChild(L.h('div', { class: 'home-group', text: g })); }
        box.appendChild(row(it, i++));
      });
      if (loading) for (let k = 0; k < 3; k++) box.appendChild(L.h('div', { class: 'home-row skel' }, L.h('div', null, L.h('i')), L.h('div', null, L.h('i')), L.h('div', null, L.h('i')), L.h('div')));
      kids.push(box);
    } else {
      const grid = L.h('div', { class: 'home-grid' }, ...vis.map(card));
      if (loading) for (let k = 0; k < 4; k++) grid.appendChild(L.h('div', { class: 'home-doc skel' }, L.h('div', { class: 'home-thumb' }), L.h('div', { class: 'home-doc-i' }, L.h('i'), L.h('i'))));
      kids.push(grid);
    }
    const others = vis.filter(it => it.kind !== 'current').length;
    if (!loading && !others) {
      const q = search.value.trim();
      kids.push(L.h('div', { class: 'home-empty' },
        emptyArt(),
        L.h('b', { text: q ? 'Aucun résultat pour « ' + q + ' »' : filter === 'shared' ? 'Aucun document partagé' : filter === 'online' ? 'Aucun fichier en ligne' : filter === 'pc' ? 'Aucun fichier récent sur ce PC' : 'Pas encore d\'autre document' }),
        L.h('span', { text: q ? 'Essayez un autre mot, ou changez de filtre.'
          : filter === 'shared' ? 'Les documents en Live Modification (les vôtres et ceux auxquels on vous invite) apparaissent ici.'
            : filter === 'pc' ? 'Les fichiers que vous ouvrez ou enregistrez sur cet ordinateur apparaissent ici.'
              : 'Créez un document à partir d\'un modèle ci-dessus, ou ouvrez un fichier.' })));
    }
    list.replaceChildren(...kids);
  }
  function emptyArt() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 120 90'); s.setAttribute('class', 'home-empty-art'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="30" y="14" width="46" height="62" rx="4" class="a1" transform="rotate(-8 53 45)"/>'
      + '<rect x="44" y="10" width="46" height="62" rx="4" class="a2"/>'
      + '<path d="M53 26h28M53 34h28M53 42h20" class="a3"/><text x="58" y="62" class="a4">∑</text>';
    return s;
  }
  async function refresh() {
    if (!root || root.hidden) return;
    const my = ++token;
    paintTop();
    loading = true;
    // Le document en cours s'affiche tout de suite ; le reste arrive ensuite
    if (!items.length && App.doc) items = [{ kind: 'current', name: docLabel(), t: Date.now(), doc: (s => () => s)(JSON.parse(JSON.stringify(App.doc))), where: '' }];
    paintList();
    const got = await collect();
    if (my !== token) return;
    items = got; loading = false;
    paintList();
  }

  /* ---------- Barre du haut ---------- */
  function paintTop() {
    const acc = root.querySelector('.home-acc'), back = root.querySelector('.home-back');
    const u = C() && C().available() && C().user();
    acc.replaceChildren(u
      ? L.h('span', { class: 'home-avatar', text: L.Collab.initials(C().pseudo()), style: { background: L.Collab.colorOf(C().uid()) } })
      : L.h('span', { class: 'home-login' }, ico('user'), 'Se connecter'));
    acc.classList.toggle('logged', !!u);
    acc.title = u ? C().pseudo() + ' — ' + C().email() + '\nGérer le compte' : 'Se connecter ou créer un compte';
    acc.onclick = () => (u ? L.dlgAccount() : L.dlgAuth('login', () => refresh()));
    back.hidden = !App.doc;
    back.querySelector('.home-back-n').textContent = App.doc ? docLabel() : '';
  }
  function seg(values, cur, onPick, cls) {
    const box = L.h('div', { class: 'home-seg ' + (cls || ''), role: 'tablist' });
    values.forEach(([v, label, icon]) => {
      const b = L.h('button', { class: v === cur ? 'on' : '', role: 'tab', 'aria-selected': String(v === cur), title: label }, icon ? ico(icon) : null, icon && cls === 'icons' ? null : label);
      b.onclick = () => { box.querySelectorAll('button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); }); b.classList.add('on'); b.setAttribute('aria-selected', 'true'); onPick(v); };
      box.appendChild(b);
    });
    return box;
  }
  function build() {
    search = L.h('input', { type: 'search', placeholder: 'Rechercher dans vos documents', 'aria-label': 'Rechercher dans vos documents', spellcheck: 'false' });
    const clear = L.h('button', { class: 'home-clear', title: 'Effacer', 'aria-label': 'Effacer la recherche', hidden: true }, ico('x'));
    search.oninput = () => { clear.hidden = !search.value; paintList(); };
    search.onkeydown = e => {
      if (e.key === 'Enter') { const v = visibleItems().find(it => it.kind !== 'current') || visibleItems()[0]; if (v) openItem(v); }
      else if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; clear.hidden = true; paintList(); }
    };
    clear.onclick = () => { search.value = ''; clear.hidden = true; paintList(); search.focus(); };
    list = L.h('div', { class: 'home-list' });
    const filters = [['all', 'Tous'], ['online', 'En ligne'], ['shared', 'Partagés']];
    if (desktop()) filters.push(['pc', 'Sur ce PC']);
    const chip = (icon, text, fn, title) => L.h('button', { class: 'home-chip', title: title || text, onclick: fn }, ico(icon), text);
    root = L.h('div', { id: 'home', hidden: true, role: 'dialog', 'aria-label': 'Accueil de LaTeX Home Edition' },
      L.h('header', { class: 'home-top' },
        L.h('div', { class: 'home-brand' }, L.h('span', { class: 'logo', text: '∑' }), L.h('span', { class: 'home-brand-n' }, 'LaTeX ', L.h('b', { text: 'Home' }), L.h('small', { text: 'Edition' }))),
        L.h('label', { class: 'home-search' }, ico('search'), search, clear),
        L.h('div', { class: 'home-top-r' },
          L.h('button', { class: 'home-back', title: 'Revenir au document ouvert (Échap)', onclick: () => hide() }, ico('back'), L.h('span', { class: 'home-back-l', text: 'Reprendre' }), L.h('span', { class: 'home-back-n' })),
          L.h('button', { class: 'home-acc' }))),
      L.h('div', { class: 'home-scroll' },
        L.h('section', { class: 'home-create' }, L.h('div', { class: 'home-wrap' },
          L.h('div', { class: 'home-h' }, L.h('h2', { text: 'Créer un document' }),
            L.h('div', { class: 'home-chips' },
              chip('folder', 'Ouvrir du PC', async () => { if (await canLeave()) App.open(); }, 'Ouvrir un fichier .lhe de l\'ordinateur (Ctrl+O)'),
              chip('link', 'Lien reçu', () => L.dlgOpenShare(), 'Ouvrir un lien de partage qu\'on vous a envoyé'),
              chip('cloud', 'Mes fichiers', () => D().dialog(), 'Tous vos fichiers en ligne, corbeille comprise (Ctrl+Maj+O)'))),
          tplRow())),
        L.h('section', { class: 'home-recent' }, L.h('div', { class: 'home-wrap' },
          L.h('div', { class: 'home-h' }, L.h('h2', { text: 'Documents récents' }),
            L.h('div', { class: 'home-tools' },
              seg(filters, filter, v => { filter = v; paintList(); }),
              L.h('span', { class: 'home-sep' }),
              seg([['date', 'Trier par date', 'clock'], ['name', 'Trier par nom (A → Z)', 'az']], sort, v => { sort = v; pref.set('lhe-accueil-tri', v); paintList(); }, 'icons'),
              seg([['grid', 'Vue grille', 'grid'], ['list', 'Vue liste', 'list']], view, v => { view = v; pref.set('lhe-accueil-vue', v); paintList(); }, 'icons'))),
          list))));
    document.body.appendChild(root);
    root.addEventListener('keydown', e => {
      if (!L.$('#modal').hidden) return;
      if (e.key === 'Escape' && !L.$('.home-menu') && !e.target.closest('input')) { e.preventDefault(); if (App.doc) hide(); }
      else if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); search.focus(); }
    });
  }

  function show() {
    if (!root) build();
    closeMenu();
    if (App.closeMenus) App.closeMenus();
    if (L.MathDock) L.MathDock.cancel();
    root.hidden = false;
    document.body.classList.add('home-on');
    search.value = ''; root.querySelector('.home-clear').hidden = true;
    items = [];
    root.querySelector('.home-scroll').scrollTop = 0;
    refresh();
    setTimeout(() => { if (!root.hidden && L.$('#modal').hidden) search.focus({ preventScroll: true }); }, 60);
  }
  function hide() {
    if (!root || root.hidden) return;
    closeMenu();
    root.hidden = true;
    document.body.classList.remove('home-on');
    token++;
    if (App.layoutSheets) requestAnimationFrame(() => App.layoutSheets());
  }

  // Connexion / déconnexion pendant que l'accueil est affiché
  document.addEventListener('DOMContentLoaded', () => { if (C()) C().onChange(() => { if (root && !root.hidden) refresh(); }); });

  L.Home = { show, hide, refresh, visible: () => !!root && !root.hidden };
})();
