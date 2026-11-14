/* Modules complémentaires : registre, installation, crochets et notes.

   Un module est livré avec l'application (code relu, mis à jour avec elle) mais reste
   inactif tant qu'on ne l'a pas installé depuis la page « Modules » (js/marketplace.js).
   Installer un module demande un compte : les modules installés sont rangés avec le
   compte connecté (sur cet ordinateur, et déclarés au serveur) ; sans compte, ou avec
   un autre compte, ils sont inactifs. Un module se déclare avec
   L.Modules.register({ id, name, … }) et s'accroche à l'éditeur par des crochets
   (hooks) appelés seulement quand il est installé :
     · codeBlock(b, el, ctx)        un bloc de code vient d'être dessiné dans l'éditeur ;
     · codeProps(b, P, helpers)     panneau de droite d'un bloc de code ;
     · codeKey(e, b, field) → true  touche dans le code (la touche est alors traitée).
   Un élément du menu Insérer peut aussi dépendre d'un module (champ mod de L.ITEMS,
   js/editor.js) : il n'apparaît que si le module est installé.
   Le module signale chaque vraie utilisation par L.Modules.used(id) (une exécution, un dessin…).
   Les notes (★ sur 5) sont sur le serveur (supabase/modules.sql) : moyenne visible par
   tous ; pour noter, il faut un compte, avoir installé le module et s'en être servi
   au moins RATE_MIN fois (règle vérifiée aussi par le serveur). */
(function () {
  const LEGACY = 'lhe-modules';                 // 1.31.0 : modules installés sans compte
  const keyOf = u => 'lhe-modules@' + u;
  const RATE_MIN = 3;                           // même valeur que dans supabase/modules.sql
  const defs = new Map();
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.warn('Module', e); return undefined; } };
  const parse = raw => { try { const o = JSON.parse(raw || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };

  /* Compte connecté. Avant la fin du démarrage du module de connexion (ou hors ligne,
     jeton expiré), on lit la session gardée par Supabase : les modules sont actifs dès
     l'ouverture. Une déconnexion efface cette session, donc les modules aussi. */
  function storedUid() {
    const o = parse(L.store.get('lhe-compte'));
    const u = o.user || (o.currentSession && o.currentSession.user);
    return u && typeof u.id === 'string' ? u.id : null;
  }
  const currentUid = () => (L.Cloud && L.Cloud.uid()) || storedUid() || null;

  let uid = currentUid();
  let state = uid ? parse(L.store.get(keyOf(uid))) : {};
  const write = () => { if (uid) L.store.set(keyOf(uid), JSON.stringify(state)); };

  /* Modules installés avec la 1.31.0 (sans compte) : repris par le premier compte connecté */
  function adoptLegacy() {
    const old = parse(L.store.get(LEGACY));
    const ids = Object.keys(old);
    if (!ids.length) return;
    ids.forEach(id => { if (!state[id] && old[id] && typeof old[id] === 'object') state[id] = { version: old[id].version, at: old[id].at || Date.now(), uses: old[id].uses || 0 }; });
    write();
    try { localStorage.removeItem(LEGACY); } catch (e) { /* stockage indisponible */ }
  }
  if (uid) adoptLegacy();

  function register(def) {
    def.version = def.version || '1.0.0';
    defs.set(def.id, def);
    if (state[def.id] && def.activate) safe(def.activate);
  }
  const get = id => defs.get(id);
  const list = () => Array.from(defs.values());
  const installed = id => !!uid && !!state[id] && defs.has(id);
  const info = id => (uid && state[id]) || null;
  const count = () => list().filter(d => installed(d.id)).length;
  const account = () => { follow(); return uid; };

  /* L'éditeur se redessine : boutons et panneaux des modules apparaissent ou disparaissent */
  function refreshEditor() {
    if (!window.App || !App.doc || !App.render) return;
    App.render();
  }

  /* Changement de compte (connexion, déconnexion, autre compte) : on passe aux modules du
     nouveau compte, et l'on déclare au serveur ce qui a été installé sur cet ordinateur. */
  let pushedFor = null;
  function follow() {
    const u = currentUid();
    if (u !== uid) {
      const before = state;
      uid = u;
      state = u ? parse(L.store.get(keyOf(u))) : {};
      if (u) adoptLegacy();
      defs.forEach(d => {
        if (before[d.id] && !state[d.id] && d.deactivate) safe(d.deactivate);
        if (!before[d.id] && state[d.id] && d.activate) safe(d.activate);
      });
      refreshEditor();
      emit();
    }
    const live = L.Cloud && L.Cloud.uid();
    if (live && live === uid && pushedFor !== live) {
      pushedFor = live;
      Object.keys(state).forEach(id => { if (defs.has(id)) track(id, true); });
    }
    if (!live) pushedFor = null;
  }

  /* Installation : la fonction install(ui) du module fait ses vérifications (et peut
     annuler : false) ; le module est ensuite marqué installé et activé. */
  async function install(id, ui) {
    const d = defs.get(id);
    if (!d) return false;
    follow();
    if (!uid) {
      if (ui && ui.fail) ui.fail('account', 'Connectez-vous pour installer un module', 'Les modules sont réservés aux comptes LaTeX Home Edition (gratuits).');
      return false;
    }
    if (d.install) {
      const ok = await d.install(ui);
      if (!ok) return false;
    }
    if (!uid) return false;                      // déconnecté pendant l'installation
    state[id] = { version: d.version, at: Date.now(), uses: 0 };
    write();
    track(id, true);
    if (d.activate) safe(d.activate);
    refreshEditor();
    emit();
    return true;
  }
  async function uninstall(id) {
    const d = defs.get(id);
    if (!d || !uid || !state[id]) return;
    track(id, false);
    if (d.deactivate) safe(d.deactivate);
    delete state[id];
    write();
    refreshEditor();
    emit();
  }
  // Installé ou désinstallé dans une autre fenêtre (même compte) : on suit
  window.addEventListener('storage', e => {
    if (!uid || e.key !== keyOf(uid)) return;
    const before = state;
    state = parse(e.newValue);
    defs.forEach(d => {
      if (before[d.id] && !state[d.id] && d.deactivate) safe(d.deactivate);
      if (!before[d.id] && state[d.id] && d.activate) safe(d.activate);
    });
    refreshEditor();
    emit();
  });

  /* Une vraie utilisation du module (ex. : une exécution de code). Le compteur ouvre le
     droit de noter ; le serveur est prévenu jusqu'au seuil. */
  function used(id) {
    const s = uid && state[id];
    if (!s) return;
    s.uses = (s.uses || 0) + 1;
    write();
    if (s.uses <= RATE_MIN) track(id, true);
    if (s.uses === RATE_MIN) emit();
  }
  /* Où en est le compte connecté pour noter ce module */
  function rateState(id) {
    const C = L.Cloud;
    if (!C || !C.available() || !C.uid()) return { ok: false, why: 'login' };
    if (R.mine[id]) return { ok: true, rated: true };
    const local = state[id] ? state[id].uses || 0 : 0;
    const srv = R.usage[id] || { installed: false, uses: 0 };
    const uses = Math.max(local, srv.uses || 0);
    if (!state[id] && !srv.uses) return { ok: false, why: 'install', uses: 0, left: RATE_MIN };
    if (uses < RATE_MIN) return { ok: false, why: 'use', uses, left: RATE_MIN - uses };
    return { ok: true };
  }

  /* ---------- Crochets ---------- */
  function each(hook, ...args) {
    let handled = false;
    defs.forEach(d => {
      if (!installed(d.id) || !d.hooks || !d.hooks[hook]) return;
      if (safe(d.hooks[hook], ...args) === true) handled = true;
    });
    return handled;
  }
  /* Panneau d'un bloc de code : réglages des modules installés, ou suggestion d'un
     module utile pas encore installé (un bloc Python → « Exécution Python ») */
  function codeProps(b, P, helpers) {
    each('codeProps', b, P, helpers);
    list().filter(d => !installed(d.id) && d.suggest && safe(d.suggest, 'code', b)).forEach(d => P.append(card(d.id, helpers)));
  }
  // Carte « module conseillé » du panneau de droite (ouvre sa fiche sur la page Modules)
  function card(id, helpers, title, text) {
    const d = defs.get(id);
    if (!d) return null;
    return helpers.sec(null, L.h('div', { class: 'mk-suggest' },
      moduleIcon(d, 34),
      L.h('div', { class: 'mk-suggest-t' },
        L.h('b', { text: title || d.suggestTitle || 'Module « ' + d.name + ' »' }),
        L.h('span', { text: text || d.suggestText || d.tagline })),
      L.h('button', { class: 'btn primary wide', text: 'Découvrir le module', onclick: () => L.Market.show(d.id) })));
  }

  /* Icône d'un module (carré coloré + pictogramme) */
  function moduleIcon(d, size) {
    const s = L.h('span', { class: 'mk-icon', 'aria-hidden': 'true' });
    // (les variables CSS ne passent pas par Object.assign(el.style) : setProperty)
    s.style.setProperty('--c1', d.colors ? d.colors[0] : '#3f6bb0');
    s.style.setProperty('--c2', d.colors ? d.colors[1] : '#2b4c7e');
    s.style.width = s.style.height = size + 'px';
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (d.icon || '') + '</svg>';
    return s;
  }

  /* ---------- Serveur : installations, utilisations, notes ---------- */
  const R = { stats: {}, mine: {}, usage: {}, loaded: false, loading: null, error: null };
  function why(e) {
    const m = String((e && (e.message || e.code || e.details)) || e || '');
    if (/PGRST202|schema cache|Could not find the function|does not exist/i.test(m)) return 'server';
    if (/Failed to fetch|NetworkError|network|Load failed|fetch/i.test(m)) return 'offline';
    return 'error';
  }
  /* Déclare au serveur l'installation (true), la désinstallation (false) ou les
     utilisations (null : installé inchangé). Sans réseau : réessayé à la connexion suivante. */
  async function track(id, inst) {
    const C = L.Cloud;
    if (!C || !C.available() || !C.uid() || C.uid() !== uid) return false;
    const uses = state[id] ? state[id].uses || 0 : 0;
    try {
      const r = await C.client().rpc('lhe_module_track', { p_module: id, p_installed: inst, p_uses: uses });
      if (r.error) throw r.error;
      const u = R.usage[id] || { installed: false, uses: 0 };
      R.usage[id] = { installed: inst === null ? u.installed : inst, uses: Math.max(u.uses || 0, uses) };
      return true;
    } catch (e) { return false; }
  }
  function loadRatings(force) {
    if (R.loading && !force) return R.loading;
    R.loading = (async () => {
      const C = L.Cloud;
      if (!C || !C.available()) { R.error = 'offline'; R.loaded = true; emit(); return R; }
      try {
        const sb = C.client();
        const st = await sb.rpc('lhe_module_stats');
        if (st.error) throw st.error;
        R.stats = {};
        (st.data || []).forEach(x => { R.stats[x.module_id] = { n: x.n, avg: Number(x.average) || 0, dist: [x.s1, x.s2, x.s3, x.s4, x.s5], installs: x.installs || 0 }; });
        R.mine = {};
        R.usage = {};
        if (C.uid()) {
          const m = await sb.rpc('lhe_module_mine');
          if (!m.error) (m.data || []).forEach(x => {
            if (x.stars) R.mine[x.module_id] = x.stars;
            R.usage[x.module_id] = { installed: !!x.installed, uses: x.uses || 0 };
          });
        }
        R.error = null;
      } catch (e) { R.error = why(e); }
      R.loaded = true;
      emit();
      return R;
    })();
    R.loading.finally(() => { setTimeout(() => { R.loading = null; }, 0); });
    return R.loading;
  }
  async function rate(id, stars) {
    const C = L.Cloud;
    if (!C || !C.uid()) throw new Error('Connectez-vous pour noter un module.');
    if (stars) {
      const rs = rateState(id);
      if (!rs.ok) throw new Error(rs.why === 'install' ? 'Installez ce module pour pouvoir le noter.' : 'Servez-vous encore un peu du module avant de le noter.');
      if (state[id]) await track(id, true);       // le serveur connaît les dernières utilisations
    }
    const r = await C.client().rpc('lhe_module_rate', { p_module: id, p_stars: stars || 0 });
    if (r.error) {
      const w = why(r.error);
      const m = String(r.error.message || '');
      throw new Error(/LHE_USE/.test(m) ? 'Installez ce module et servez-vous-en au moins ' + RATE_MIN + ' fois avant de le noter.'
        : w === 'server' ? 'Les notes ne sont pas encore disponibles sur le serveur.' : w === 'offline' ? 'Impossible de joindre le serveur : vérifiez votre connexion internet.' : C.fr(r.error));
    }
    if (stars) R.mine[id] = stars; else delete R.mine[id];
    await loadRatings(true);
  }
  // Connexion / déconnexion : modules du compte, « mes notes »
  document.addEventListener('DOMContentLoaded', () => {
    if (!L.Cloud) return;
    L.Cloud.onChange(() => { follow(); if (R.loaded) loadRatings(true); });
  });

  L.Modules = {
    register, get, list, installed, info, count, account, install, uninstall, each, codeProps, card, moduleIcon,
    used, rateState, RATE_MIN,
    onChange: f => { subs.add(f); return () => subs.delete(f); },
    ratings: R, loadRatings, rate,
  };
})();
