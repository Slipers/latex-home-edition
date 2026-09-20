/* LaTeX MolecularChemistry Edition — socle commun (espace de noms, utilitaires, évènements) */
var M = window.M || {};
window.M = M;

M.VERSION = '1.0.0';

/* ---------- Petits utilitaires ---------- */
M.util = {
  id: (p => () => p + '_' + (++M.util._n).toString(36))('a'),
  _n: 0,
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  deg: r => r * 180 / Math.PI,
  rad: d => d * Math.PI / 180,
  round: (v, n = 3) => { const k = Math.pow(10, n); return Math.round(v * k) / k; },
  /* Formatage « français » des nombres : virgule décimale */
  num: (v, n = 2) => {
    if (!isFinite(v)) return '—';
    const s = Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : v.toFixed(n);
    return s.replace('.', ',');
  },
  esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  /* Indices/exposants Unicode pour les formules brutes */
  sub: s => String(s).replace(/[0-9]/g, d => '₀₁₂₃₄₅₆₇₈₉'[+d]),
  sup: s => String(s).replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).replace(/\+/g, '⁺').replace(/-/g, '⁻'),
  clone: o => JSON.parse(JSON.stringify(o)),
  /* Mélange reproductible (graine) pour les exercices */
  rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  },
  shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  /* Combinaisons utiles */
  pairs(arr) { const r = []; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) r.push([arr[i], arr[j]]); return r; },
};

/* ---------- Vecteurs 3D (indépendants du moteur de rendu) ---------- */
M.V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  len: a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  dist: (a, b) => M.V.len(M.V.sub(a, b)),
  norm(a) { const l = M.V.len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; },
  zero: () => ({ x: 0, y: 0, z: 0 }),
  copy: a => ({ x: a.x, y: a.y, z: a.z }),
  /* Angle (degrés) entre trois points */
  angle(a, b, c) {
    const u = M.V.norm(M.V.sub(a, b)), v = M.V.norm(M.V.sub(c, b));
    return M.util.deg(Math.acos(M.util.clamp(M.V.dot(u, v), -1, 1)));
  },
  /* Angle dièdre signé a-b-c-d, en degrés, dans la convention UICPA : vu de b vers c,
     l'angle est positif si la liaison c-d doit tourner dans le sens horaire pour
     venir éclipser la liaison b-a. */
  dihedral(a, b, c, d) {
    const b1 = M.V.sub(b, a), b2 = M.V.sub(c, b), b3 = M.V.sub(d, c);
    const n1 = M.V.cross(b1, b2), n2 = M.V.cross(b2, b3);
    const m = M.V.cross(n1, M.V.norm(b2));
    return -M.util.deg(Math.atan2(M.V.dot(m, n2), M.V.dot(n1, n2)));
  },
  /* Rotation de v autour de l'axe unitaire k d'un angle a (rad) — Rodrigues */
  rotate(v, k, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const cr = M.V.cross(k, v), d = M.V.dot(k, v);
    return { x: v.x * c + cr.x * s + k.x * d * (1 - c), y: v.y * c + cr.y * s + k.y * d * (1 - c), z: v.z * c + cr.z * s + k.z * d * (1 - c) };
  },
  /* Un vecteur unitaire quelconque orthogonal à v */
  perp(v) {
    const a = Math.abs(v.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    return M.V.norm(M.V.cross(v, a));
  },
};

/* ---------- Bus d'évènements minimaliste ---------- */
M.bus = (() => {
  const map = new Map();
  return {
    on(ev, fn) { (map.get(ev) || map.set(ev, []).get(ev)).push(fn); return fn; },
    off(ev, fn) { const l = map.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(ev, data) { (map.get(ev) || []).forEach(fn => { try { fn(data); } catch (e) { console.error('[bus ' + ev + ']', e); } }); },
  };
})();

/* ---------- Raccourcis DOM ---------- */
M.dom = {
  q: (s, r = document) => r.querySelector(s),
  qa: (s, r = document) => Array.from(r.querySelectorAll(s)),
  el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && e.append(k));
    return e;
  },
  svg(tag, attrs = {}) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  },
};

/* ---------- Stockage local tolérant aux pannes ---------- */
M.store = {
  get(k, def) { try { const v = localStorage.getItem('lmc.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('lmc.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('lmc.' + k); } catch (e) {} },
};
