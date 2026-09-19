/* Éditeur visuel de formules (MathLive) — sans écrire une ligne de code */

L.PALETTE = [
  { name: 'Courant', items: [
    ['\\frac{#0}{#?}', 'Fraction'], ['#@^{#?}', 'Puissance / exposant', 'x^{\\square}'], ['#@_{#?}', 'Indice', 'x_{\\square}'],
    ['\\sqrt{#0}', 'Racine carrée'], ['\\sqrt[#?]{#0}', 'Racine n-ième'], ['\\left(#0\\right)', 'Parenthèses'],
    ['\\left[#0\\right]', 'Crochets'], ['\\left\\{#0\\right\\}', 'Accolades'], ['\\left|#0\\right|', 'Valeur absolue'],
    ['\\times', 'Multiplié'], ['\\cdot', 'Point (produit)'], ['\\div', 'Divisé'], ['\\pm', 'Plus ou moins'],
    ['\\leq', 'Inférieur ou égal'], ['\\geq', 'Supérieur ou égal'], ['\\neq', 'Différent'], ['\\approx', 'Environ égal'],
    ['\\infty', 'Infini'], ['\\pi', 'Pi'], ['\\mathrm{e}^{#?}', 'Exponentielle'], ['\\ln\\left(#?\\right)', 'Logarithme népérien'],
    ['\\text{#?}', 'Texte dans la formule', '\\text{abc}'],
  ]},
  { name: 'Analyse', items: [
    ['\\lim_{#?\\to#?}', 'Limite', '\\lim_{x\\to a}'], ['\\sum_{#?=#?}^{#?}', 'Somme', '\\sum_{k=0}^{n}'], ['\\prod_{#?=#?}^{#?}', 'Produit', '\\prod_{k=1}^{n}'],
    ['\\int_{#?}^{#?}#?\\,\\mathrm{d}#?', 'Intégrale', '\\int_a^b f\\,\\mathrm{d}x'], ['\\int #?\\,\\mathrm{d}#?', 'Primitive', '\\int f\\,\\mathrm{d}x'],
    ['\\iint_{#?}#?\\,\\mathrm{d}#?\\,\\mathrm{d}#?', 'Intégrale double', '\\iint'], ['\\oint_{#?}', 'Intégrale curviligne', '\\oint'],
    ['\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}', 'Dérivée', '\\frac{\\mathrm{d}y}{\\mathrm{d}x}'], ['\\frac{\\partial #?}{\\partial #?}', 'Dérivée partielle', '\\frac{\\partial f}{\\partial x}'],
    ['#@\'', 'Prime (dérivée)', "f'"], ['#@\'\'', 'Seconde', "f''"], ['\\left[#?\\right]_{#?}^{#?}', 'Crochet d\'intégration', '\\left[F\\right]_a^b'],
    ['\\to', 'Tend vers'], ['\\mapsto', 'Associe'], ['\\nabla', 'Nabla'], ['\\partial', 'd rond'],
    ['\\sin', 'Sinus'], ['\\cos', 'Cosinus'], ['\\tan', 'Tangente'], ['\\arctan', 'Arctangente'], ['\\exp', 'exp'], ['\\log', 'log'],
    ['\\underset{#?\\to #?}{\\sim}', 'Équivalent', '\\underset{x\\to 0}{\\sim}'], ['o\\left(#?\\right)', 'Petit o', 'o(x)'],
  ]},
  { name: 'Relations', items: [
    ['=', 'Égal'], ['\\neq', 'Différent'], ['<', 'Inférieur'], ['>', 'Supérieur'], ['\\leq', '≤'], ['\\geq', '≥'], ['\\ll', 'Très inférieur'],
    ['\\gg', 'Très supérieur'], ['\\approx', '≈'], ['\\simeq', '≃'], ['\\sim', '∼'], ['\\equiv', 'Congru / identique'], ['\\propto', 'Proportionnel'],
    ['\\Rightarrow', 'Implique'], ['\\Leftarrow', 'Est impliqué par'], ['\\Leftrightarrow', 'Équivalent'], ['\\rightarrow', 'Flèche'],
    ['\\longrightarrow', 'Longue flèche'], ['\\perp', 'Perpendiculaire'], ['\\parallel', 'Parallèle'], ['\\equiv #? \\pmod{#?}', 'Modulo', 'a\\equiv b \\pmod{n}'],
  ]},
  { name: 'Ensembles', items: [
    ['\\mathbb{N}', 'Entiers naturels'], ['\\mathbb{Z}', 'Entiers relatifs'], ['\\mathbb{Q}', 'Rationnels'], ['\\mathbb{R}', 'Réels'], ['\\mathbb{C}', 'Complexes'],
    ['\\in', 'Appartient'], ['\\notin', 'N\'appartient pas'], ['\\subset', 'Inclus'], ['\\subseteq', 'Inclus ou égal'], ['\\cup', 'Union'],
    ['\\cap', 'Intersection'], ['\\setminus', 'Privé de'], ['\\emptyset', 'Ensemble vide'], ['\\forall', 'Pour tout'], ['\\exists', 'Il existe'],
    ['\\exists!', 'Il existe un unique'], ['\\neg', 'Non'], ['\\land', 'Et'], ['\\lor', 'Ou'], ['\\left[#?,#?\\right]', 'Intervalle', '[a,b]'],
    ['\\left]#?,#?\\right[', 'Intervalle ouvert', ']a,b['], ['\\left\\{#?\\mid #?\\right\\}', 'Ensemble défini par', '\\{x\\mid P\\}'],
    ['\\overline{#0}', 'Barre / conjugué'], ['\\binom{#?}{#?}', 'Coefficient binomial'], ['#@!', 'Factorielle', 'n!'],
  ]},
  { name: 'Matrices & systèmes', items: [
    ['\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}', 'Matrice 2×2', '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'],
    ['\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}', 'Matrice 3×3', '\\begin{pmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{pmatrix}'],
    ['\\begin{pmatrix}#?\\\\#?\\end{pmatrix}', 'Vecteur colonne 2', '\\begin{pmatrix}x\\\\y\\end{pmatrix}'],
    ['\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}', 'Vecteur colonne 3', '\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix}'],
    ['\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}', 'Déterminant', '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}'],
    ['\\begin{cases}#?&\\text{si }#?\\\\#?&\\text{sinon}\\end{cases}', 'Fonction par morceaux', '\\begin{cases}a&\\text{si}\\\\b&\\text{sinon}\\end{cases}'],
    ['\\left\\{\\begin{aligned}#?&=#?\\\\#?&=#?\\end{aligned}\\right.', 'Système d\'équations', '\\left\\{\\begin{aligned}x&=1\\\\y&=2\\end{aligned}\\right.'],
    ['\\begin{aligned}#?&=#?\\\\&=#?\\end{aligned}', 'Calcul sur plusieurs lignes', '\\begin{aligned}a&=b\\\\&=c\\end{aligned}'],
    ['\\vec{#0}', 'Vecteur'], ['\\overrightarrow{#0}', 'Vecteur AB', '\\overrightarrow{AB}'], ['\\left\\|#0\\right\\|', 'Norme'],
    ['\\hat{#0}', 'Chapeau'], ['\\tilde{#0}', 'Tilde'], ['\\dot{#0}', 'Point (dérivée temporelle)'], ['\\ddot{#0}', 'Deux points'],
    ['#@^{\\mathsf{T}}', 'Transposée', 'A^{\\mathsf{T}}'], ['#@^{-1}', 'Inverse', 'A^{-1}'],
  ]},
  { name: 'Grec', items: 'alpha beta gamma delta epsilon varepsilon zeta eta theta lambda mu nu xi pi rho sigma tau phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega'
      .split(' ').map(g => ['\\' + g, g]) },
  { name: 'Physique', items: [
    ['#@\\times 10^{#?}', 'Notation scientifique', 'a\\times10^{n}'], ['\\,\\mathrm{#?}', 'Unité', '\\mathrm{m}'],
    ['\\,\\mathrm{m\\cdot s^{-1}}', 'm/s', '\\mathrm{m\\cdot s^{-1}}'], ['\\,\\mathrm{m\\cdot s^{-2}}', 'm/s²', '\\mathrm{m\\cdot s^{-2}}'],
    ['\\,\\mathrm{kg}', 'kg', '\\mathrm{kg}'], ['\\,\\mathrm{N}', 'Newton', '\\mathrm{N}'], ['\\,\\mathrm{J}', 'Joule', '\\mathrm{J}'],
    ['\\,\\mathrm{W}', 'Watt', '\\mathrm{W}'], ['\\,\\mathrm{V}', 'Volt', '\\mathrm{V}'], ['\\,\\Omega', 'Ohm', '\\Omega'],
    ['\\,\\mathrm{mol\\cdot L^{-1}}', 'mol/L', '\\mathrm{mol\\cdot L^{-1}}'], ['^{\\circ}\\mathrm{C}', 'Degré Celsius', '^{\\circ}\\mathrm{C}'],
    ['\\,\\mathrm{Hz}', 'Hertz', '\\mathrm{Hz}'], ['\\,\\mathrm{Pa}', 'Pascal', '\\mathrm{Pa}'], ['\\Delta #?', 'Variation', '\\Delta t'],
    ['\\hbar', 'h barre'], ['\\ell', 'l cursif'], ['\\vec{F}', 'Force', '\\vec{F}'], ['\\sum \\vec{F} = m\\vec{a}', 'PFD', '\\sum\\vec F=m\\vec a'],
    ['\\langle #? \\rangle', 'Moyenne', '\\langle x\\rangle'], ['\\overline{#0}', 'Barre (moyenne)', '\\bar{x}'],
  ]},
];

L.CHEM_PALETTE = [
  [' -> ', 'Réaction', '\\ce{->}'], [' <=> ', 'Équilibre', '\\ce{<=>}'], ['^2+', 'Charge 2+', '\\ce{^2+}'], ['^-', 'Charge −', '\\ce{^-}'],
  ['(aq)', 'Aqueux', '\\ce{(aq)}'], ['(s)', 'Solide', '\\ce{(s)}'], ['(l)', 'Liquide', '\\ce{(l)}'], ['(g)', 'Gaz', '\\ce{(g)}'],
  [' v', 'Précipité', '\\ce{v}'], [' ^', 'Dégagement gazeux', '\\ce{^}'], [' ->[\\Delta] ', 'Chauffage', '\\ce{->[\\Delta]}'],
  ['H2O', 'Eau', '\\ce{H2O}'], ['H3O+', 'Ion oxonium', '\\ce{H3O+}'], ['HO-', 'Ion hydroxyde', '\\ce{HO-}'], ['CO2', 'CO2', '\\ce{CO2}'],
  ['e-', 'Électron', '\\ce{e-}'],
];

L.MathDock = (function () {
  const dock = () => L.$('#mathdock');
  let mf, target = null, mode = 'math', cat = 0;

  function init() {
    mf = L.$('#mf');
    if (window.MathfieldElement) {
      MathfieldElement.fontsDirectory = 'vendor/mathlive/fonts';
      MathfieldElement.soundsDirectory = null;
      MathfieldElement.plonkSound = null;
    }
    try { mf.smartFence = true; mf.smartSuperscript = true; mf.menuItems = []; } catch (e) {}
    mf.addEventListener('input', () => {
      const v = mf.value;
      if (!L.$('#mdLatex').hidden) L.$('#mdLatex').value = v;
      preview(v);
    });
    mf.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); ok(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    }, { capture: true });
    L.$('#mdLatex').addEventListener('input', e => { mf.value = e.target.value; preview(e.target.value); });
    L.$('#chemIn').addEventListener('input', () => chemPreview());
    L.$('#chemIn').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); ok(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    L.$('#mdOk').onclick = ok;
    L.$('#mdCancel').onclick = cancel;
    L.$('#mdDel').onclick = del;
    L.$('#mdKbd').onclick = () => {
      const kb = window.mathVirtualKeyboard;
      if (!kb) return;
      mf.focus();
      kb.visible ? kb.hide() : kb.show();
    };
    L.$('#mdSrc').onclick = () => {
      const t = L.$('#mdLatex');
      t.hidden = !t.hidden;
      L.$('#mdSrc').classList.toggle('on', !t.hidden);
      if (!t.hidden) t.value = mf.value;
    };
    L.$('#mdNum').onclick = () => {
      if (!target || target.kind !== 'block') return;
      const f = L.find(App.doc, target.blockId);
      if (!f) return;
      f.block.numbered = !f.block.numbered;
      L.$('#mdNum').classList.toggle('on', f.block.numbered);
      App.renumber();
    };
    L.$$('.md-mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    buildCats();
    buildPalette();
    const cp = L.$('#chemPalette');
    L.CHEM_PALETTE.forEach(([ins, title, disp]) => {
      const b = L.h('button', { title, html: L.katex(disp) });
      b.onclick = () => { const i = L.$('#chemIn'); insertAtInput(i, ins); chemPreview(); i.focus(); };
      cp.appendChild(b);
    });
  }

  function insertAtInput(i, s) {
    const a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
    i.value = i.value.slice(0, a) + s + i.value.slice(b);
    i.selectionStart = i.selectionEnd = a + s.length;
  }

  function buildCats() {
    const c = L.$('#mdCats');
    c.innerHTML = '';
    L.PALETTE.forEach((p, i) => {
      const b = L.h('button', { class: i === cat ? 'on' : '', text: p.name });
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => { cat = i; buildCats(); buildPalette(); };
      c.appendChild(b);
    });
  }

  function buildPalette() {
    const p = L.$('#mdPalette');
    p.innerHTML = '';
    L.PALETTE[cat].items.forEach(([tpl, title, disp]) => {
      const show = disp || tpl.replace(/#\?|#0/g, '\\square').replace(/#@/g, 'x');
      const b = L.h('button', { title, html: L.katex(show) });
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => {
        mf.focus();
        mf.insert(tpl, { selectionMode: 'placeholder', focus: true, format: 'latex' });
        mf.dispatchEvent(new Event('input'));
      };
      p.appendChild(b);
    });
  }

  function setMode(m) {
    mode = m;
    L.$$('.md-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    L.$('.md-math').hidden = m !== 'math';
    L.$('.md-chem').hidden = m !== 'chem';
    L.$('#mdKbd').hidden = m !== 'math';
    L.$('#mdSrc').hidden = m !== 'math';
    if (m === 'chem') { chemPreview(); setTimeout(() => L.$('#chemIn').focus(), 30); }
    else { preview(mf.value); setTimeout(() => mf.focus(), 30); }
  }

  function chemPreview() {
    const v = L.$('#chemIn').value.trim();
    const latex = v ? '\\ce{' + v + '}' : '';
    L.$('#chemPrev').innerHTML = latex ? L.katex(latex) : '<span style="color:#aaa;font:13px var(--ui)">Aperçu</span>';
    preview(latex);
  }

  function current() {
    if (mode === 'chem') { const v = L.$('#chemIn').value.trim(); return v ? '\\ce{' + v + '}' : ''; }
    return L.cleanLatex(mf.value);
  }

  function preview(latex) {
    if (!target) return;
    latex = L.cleanLatex(latex);
    if (target.kind === 'inline') {
      target.chip.dataset.latex = latex;
      target.chip.innerHTML = latex ? L.katex(latex) : '<span class="chip-empty">formule</span>';
    } else {
      const el = App.blockEl(target.blockId);
      const body = el && el.querySelector('.eq-body');
      if (body) body.innerHTML = latex ? L.katex(L.displayLatex(latex), true) : '<span class="eq-empty">Saisissez votre équation ci-dessous</span>';
    }
  }

  /* target = { kind:'inline', chip, isNew } | { kind:'block', blockId, isNew } */
  function open(t) {
    if (target) finish(false);
    target = t;
    const latex = t.kind === 'inline' ? (t.chip.dataset.latex || '') : ((L.find(App.doc, t.blockId) || {}).block || {}).latex || '';
    t.original = latex;
    const isChem = /^\\ce\{/.test(latex);
    L.$('#chemIn').value = isChem ? latex.replace(/^\\ce\{/, '').replace(/\}$/, '') : '';
    mf.value = isChem ? '' : latex;
    L.$('#mdLatex').value = mf.value;
    L.$('#mdTitle').textContent = t.kind === 'inline' ? 'Formule dans le texte' : 'Équation centrée';
    const numBtn = L.$('#mdNum');
    numBtn.hidden = t.kind !== 'block';
    if (t.kind === 'block') numBtn.classList.toggle('on', !!L.find(App.doc, t.blockId).block.numbered);
    L.$$('.editing').forEach(x => x.classList.remove('editing'));
    if (t.kind === 'inline') t.chip.classList.add('editing');
    else { const el = App.blockEl(t.blockId); if (el) el.querySelector('.eq').classList.add('editing'); }
    dock().hidden = false;
    setMode(isChem ? 'chem' : 'math');
    const anchor = t.kind === 'inline' ? t.chip : App.blockEl(t.blockId);
    if (anchor) setTimeout(() => {
      const r = anchor.getBoundingClientRect(), dh = dock().offsetHeight;
      if (r.bottom > window.innerHeight - dh - 30) L.$('#desk').scrollBy({ top: r.bottom - (window.innerHeight - dh - 60), behavior: 'smooth' });
    }, 40);
  }

  function finish(commit) {
    if (!target) return;
    const t = target;
    target = null;
    if (window.mathVirtualKeyboard) try { mathVirtualKeyboard.hide(); } catch (e) {}
    dock().hidden = true;
    L.$$('.editing').forEach(x => x.classList.remove('editing'));
    if (t.kind === 'inline') {
      const latex = commit ? t.chip.dataset.latex : t.original;
      if (!latex) { const host = t.chip.closest('[data-f]'); t.chip.remove(); if (host) App.syncField(host); }
      else {
        t.chip.dataset.latex = latex;
        t.chip.innerHTML = L.katex(latex);
        const host = t.chip.closest('[data-f]');
        if (host) {
          App.syncField(host);
          if (commit) App.placeCaretAfter(t.chip);
        }
      }
      App.commit();
    } else {
      const f = L.find(App.doc, t.blockId);
      if (!f) return;
      if (commit) {
        f.block.latex = t.latexNow;
        App.commit();
        App.render();
      } else if (t.isNew && !t.original) {
        App.removeBlock(t.blockId);
      } else {
        App.render();
      }
    }
  }

  function ok() {
    if (!target) return;
    const latex = current();
    preview(latex);
    target.latexNow = latex;
    if (target.kind === 'inline') target.chip.dataset.latex = latex;
    finish(true);
  }
  function cancel() { finish(false); }
  function del() {
    if (!target) return;
    const t = target;
    if (t.kind === 'inline') { preview(''); t.latexNow = ''; t.chip.dataset.latex = ''; finish(true); }
    else { target = null; dock().hidden = true; App.removeBlock(t.blockId); }
  }

  return { init, open, ok, cancel, isOpen: () => !!target };
})();
