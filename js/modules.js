/* Modules complémentaires : registre, installation, crochets et notes.

   Un module est livré avec l'application (code relu, mis à jour avec elle) mais reste
   inactif tant qu'on ne l'a pas installé depuis la page « Modules » (js/marketplace.js).
   L'état « installé » est gardé sur cet ordinateur (stockage local). Un module se
   déclare avec L.Modules.register({ id, name, … }) et s'accroche à l'éditeur par des
   crochets (hooks) appelés seulement quand il est installé :
     · codeBlock(b, el, ctx)        un bloc de code vient d'être dessiné dans l'éditeur ;
     · codeProps(b, P, helpers)     panneau de droite d'un bloc de code ;
     · codeKey(e, b, field) → true  touche dans le code (la touche est alors traitée).
   Les notes (★ sur 5) sont sur le serveur (supabase/modules.sql) : moyenne visible par
   tous, une note par compte. */
(function () {
  const KEY = 'lhe-modules';
  const defs = new Map();
  const subs = new Set();
  const read = () => { try { const o = JSON.parse(L.store.get(KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } };
  let state = read();
  const write = () => L.store.set(KEY, JSON.stringify(state));
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
  const safe = (fn, ...a) => { try { return fn(...a); } catch (e) { console.warn('Module', e); return undefined; } };

  function register(def) {
    def.version = def.version || '1.0.0';
    defs.set(def.id, def);
    if (state[def.id] && def.activate) safe(def.activate);
  }
  const get = id => defs.get(id);
  const list = () => Array.from(defs.values());
  const installed = id => !!state[id] && defs.has(id);
  const info = id => state[id] || null;
  const count = () => list().filter(d => installed(d.id)).length;

  /* L'éditeur se redessine : boutons et panneaux des modules apparaissent ou disparaissent */
  function refreshEditor() {
    if (!window.App || !App.doc || !App.render) return;
    App.render();
  }

  /* Installation : la fonction install(ui) du module fait ses vérifications (et peut
     annuler : false) ; le module est ensuite marqué installé et activé. */
  async function install(id, ui) {
    const d = defs.get(id);
    if (!d) return false;
    if (d.install) {
      const ok = await d.install(ui);
      if (!ok) return false;
    }
    state[id] = { version: d.version, at: Date.now() };
    write();
    if (d.activate) safe(d.activate);
    refreshEditor();
    emit();
    return true;
  }
  async function uninstall(id) {
    const d = defs.get(id);
    if (!d || !state[id]) return;
    if (d.deactivate) safe(d.deactivate);
    delete state[id];
    write();
    refreshEditor();
    emit();
  }
  // Installé ou désinstallé dans une autre fenêtre : on suit
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    const before = state;
    state = read();
    defs.forEach(d => {
      if (before[d.id] && !state[d.id] && d.deactivate) safe(d.deactivate);
      if (!before[d.id] && state[d.id] && d.activate) safe(d.activate);
    });
    refreshEditor();
    emit();
  });

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
    list().filter(d => !installed(d.id) && d.suggest && safe(d.suggest, 'code', b)).forEach(d => {
      P.append(helpers.sec(null, L.h('div', { class: 'mk-suggest' },
        moduleIcon(d, 34),
        L.h('div', { class: 'mk-suggest-t' },
          L.h('b', { text: d.suggestTitle || d.name }),
          L.h('span', { text: d.suggestText || d.tagline })),
        L.h('button', { class: 'btn primary wide', text: 'Découvrir le module', onclick: () => L.Market.show(d.id) }))));
    });
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

  /* ---------- Notes (★ sur 5) ---------- */
  const R = { stats: {}, mine: {}, loaded: false, loading: null, error: null };
  function why(e) {
    const m = String((e && (e.message || e.code || e.details)) || e || '');
    if (/PGRST202|schema cache|Could not find the function|does not exist/i.test(m)) return 'server';
    if (/Failed to fetch|NetworkError|network|Load failed|fetch/i.test(m)) return 'offline';
    return 'error';
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
        (st.data || []).forEach(x => { R.stats[x.module_id] = { n: x.n, avg: Number(x.average) || 0, dist: [x.s1, x.s2, x.s3, x.s4, x.s5] }; });
        R.mine = {};
        if (C.uid()) {
          const m = await sb.rpc('lhe_module_my_ratings');
          if (!m.error) (m.data || []).forEach(x => { R.mine[x.module_id] = x.stars; });
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
    const r = await C.client().rpc('lhe_module_rate', { p_module: id, p_stars: stars || 0 });
    if (r.error) {
      const w = why(r.error);
      throw new Error(w === 'server' ? 'Les notes ne sont pas encore disponibles sur le serveur.' : w === 'offline' ? 'Impossible de joindre le serveur : vérifiez votre connexion internet.' : C.fr(r.error));
    }
    if (stars) R.mine[id] = stars; else delete R.mine[id];
    await loadRatings(true);
  }
  // Connexion / déconnexion : les « mes notes » changent
  document.addEventListener('DOMContentLoaded', () => { if (L.Cloud) L.Cloud.onChange(() => { if (R.loaded) loadRatings(true); }); });

  L.Modules = {
    register, get, list, installed, info, count, install, uninstall, each, codeProps, moduleIcon,
    onChange: f => { subs.add(f); return () => subs.delete(f); },
    ratings: R, loadRatings, rate,
  };
})();
