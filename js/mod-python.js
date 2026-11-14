/* Module complémentaire « Exécution Python ».

   Une fois installé (page Modules), chaque bloc de code Python de l'éditeur reçoit un
   bouton ▶ Exécuter (ou Ctrl+Entrée dans le code). Le code s'exécute sur l'ordinateur
   avec le Python installé (electron/python.js), et le résultat s'affiche dans la
   console en bas de l'éditeur : texte, erreurs expliquées en français, graphiques
   matplotlib. Le résultat ne fait pas partie du document, sauf si on l'y insère.

   Pont vers l'ordinateur : l'application de bureau (lheDesktop.py), ou le serveur
   local de développement (node server.js, adresse localhost). Sur le site web, le
   module n'est pas disponible (un navigateur ne peut pas lancer Python). */
(function () {
  const ID = 'python';
  const TIMEOUT = 60 * 1000;
  const PY_ORG = 'https://www.python.org/downloads/';

  /* ---------- Pont ---------- */
  const isLocal = location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  async function post(what, body) {
    const r = await fetch('/__lhe/py/' + what, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LHE': '1' }, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error(r.status === 404 ? 'serveur local trop ancien : relancez « node server.js »' : 'erreur ' + r.status + ' du serveur local');
    return r.json();
  }
  const bridge = window.lheDesktop && lheDesktop.py
    ? { kind: 'desktop', check: f => lheDesktop.py.check(!!f), run: o => lheDesktop.py.run(o), stop: id => lheDesktop.py.stop(id), install: () => lheDesktop.py.install() }
    : isLocal
      ? { kind: 'local', check: f => post('check', { force: !!f }), run: o => post('run', o), stop: id => post('stop', { id }), install: () => post('install') }
      : null;

  /* ---------- Python de l'ordinateur ---------- */
  let py = null;   // { ok, version, exe, libs } après une vérification
  const statusSubs = new Set();
  async function check(force) {
    if (!bridge) return { ok: false, nobridge: true };
    try { py = await bridge.check(force); } catch (e) { py = { ok: false, error: String((e && e.message) || e) }; }
    statusSubs.forEach(f => { try { f(py); } catch (e) { /* ignoré */ } });
    return py;
  }
  const pipCmd = pkg => (py && py.exe ? (/\s/.test(py.exe) ? '"' + py.exe + '"' : py.exe) : (navigator.platform.startsWith('Win') ? 'py' : 'python3')) + ' -m pip install ' + pkg;
  const PIP = { sklearn: 'scikit-learn', cv2: 'opencv-python', PIL: 'pillow', yaml: 'pyyaml', bs4: 'beautifulsoup4' };

  /* ---------- Icônes ---------- */
  const ICO = {
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    term: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    insert: '<path d="M12 4v10M7.5 9.5L12 14l4.5-4.5"/><path d="M4 18.5h16"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    kbd: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8.5"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    redo: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  };
  function ic(name, size) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 15); s.setAttribute('height', size || 15);
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICO[name] || '';
    return s;
  }
  const secs = ms => (ms < 1000 ? (ms / 1000).toFixed(2) : ms < 10000 ? (ms / 1000).toFixed(1) : String(Math.round(ms / 1000))).replace('.', ',') + ' s';

  /* ---------- État des exécutions ---------- */
  const results = new Map();   // id du bloc → { res, code, at }
  const inputs = new Map();    // id du bloc → entrées (input())
  const okDocs = new WeakSet(); // documents dont l'exécution a été acceptée
  let run = null;              // exécution en cours { id, blockId, t0, code }
  let ticker = 0;
  let shown = null;            // bloc affiché dans la console
  let showInputs = false;

  const blockOf = id => { const f = window.App && App.doc && L.find(App.doc, id); return f && f.block.type === 'code' ? f.block : null; };
  const preOf = id => L.$('#paper .blk[data-id="' + id + '"] pre.code-edit');
  const codeOf = id => { const pre = preOf(id); if (pre) return pre.innerText.replace(/\n$/, ''); const b = blockOf(id); return b ? b.code || '' : ''; };
  const firstLine = code => { const l = String(code || '').split('\n').find(s => s.trim()) || ''; return l.trim().length > 46 ? l.trim().slice(0, 45) + '…' : l.trim(); };

  /* Première exécution dans un document : on prévient (un document reçu peut contenir du code dangereux) */
  function confirmDoc() {
    if (!App.doc || okDocs.has(App.doc)) return Promise.resolve(true);
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; if (v) okDocs.add(App.doc); resolve(v); };
      L.modal({
        title: 'Exécuter du code sur cet ordinateur ?',
        cls: 'py-confirm-modal',
        body: L.h('div', { class: 'py-confirm' },
          L.h('div', { class: 'py-confirm-ic' }, ic('warn', 22)),
          L.h('div', null,
            L.h('p', { html: 'Le code Python s\'exécute <b>sur votre ordinateur</b>, avec les mêmes droits que vous : il peut lire, modifier ou supprimer vos fichiers.' }),
            L.h('p', { html: 'Si ce document vous a été <b>envoyé par quelqu\'un d\'autre</b>, lisez le code avant de l\'exécuter. Votre propre code ne pose aucun problème.' }),
            L.h('small', { text: 'Cette question n\'est posée qu\'une fois par document ouvert.' }))),
        foot: [
          { text: 'Annuler', onClick: c => { finish(false); c(); } },
          { text: '▶  Exécuter', cls: 'primary', onClick: c => { finish(true); c(); } },
        ],
        onClose: () => finish(false),
      });
    });
  }

  async function runBlock(id) {
    if (run) {
      if (run.blockId === id) return stopRun();
      L.toast('Un autre code est déjà en cours d\'exécution.');
      return;
    }
    const b = blockOf(id);
    if (!b) return;
    const code = codeOf(id);
    if (!code.trim()) { L.toast('Ce bloc de code est vide.'); return; }
    shown = id;
    if (!bridge) { openConsole(); return; }
    if (!(await confirmDoc())) return;
    const pre = preOf(id);
    if (pre && App.syncField) { App.syncField(pre); App.commit(); }
    run = { id: L.uid('r'), blockId: id, t0: Date.now(), code };
    openConsole();
    paintAll();
    clearInterval(ticker);
    ticker = setInterval(tick, 100);
    let res;
    try {
      res = await bridge.run({ id: run.id, code, stdin: inputs.get(id) || '', timeout: TIMEOUT, docPath: App.filePath || null });
    } catch (e) { res = { ok: false, error: 'bridge', message: String((e && e.message) || e) }; }
    clearInterval(ticker);
    if (res && res.error === 'nopython') py = { ok: false };
    else if (res && res.ok && res.version && (!py || !py.ok)) check(false);
    results.set(id, { res: res || { ok: false, error: 'bridge' }, code, at: Date.now() });
    if (res && res.ok) L.Modules.used(ID);       // le programme a tourné (même terminé par une erreur)
    run = null;
    paintAll();
    if (App.sel === id) App.updateProps();
  }
  function stopRun() {
    if (!run) return;
    try { bridge.stop(run.id); } catch (e) { /* déjà terminé */ }
  }
  function tick() {
    if (!run) return;
    const t = secs(Date.now() - run.t0);
    L.$$('.py-elapsed').forEach(x => { x.textContent = t; });
  }

  /* ---------- Bouton ▶ sur les blocs de code ---------- */
  function decorate(b, el) {
    if (b.lang !== 'python') return;
    el.classList.add('py-able');
    const bar = L.h('div', { class: 'py-bar', contenteditable: 'false' });
    el.appendChild(bar);
    paintBar(bar, b.id);
  }
  function chipFor(id) {
    const r = results.get(id);
    if (run && run.blockId === id) return L.h('span', { class: 'py-chip run' }, L.h('i', { class: 'py-spin' }), L.h('span', { class: 'py-elapsed', text: secs(Date.now() - run.t0) }));
    if (!r) return null;
    const a = analyse(r.res);
    const stale = r.code !== codeOf(id);
    const chip = L.h('button', { class: 'py-chip ' + a.kind + (stale ? ' stale' : ''), title: (stale ? 'Code modifié depuis cette exécution — ' : '') + 'Voir le résultat dans la console' },
      a.kind === 'ok' ? ic('check', 13) : a.kind === 'err' ? ic('x', 13) : ic('stop', 11), a.short);
    chip.onmousedown = e => e.preventDefault();
    chip.onclick = e => { e.stopPropagation(); shown = id; openConsole(); };
    return chip;
  }
  function paintBar(bar, id) {
    const running = run && run.blockId === id;
    const btn = L.h('button', { class: 'py-run' + (running ? ' stop' : ''), title: running ? 'Arrêter l\'exécution' : 'Exécuter ce code (Ctrl+Entrée)' },
      ic(running ? 'stop' : 'play', running ? 11 : 12), L.h('span', { text: running ? 'Arrêter' : 'Exécuter' }));
    btn.onmousedown = e => e.preventDefault();   // le curseur reste dans le code
    btn.onclick = e => { e.stopPropagation(); running ? stopRun() : runBlock(id); };
    bar.replaceChildren(...[chipFor(id), btn].filter(Boolean));
  }
  function paintBars() {
    L.$$('#paper .code.py-able > .py-bar').forEach(bar => { const blk = bar.closest('.blk'); if (blk) paintBar(bar, blk.dataset.id); });
  }

  /* ---------- Analyse du résultat (erreurs expliquées) ---------- */
  const EXPL = {
    SyntaxError: 'Erreur de syntaxe : parenthèse ou guillemet non fermé, « : » oublié après if, for, while ou def, opérateur mal écrit…',
    IndentationError: 'Indentation incorrecte : les lignes d\'un même bloc doivent commencer au même niveau (4 espaces après if, for, def…).',
    TabError: 'Tabulations et espaces mélangés dans l\'indentation : utilisez seulement des espaces.',
    NameError: 'Nom inconnu : variable ou fonction utilisée avant d\'être définie, ou faute de frappe (attention aux majuscules).',
    UnboundLocalError: 'Variable utilisée dans la fonction avant d\'y avoir reçu une valeur.',
    TypeError: 'Types incompatibles (par exemple un nombre + un texte), ou mauvais nombre d\'arguments donnés à une fonction.',
    ValueError: 'Valeur incorrecte pour cette opération (par exemple int("abc") ou sqrt(-1)).',
    ZeroDivisionError: 'Division par zéro.',
    IndexError: 'Indice hors de la liste : pour une liste de n éléments, les indices vont de 0 à n − 1.',
    KeyError: 'Cette clé n\'existe pas dans le dictionnaire.',
    AttributeError: 'Cet objet n\'a pas cet attribut ou cette méthode (faute de frappe ? mauvais type ?).',
    RecursionError: 'Trop d\'appels récursifs imbriqués : vérifiez le cas de base de la fonction récursive.',
    OverflowError: 'Nombre trop grand pour être représenté.',
    AssertionError: 'Une assertion (assert) est fausse.',
    MemoryError: 'Mémoire insuffisante : le programme crée sans doute une liste beaucoup trop grande.',
    EOFError: 'Le programme attend une saisie au clavier (input) : écrivez les valeurs dans « Entrées », une par ligne, puis relancez.',
    FileNotFoundError: 'Fichier introuvable.',
  };
  function analyse(res) {
    if (!res || !res.ok) {
      const e = res && res.error;
      return { kind: 'err', short: 'Erreur', title: e === 'nopython' ? 'Python introuvable' : 'Exécution impossible', sys: e || 'bridge' };
    }
    if (res.timedOut) return { kind: 'stop', short: 'Trop long', title: 'Arrêté au bout de ' + Math.round(res.timeout / 1000) + ' s' };
    if (res.stopped) return { kind: 'stop', short: 'Arrêté', title: 'Arrêté' };
    const err = res.output.filter(o => o.s === 'err').map(o => o.t).join('');
    const lines = err.replace(/\r/g, '').trim().split('\n');
    let line = null, m;
    const re = /File "code\.py", line (\d+)/g;
    while ((m = re.exec(err))) line = +m[1];
    const last = lines[lines.length - 1] || '';
    const em = /^([A-Za-z_][\w.]*)(?::\s?(.*))?$/.exec(last);
    const type = em && /(Error|Exception|Interrupt)$/.test(em[1]) ? em[1].split('.').pop() : null;
    if (res.exitCode === 0 && !type) return { kind: 'ok', short: secs(res.ms), title: 'Terminé en ' + secs(res.ms) };
    return { kind: 'err', short: type ? type.replace(/Error$/, '') || 'Erreur' : 'Code ' + res.exitCode, title: type ? type + (line ? ' (ligne ' + line + ')' : '') : 'Terminé avec le code ' + res.exitCode, type, msg: em && em[2], line };
  }

  /* ---------- Console (en bas de l'éditeur) ---------- */
  let con = null;
  const H = { get: () => Math.max(120, Math.min(+(L.store.get('lhe-pyc-h') || 260), window.innerHeight - 220)), set: h => L.store.set('lhe-pyc-h', String(Math.round(h))) };
  function buildConsole() {
    con = L.h('section', { id: 'pyConsole', class: 'pyc', 'aria-label': 'Console Python' });
    con.style.height = H.get() + 'px';
    const grip = L.h('div', { class: 'pyc-grip', title: 'Glisser pour agrandir ou réduire la console' });
    grip.onpointerdown = e => {
      e.preventDefault();
      const y0 = e.clientY, h0 = con.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      con.classList.add('resizing');
      const mv = ev => { const h = Math.max(120, Math.min(h0 + (y0 - ev.clientY), window.innerHeight - 220)); con.style.height = h + 'px'; };
      const up = () => { grip.removeEventListener('pointermove', mv); con.classList.remove('resizing'); H.set(con.offsetHeight); if (App.layoutSheets) App.layoutSheets(); };
      grip.addEventListener('pointermove', mv);
      grip.addEventListener('pointerup', up, { once: true });
      grip.addEventListener('pointercancel', up, { once: true });
    };
    con.append(grip, L.h('div', { class: 'pyc-head' }), L.h('div', { class: 'pyc-body' }));
    const center = L.$('#center');
    center.insertBefore(con, L.$('#statusBar', center));
  }
  function openConsole() {
    if (!con) buildConsole();
    con.hidden = false;
    con.classList.remove('min');
    L.store.set('lhe-pyc-min', '0');
    paintConsole();
  }
  function closeConsole() { if (con) con.hidden = true; }
  const tbtn = (icon, label, fn, cls, title) => {
    const b = L.h('button', { class: 'pyc-btn' + (cls ? ' ' + cls : ''), title: title || label }, ic(icon, 14), label ? L.h('span', { text: label }) : null);
    b.onclick = fn;
    return b;
  };
  function paintConsole() {
    if (!con || con.hidden) return;
    const id = shown && blockOf(shown) ? shown : null;
    const r = id ? results.get(id) : null;
    const running = run && run.blockId === id;
    const a = r ? analyse(r.res) : null;
    const ro = document.body.classList.contains('ro');

    // En-tête
    const status = running ? L.h('span', { class: 'pyc-st run' }, L.h('i', { class: 'py-spin' }), 'Exécution… ', L.h('span', { class: 'py-elapsed', text: secs(Date.now() - run.t0) }))
      : a ? L.h('span', { class: 'pyc-st ' + a.kind }, ic(a.kind === 'ok' ? 'check' : a.kind === 'err' ? 'x' : 'stop', 13), a.title) : null;
    const ctx = id ? L.h('button', { class: 'pyc-ctx', title: 'Afficher le bloc de code dans le document', text: firstLine(codeOf(id)) || 'Bloc de code' }) : null;
    if (ctx) ctx.onclick = () => { const el = App.blockEl(id); if (el) { App.select(id); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    const acts = [];
    if (id) {
      acts.push(tbtn('kbd', 'Entrées', () => { showInputs = !showInputs; paintConsole(); }, showInputs ? 'on' : '', 'Valeurs lues par input(), une par ligne'));
      if (running) acts.push(tbtn('stop', 'Arrêter', stopRun, 'danger'));
      else acts.push(tbtn('play', r ? 'Relancer' : 'Exécuter', () => runBlock(id), 'primary', 'Exécuter ce code (Ctrl+Entrée)'));
      if (r && r.res.ok && r.res.output.length) {
        acts.push(tbtn('copy', '', () => copyOut(r), '', 'Copier la sortie'));
        if (!ro) acts.push(tbtn('insert', '', () => insertOut(id, r), '', 'Insérer la sortie dans le document, sous le code'));
      }
      if (r) acts.push(tbtn('trash', '', () => { results.delete(id); paintAll(); }, '', 'Effacer le résultat'));
    }
    const minimized = con.classList.contains('min');
    acts.push(tbtn(minimized ? 'up' : 'down', '', () => { con.classList.toggle('min'); L.store.set('lhe-pyc-min', con.classList.contains('min') ? '1' : '0'); paintConsole(); if (App.layoutSheets) App.layoutSheets(); }, '', minimized ? 'Agrandir la console' : 'Réduire la console'));
    acts.push(tbtn('x', '', closeConsole, '', 'Fermer la console'));
    L.$('.pyc-head', con).replaceChildren(...[
      L.h('span', { class: 'pyc-title' }, L.h('span', { class: 'pyc-logo' }, ic('term', 15)), 'Console Python'),
      ctx, status,
      r && !running && r.code !== codeOf(id) ? L.h('span', { class: 'pyc-stale', text: 'code modifié depuis', title: 'Le code a changé depuis cette exécution : relancez pour mettre à jour le résultat' }) : null,
      L.h('span', { class: 'pyc-flex' }), ...acts].filter(Boolean));

    // Corps
    const body = L.$('.pyc-body', con);
    if (minimized) { body.replaceChildren(); return; }
    const main = L.h('div', { class: 'pyc-out' });
    if (!bridge) main.append(notice('info', 'Disponible dans l\'application de bureau', 'Un navigateur ne peut pas lancer Python sur l\'ordinateur. Ouvrez ce document dans LaTeX Home Edition pour Windows, macOS ou Linux pour exécuter le code.'));
    else if (!id) main.append(L.h('div', { class: 'pyc-empty' }, ic('play', 22), L.h('b', { text: 'Aucune exécution pour l\'instant' }),
      L.h('span', { html: 'Cliquez sur <b>▶ Exécuter</b> en haut à droite d\'un bloc de code Python, ou appuyez sur <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> dans le code.' })));
    else if (running && !r) main.append(L.h('div', { class: 'pyc-wait' }, L.h('i', { class: 'py-spin big' }), 'Exécution en cours…'));
    else if (!r) main.append(L.h('div', { class: 'pyc-empty' }, ic('play', 22), L.h('b', { text: 'Ce code n\'a pas encore été exécuté' }), L.h('span', { html: 'Cliquez sur <b>Exécuter</b> ci-dessus.' })));
    else paintResult(main, id, r, a);
    if (running && r) main.classList.add('dim');
    const kids = [main];
    if (id && showInputs) {
      const ta = L.h('textarea', { class: 'pyc-in', spellcheck: 'false', placeholder: 'Une valeur par ligne :\n12\n3.5\nBonjour' });
      ta.value = inputs.get(id) || '';
      ta.oninput = () => inputs.set(id, ta.value);
      ta.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runBlock(id); } };
      kids.push(L.h('div', { class: 'pyc-inputs' }, L.h('b', { text: 'Entrées du programme' }), L.h('small', { text: 'Lues dans l\'ordre par input(), une par ligne.' }), ta));
    }
    body.replaceChildren(...kids);
    // Erreur : on descend jusqu'à l'explication (comme un terminal) ; sinon, début de la sortie
    main.scrollTop = a && a.kind === 'err' ? main.scrollHeight : 0;
  }
  function notice(icon, title, text, extra) {
    return L.h('div', { class: 'pyc-note ' + icon }, ic(icon === 'warn' ? 'warn' : 'info', 18), L.h('div', null, L.h('b', { text: title }), L.h('span', { html: text }), extra || null));
  }
  function paintResult(main, id, r, a) {
    const res = r.res;
    if (!res.ok) {
      if (res.error === 'nopython') { main.append(noPython()); return; }
      main.append(notice('warn', 'Exécution impossible', L.escHtml(res.message || res.error || 'erreur inconnue')));
      return;
    }
    const pre = L.h('pre', { class: 'pyc-pre' });
    res.output.forEach(o => pre.appendChild(L.h('span', { class: o.s === 'err' ? 'e' : 'o', text: o.t.replace(/\r\n/g, '\n') })));
    if (!res.output.length) pre.appendChild(L.h('span', { class: 'none', text: res.figures.length ? '(aucun texte affiché)' : '(le programme n\'a rien affiché : utilisez print(…) pour afficher un résultat)' }));
    if (res.truncated) pre.appendChild(L.h('span', { class: 'none', text: '\n… sortie tronquée (trop longue)' }));
    if (res.timedOut) pre.appendChild(L.h('span', { class: 'e', text: '\n■ Arrêté : le programme a dépassé ' + Math.round(res.timeout / 1000) + ' s (boucle infinie ?).' }));
    else if (res.stopped) pre.appendChild(L.h('span', { class: 'none', text: '\n■ Exécution arrêtée.' }));
    // Ligne de l'erreur : cliquable, montre la ligne dans le bloc de code
    if (a.line) pre.querySelectorAll('span.e').forEach(sp => {
      const t = sp.textContent, k = t.lastIndexOf('File "code.py", line ' + a.line);
      if (k < 0) return;
      const tag = 'File "code.py", line ' + a.line;
      const link = L.h('button', { class: 'pyc-line', text: 'ligne ' + a.line, title: 'Montrer la ligne ' + a.line + ' dans le code' });
      link.onclick = () => goLine(id, a.line);
      sp.replaceChildren(t.slice(0, k) + 'File "code.py", ', link, t.slice(k + tag.length));
    });
    main.appendChild(pre);
    if (a.kind === 'err' && a.type) main.appendChild(explain(a));
    if (res.figures && res.figures.length) {
      const ro = document.body.classList.contains('ro');
      main.appendChild(L.h('div', { class: 'pyc-figs' }, ...res.figures.map((src, i) => {
        const fig = L.h('figure', { class: 'pyc-fig' }, L.h('img', { src, alt: 'Graphique ' + (i + 1) }),
          L.h('figcaption', null, L.h('span', { text: 'Graphique ' + (i + 1) }),
            ro ? null : tbtn('insert', 'Insérer', () => insertFig(id, src), 'primary', 'Insérer ce graphique dans le document, sous le code'),
            tbtn('save', '', () => saveFig(src, i), '', 'Enregistrer l\'image (PNG)')));
        return fig;
      })));
    }
  }
  function explain(a) {
    let text = EXPL[a.type] || '';
    let extra = null;
    if (a.type === 'ModuleNotFoundError' || a.type === 'ImportError') {
      const mod = (/No module named '([^'.]+)/.exec(a.msg || '') || [])[1];
      if (mod) {
        const cmd = pipCmd(PIP[mod] || mod);
        text = 'La bibliothèque <b>' + L.escHtml(mod) + '</b> n\'est pas installée. Pour l\'installer, ouvrez un terminal (invite de commandes) et tapez :';
        const c = L.h('code', { text: cmd });
        extra = L.h('div', { class: 'pyc-cmd' }, c, tbtn('copy', 'Copier', () => { navigator.clipboard.writeText(cmd).then(() => L.toast('Commande copiée')); }));
      }
    }
    if (a.type === 'FileNotFoundError') text += App.filePath && bridge && bridge.kind === 'desktop' ? ' Le code s\'exécute dans le dossier du document : rangez le fichier à côté du document .lhe.' : ' Enregistrez le document sur l\'ordinateur (.lhe) : le code s\'exécutera alors dans son dossier et pourra lire un fichier rangé à côté.';
    if (!text) return L.h('div');
    return notice('info', (a.line ? 'Ligne ' + a.line + ' — ' : '') + a.type, text, extra);
  }
  function noPython() {
    const box = L.h('div', { class: 'pyc-acts' });
    const msg = L.h('small', { class: 'pyc-msg' });
    const recheck = tbtn('redo', 'Vérifier à nouveau', async () => {
      msg.textContent = 'Recherche de Python…';
      const r = await check(true);
      if (r.ok) { msg.textContent = ''; L.toast('Python ' + r.version + ' trouvé'); if (shown) runBlock(shown); }
      else msg.textContent = 'Python est toujours introuvable.';
    });
    const inst = tbtn('save', 'Installer Python pour moi', async () => {
      inst.disabled = true; recheck.disabled = true;
      msg.replaceChildren(L.h('i', { class: 'py-spin' }), ' Installation de Python (téléchargement et installation, 1 à 3 minutes)…');
      let r;
      try { r = await bridge.install(); } catch (e) { r = { ok: false, reason: 'failed', detail: String(e.message || e) }; }
      inst.disabled = false; recheck.disabled = false;
      if (r.ok) { py = r.python; msg.textContent = ''; L.toast('Python ' + r.python.version + ' installé'); if (shown) runBlock(shown); }
      else { msg.textContent = r.reason === 'failed' ? 'L\'installation automatique a échoué. Installez Python depuis python.org.' : 'Installation automatique indisponible ici : installez Python depuis python.org.'; window.open(PY_ORG, '_blank'); }
    }, 'primary');
    box.append(inst, tbtn('save', 'python.org', () => window.open(PY_ORG, '_blank'), '', 'Télécharger Python sur le site officiel'), recheck, msg);
    return notice('warn', 'Python est introuvable sur cet ordinateur', 'Le module a besoin de Python 3 installé. Installez-le, puis relancez.', box);
  }

  /* Sélectionne une ligne du code dans le document */
  function goLine(id, n) {
    const pre = preOf(id);
    if (!pre) return;
    App.select(id);
    pre.focus();
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let line = 1, node, start = null, end = null;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue;
      for (let i = 0; i <= t.length; i++) {
        if (line === n && !start) start = { node, i };
        if (line === n && (i === t.length ? false : t[i] === '\n')) { end = { node, i }; break; }
        if (i < t.length && t[i] === '\n') line++;
      }
      if (end) break;
    }
    if (!start) return;
    const rg = document.createRange();
    rg.setStart(start.node, start.i);
    if (end) rg.setEnd(end.node, end.i); else rg.setEnd(pre, pre.childNodes.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    const el = start.node.parentElement;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- Copier, insérer, enregistrer ---------- */
  const outText = r => r.res.output.map(o => o.t).join('').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  function copyOut(r) { navigator.clipboard.writeText(outText(r)).then(() => L.toast('Sortie copiée'), () => L.toast('Copie impossible', 'err')); }
  function insertOut(id, r) {
    const text = outText(r);
    if (!text) return L.toast('Rien à insérer.');
    const b = Object.assign(L.newBlock('code'), { lang: 'texte', code: text.length > 20000 ? text.slice(0, 20000) + '\n…' : text });
    App.insertBlocks([b], { after: id });
    L.toast('Sortie insérée sous le code');
  }
  function insertFig(id, src) {
    App.insertBlocks([Object.assign(L.newBlock('figure'), { src, width: 70 })], { after: id });
    L.toast('Graphique inséré sous le code');
  }
  async function saveFig(src, i) {
    const blob = await (await fetch(src)).blob();
    L.download('graphique-' + (i + 1) + '.png', blob);
  }

  function paintAll() { paintBars(); paintConsole(); }

  /* ---------- Fiche du module (page Modules) ---------- */
  function requirementsBox() {
    const box = L.h('div', { class: 'mk-req' });
    const paint = () => {
      const libs = ['numpy', 'matplotlib', 'scipy', 'pandas'];
      const line = !bridge ? L.h('div', { class: 'mk-req-st warn' }, ic('info', 15), 'Application de bureau nécessaire')
        : !py ? L.h('div', { class: 'mk-req-st' }, ic('info', 15), 'Python pas encore vérifié')
          : py.ok ? L.h('div', { class: 'mk-req-st ok', title: py.exe }, ic('check', 15), 'Python ' + py.version + ' détecté')
            : L.h('div', { class: 'mk-req-st warn' }, ic('warn', 15), 'Python introuvable sur cet ordinateur');
      const btn = bridge ? L.h('button', { class: 'mk-link', text: py ? 'Vérifier à nouveau' : 'Vérifier maintenant' }) : null;
      if (btn) btn.onclick = async () => { btn.disabled = true; btn.textContent = 'Recherche…'; await check(true); paint(); };
      box.replaceChildren(...[
        L.h('p', { text: 'Python 3.6 ou plus récent, installé sur l\'ordinateur. Si Python manque, l\'installation du module propose de l\'installer pour vous.' }),
        line, btn,
        py && py.ok ? L.h('div', { class: 'mk-libs' }, L.h('small', { text: 'Bibliothèques (facultatives) :' }),
          L.h('div', null, ...libs.map(l => L.h('span', { class: 'mk-lib' + (py.libs.includes(l) ? ' on' : ''), title: py.libs.includes(l) ? 'Installée' : 'Non installée — ' + pipCmd(l), text: (py.libs.includes(l) ? '✓ ' : '') + l })))) : null].filter(Boolean));
    };
    paint();
    if (bridge && !py) check(false).then(paint);
    return box;
  }
  /* Illustration de la fiche : un bloc de code et la console */
  function preview() {
    const code = '<span class="k">import</span> numpy <span class="k">as</span> np\n\nt = np.linspace(<span class="n">0</span>, <span class="n">2</span>, <span class="n">5</span>)\nx = <span class="n">0.5</span> * <span class="n">9.81</span> * t**<span class="n">2</span>\n<span class="b">print</span>(<span class="s">"Chute libre :"</span>, x.round(<span class="n">2</span>))';
    return L.h('div', { class: 'mk-prev', 'aria-hidden': 'true' },
      L.h('div', { class: 'mk-prev-page' },
        L.h('div', { class: 'mk-prev-h', text: '2) Étude numérique' }),
        L.h('div', { class: 'mk-prev-p' }), L.h('div', { class: 'mk-prev-p s' }),
        L.h('div', { class: 'mk-prev-code' }, L.h('span', { class: 'mk-prev-run' }, ic('play', 10), 'Exécuter'), L.h('pre', { html: code }))),
      L.h('div', { class: 'mk-prev-con' },
        L.h('div', { class: 'mk-prev-con-h' }, ic('term', 13), 'Console Python', L.h('span', { class: 'ok' }, ic('check', 12), 'Terminé en 0,09 s')),
        L.h('pre', { text: 'Chute libre : [ 0.    0.49  1.96  4.41  7.85]' })));
  }

  /* ---------- Installation (appelée par la page Modules) ---------- */
  async function install(ui) {
    if (!bridge) { ui.fail('env', 'Ce module fonctionne dans l\'application de bureau LaTeX Home Edition : un navigateur ne peut pas lancer Python.'); return false; }
    ui.step('py', 'Recherche de Python sur l\'ordinateur');
    let r = await check(true);
    while (!r.ok) {
      ui.fail('py', 'Python n\'est pas installé sur cet ordinateur (ou il est introuvable).');
      const c = await ui.ask({
        title: 'Python est nécessaire',
        text: 'Ce module exécute votre code avec Python. Voulez-vous que LaTeX Home Edition installe Python pour vous ?',
        actions: [
          { v: 'install', label: 'Installer Python pour moi', sub: 'Python 3.14 officiel · ~30 Mo · 1 à 3 min · sans droits administrateur', primary: true, hidden: !/^Win/.test(navigator.platform) },
          { v: 'manual', label: 'Je l\'installe moi-même', sub: 'Ouvre python.org ; revenez ensuite ici' },
          { v: 'cancel', label: 'Annuler l\'installation du module', danger: true },
        ],
      });
      if (c === 'cancel' || !c) return false;
      if (c === 'install') {
        ui.step('inst', 'Installation de Python 3.14', 'Téléchargement et installation depuis python.org (via Windows), 1 à 3 minutes…', true);
        let res;
        try { res = await bridge.install(); } catch (e) { res = { ok: false, reason: 'failed', detail: String(e.message || e) }; }
        if (res.ok) { py = res.python; r = res.python; ui.ok('inst', 'Python ' + res.python.version + ' installé'); break; }
        ui.fail('inst', res.reason === 'nowinget' ? 'L\'installation automatique n\'est pas disponible sur cet ordinateur (outil winget absent).'
          : res.reason === 'manual' ? 'L\'installation automatique n\'existe que sous Windows.'
            : 'L\'installation automatique a échoué' + (res.detail ? ' : ' + res.detail : '.'));
      }
      window.open(PY_ORG, '_blank');
      const c2 = await ui.ask({
        title: 'Installez Python, puis revenez ici',
        text: 'Sur python.org, téléchargez la dernière version de Python 3 et lancez l\'installation (sous Windows, cochez « Add python.exe to PATH »). Quand c\'est fini :',
        actions: [
          { v: 'recheck', label: 'C\'est fait : vérifier à nouveau', primary: true },
          { v: 'open', label: 'Rouvrir python.org' },
          { v: 'cancel', label: 'Annuler l\'installation du module', danger: true },
        ],
      });
      if (c2 === 'cancel' || !c2) return false;
      if (c2 === 'open') { window.open(PY_ORG, '_blank'); }
      ui.step('py', 'Nouvelle recherche de Python');
      r = await check(true);
    }
    ui.ok('py', 'Python ' + r.version + ' trouvé', r.exe);
    const want = ['numpy', 'matplotlib'].filter(l => !(r.libs || []).includes(l));
    ui.step('libs', 'Bibliothèques scientifiques');
    ui.ok('libs', want.length ? 'Facultatif : ' + want.join(' et ') + (want.length > 1 ? ' ne sont pas installées' : ' n\'est pas installée') + ' (calcul numérique, graphiques).' : 'numpy et matplotlib sont disponibles.',
      want.length ? 'Pour les ajouter : ' + pipCmd(want.join(' ')) : null, want.length ? 'note' : 'ok');
    return true;
  }

  function deactivate() {
    if (run) stopRun();
    results.clear();
    if (con) { con.remove(); con = null; }
  }

  const SAMPLE = '# Exemple : moyenne et écart-type d\'une série de mesures\nfrom statistics import mean, stdev\n\nmesures = [9.79, 9.83, 9.81, 9.78, 9.84]   # g en m/s²\nprint(f"Moyenne    : {mean(mesures):.3f} m/s²")\nprint(f"Écart-type : {stdev(mesures):.3f} m/s²")\nprint(f"u(g)       : {stdev(mesures) / len(mesures) ** 0.5:.3f} m/s²")';

  L.Modules.register({
    id: ID,
    name: 'Exécution Python',
    version: '1.0.0',
    author: 'LaTeX Home Edition',
    official: true,
    category: 'Programmation',
    tags: ['Python', 'Code', 'Sciences'],
    colors: ['#3b77c4', '#f2b134'],
    icon: '<path d="M8.5 8.5L5 12l3.5 3.5M15.5 8.5L19 12l-3.5 3.5"/><path d="M13.2 6.5l-2.4 11"/>',
    tagline: 'Exécutez vos blocs de code Python et voyez le résultat, graphiques compris, sans quitter le document.',
    description: '<p>Collez ou écrivez votre code dans un bloc <b>Code informatique</b> en Python, puis cliquez sur <b>▶ Exécuter</b> : le programme tourne sur votre ordinateur et son résultat s\'affiche aussitôt dans une console, en bas de l\'éditeur.</p>'
      + '<p>Idéal pour vérifier un algorithme d\'un TP, une fonction récursive d\'un DS d\'informatique, ou faire un calcul d\'incertitudes sans ouvrir un autre logiciel. Les erreurs sont expliquées en français, avec la ligne en cause, et les graphiques <i>matplotlib</i> s\'insèrent dans le document en un clic.</p>',
    features: [
      ['play', 'Un clic pour exécuter', 'Bouton ▶ sur chaque bloc Python, ou Ctrl+Entrée dans le code.'],
      ['term', 'Console intégrée', 'Sortie du programme et erreurs, en bas de l\'éditeur, sans changer la mise en page.'],
      ['warn', 'Erreurs expliquées', 'Type d\'erreur traduit en français, ligne en cause cliquable.'],
      ['image', 'Graphiques matplotlib', 'Les figures s\'affichent dans la console et s\'insèrent dans le document.'],
      ['kbd', 'Saisies input()', 'Donnez à l\'avance les valeurs lues par input().'],
      ['insert', 'Résultat dans le document', 'Insérez la sortie sous le code, pour un compte rendu ou un corrigé.'],
    ],
    steps: [
      'Insérez un bloc <b>Code informatique</b> (menu Insérer, ou tapez « / code »), langage <b>Python</b>.',
      'Écrivez ou collez votre code.',
      'Cliquez sur <b>▶ Exécuter</b> en haut à droite du bloc, ou appuyez sur <kbd>Ctrl</kbd>+<kbd>Entrée</kbd>.',
      'Lisez le résultat dans la console ; insérez-le dans le document si besoin.',
    ],
    compat: 'Application de bureau (Windows, macOS, Linux)',
    size: 'Inclus dans l\'application',
    updated: '14 novembre 2026',
    privacy: 'Le code s\'exécute uniquement sur votre ordinateur. Rien n\'est envoyé sur Internet.',
    available: () => !!bridge,
    unavailableText: 'Disponible dans l\'application de bureau (un navigateur ne peut pas lancer Python).',
    suggest: (kind, b) => kind === 'code' && b.lang === 'python',
    suggestTitle: 'Exécutez ce code Python',
    suggestText: 'Installez le module « Exécution Python » pour lancer ce code et voir son résultat sans quitter le document.',
    sample: () => Object.assign(L.newBlock('code'), { lang: 'python', code: SAMPLE }),
    afterSample: b => runBlock(b.id),
    installedText: 'Chaque bloc de code Python a maintenant un bouton <b>▶ Exécuter</b> (ou <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> dans le code).',
    usesLabel: n => n > 1 ? n + ' exécutions de code' : n + ' exécution de code',
    install, deactivate, requirementsBox, preview,
    hooks: {
      codeBlock: (b, el) => decorate(b, el),
      codeProps: (b, P, h) => {
        if (b.lang !== 'python') return;
        const running = run && run.blockId === b.id;
        P.append(h.sec('Exécution Python',
          h.btn(running ? '■  Arrêter' : '▶  Exécuter le code', () => (running ? stopRun() : runBlock(b.id)), 'primary wide', 'Ctrl+Entrée dans le code'),
          h.btn('Ouvrir la console', () => { shown = b.id; openConsole(); }, 'wide'),
          h.help('Raccourci : <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> dans le code. Le résultat s\'affiche dans la console, en bas ; il n\'entre dans le document que si vous l\'insérez.')));
      },
      codeKey: (e, b) => {
        if (b.lang !== 'python' || !(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return false;
        e.preventDefault();
        runBlock(b.id);
        return true;
      },
    },
  });

  L.PyRun = { run: runBlock, stop: stopRun, check, openConsole, bridge: () => bridge };
})();
