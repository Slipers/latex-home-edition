/* Utilitaires partagés — espace de noms global L */
window.L = window.L || {};

L.uid = (p = 'b') => p + Math.random().toString(36).slice(2, 9);

L.$ = (sel, root = document) => root.querySelector(sel);
L.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

L.h = function (tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
};

L.escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Macros produites par MathLive : définies aussi dans le préambule LaTeX exporté */
L.KATEX_MACROS = {
  '\\exponentialE': '\\mathrm{e}',
  '\\imaginaryI': '\\mathrm{i}',
  '\\imaginaryJ': '\\mathrm{j}',
  '\\differentialD': '\\mathrm{d}',
  '\\capitalDifferentialD': '\\mathrm{D}',
  '\\placeholder': '\\square',
  '\\doubleprime': '\\prime\\prime',
  '\\tripleprime': '\\prime\\prime\\prime',
};

/* Un même document redessine souvent les mêmes formules (repagination
   complète à chaque pause de frappe) : on met en cache le rendu KaTeX,
   pur et déterministe, pour que ça reste fluide même avec beaucoup de
   formules. Taille bornée pour ne pas grossir indéfiniment. */
const KATEX_CACHE = new Map();
const KATEX_CACHE_MAX = 1000;
L.katex = function (latex, display = false) {
  if (!window.katex) return L.escHtml(latex);
  const key = (display ? '1|' : '0|') + latex;
  const hit = KATEX_CACHE.get(key);
  if (hit !== undefined) return hit;
  let out;
  try {
    out = katex.renderToString(latex || '', {
      displayMode: display, throwOnError: false, strict: 'ignore', trust: false,
      macros: Object.assign({}, L.KATEX_MACROS),
    });
  } catch (e) {
    out = '<span class="math-err">' + L.escHtml(latex) + '</span>';
  }
  if (KATEX_CACHE.size >= KATEX_CACHE_MAX) KATEX_CACHE.delete(KATEX_CACHE.keys().next().value);
  KATEX_CACHE.set(key, out);
  return out;
};

/* Nettoie le LaTeX renvoyé par l'éditeur visuel */
L.cleanLatex = s => String(s || '')
  .replace(/\\placeholder(\[[^\]]*\])?\{\}/g, '')
  // Primes et opérateurs tels que MathLive les écrit : f^{\doubleprime} → f'', \operatorname{\mathrm{Vect}} → \operatorname{Vect}
  .replace(/\^\{\\(prime|doubleprime|tripleprime)\}/g, (m, p) => "'".repeat(p === 'prime' ? 1 : p === 'doubleprime' ? 2 : 3))
  .replace(/\\operatorname\{\\mathrm\{([^{}]*)\}\}/g, '\\operatorname{$1}')
  .replace(/^\s+|\s+$/g, '');

/* Équation multi-lignes : on enveloppe dans aligned si besoin */
L.displayLatex = function (latex) {
  const s = latex || '';
  if (/\\\\/.test(s) && !/\\begin\{/.test(s)) return '\\begin{aligned}' + s + '\\end{aligned}';
  return s;
};

L.debounce = function (fn, ms) {
  let t;
  return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
};

/* Petites icônes vectorielles de l'interface (trait, 16 px, couleur du texte) */
L.ICONS = {
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  foldL: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>',
  foldR: '<path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  outline: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-2.5-5.1"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5"/>',
  pin: '<path d="M12 21v-6M7 4h10l-1.5 5 3 3.5h-13l3-3.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5 4 4 0 0 1-.4 7.5z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.6-7.5 9.5-4.3-.9-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};
L.svg = function (name, size = 16) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = L.ICONS[name] || '';
  return s;
};

L.download = function (name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

L.slug = s => (String(s || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'document').slice(0, 60);

L.toast = function (msg, kind = '') {
  const t = L.h('div', { class: 'toast ' + kind, text: msg });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
};

L.store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};

L.todayFr = function (lang = 'fr') {
  const d = new Date();
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

L.roman = function (n) {
  if (!(n > 0)) return String(n);   // 0 ou négatif : pas d'écriture romaine
  // (jusqu'à M : 40 = xl, 90 = xc… comme \roman en LaTeX)
  const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let r = '';
  for (const [v, s] of m) while (n >= v) { r += s; n -= v; }
  return r;
};
L.alpha = n => n > 0 ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : String(n);

/* Lecture d'une image locale, redimensionnée pour garder le projet léger */
L.readImage = function (file, max = 1800) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') return resolve(fr.result);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && fr.result.length < 1.5e6) return resolve(fr.result);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        const png = file.type === 'image/png';
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
};
