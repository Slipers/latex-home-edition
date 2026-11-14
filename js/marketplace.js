/* Page « Modules complémentaires » : découvrir, installer, désinstaller et noter les
   modules (js/modules.js). Plein écran, au-dessus de l'accueil ou de l'éditeur :
   « Retour » ramène là où l'on était. */
(function () {
  const M = () => L.Modules;
  let root = null, scroll = null, search = null, tab = 'all', cat = '', cur = null, unsub = null;

  /* ---------- Icônes ---------- */
  const ICONS = {
    back: '<path d="M11 18l-6-6 6-6"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    puzzle: '<path d="M9.5 4.5a2 2 0 1 1 4 0V6H17a1 1 0 0 1 1 1v3.5h1.5a2 2 0 1 1 0 4H18V18a1 1 0 0 1-1 1h-3.5v-1.5a2 2 0 1 0-4 0V19H6a1 1 0 0 1-1-1v-3.5h1.5a2 2 0 1 0 0-4H5V7a1 1 0 0 1 1-1h3.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    verified: '<path d="M12 2.8l2.4 1.6 2.9-.1.9 2.7 2.3 1.8-.9 2.7.9 2.7-2.3 1.8-.9 2.7-2.9-.1L12 21.2l-2.4-1.6-2.9.1-.9-2.7-2.3-1.8.9-2.7-.9-2.7 2.3-1.8.9-2.7 2.9.1z" fill="currentColor" stroke="none"/><path d="M8.5 12.2l2.4 2.3 4.6-4.8" stroke="#fff"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.6-7.5 9.5-4.3-.9-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    term: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8.5"/>',
    kbd: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    insert: '<path d="M12 4v10M7.5 9.5L12 14l4.5-4.5"/><path d="M4 18.5h16"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  };
  function ico(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'h-ico' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  /* ---------- Étoiles ---------- */
  const STAR = 'M12 2.8l2.75 5.8 6.35.75-4.7 4.35 1.25 6.3L12 16.85 6.35 20l1.25-6.3L2.9 9.35l6.35-.75z';
  function stars(value, size) {
    const w = Math.max(0, Math.min(5, value || 0)) / 5 * 100;
    const row = cls => '<svg viewBox="0 0 120 24" class="' + cls + '" aria-hidden="true">' + [0, 1, 2, 3, 4].map(i => '<path transform="translate(' + (i * 24) + ' 0)" d="' + STAR + '"/>').join('') + '</svg>';
    const el = L.h('span', { class: 'mk-stars', style: { '--sz': (size || 14) + 'px' }, title: value ? String(value).replace('.', ',') + ' sur 5' : 'Pas encore noté' });
    el.innerHTML = row('bg') + '<span class="fg" style="width:' + w + '%">' + row('on') + '</span>';
    return el;
  }
  const fmt = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

  function ratingLine(d, big) {
    const R = M().ratings, st = R.stats[d.id];
    if (!R.loaded) return L.h('span', { class: 'mk-rl muted' }, stars(0, big ? 16 : 13), L.h('i', { class: 'mk-skel-t' }));
    if (!st || !st.n) return L.h('span', { class: 'mk-rl muted' }, stars(0, big ? 16 : 13), L.h('span', { text: 'Pas encore noté' }));
    return L.h('span', { class: 'mk-rl' }, L.h('b', { text: fmt(st.avg) }), stars(st.avg, big ? 16 : 13), L.h('span', { class: 'muted', text: '(' + st.n + ')' }));
  }

  /* ---------- Liste ---------- */
  function matches(d) {
    const q = (search.value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hay = [d.name, d.tagline, d.category, ...(d.tags || [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return (!q || hay.includes(q)) && (tab !== 'installed' || M().installed(d.id)) && (!cat || d.category === cat);
  }
  function actionBtn(d, compact) {
    if (M().installed(d.id)) {
      const b = L.h('button', { class: 'mk-btn ok' + (compact ? ' sm' : ''), title: 'Module installé — voir la fiche' }, ico('check'), 'Installé');
      b.onclick = e => { e.stopPropagation(); openDetail(d.id); };
      return b;
    }
    const can = !d.available || d.available();
    const b = L.h('button', { class: 'mk-btn primary' + (compact ? ' sm' : ''), title: can ? 'Installer ce module' : d.unavailableText || 'Indisponible ici' }, 'Installer');
    if (!can) b.disabled = true;
    b.onclick = e => { e.stopPropagation(); installFlow(d); };
    return b;
  }
  function card(d, i) {
    const c = L.h('article', { class: 'mk-card' + (M().installed(d.id) ? ' is-on' : ''), tabindex: '0', role: 'button', 'aria-label': d.name },
      L.h('div', { class: 'mk-card-top' },
        M().moduleIcon(d, 48),
        L.h('div', { class: 'mk-card-h' },
          L.h('b', { text: d.name }),
          L.h('span', { class: 'mk-by' }, d.author || '', d.official ? L.h('span', { class: 'mk-verified', title: 'Module officiel, développé avec l\'application' }, ico('verified')) : null))),
      L.h('p', { class: 'mk-desc', text: d.tagline }),
      L.h('div', { class: 'mk-tags' }, ...[d.category].concat(d.tags || []).filter((t, k, a) => t && a.indexOf(t) === k).slice(0, 3).map(t => L.h('span', { text: t }))),
      L.h('div', { class: 'mk-card-foot' }, ratingLine(d), actionBtn(d, true)));
    c.style.setProperty('--i', i);
    c.onclick = () => openDetail(d.id);
    c.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); openDetail(d.id); } };
    return c;
  }
  function soonCard() {
    return L.h('article', { class: 'mk-card soon' },
      L.h('div', { class: 'mk-soon-ic' }, ico('spark')),
      L.h('b', { text: 'D\'autres modules arrivent' }),
      L.h('p', { text: 'Les prochains modules apparaîtront ici avec les mises à jour de l\'application.' }));
  }
  function paintList() {
    cur = null;
    const all = M().list();
    const cats = Array.from(new Set(all.map(d => d.category).filter(Boolean)));
    const vis = all.filter(matches);
    const n = M().count();
    const seg = L.h('div', { class: 'home-seg', role: 'tablist' },
      ...[['all', 'Découvrir'], ['installed', 'Installés' + (n ? ' (' + n + ')' : '')]].map(([v, label]) => {
        const b = L.h('button', { class: tab === v ? 'on' : '', role: 'tab', 'aria-selected': String(tab === v), text: label });
        b.onclick = () => { tab = v; paintList(); };
        return b;
      }));
    const chips = L.h('div', { class: 'mk-cats' },
      ...[['', 'Toutes les catégories']].concat(cats.map(c => [c, c])).map(([v, label]) => {
        const b = L.h('button', { class: 'mk-cat' + (cat === v ? ' on' : ''), text: label });
        b.onclick = () => { cat = v; paintList(); };
        return b;
      }));
    const grid = L.h('div', { class: 'mk-grid' }, ...vis.map(card));
    if (!search.value.trim() && tab === 'all') grid.appendChild(soonCard());
    const empty = !vis.length ? L.h('div', { class: 'home-empty' },
      L.h('b', { text: tab === 'installed' && !search.value.trim() ? 'Aucun module installé' : 'Aucun module trouvé' }),
      L.h('span', { text: tab === 'installed' && !search.value.trim() ? 'Les modules que vous installez apparaissent ici.' : 'Essayez un autre mot.' })) : null;
    scroll.replaceChildren(
      L.h('section', { class: 'mk-hero' }, L.h('div', { class: 'mk-wrap' },
        L.h('div', { class: 'mk-hero-t' },
          L.h('h1', { text: 'Ajoutez des fonctions à LaTeX Home Edition' }),
          L.h('p', { text: 'Installez seulement ce dont vous avez besoin, désinstallez quand vous voulez. Vos documents ne changent pas.' })),
        L.h('div', { class: 'mk-hero-art', 'aria-hidden': 'true' }, heroArt()))),
      L.h('section', { class: 'mk-list' }, L.h('div', { class: 'mk-wrap' },
        L.h('div', { class: 'mk-bar' }, seg, cats.length > 1 ? chips : null,
          L.h('span', { class: 'mk-count', text: plural(vis.length, 'module', 'modules') })),
        grid, empty)));
    scroll.scrollTop = 0;
  }
  function heroArt() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 220 120');
    s.innerHTML = '<rect x="18" y="22" width="78" height="78" rx="18" class="t1"/><rect x="74" y="8" width="64" height="64" rx="16" class="t2"/><rect x="122" y="40" width="80" height="70" rx="18" class="t3"/>'
      + '<path d="M44 61l-9 0M57 48l-6 26M70 61l-9 0" class="g"/><path d="M98 40l8-8M98 32l8 8M115 40h10" class="g"/><path d="M150 75l10-10 9 9 14-15" class="g"/>';
    return s;
  }

  /* ---------- Fiche d'un module ---------- */
  function openDetail(id) {
    const d = M().get(id);
    if (!d) return paintList();
    cur = id;
    const inst = M().installed(id);
    const can = !d.available || d.available();
    const head = L.h('header', { class: 'mk-d-head' },
      M().moduleIcon(d, 88),
      L.h('div', { class: 'mk-d-t' },
        L.h('h1', { text: d.name }),
        L.h('div', { class: 'mk-by' }, d.author || '', d.official ? L.h('span', { class: 'mk-verified', title: 'Module officiel' }, ico('verified')) : null, d.official ? L.h('span', { class: 'mk-off', text: 'Officiel' }) : null),
        L.h('p', { class: 'mk-d-tag', text: d.tagline }),
        L.h('div', { class: 'mk-d-meta' }, ratingLine(d, true), L.h('span', { class: 'mk-dot' }), L.h('span', { text: d.category }), L.h('span', { class: 'mk-dot' }), L.h('span', { text: 'Version ' + d.version }))),
      L.h('div', { class: 'mk-d-act' },
        inst ? L.h('span', { class: 'mk-installed' }, ico('check'), 'Installé') : null,
        inst ? L.h('button', { class: 'mk-btn danger-o', onclick: () => uninstallFlow(d) }, ico('trash'), 'Désinstaller')
          : L.h('button', { class: 'mk-btn primary lg', disabled: !can, onclick: () => installFlow(d) }, 'Installer'),
        L.h('small', { text: can ? 'Gratuit · ' + (d.size || '') : d.unavailableText || '' })));
    const main = L.h('div', { class: 'mk-d-main' },
      L.h('section', { class: 'mk-sec' }, L.h('h3', { text: 'Présentation' }), L.h('div', { class: 'mk-prose', html: d.description || '' })),
      d.preview ? L.h('section', { class: 'mk-sec' }, d.preview()) : null,
      d.features ? L.h('section', { class: 'mk-sec' }, L.h('h3', { text: 'Fonctionnalités' }),
        L.h('ul', { class: 'mk-feats' }, ...d.features.map(([icn, t, s]) => L.h('li', null, L.h('span', { class: 'mk-feat-ic' }, ico(icn)), L.h('div', null, L.h('b', { text: t }), L.h('span', { text: s })))))) : null,
      d.steps ? L.h('section', { class: 'mk-sec' }, L.h('h3', { text: 'Comment l\'utiliser' }), L.h('ol', { class: 'mk-steps' }, ...d.steps.map(s => L.h('li', { html: s })))) : null,
      reviews(d));
    const side = L.h('aside', { class: 'mk-d-side' },
      L.h('div', { class: 'mk-box' }, L.h('h4', { text: 'Informations' }),
        L.h('dl', { class: 'mk-dl' },
          ...[['Version', d.version], ['Développeur', d.author], ['Catégorie', d.category], ['Mise à jour', d.updated], ['Compatibilité', d.compat], ['Taille', d.size]]
            .filter(x => x[1]).map(([k, v]) => [L.h('dt', { text: k }), L.h('dd', { text: v })]).flat(),
          inst ? [L.h('dt', { text: 'Installé le' }), L.h('dd', { text: new Date(M().info(id).at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) })] : [])),
      d.requirementsBox ? L.h('div', { class: 'mk-box' }, L.h('h4', { text: 'Prérequis' }), d.requirementsBox()) : null,
      d.privacy ? L.h('div', { class: 'mk-box' }, L.h('h4', { text: 'Confidentialité' }), L.h('p', { class: 'mk-priv' }, ico('shield'), L.h('span', { text: d.privacy }))) : null);
    const crumb = L.h('button', { class: 'mk-crumb', onclick: () => paintList() }, ico('back'), 'Tous les modules');
    scroll.replaceChildren(L.h('div', { class: 'mk-wrap mk-detail' }, crumb, head, L.h('div', { class: 'mk-d-cols' }, main, side)));
    scroll.scrollTop = 0;
  }

  /* Notes et avis */
  function reviews(d) {
    const box = L.h('section', { class: 'mk-sec mk-rev' });
    const paint = () => {
      const R = M().ratings, st = R.stats[d.id] || { n: 0, avg: 0, dist: [0, 0, 0, 0, 0] };
      const mine = R.mine[d.id] || 0;
      const kids = [L.h('h3', { text: 'Notes et avis' })];
      if (!R.loaded) kids.push(L.h('div', { class: 'mk-rev-load' }, L.h('i', { class: 'mk-skel-t w' }), L.h('i', { class: 'mk-skel-t' })));
      else if (R.error) kids.push(L.h('p', { class: 'mk-rev-note', text: R.error === 'offline' ? 'Les notes ne sont pas disponibles hors connexion.' : 'Les notes ne sont pas encore disponibles.' }));
      else {
        const max = Math.max(1, ...st.dist);
        kids.push(L.h('div', { class: 'mk-rev-sum' },
          L.h('div', { class: 'mk-rev-big' }, L.h('b', { text: st.n ? fmt(st.avg) : '–' }), stars(st.avg, 18), L.h('small', { text: st.n ? plural(st.n, 'note', 'notes') : 'Aucune note pour l\'instant' })),
          L.h('div', { class: 'mk-rev-bars' }, ...[5, 4, 3, 2, 1].map(k => L.h('div', { class: 'mk-rev-bar' },
            L.h('span', { text: String(k) }), L.h('i', null, L.h('em', { style: { width: (st.dist[k - 1] / max * 100) + '%' } })), L.h('small', { text: String(st.dist[k - 1] || 0) })))),
          myRating(d, mine, paint)));
      }
      box.replaceChildren(...kids);
    };
    paint();
    box._paint = paint;
    return box;
  }
  function myRating(d, mine, repaint) {
    const C = L.Cloud;
    const wrap = L.h('div', { class: 'mk-rev-me' }, L.h('b', { text: mine ? 'Votre note' : 'Donnez votre avis' }));
    if (!C || !C.available() || !C.uid()) {
      wrap.append(L.h('span', { class: 'mk-rev-note', text: 'Connectez-vous pour noter ce module (une note par compte).' }),
        L.h('button', { class: 'mk-btn sm', onclick: () => L.dlgAuth('login', () => M().loadRatings(true)) }, ico('user'), 'Se connecter'));
      return wrap;
    }
    const pick = L.h('div', { class: 'mk-pick', role: 'radiogroup', 'aria-label': 'Votre note sur 5' });
    const msg = L.h('small', { class: 'mk-rev-note', text: mine ? 'Cliquez sur une étoile pour changer votre note.' : 'Cliquez sur une étoile.' });
    const LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'];
    const show = v => pick.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k < v));
    for (let k = 1; k <= 5; k++) {
      const b = L.h('button', { role: 'radio', 'aria-checked': String(mine === k), title: k + ' étoile' + (k > 1 ? 's' : '') + ' — ' + LABELS[k] });
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"/></svg>';
      b.onmouseenter = () => { show(k); msg.textContent = LABELS[k]; };
      b.onclick = async () => {
        pick.classList.add('busy');
        try { await M().rate(d.id, k); L.toast('Merci pour votre note !'); repaint(); }
        catch (e) { pick.classList.remove('busy'); msg.textContent = e.message; show(mine); }
      };
      pick.appendChild(b);
    }
    pick.onmouseleave = () => { show(mine); msg.textContent = mine ? 'Votre note : ' + LABELS[mine] + '.' : 'Cliquez sur une étoile.'; };
    show(mine);
    wrap.append(pick, msg);
    if (mine) {
      const rm = L.h('button', { class: 'mk-link', text: 'Retirer ma note' });
      rm.onclick = async () => { try { await M().rate(d.id, 0); repaint(); } catch (e) { msg.textContent = e.message; } };
      wrap.append(rm);
    }
    return wrap;
  }

  /* ---------- Installation (fenêtre à étapes) ---------- */
  function installFlow(d) {
    if (M().installed(d.id)) return openDetail(d.id);
    const steps = L.h('ol', { class: 'mk-inst-steps' });
    const askBox = L.h('div', { class: 'mk-inst-ask', hidden: true });
    const done = L.h('div', { class: 'mk-inst-done', hidden: true });
    const sub = L.h('span', { text: 'Installation en cours…' });
    const body = L.h('div', { class: 'mk-inst' },
      L.h('div', { class: 'mk-inst-head' }, M().moduleIcon(d, 52), L.h('div', null, L.h('b', { text: d.name }), sub)),
      steps, askBox, done);
    let closed = false, pending = null, waitLong = false;
    const dlg = L.modal({
      title: 'Installer un module', body, cls: 'mk-inst-modal',
      guard: () => {
        if (waitLong) { L.toast('Patientez : l\'installation de Python est en cours.'); return false; }
        return true;
      },
      onClose: () => { closed = true; if (pending) pending(null); },
    });
    const rows = {};
    const row = key => {
      if (rows[key]) return rows[key];
      const li = L.h('li', { class: 'todo' }, L.h('span', { class: 'st' }), L.h('div', { class: 'tx' }, L.h('b'), L.h('small')));
      steps.appendChild(li);
      rows[key] = li;
      return li;
    };
    const set = (key, cls, label, detail) => {
      const li = row(key);
      li.className = cls;
      if (label) li.querySelector('b').textContent = label;
      li.querySelector('small').textContent = detail || '';
      li.querySelector('small').hidden = !detail;
      li.querySelector('.st').replaceChildren(cls === 'ok' ? ico('check') : cls === 'fail' ? ico('x') : cls === 'note' ? ico('info') : L.h('i', { class: 'py-spin' }));
    };
    const ui = {
      step: (key, label, detail, long) => { askBox.hidden = true; sub.textContent = 'Installation en cours…'; waitLong = !!long; set(key, 'run' + (long ? ' long' : ''), label, detail); },
      ok: (key, label, detail, kind) => { waitLong = false; set(key, kind === 'note' ? 'note' : 'ok', label, detail); },
      fail: (key, label, detail) => { waitLong = false; set(key, 'fail', label, detail); },
      ask: ({ title, text, actions }) => new Promise(resolve => {
        if (closed) return resolve(null);
        pending = v => { pending = null; askBox.hidden = true; resolve(v); };
        askBox.replaceChildren(L.h('b', { text: title }), L.h('p', { text }),
          L.h('div', { class: 'mk-ask-acts' }, ...actions.filter(a => !a.hidden).map(a => L.h('button', { class: 'mk-ask' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), onclick: () => pending && pending(a.v) },
            L.h('b', { text: a.label }), a.sub ? L.h('small', { text: a.sub }) : null))));
        askBox.hidden = false;
        sub.textContent = 'Votre choix est nécessaire';
      }),
    };
    (async () => {
      let ok = false;
      try { ok = await M().install(d.id, ui); } catch (e) { ui.fail('err', 'Erreur pendant l\'installation', String((e && e.message) || e)); }
      waitLong = false;
      if (closed) { if (ok) { L.toast('Module « ' + d.name + ' » installé'); repaint(); } return; }
      if (!ok) {
        sub.textContent = 'Installation annulée';
        done.replaceChildren(L.h('p', { class: 'mk-inst-cancel', text: 'Le module n\'a pas été installé. Vous pourrez réessayer quand vous voulez.' }),
          L.h('div', { class: 'mk-ask-acts row' }, L.h('button', { class: 'mk-btn', text: 'Fermer', onclick: () => dlg.close() })));
        done.hidden = false;
        return;
      }
      set('act', 'ok', 'Module activé');
      sub.textContent = 'Installé';
      const canTry = d.sample && window.App && App.doc && !document.body.classList.contains('ro');
      done.replaceChildren(
        L.h('div', { class: 'mk-inst-yay' }, L.h('span', null, ico('check')), L.h('div', null, L.h('b', { text: 'Module installé !' }),
          L.h('span', { html: d.id === 'python' ? 'Chaque bloc de code Python a maintenant un bouton <b>▶ Exécuter</b> (ou <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> dans le code).' : 'Le module est prêt.' }))),
        L.h('div', { class: 'mk-ask-acts row' },
          L.h('button', { class: 'mk-btn', text: 'Terminé', onclick: () => dlg.close() }),
          canTry ? L.h('button', { class: 'mk-btn primary', text: 'Essayer avec un exemple', onclick: () => { dlg.close(); tryIt(d); } }) : null));
      done.hidden = false;
      repaint();
    })();
  }
  /* Un exemple est ajouté au document ouvert, puis exécuté */
  function tryIt(d) {
    hide();
    if (L.Home && L.Home.visible()) L.Home.hide();
    const b = d.sample();
    App.insertBlock(b);
    setTimeout(() => { if (L.PyRun && d.id === 'python') L.PyRun.run(b.id); }, 150);
  }
  function uninstallFlow(d) {
    L.modal({
      title: 'Désinstaller « ' + d.name + ' » ?',
      body: L.h('div', { class: 'mk-uninst' }, M().moduleIcon(d, 44),
        L.h('p', { text: 'Les fonctions du module disparaissent de l\'éditeur. Vos documents ne changent pas (les blocs de code restent), et vous pourrez le réinstaller à tout moment.' })),
      foot: [
        { text: 'Annuler', onClick: c => c() },
        { text: 'Désinstaller', cls: 'danger', onClick: async c => { c(); await M().uninstall(d.id); L.toast('Module désinstallé'); repaint(); } },
      ],
    });
  }

  /* Rafraîchit la page sans perdre la position de lecture (notes rechargées, module installé…) */
  function repaint() {
    if (!root || root.hidden) return;
    const top = scroll.scrollTop;
    if (cur) openDetail(cur); else paintList();
    scroll.scrollTop = top;
  }

  /* ---------- Page ---------- */
  function build() {
    search = L.h('input', { type: 'search', placeholder: 'Rechercher un module', 'aria-label': 'Rechercher un module', spellcheck: 'false' });
    const clear = L.h('button', { class: 'home-clear', title: 'Effacer', hidden: true }, ico('x'));
    search.oninput = () => { clear.hidden = !search.value; if (cur) cur = null; paintList(); };
    search.onkeydown = e => { if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; clear.hidden = true; paintList(); } };
    clear.onclick = () => { search.value = ''; clear.hidden = true; paintList(); search.focus(); };
    scroll = L.h('div', { class: 'mk-scroll' });
    root = L.h('div', { id: 'market', hidden: true, role: 'dialog', 'aria-label': 'Modules complémentaires' },
      L.h('header', { class: 'home-top mk-top' },
        L.h('div', { class: 'mk-top-l' },
          L.h('button', { class: 'home-back mk-close', title: 'Retour (Échap)', onclick: () => hide() }, ico('back'), L.h('span', { class: 'home-back-l', text: 'Retour' })),
          L.h('div', { class: 'mk-brand' }, L.h('span', { class: 'mk-brand-ic' }, ico('puzzle')), L.h('span', null, 'Modules', L.h('small', { text: 'complémentaires' })))),
        L.h('label', { class: 'home-search' }, ico('search'), search, clear),
        L.h('div', { class: 'home-top-r' })),
      scroll);
    document.body.appendChild(root);
    root.addEventListener('keydown', e => {
      if (!L.$('#modal').hidden || e.key !== 'Escape' || e.target.closest('input')) return;
      e.preventDefault();
      if (cur) paintList(); else hide();
    });
  }
  function show(id) {
    if (!root) build();
    if (App.closeMenus) App.closeMenus();
    if (L.MathDock) L.MathDock.cancel();
    root.hidden = false;
    document.body.classList.add('market-on');
    search.value = ''; root.querySelector('.home-clear').hidden = true;
    tab = 'all'; cat = '';
    if (!unsub) unsub = M().onChange(() => repaint());
    if (id && M().get(id)) openDetail(id); else paintList();
    M().loadRatings(true);
    setTimeout(() => { if (!root.hidden && L.$('#modal').hidden && !cur) search.focus({ preventScroll: true }); }, 60);
  }
  function hide() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('market-on');
    if (unsub) { unsub(); unsub = null; }
  }

  L.Market = { show, hide, visible: () => !!root && !root.hidden };
})();
