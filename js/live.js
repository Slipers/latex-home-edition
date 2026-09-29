/* Mises à jour des documents partagés (voir js/share.js).
   - Côté auteur (meta.share + code gardé sur cet ordinateur) : en mode
     « direct », chaque modification est envoyée sur le lien quelques secondes
     après la frappe ; en mode « figé », seulement sur demande. Une pastille
     en haut indique l'état (à jour, envoi, hors ligne…).
   - Côté destinataire (meta.sharedFrom) : l'application vérifie
     régulièrement si l'auteur a envoyé une version plus récente et le propose
     dans une carte discrète en bas à gauche. */
(function () {
  const S = () => L.Share;
  const DEBOUNCE = 3000;          // attente après la dernière modification
  const BIG = 1000000;            // au-delà (images), un envoi toutes les 30 s au plus
  const POLL = 45000;             // vérification des nouvelles versions

  /* Empreinte du contenu (hors liens de partage) : sert à savoir s'il y a
     quelque chose de nouveau à envoyer, et si le destinataire a modifié sa copie */
  function hash(doc) {
    const meta = Object.assign({}, doc.meta);
    delete meta.share; delete meta.sharedFrom;
    const s = JSON.stringify({ meta, blocks: doc.blocks, bib: doc.bib });
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + '.' + s.length;
  }

  /* ================= Auteur ================= */
  const st = { busy: false, err: null, timer: null, lastSend: 0, lastSize: 0, again: false };
  const listeners = new Set();
  const emit = () => { paintPill(); listeners.forEach(f => { try { f(); } catch (e) { /* fenêtre fermée */ } }); };
  const owner = () => {
    const sh = App.doc && App.doc.meta.share;
    const e = sh && S().entryOf(sh.id);
    return sh && e ? { sh, e } : null;
  };
  const upToDate = o => o.e.hash === hash(App.doc);

  function ownerState() {
    const o = owner();
    if (!o) return { kind: 'none', text: '' };
    if (st.busy) return { kind: 'busy', text: 'Envoi de la nouvelle version…' };
    if (st.err) return { kind: 'err', text: st.err };
    if (upToDate(o)) return { kind: 'ok', text: 'À jour · version ' + (o.e.v || 1) + ' envoyée ' + S().ago(o.e.sentAt || o.e.at) };
    return o.sh.live
      ? { kind: 'busy', text: 'Modifications en attente d\'envoi…' }
      : { kind: 'wait', text: 'Vos dernières modifications ne sont pas encore partagées' };
  }

  async function publish(force) {
    clearTimeout(st.timer); st.timer = null;
    const o = owner();
    if (!o) return;
    if (!force && !o.sh.live) { emit(); return; }
    if (st.busy) { st.again = true; return; }
    const h = hash(App.doc);
    if (o.e.hash === h) { st.err = null; emit(); return; }
    st.busy = true; st.err = null; emit();
    try {
      const payload = await S().pack(await S().docData(!!o.sh.light));
      st.lastSize = payload.length;
      const r = await S().rpc('update_share', { p_id: o.sh.id, p_token: o.e.token, p_payload: payload, p_title: L.plain(App.doc.meta.title) || 'Sans titre', p_live: !!o.sh.live });
      S().setEntry(o.sh.id, { v: r.version, sentAt: r.updated_at, hash: h, title: L.plain(App.doc.meta.title) || 'Sans titre' });
      st.lastSend = Date.now();
    } catch (e) {
      if (e.code === 'LHE_NOTFOUND') {
        // Lien désactivé ailleurs (autre ordinateur, expiration) : on l'oublie
        S().setEntry(o.sh.id, { gone: true });
        st.err = 'Ce lien a été désactivé : les modifications ne sont plus partagées.';
      } else if (e.code === 'LHE_RATE') {
        st.busy = false; schedule(5000); return;
      } else {
        st.err = e.offline ? 'Hors ligne : les modifications seront envoyées dès le retour de la connexion' : e.message;
        schedule(30000);
      }
    }
    st.busy = false;
    emit();
    if (st.again) { st.again = false; schedule(DEBOUNCE); }
  }
  function schedule(ms) {
    clearTimeout(st.timer);
    const o = owner();
    if (!o || !o.sh.live) { emit(); return; }
    let wait = ms === undefined ? DEBOUNCE : ms;
    if (st.lastSize > BIG) wait = Math.max(wait, st.lastSend + 30000 - Date.now());
    st.timer = setTimeout(() => publish(false), Math.max(500, wait));
    emit();
  }
  /* Appelé à chaque modification du document */
  function changed() {
    const o = owner();
    if (!o) return;
    if (o.sh.live) schedule(); else emit();
  }

  /* Pastille d'état à côté du nom du document */
  function paintPill() {
    const pill = L.$('#shareStatus');
    if (!pill) return;
    const o = owner();
    if (!o) { pill.hidden = true; return; }
    const s = ownerState();
    pill.hidden = false;
    pill.className = 'share-pill ' + s.kind + (o.sh.live ? ' live' : '');
    pill.textContent = o.sh.live
      ? (s.kind === 'ok' ? '● En direct · à jour' : s.kind === 'err' ? '● En direct · non envoyé' : '● En direct · envoi…')
      : (s.kind === 'ok' ? 'Partagé · version figée' : s.kind === 'err' ? 'Partagé · erreur d\'envoi' : 'Partagé · modifications non envoyées');
    pill.title = s.text + ' — cliquer pour gérer le partage';
  }

  /* ================= Destinataire ================= */
  const rc = { timer: null, lastCheck: 0, dismissed: 0, info: null, checking: false };
  const src = () => App.doc && App.doc.meta.sharedFrom;

  // Hors de l'écran (fenêtre réduite…), on ne vérifie pas, sauf demande explicite
  async function check(force) {
    const sf = src();
    if (!sf || rc.checking || (document.hidden && force !== true)) return;
    rc.checking = true; rc.lastCheck = Date.now();
    try {
      const info = await S().rpc('share_info', { p_id: sf.id });
      if (src() !== sf) return;                     // autre document ouvert entre-temps
      if (!info) { showGone(sf); stopPoll(); return; }
      rc.info = info;
      if ((info.version || 1) > (sf.v || 1) && (info.version || 1) > rc.dismissed) showCard(sf, info);
      else hideCard();
    } catch (e) { /* hors ligne : on réessaiera */ }
    finally { rc.checking = false; }
  }
  function startPoll() {
    stopPoll();
    if (!src()) return;
    rc.timer = setInterval(check, POLL);
    setTimeout(check, 1500);
  }
  function stopPoll() { clearInterval(rc.timer); rc.timer = null; }

  const card = () => L.$('#updCard');
  function hideCard() { const c = card(); if (c) c.hidden = true; }
  function showCard(sf, info) {
    const c = card();
    if (!c) return;
    c.replaceChildren(
      L.h('button', { class: 'uc-x', title: 'Plus tard', text: '×', onclick: later }),
      L.h('div', { class: 'uc-h' }, L.h('span', { class: 'uc-dot' }), 'Nouvelle version disponible'),
      L.h('div', { class: 'uc-t', text: info.title || L.plain(App.doc.meta.title) || 'Document partagé' }),
      L.h('div', { class: 'uc-m', text: 'Modifiée par l\'auteur ' + S().ago(info.updated_at) + (info.version - (sf.v || 1) > 1 ? ' · ' + (info.version - (sf.v || 1)) + ' versions depuis la vôtre' : '') }),
      L.h('div', { class: 'uc-acts' },
        L.h('button', { class: 'btn primary small', text: 'Mettre à jour', onclick: () => applyUpdate() }),
        L.h('button', { class: 'btn small', text: 'Plus tard', onclick: later }),
        L.h('button', { class: 'linkish uc-stop', text: 'Ne plus suivre', title: 'Votre copie ne recevra plus les mises à jour de l\'auteur', onclick: unfollow })));
    c.hidden = false;
  }
  function showGone(sf) {
    const c = card();
    if (!c) return;
    c.replaceChildren(
      L.h('button', { class: 'uc-x', title: 'Fermer', text: '×', onclick: () => { unfollow(true); } }),
      L.h('div', { class: 'uc-h muted', text: 'Partage terminé' }),
      L.h('div', { class: 'uc-m', text: 'L\'auteur a désactivé le lien d\'origine (ou il a expiré) : votre copie ne recevra plus de mises à jour. Elle reste à vous.' }),
      L.h('div', { class: 'uc-acts' }, L.h('button', { class: 'btn small', text: 'Compris', onclick: () => unfollow(true) })));
    c.hidden = false;
  }
  function later() { rc.dismissed = (rc.info && rc.info.version) || 0; hideCard(); }
  function unfollow(silent) {
    hideCard(); stopPoll();
    if (!src()) return;
    delete App.doc.meta.sharedFrom;
    App.commit();
    if (silent !== true) L.toast('Votre copie ne suivra plus les mises à jour de l\'auteur');
  }

  async function applyUpdate() {
    const sf = src();
    if (!sf) return;
    if (hash(App.doc) !== sf.hash && !confirm('Vous avez modifié votre copie depuis la dernière mise à jour. Ces modifications seront remplacées par la nouvelle version de l\'auteur.\n\n(Vous pourrez revenir à votre version avec Ctrl+Z, ou l\'enregistrer d\'abord sous un autre nom.)\n\nMettre à jour quand même ?')) return;
    const c = card();
    const btn = c && c.querySelector('.btn.primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Mise à jour…'; }
    let r, doc;
    try {
      r = await S().rpc('get_share', { p_id: sf.id });
      if (!r || !r.payload) { showGone(sf); return; }
      doc = await S().unpack(r.payload);
    } catch (e) {
      L.toast(e.message, 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Mettre à jour'; }
      return;
    }
    App.commit();                                   // l'état actuel reste accessible par Ctrl+Z
    const own = App.doc.meta.share;                 // lien que le destinataire aurait lui-même créé
    const meta = L.fixMeta(Object.assign(L.defaultMeta(), doc.meta));
    if (own) meta.share = own;
    Object.assign(App.doc, { meta, blocks: doc.blocks.length ? doc.blocks : [L.newBlock('paragraph')], bib: doc.bib || [] });
    App.doc.assets = Object.assign({}, App.doc.assets, doc.assets);
    meta.sharedFrom = { id: sf.id, v: r.version || 1, at: r.updated_at, live: !!r.live, hash: hash(App.doc) };
    if (App.sel && !L.find(App.doc, App.sel)) App.sel = null;
    App.render();
    App.commit();
    App.updateName();
    hideCard();
    rc.dismissed = 0;
    L.toast('Document mis à jour vers la version de l\'auteur (Ctrl+Z pour revenir à la vôtre)');
  }

  /* ================= Branchements ================= */
  function docLoaded() {
    clearTimeout(st.timer); st.timer = null; st.err = null; st.again = false; st.lastSize = 0;
    rc.dismissed = 0; rc.info = null; hideCard();
    startPoll();
    const o = owner();
    // Modifications faites hors connexion (ou application fermée avant l'envoi) : on rattrape
    if (o && o.sh.live && !upToDate(o)) schedule(DEBOUNCE);
    emit();
  }
  function onState(f) { listeners.add(f); return () => listeners.delete(f); }

  window.addEventListener('focus', () => { if (src() && Date.now() - rc.lastCheck > 10000) check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && src() && Date.now() - rc.lastCheck > 10000) check(); });
  window.addEventListener('online', () => { if (st.err) schedule(1000); if (src()) check(); });

  L.Live = { hash, changed, publish, docLoaded, ownerState, onState, refresh: emit, check, applyUpdate };
})();
