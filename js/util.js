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
  const m = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let r = '';
  for (const [v, s] of m) while (n >= v) { r += s; n -= v; }
  return r;
};
L.alpha = n => String.fromCharCode(96 + ((n - 1) % 26) + 1);

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
