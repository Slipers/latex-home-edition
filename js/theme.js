/* Apparence de l'application : thème clair, sombre ou automatique (selon le
   système), et option « feuille sombre ». C'est un réglage de l'ordinateur,
   pas du document : il est gardé dans le stockage local (appliqué avant
   l'affichage, voir index.html) et, dans l'application de bureau, partagé
   entre toutes les fenêtres. */
(function () {
  const KEY = 'lhe-theme', PAPER = 'lhe-paper-dark';
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };

  const get = () => ({ theme: read(KEY, 'light'), paperDark: read(PAPER, '0') === '1' });
  function apply() {
    const { theme, paperDark } = get();
    const dark = theme === 'dark' || (theme === 'auto' && mq && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (dark && paperDark) document.documentElement.dataset.paper = 'dark';
    else delete document.documentElement.dataset.paper;
  }
  function set(theme, paperDark) {
    if (theme) write(KEY, theme);
    if (paperDark !== undefined) write(PAPER, paperDark ? '1' : '0');
    apply();
    const g = get();
    if (window.lheDesktop && lheDesktop.setPrefs) lheDesktop.setPrefs({ theme: g.theme, paperDark: g.paperDark }).catch(() => {});
    if (App.layoutSheets && App.doc) requestAnimationFrame(() => App.layoutSheets(true));
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (get().theme === 'auto') apply(); });

  /* Application de bureau : le thème choisi dans une fenêtre vaut pour toutes */
  async function syncDesktop() {
    if (!window.lheDesktop || !lheDesktop.getPrefs) return;
    try {
      const p = await lheDesktop.getPrefs();
      if (p && p.theme && (p.theme !== get().theme || !!p.paperDark !== get().paperDark)) {
        write(KEY, p.theme); write(PAPER, p.paperDark ? '1' : '0'); apply();
      }
    } catch (e) { /* ignoré */ }
  }

  /* Réglage affiché dans « Document » et dans « Préférences » */
  function settingsSection() {
    const cur = get();
    const seg = L.h('div', { class: 'seg theme-seg' });
    const paper = L.h('input', { type: 'checkbox' });
    paper.checked = cur.paperDark;
    const paperRow = L.h('label', { class: 'chk' }, paper, 'Feuille sombre aussi (confort de lecture à l\'écran ; le PDF et l\'impression restent blancs)');
    const paint = () => { paperRow.hidden = get().theme === 'light'; };
    [['light', '☀ Clair'], ['dark', '☾ Sombre'], ['auto', '◐ Comme le système']].forEach(([v, t]) => {
      const b = L.h('button', { class: cur.theme === v ? 'on' : '', text: t });
      b.onclick = () => { set(v); seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); paint(); };
      seg.appendChild(b);
    });
    paper.onchange = () => set(null, paper.checked);
    paint();
    return L.h('div', { class: 'theme-sec' },
      L.h('div', { class: 'set-h', text: 'Apparence de l\'application' }),
      L.h('div', { class: 'field' }, L.h('label', { text: 'Thème' }), seg),
      paperRow,
      L.h('p', { class: 'pp-help', text: 'Réglage de cet ordinateur, valable pour tous les documents.' }));
  }

  apply();
  syncDesktop();
  L.Theme = { get, set, apply, settingsSection };
})();
