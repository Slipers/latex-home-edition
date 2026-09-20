/* Import de fichiers PDF : le texte, les titres, les listes, les tableaux,
   les formules et les images sont reconstruits en éléments modifiables
   (donc exportables en LaTeX comme n'importe quel document de l'application). */
(function () {

  /* ---------- Reconnaissance des polices ---------- */
  const F_MATH = /(cmmi|cmsy|cmex|cmbsy|msam|msbm|eufm|eusm|rsfs|mathit|mathital|.*math(italic)?$|lmmath|latinmodernmath|xitsmath|stixmath|cambriamath|asana|mtmi|mtsy|txmi|txsy|rxmi|esint|wasy)/i;
  const F_BOLD = /(bold|black|heavy|semib|demib|[-_ ]b$|cmbx|sfbx|cmb\d|bx\d)/i;
  const F_ITAL = /(italic|oblique|slanted|cmti|sfti|cmsl|sfsl|[-_ ]i$|it\d)/i;
  const F_MONO = /(mono|courier|consol|cmtt|sftt|typewriter)/i;

  /* ---------- Glyphes → LaTeX ---------- */
  const G_MATH = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ϵ': '\\epsilon',
    'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ϑ': '\\vartheta', 'ι': '\\iota', 'κ': '\\kappa',
    'λ': '\\lambda', 'μ': '\\mu', 'µ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ϖ': '\\varpi',
    'ρ': '\\rho', 'ϱ': '\\varrho', 'σ': '\\sigma', 'ς': '\\varsigma', 'τ': '\\tau', 'υ': '\\upsilon',
    'φ': '\\varphi', 'ϕ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi',
    'Σ': '\\Sigma', 'Υ': '\\Upsilon', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
    '∞': '\\infty', '∈': '\\in', '∉': '\\notin', '∋': '\\ni', '⊂': '\\subset', '⊃': '\\supset',
    '⊆': '\\subseteq', '⊇': '\\supseteq', '∪': '\\cup', '∩': '\\cap', '∅': '\\varnothing',
    '∀': '\\forall', '∃': '\\exists', '¬': '\\neg', '∧': '\\wedge', '∨': '\\vee',
    '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇐': '\\Leftarrow',
    '⇔': '\\iff', '↦': '\\mapsto', '⟶': '\\longrightarrow', '⟹': '\\Longrightarrow',
    '≤': '\\leqslant', '⩽': '\\leqslant', '≥': '\\geqslant', '⩾': '\\geqslant', '≠': '\\neq',
    '≈': '\\approx', '≃': '\\simeq', '≅': '\\cong', '≡': '\\equiv', '∼': '\\sim', '∝': '\\propto',
    '≪': '\\ll', '≫': '\\gg', '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
    '·': '\\cdot', '⋅': '\\cdot', '∘': '\\circ', '⊕': '\\oplus', '⊗': '\\otimes',
    '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
    '√': '\\sqrt{}', '︁': '', '∂': '\\partial', '∇': '\\nabla', '⊥': '\\perp', '∥': '\\parallel',
    '∠': '\\angle', '°': '^{\\circ}', 'ℓ': '\\ell', 'ℏ': '\\hbar', '∆': '\\Delta',
    'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
    '…': '\\dots', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots', '′': "'", '″': "''", '‴': "'''",
    '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '⟨': '\\langle', '⟩': '\\rangle',
    '−': '-', '–': '-', '—': '-', '∖': '\\setminus', '∣': '\\mid', '∤': '\\nmid', '≺': '\\prec',
    '⊤': '\\top', '⊢': '\\vdash', '↑': '\\uparrow', '↓': '\\downarrow', '∙': '\\bullet', '∓': '\\mp',
  };
  const LIG = { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', '\u00a0': ' ' };

  const cleanText = s => String(s || '').replace(/[ﬁﬂﬀﬃﬄﬅ\u00a0]/g, c => LIG[c] || c).replace(/[\uFE00-\uFE0F\u200B-\u200D]/g, '');
  const mathish = s => /[α-ωΑ-Ω∞∈∉⊂⊆∪∩∅∀∃→←⇒⇔≤≥≠≈≡±×÷∑∏∫√∂∇ℝℕℤℚℂ′″⌊⌈⟨≪≫·⩽⩾]/.test(s);

  /* Un fragment de formule → LaTeX (avec indices et exposants détectés).
     refSize = corps du texte de la ligne, pour reconnaître les petits caractères. */
  const RELATION = /^\s*(=|<|>|\\leqslant|\\geqslant|\\neq|\\approx|\\equiv|\\simeq|\\to|\\iff|\\Rightarrow)/;
  const isSqrt = s => /^[√]+[︀-️\s]*$/.test(String(s));

  function toLatex(run, refSize) {
    const base = Math.max(refSize || 0, run.reduce((m, it) => Math.max(m, it.size), 0));
    const fulls = run.filter(it => it.size >= base * 0.88);
    // si le fragment ne contient que de petits caractères (exposant isolé),
    // on se repère sur la ligne d'origine
    const baseY = fulls.length ? median(fulls.map(it => it.y))
      : median(run.map(it => (it._ly !== undefined ? it._ly : it.y)));
    let out = '', mode = '', sqrt = 0;   // mode : '', '^' ou '_' en cours
    const close = () => { if (mode) { out += '}'; mode = ''; } };
    const closeSqrt = () => { while (sqrt > 0) { close(); out = out.replace(/\s+$/, '') + '}'; sqrt--; } };
    for (const it of run) {
      const small = it.size < base * 0.88;
      const dy = it.y - baseY;
      const sup = small && dy > it.size * 0.12;
      const sub = small && dy < -it.size * 0.08;
      if (isSqrt(it.s)) { close(); out += '\\sqrt{'; sqrt++; continue; }
      let t = glyphs(it.s, it.font);
      if (sqrt && RELATION.test(t)) closeSqrt();
      if (!t.trim()) { if (!mode) out += ' '; continue; }
      const want = sup ? '^' : sub ? '_' : '';
      if (want !== mode) {
        close();
        if (want) {
          out = out.replace(/\s+$/, '');
          if (!out) out = '{}';
          // les primes sont déjà en exposant : on les écrit directement
          if (want === '^' && /^[']+$/.test(t.replace(/\s+/g, ''))) { out += t.replace(/\s+/g, ''); continue; }
          out += want + '{';
          mode = want;
        }
      } else if (!mode && /^[']+$/.test(t.replace(/\s+/g, ''))) {
        out += t.replace(/\s+/g, '');
        continue;
      }
      out += mode ? t.trim() : t;
    }
    close();
    closeSqrt();
    return out.replace(/\s{2,}/g, ' ').replace(/\{\s+/g, '{').replace(/\s+\}/g, '}').trim();
  }

  /* Glyphes d'un fragment → LaTeX ; les lettres d'une police mathématique restent des variables */
  function glyphs(s, font) {
    let out = '';
    for (const c of cleanText(s)) {
      if (G_MATH[c] !== undefined) { out += G_MATH[c] + ' '; continue; }
      if (c === '%' || c === '&' || c === '#' || c === '_' || c === '$') { out += '\\' + c; continue; }
      if (c === '{' || c === '}') { out += '\\' + c; continue; }
      out += c;
    }
    if (font && F_MONO.test(font)) return '\\texttt{' + out.trim() + '}';
    return out;
  }

  const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const mode = a => {
    const m = new Map();
    a.forEach(v => m.set(v, (m.get(v) || 0) + 1));
    let best = null, n = -1;
    m.forEach((c, v) => { if (c > n) { n = c; best = v; } });
    return best;
  };

  /* ---------- Chargement de pdf.js (à la demande) ---------- */
  let libPromise = null;
  function lib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (libPromise) return libPromise;
    libPromise = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = () => {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; } catch (e) {}
        ok(window.pdfjsLib);
      };
      s.onerror = () => ko(new Error('Impossible de charger le module PDF.'));
      document.head.appendChild(s);
    });
    return libPromise;
  }

  /* ---------- Lecture d'une page ---------- */
  async function readPage(pdf, n) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    try { await page.getOperatorList(); } catch (e) {}      // charge les polices (noms réels)
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      if (typeof it.str !== 'string' || !it.str.length) continue;
      const t = it.transform;
      const size = Math.hypot(t[2], t[3]) || it.height || 10;
      if (size < 1) continue;
      let font = it.fontName || '';
      try { const f = page.commonObjs.get(it.fontName); if (f && f.name) font = f.name; } catch (e) {}
      font = font.replace(/^[A-Z]{6}\+/, '');
      items.push({ s: it.str, x: t[4], y: t[5], w: it.width || 0, size, font, eol: it.hasEOL });
    }
    return { n, items, W: vp.width, H: vp.height, page };
  }

  /* ---------- Items → lignes ----------
     Deux passes : on établit d'abord les lignes de base avec les fragments de
     corps normal, puis on y rattache les petits fragments (indices, exposants),
     qui sont décalés verticalement et créeraient sinon de fausses lignes. */
  function toLines(items) {
    if (!items.length) return [];
    const wsize = new Map();
    items.forEach(it => {
      const k = +it.size.toFixed(1);
      wsize.set(k, (wsize.get(k) || 0) + it.s.replace(/\s/g, '').length);
    });
    let body = 10, bw = -1;
    wsize.forEach((w, s) => { if (w > bw) { bw = w; body = s; } });

    const full = [], small = [];
    items.forEach(it => (it.size >= body * 0.85 && !/cmex/i.test(it.font) ? full : small).push(it));
    const lines = [];
    const place = (it, y) => {
      const tol = Math.max(1.5, Math.max(it.size, body) * 0.42);
      let best = null, bd = Infinity;
      for (const l of lines) {
        const d = Math.abs(l.y - y);
        if (d < bd) { bd = d; best = l; }
      }
      if (best && bd <= tol) { best.items.push(it); best.size = Math.max(best.size, it.size); return best; }
      const l = { y, size: it.size, items: [it] };
      lines.push(l);
      return l;
    };
    [...full].sort((a, b) => (b.y - a.y) || (a.x - b.x)).forEach(it => place(it, it.y));
    // exposants (au-dessus) et indices (en dessous) : on ramène leur ordonnée sur la ligne de base
    small.forEach(it => {
      const cands = [it.y, it.y - it.size * 0.33, it.y + it.size * 0.16];
      // les grands signes (racines, accolades, intégrales) sont tracés au-dessus de la ligne
      if (/cmex|cmsy\d*$/i.test(it.font)) cands.push(it.y - it.size * 0.9, it.y - it.size * 1.4);
      cands.push(it.y + it.size * 0.85);   // limite sous un grand operateur
      let best = null, bd = Infinity, by = it.y;
      for (const l of lines) {
        for (const y of cands) {
          const d = Math.abs(l.y - y);
          if (d < bd) { bd = d; best = l; by = y; }
        }
      }
      const tol = Math.max(1.5, Math.max(it.size, body) * 0.5);
      if (best && bd <= tol) { best.items.push(it); }
      else place(it, it.y);
    });
    lines.forEach(l => {
      l.items.sort((a, b) => a.x - b.x);
      l.x0 = Math.min(...l.items.map(i => i.x));
      l.x1 = Math.max(...l.items.map(i => i.x + (i.w || i.s.length * i.size * 0.5)));
      l.y = median(l.items.filter(i => i.size >= l.size * 0.88).map(i => i.y)) || l.y;
      l.text = lineText(l);
      l.bold = l.items.filter(i => F_BOLD.test(i.font)).length > l.items.length / 2;
    });
    lines.sort((a, b) => b.y - a.y);
    return lines.filter(l => l.text.trim().length);
  }

  function lineText(l) {
    let out = '';
    let prev = null;
    for (const it of l.items) {
      if (prev) {
        const gap = it.x - (prev.x + (prev.w || 0));
        if (gap > Math.max(prev.size, it.size) * 0.22 && !/\s$/.test(out) && !/^\s/.test(it.s)) out += ' ';
      }
      out += cleanText(it.s);
      prev = it;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  /* ---------- En-têtes et pieds de page répétés ---------- */
  function stripRunning(pages) {
    const seen = new Map();
    pages.forEach(p => {
      p.lines.forEach(l => {
        const top = l.y > p.H * 0.93, bot = l.y < p.H * 0.085;
        if (!top && !bot) return;
        const key = l.text.replace(/\d+/g, '#');
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(p.n);
      });
    });
    pages.forEach(p => {
      p.lines = p.lines.filter(l => {
        const top = l.y > p.H * 0.93, bot = l.y < p.H * 0.085;
        if (!top && !bot) return true;
        if (/^[\s\-–—]*(page\s*)?\d+\s*(\/|sur|of)?\s*\d*[\s\-–—]*$/i.test(l.text)) return false;
        const key = l.text.replace(/\d+/g, '#');
        return (seen.get(key) || new Set()).size < 2;
      });
    });
  }

  /* ---------- Découpage en paragraphes ---------- */
  function toParagraphs(lines, ctx) {
    const paras = [];
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], p = lines[i - 1];
      let cut = !cur;
      if (!cut) {
        const gap = p.y - l.y;
        const lead = Math.max(p.size, l.size);
        if (gap > lead * 1.55) cut = true;                               // saut vertical
        else if (l.x0 > cur.x0 + lead * 0.7 && l.x0 > ctx.left + lead * 0.7) cut = true;  // alinéa
        else if (p.x1 < ctx.right - lead * 2.2 && l.x0 <= ctx.left + lead * 0.6) cut = true; // ligne précédente courte
        else if (Math.abs(l.size - p.size) > Math.max(l.size, p.size) * 0.12) cut = true;  // changement de corps
      }
      if (cut) { cur = { lines: [l], x0: l.x0, size: l.size }; paras.push(cur); }
      else { cur.lines.push(l); cur.x0 = Math.min(cur.x0, l.x0); cur.size = Math.max(cur.size, l.size); }
    }
    return paras;
  }

  /* ---------- Texte enrichi d'un paragraphe ---------- */
  function richText(para, ctx, opts) {
    const chunks = [];
    para.lines.forEach((l, li) => {
      if (li) chunks.push({ sep: true, size: l.size });
      l.items.forEach(it => { it._ly = l.y; chunks.push(it); });
    });
    const ref = para.size || ctx.size;
    let html = '', run = [], pending = '';
    const flushRun = () => {
      if (!run.length) return;
      const tex = toLatex(run, ref);
      if (tex) html += '<span class="imath" data-latex="' + L.escHtml(tex) + '"></span>';
      run = [];
    };
    let prev = null;
    for (const c of chunks) {
      if (c.sep) {
        flushRun();
        const t = html.replace(/<[^>]*>/g, '');
        if (/[-–]$/.test(t)) html = html.replace(/[-–]$/, '');   // césure en fin de ligne
        else if (!/\s$/.test(html) && html) html += ' ';
        pending = '';
        prev = null;
        continue;
      }
      // fragment composé uniquement d'espaces : il ne coupe pas une formule en cours
      if (!c.s.trim()) { pending = ' '; prev = c; continue; }

      const isMath = opts.math !== false && isMathItem(c, ctx);
      const gap = prev ? c.x - (prev.x + (prev.w || 0)) : 0;
      const seuil = Math.max(prev ? prev.size : c.size, c.size) * (isMath !== (run.length > 0) ? 0.14 : 0.22);
      const space = pending || (prev && gap > seuil ? ' ' : '');
      pending = '';

      if (isMath) {
        if (run.length) { if (space) run.push({ s: ' ', x: c.x, y: c.y, size: c.size, font: '', w: 0 }); }
        else if (space && html && !/\s$/.test(html)) html += space;
        run.push(c);
        prev = c;
        continue;
      }
      flushRun();
      if (space && html && !/\s$/.test(html)) html += space;
      html += style(c, ctx);
      prev = c;
    }
    flushRun();
    return html.replace(/\s{2,}/g, ' ').trim();
  }

  /* Un fragment appartient-il à une formule ? */
  function isMathItem(it, ctx) {
    if (F_MATH.test(it.font)) return true;
    if (mathish(it.s)) return true;
    const small = it.size < ctx.size * 0.86 && it.size > ctx.size * 0.45;
    if (small && /^[0-9a-zA-Z+\-−()]{1,3}$/.test(it.s.trim())) return true;   // indice ou exposant
    const bodyFont = it.font === ctx.font;
    if (/^[.,;:!?]$/.test(it.s.trim())) return false;
    if (!bodyFont && /^[\s()[\]0-9+=\-−.,;:/|]{1,6}$/.test(it.s) && it.s.trim()) return true;
    return false;
  }

  function style(it, ctx) {
    let t = L.escHtml(cleanText(it.s));
    if (!t) return '';
    const b = F_BOLD.test(it.font) && !F_BOLD.test(ctx.font);
    const i = F_ITAL.test(it.font) && !F_ITAL.test(ctx.font);
    const m = F_MONO.test(it.font) && !F_MONO.test(ctx.font);
    if (m) t = '<code>' + t + '</code>';
    if (i) t = '<i>' + t + '</i>';
    if (b) t = '<b>' + t + '</b>';
    return t;
  }

  /* ---------- Reconnaissance des blocs ---------- */
  const RE_BULLET = /^\s*([•·▪◦‣∙\u2022\u25cf\u25aa\u2043–-])\s+/;
  const RE_NUM = /^\s*(\(?\d{1,2}[.)]|\(?[a-h][.)]|\(?[ivx]{1,4}[.)])\s+/i;
  const RE_HEADNUM = /^\s*(\d{1,2}(\.\d{1,2}){0,3})[.)]?\s+(\S.*)$/;
  const RE_CAPTION = /^\s*(table|tableau|figure|fig\.?|tab\.?)\s*\d+\s*([.:—–-]|\s)/i;
  const RE_EQNUM = /\(\s*\d{1,3}(\.\d{1,3})?\s*\)\s*$/;

  function mathRatio(para, ctx) {
    let m = 0, t = 0;
    para.lines.forEach(l => l.items.forEach(it => {
      const n = it.s.replace(/\s/g, '').length;
      t += n;
      if (isMathItem(it, ctx)) m += n;
    }));
    return t ? m / t : 0;
  }

  /* ---------- Tableaux ---------- */
  /* Cellules d'une ligne : les fragments d'espaces comptent comme des blancs,
     une colonne commence après un blanc d'au moins une cadratine. */
  function cellsOf(line) {
    const cells = [];
    let cur = null, end = null;
    for (const it of line.items) {
      if (!it.s.trim()) continue;                      // le blanc lui-même fait partie de l'écart
      const gap = end === null ? 0 : it.x - end;
      if (!cur || gap > it.size * 0.85) {
        cur = { x: it.x, items: [it] };
        cells.push(cur);
      } else cur.items.push(it);
      end = it.x + (it.w || 0);
    }
    return cells.map(c => {
      const last = c.items[c.items.length - 1];
      const x1 = last.x + (last.w || last.s.length * last.size * 0.5);
      return { x: c.x, w: x1 - c.x, items: c.items, size: line.size, text: lineText({ items: c.items, size: line.size }) };
    });
  }

  /* Deux colonnes sont « alignées » si elles partagent un bord ou leur centre */
  function sameCol(a, b, tol) {
    return Math.abs(a.x - b.x) < tol || Math.abs((a.x + a.w) - (b.x + b.w)) < tol
      || Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) < tol;
  }

  /* Zones de lignes formant un tableau : au moins deux lignes de même nombre de
     colonnes, alignées entre elles et proches verticalement. */
  function tableZones(lines, ctx) {
    const zones = [];
    const cells = lines.map(l => cellsOf(l));
    for (let i = 0; i < lines.length; i++) {
      const ref = cells[i];
      if (ref.length < 2) continue;
      let j = i + 1;
      while (j < lines.length) {
        const cs = cells[j];
        if (cs.length !== ref.length) break;
        if (lines[j - 1].y - lines[j].y > Math.max(lines[j].size, ctx.size) * 2.6) break;
        const tol = ctx.size * 1.4;
        const aligned = cs.filter((c, k) => sameCol(c, ref[k], tol)).length;
        if (aligned < Math.max(2, ref.length - 1)) break;
        j++;
      }
      const n = j - i;
      if (n < 2) continue;
      const rows = lines.slice(i, j).map((l, k) => cells[i + k]);
      const flat = rows.flat();
      const digits = flat.filter(c => /\d/.test(c.text)).length;
      const longs = flat.filter(c => c.text.length > 28).length;
      // garde-fous : on évite de prendre du texte justifié pour un tableau
      const avgLen = flat.reduce((s, c) => s + c.text.length, 0) / flat.length;
      if (ref.length < 3 && (n < 3 || digits < flat.length * 0.3 || avgLen > 18)) continue;
      if (longs > flat.length * 0.25) continue;
      zones.push({ i0: i, i1: j - 1, rows });
      i = j - 1;
    }
    return zones;
  }

  /* ---------- Blocs de code (police à chasse fixe) ---------- */
  function monoRatio(line) {
    let m = 0, t = 0;
    line.items.forEach(it => {
      const n = it.s.replace(/\s/g, '').length;
      t += n;
      if (F_MONO.test(it.font)) m += n;
    });
    return t ? m / t : 0;
  }

  function codeZones(lines, ctx) {
    const zones = [];
    for (let i = 0; i < lines.length; i++) {
      if (monoRatio(lines[i]) < 0.75) continue;
      let j = i + 1;
      while (j < lines.length && monoRatio(lines[j]) >= 0.75
        && lines[j - 1].y - lines[j].y < Math.max(lines[j].size, ctx.size) * 2.4) j++;
      if (j - i >= 2) { zones.push({ i0: i, i1: j - 1 }); i = j - 1; }
    }
    return zones;
  }

  function codeBlock(lines) {
    const widths = [];
    lines.forEach(l => l.items.forEach(it => { if (it.s.trim() && it.w) widths.push(it.w / it.s.length); }));
    const cw = median(widths) || lines[0].size * 0.6;
    const left = Math.min(...lines.map(l => l.x0));
    const text = lines.map(l => ' '.repeat(Math.max(0, Math.round((l.x0 - left) / cw))) + l.text).join('\n');
    const lang = /\b(def|import|elif|print|range|numpy)\b/.test(text) ? 'python'
      : /#include|printf|std::/.test(text) ? 'c'
        : /\b(function|const|let|console\.log)\b/.test(text) ? 'javascript'
          : /\b(SELECT|FROM|WHERE)\b/.test(text) ? 'sql' : 'texte';
    return L.newBlock('code', { lang, code: text, numbers: false });
  }

  /* ---------- Images ---------- */
  async function pageImages(p) {
    const out = [];
    let ops;
    try { ops = await p.page.getOperatorList(); } catch (e) { return out; }
    const OPS = window.pdfjsLib.OPS;
    const boxes = [];
    const stack = [];
    let m = [1, 0, 0, 1, 0, 0];
    const mul = (a, b) => [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(m.slice());
      else if (fn === OPS.restore) m = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) m = mul(m, args);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        const w = Math.abs(m[0]) + Math.abs(m[2]), h = Math.abs(m[1]) + Math.abs(m[3]);
        if (w > 20 && h > 20 && typeof args[0] === 'string') boxes.push({ name: args[0], x: m[4], y: m[5], w, h });
      }
    }
    for (const b of boxes) {
      const obj = await pageObject(p.page, b.name);
      const src = imageToUrl(obj);
      if (src) out.push({ y: b.y + b.h, src, w: b.w / p.W, wAbs: b.w });
    }
    out.sort((a, b) => b.y - a.y);
    return out;
  }

  /* Récupère un objet image de la page (décodé par pdf.js) */
  function pageObject(page, name) {
    return new Promise(resolve => {
      let done = false;
      const ok = v => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => ok(null), 8000);
      try {
        if (page.objs.has(name)) return ok(page.objs.get(name));
        page.objs.get(name, ok);
      } catch (e) { ok(null); }
    });
  }

  /* Données d'image pdf.js → image PNG/JPEG utilisable dans le document */
  function imageToUrl(img) {
    if (!img) return null;
    const bmp = img.bitmap || (img.data ? null : img);
    const w = img.width || (bmp && bmp.width), h = img.height || (bmp && bmp.height);
    if (!w || !h || w < 8 || h < 8) return null;
    const k = Math.min(1, 1600 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    try {
      if (bmp && typeof bmp.width === 'number' && !img.data) {
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
      } else if (img.data) {
        const src = document.createElement('canvas');
        src.width = w; src.height = h;
        const sctx = src.getContext('2d');
        const id = sctx.createImageData(w, h);
        const d = img.data;
        if (d.length === w * h * 4) id.data.set(d);
        else if (d.length === w * h * 3) {
          for (let i = 0, j = 0; i < w * h; i++) { id.data[j++] = d[i * 3]; id.data[j++] = d[i * 3 + 1]; id.data[j++] = d[i * 3 + 2]; id.data[j++] = 255; }
        } else if (d.length === w * h) {
          for (let i = 0, j = 0; i < w * h; i++) { id.data[j++] = d[i]; id.data[j++] = d[i]; id.data[j++] = d[i]; id.data[j++] = 255; }
        } else return null;
        sctx.putImageData(id, 0, 0);
        ctx.drawImage(src, 0, 0, c.width, c.height);
      } else return null;
    } catch (e) { return null; }
    return c.toDataURL(c.width * c.height > 400000 ? 'image/jpeg' : 'image/png', 0.88);
  }

  /* Rendu d'une page entière (pages scannées). Le rendu de pdf.js s'appuie sur
     requestAnimationFrame, gelé quand la fenêtre est masquée : on force la suite
     et on abandonne au bout de 25 s plutôt que d'attendre indéfiniment. */
  async function renderPage(p, scale) {
    const vp = p.page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const task = p.page.render({ canvasContext: ctx, viewport: vp });
    try { task.onContinue = cont => cont(); } catch (e) {}
    const fini = await Promise.race([
      task.promise.then(() => true),
      new Promise(r => setTimeout(() => r(false), 25000)),
    ]);
    if (!fini) { try { task.cancel(); } catch (e) {} }
    return canvas;
  }

  function crop(canvas, x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    w = Math.min(canvas.width - x, Math.round(w)); h = Math.min(canvas.height - y, Math.round(h));
    if (w < 8 || h < 8) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  }

  /* Largeur d'une figure, en pourcentage de la colonne de texte */
  function figWidth(im, ctx) {
    const col = Math.max(50, (ctx.right || 0) - (ctx.left || 0));
    const pct = im.wAbs ? im.wAbs / col * 100 : im.w * 100;
    return Math.max(20, Math.min(100, Math.round(pct)));
  }

  /* ---------- Conversion complète ---------- */
  async function convert(data, opts, onStep) {
    const pdfjs = await lib();
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const total = pdf.numPages;
    const nums = parseRange(opts.range, total);
    const pages = [];
    for (const n of nums) {
      if (onStep) onStep('Lecture de la page ' + n + ' sur ' + total + '…', (pages.length + 1) / nums.length);
      const p = await readPage(pdf, n);
      p.lines = toLines(p.items);
      pages.push(p);
    }
    if (opts.running !== false) stripRunning(pages);

    // police et corps du texte courant
    const weight = new Map();
    pages.forEach(p => p.lines.forEach(l => l.items.forEach(it => {
      const k = it.font + '|' + it.size.toFixed(1);
      weight.set(k, (weight.get(k) || 0) + it.s.replace(/\s/g, '').length);
    })));
    let bodyKey = '', bw = -1;
    weight.forEach((w, k) => { if (w > bw) { bw = w; bodyKey = k; } });
    const ctx = { font: bodyKey.split('|')[0], size: +bodyKey.split('|')[1] || 10 };
    const allX = [].concat(...pages.map(p => p.lines.map(l => l.x0)));
    const allR = [].concat(...pages.map(p => p.lines.map(l => l.x1)));
    ctx.left = mode(allX.map(x => Math.round(x / 4) * 4)) || Math.min(...allX);
    ctx.right = Math.max(...allR);

    const sizes = [];
    pages.forEach(p => p.lines.forEach(l => sizes.push(+l.size.toFixed(1))));
    const bigger = [...new Set(sizes.filter(s => s > ctx.size * 1.08))].sort((a, b) => b - a);

    const blocks = [];
    const stats = { pages: nums.length, paragraphes: 0, titres: 0, equations: 0, listes: 0, tableaux: 0, figures: 0, formules: 0 };
    const meta = {};
    let scanned = 0;

    for (const p of pages) {
      if (onStep) onStep('Conversion de la page ' + p.n + '…', 0.5 + 0.5 * (pages.indexOf(p) + 1) / pages.length);
      const images = opts.images !== false ? await pageImages(p).catch(() => []) : [];
      const chars = p.lines.reduce((n, l) => n + l.text.length, 0);

      // page sans texte : on insère l'image de la page entière
      if (chars < 40) {
        scanned++;
        if (opts.images !== false) {
          const canvas = await renderPage(p, 1.6);
          blocks.push(L.newBlock('figure', { src: canvas.toDataURL('image/jpeg', 0.85), width: 95, caption: '' }));
          stats.figures++;
        }
        continue;
      }

      // zones de tableau et blocs de code : ils sortent du flux des paragraphes
      const zones = [];
      if (opts.code !== false) codeZones(p.lines, ctx).forEach(z => zones.push(Object.assign({ code: true }, z)));
      if (opts.tables !== false) {
        tableZones(p.lines, ctx).forEach(z => {
          if (!zones.some(o => z.i0 <= o.i1 && z.i1 >= o.i0)) zones.push(z);
        });
      }
      zones.sort((a, b) => a.i0 - b.i0);
      const segments = [];
      let k0 = 0;
      zones.forEach(z => {
        if (z.i0 > k0) segments.push({ lines: p.lines.slice(k0, z.i0) });
        segments.push({ zone: z });
        k0 = z.i1 + 1;
      });
      if (k0 < p.lines.length) segments.push({ lines: p.lines.slice(k0) });

      const paras = [];
      segments.forEach(s => {
        if (s.zone) paras.push({ zone: s.zone, lines: p.lines.slice(s.zone.i0, s.zone.i1 + 1), size: ctx.size, x0: ctx.left });
        else toParagraphs(s.lines, ctx).forEach(q => paras.push(q));
      });

      let pendingCaption = null;
      for (let i = 0; i < paras.length; i++) {
        const para = paras[i];
        if (para.zone && para.zone.code) {
          blocks.push(codeBlock(para.lines));
          stats.codes = (stats.codes || 0) + 1;
          continue;
        }
        if (para.zone) {
          const z = para.zone;
          const nCols = z.rows[0].length;
          const rows = z.rows.map(r => r.map(c => richText({ lines: [{ items: c.items, size: c.size }], size: ctx.size }, ctx, opts)));
          blocks.push(L.newBlock('table', {
            head: true, style: 'pro', align: new Array(nCols).fill('c'),
            rows, caption: pendingCaption || '',
          }));
          pendingCaption = null;
          stats.tableaux++;
          continue;
        }
        const text = para.lines.map(l => l.text).join(' ');
        const size = para.size;
        const bold = para.lines[0].items.some(it => F_BOLD.test(it.font));
        const mr = mathRatio(para, ctx);

        // images placées à leur hauteur dans le flux
        while (images.length && images[0].y > para.lines[0].y + size) {
          const im = images.shift();
          const fig = L.newBlock('figure', { src: im.src, width: figWidth(im, ctx), caption: pendingCaption || '' });
          pendingCaption = null;
          blocks.push(fig); stats.figures++;
        }

        // page de titre : titre du document, puis auteur et date
        const centeredPara = para.x0 > ctx.left + ctx.size * 1.5 && para.lines[0].x1 < ctx.right - ctx.size * 1.5;
        if (opts.title !== false && p === pages[0] && blocks.length <= 2 && text.length < 130
            && !RE_CAPTION.test(text) && para.lines[0].y > p.H * 0.62) {
          if (!meta.title && bigger.length && size >= bigger[0] - 0.2) { meta.title = L.escHtml(text); continue; }
          if (meta.title && centeredPara && text.length < 90) {
            if (/\b(19|20)\d{2}\b/.test(text) && text.length < 40) { meta.date = L.escHtml(text); continue; }
            // une ligne de plusieurs mots ressemble davantage à un sous-titre qu'à un auteur
            if (text.split(/\s+/).length >= 4) { if (!meta.subtitle) { meta.subtitle = L.escHtml(text); continue; } }
            else if (!meta.author) { meta.author = L.escHtml(text); continue; }
          }
        }

        // légende
        if (RE_CAPTION.test(text) && text.length < 300) {
          const cap = richText(para, ctx, opts).replace(/^\s*(<[^>]+>)?\s*(table|tableau|figure|fig\.?|tab\.?)\s*\d+\s*[.:—–-]?\s*/i, '$1');
          const prev = blocks[blocks.length - 1];
          if (prev && (prev.type === 'table' || prev.type === 'figure') && !prev.caption) prev.caption = cap;
          else pendingCaption = cap;
          continue;
        }

        // titre de section : plus gros que le corps, ou en gras, et court
        const headish = para.lines.length <= 2 && text.length < 110 && !/[.;:]\s*$/.test(text)
          && (size > ctx.size * 1.06 || (bold && size >= ctx.size * 0.98 && text.length < 80));
        if (opts.headings !== false && headish) {
          const m = RE_HEADNUM.exec(text);
          let level = 1;
          if (m) level = Math.min(3, m[1].split('.').length);
          else if (bigger.length > 1) level = Math.min(3, 1 + Math.max(0, bigger.findIndex(s => size >= s - 0.2)));
          const label = m ? m[3] : text;
          blocks.push(L.newBlock('heading', { level, html: richTextFrom(label, para, ctx, opts, !!m), numbered: !!m }));
          stats.titres++;
          continue;
        }

        // équation centrée
        const centered = para.x0 > ctx.left + ctx.size * 2 && para.lines[0].x1 < ctx.right - ctx.size;
        const numbered = RE_EQNUM.test(text);
        if (opts.math !== false && mr > 0.55 && (centered || numbered) && text.length < 400) {
          const items = [].concat(...para.lines.map(l => l.items));
          const kept = numbered ? items.filter(it => !(it.x > ctx.right - ctx.size * 4)) : items;
          const tex = toLatex(kept, ctx.size);
          if (tex) {
            blocks.push(L.newBlock('equation', { latex: tex, numbered }));
            stats.equations++;
            continue;
          }
        }

        // liste
        if (opts.lists !== false && (RE_BULLET.test(text) || RE_NUM.test(text))) {
          const style = RE_BULLET.test(text) ? 'bullet' : /^\s*\(?[a-h][.)]/.test(text) ? 'alpha' : /^\s*\(?[ivx]{1,4}[.)]/i.test(text) ? 'roman' : 'number';
          const items = [];
          let j = i, firstX = para.x0;
          while (j < paras.length) {
            const q = paras[j], qt = q.lines.map(l => l.text).join(' ');
            const isItem = RE_BULLET.test(qt) || RE_NUM.test(qt);
            if (!isItem) break;
            if (Math.abs(q.x0 - firstX) > ctx.size * 3) break;
            const html = richText(q, ctx, opts).replace(/^\s*(<[^>]+>)?\s*([•·▪◦‣∙\u2022\u25cf\u25aa\u2043–-]|\(?\d{1,2}[.)]|\(?[a-h][.)]|\(?[ivx]{1,4}[.)])\s*/i, '$1');
            items.push({ html, level: Math.round(Math.max(0, q.x0 - firstX) / (ctx.size * 1.5)) });
            j++;
          }
          if (items.length) {
            blocks.push(L.newBlock('list', { style, items }));
            stats.listes++;
            i = j - 1;
            continue;
          }
        }

        // paragraphe ordinaire
        const html = richText(para, ctx, opts);
        if (!html) continue;
        blocks.push(L.newBlock('paragraph', { html, noindent: para.x0 <= ctx.left + ctx.size * 0.4 }));
        stats.paragraphes++;
      }

      // images restantes en bas de page
      for (const im of images) {
        blocks.push(L.newBlock('figure', { src: im.src, width: figWidth(im, ctx), caption: pendingCaption || '' }));
        pendingCaption = null;
        stats.figures++;
      }
      if (pendingCaption) { blocks.push(L.newBlock('paragraph', { html: pendingCaption, noindent: true })); pendingCaption = null; }
      if (opts.pagebreaks && p !== pages[pages.length - 1]) blocks.push(L.newBlock('pagebreak'));
    }

    stats.formules = blocks.reduce((n, b) => n + (JSON.stringify(b).match(/class=\\"imath/g) || []).length, 0) + stats.equations;

    // métadonnées du fichier
    try {
      const info = (await pdf.getMetadata()).info || {};
      if (!meta.title && info.Title && info.Title.trim().length > 2) meta.title = L.escHtml(info.Title.trim());
      if (info.Author && info.Author.trim()) meta.author = L.escHtml(info.Author.trim());
    } catch (e) {}

    const warnings = [];
    if (scanned) warnings.push(scanned + ' page(s) sans texte (document scanné) : importée(s) en image.');
    if (stats.formules) warnings.push('Les formules sont reconstruites automatiquement : vérifiez les fractions, racines et matrices, qui peuvent être approximatives.');
    return { blocks, meta, stats, warnings, total };
  }

  /* HTML d'un titre, débarrassé de sa numérotation (l'application numérote seule) */
  function richTextFrom(label, para, ctx, opts, hasNum) {
    const full = richText(para, ctx, opts);
    if (!hasNum) return full;
    const cut = full
      .replace(/^\s*<span class="imath" data-latex="[\d.\s]*"><\/span>\s*/, '')   // numéro converti en formule
      .replace(/^\s*(<[^>]+>)?\s*\d{1,2}(\.\d{1,2}){0,3}[.)]?\s*/, '$1')
      .replace(/^\s*<b>\s*<\/b>\s*/, '');
    return cut.replace(/<[^>]*>/g, '').trim() ? cut : L.escHtml(label);
  }

  function parseRange(s, total) {
    const out = [];
    s = String(s || '').trim();
    if (!s) { for (let i = 1; i <= total; i++) out.push(i); return out; }
    s.split(/[,;]/).forEach(part => {
      const m = /^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/.exec(part);
      if (!m) return;
      const a = Math.max(1, +m[1]), b = Math.min(total, m[2] ? +m[2] : +m[1]);
      for (let i = a; i <= b; i++) if (!out.includes(i)) out.push(i);
    });
    return out.length ? out.sort((x, y) => x - y) : parseRange('', total);
  }

  L.PDF = { convert, lib, parseRange, _int: { toLines, toParagraphs, richText, toLatex, tableZones, cellsOf, isMathItem, readPage } };

  /* ================= Fenêtre « Importer un PDF » ================= */
  L.dlgImportPdf = function (initialFile) {
    const opts = { headings: true, math: true, lists: true, tables: true, code: true, images: true, running: true, title: true, pagebreaks: false, range: '' };
    let data = null, name = '', kind = 'pdf', dlg = null;

    const drop = L.h('div', { class: 'imp-drop' },
      L.h('div', { class: 'imp-ic', text: '⇩' }),
      L.h('b', { text: 'Déposez un fichier PDF ici' }),
      L.h('span', { text: 'ou cliquez pour le choisir (.pdf, .tex)' }));
    const input = L.h('input', { type: 'file', accept: '.pdf,.tex,.txt,application/pdf', style: { display: 'none' } });
    const info = L.h('div', { class: 'imp-file', hidden: true });
    const prog = L.h('div', { class: 'imp-prog', hidden: true }, L.h('div', { class: 'imp-bar' }, L.h('i')), L.h('span', { class: 'imp-msg' }));
    const err = L.h('div', { class: 'note', hidden: true });

    const chk = (key, label, hint) => {
      const i = L.h('input', { type: 'checkbox' });
      i.checked = !!opts[key];
      i.onchange = () => { opts[key] = i.checked; };
      return L.h('label', { class: 'imp-opt' }, i, L.h('span', null, L.h('b', { text: label }), hint ? L.h('em', { text: hint }) : null));
    };
    const range = L.h('input', { type: 'text', placeholder: 'toutes', style: { width: '110px' } });
    range.oninput = () => { opts.range = range.value; };
    const brk = L.h('input', { type: 'checkbox' });
    brk.onchange = () => { opts.pagebreaks = brk.checked; };

    const optBox = L.h('div', { hidden: true },
      L.h('div', { class: 'set-h', text: 'À reconnaître dans le PDF' }),
      L.h('div', { class: 'imp-grid' },
        chk('headings', 'Titres et sections', 'renumérotés automatiquement'),
        chk('math', 'Formules', 'indices, exposants, symboles'),
        chk('lists', 'Listes et questions', 'puces, 1., a), i)'),
        chk('tables', 'Tableaux', 'colonnes alignées'),
        chk('code', 'Blocs de code', 'police à chasse fixe'),
        chk('images', 'Images et pages scannées', 'figures insérées dans le flux'),
        chk('running', 'Ignorer en-têtes et pieds de page', 'numéros de page répétés')),
      L.h('div', { class: 'imp-row' },
        L.h('label', null, 'Pages : ', range, L.h('em', { class: 'pp-help', text: ' ex. 1-4, 7' })),
        L.h('label', { class: 'imp-opt' }, brk, L.h('span', null, L.h('b', { text: 'Un saut de page par page du PDF' })))));

    const dest = { v: 'new' };
    const seg = L.h('div', { class: 'seg', hidden: true });
    [['new', 'Nouveau document'], ['here', 'Insérer dans le document actuel']].forEach(([v, t], k) => {
      const b = L.h('button', { class: k === 0 ? 'on' : '', text: t });
      b.onclick = () => { dest.v = v; seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      seg.appendChild(b);
    });

    const setFile = async f => {
      if (!f) return;
      name = f.name;
      kind = /\.(tex|txt|md)$/i.test(name) ? 'tex' : 'pdf';
      err.hidden = true;
      info.hidden = false;
      info.textContent = name + '  —  ' + (f.size > 1e6 ? (f.size / 1e6).toFixed(1) + ' Mo' : Math.round(f.size / 1024) + ' Ko');
      drop.classList.add('has');
      optBox.hidden = kind !== 'pdf';
      seg.hidden = false;
      data = kind === 'pdf' ? await f.arrayBuffer() : await f.text();
      const b = dlg && dlg.box.querySelector('.mb-foot .primary');
      if (b) b.disabled = false;
    };

    drop.onclick = () => input.click();
    input.onchange = () => setFile(input.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); };

    const run = async close => {
      if (!data) return;
      if (dest.v === 'new' && App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Continuer quand même ?')) return;
      const btn = dlg.box.querySelector('.mb-foot .primary');
      btn.disabled = true;
      prog.hidden = false;
      err.hidden = true;
      const bar = prog.querySelector('i'), msg = prog.querySelector('.imp-msg');
      try {
        let blocks, meta = {}, stats = null, warnings = [];
        if (kind === 'tex') {
          blocks = L.latexToBlocks(data);
          stats = {
            paragraphes: blocks.filter(b => b.type === 'paragraph').length,
            equations: blocks.filter(b => b.type === 'equation').length,
            titres: blocks.filter(b => b.type === 'heading').length,
            tableaux: blocks.filter(b => b.type === 'table').length,
            listes: blocks.filter(b => b.type === 'list').length,
          };
        } else {
          msg.textContent = 'Ouverture du PDF…';
          const res = await convert(new Uint8Array(data), opts, (m, p) => { msg.textContent = m; bar.style.width = Math.round(Math.min(1, p) * 100) + '%'; });
          blocks = res.blocks; meta = res.meta; stats = res.stats; warnings = res.warnings;
        }
        if (!blocks.length) throw new Error('aucun contenu n\'a pu être extrait de ce fichier.');
        if (dest.v === 'new') {
          App.load({ meta: Object.assign(L.defaultMeta(), meta), blocks, bib: [], assets: {} }, null);
          App.fileName = null; App.filePath = null; App.fileHandle = null;
          App.updateName();
        } else {
          App.insertBlocks(blocks);
        }
        close();
        L.dlgImportDone(name, stats, warnings);
      } catch (e) {
        prog.hidden = true;
        btn.disabled = false;
        err.hidden = false;
        err.textContent = 'Import impossible : ' + (e && e.message ? e.message : e);
      }
    };

    dlg = L.modal({
      title: 'Importer un PDF', wide: true,
      body: L.h('div', null,
        L.h('p', { class: 'pp-help', text: 'Le PDF est analysé puis reconstruit en éléments modifiables : texte, titres, listes, tableaux, formules et images. Vous pouvez ensuite le corriger, puis l\'exporter en LaTeX (.tex) ou en PDF.' }),
        drop, input, info, optBox,
        L.h('div', { class: 'set-h', text: 'Destination' }), seg,
        prog, err),
      foot: [
        { text: 'Annuler', onClick: c => c() },
        { text: 'Importer', cls: 'primary', onClick: run },
      ],
    });
    dlg.box.querySelector('.mb-foot .primary').disabled = true;
    if (initialFile) setFile(initialFile);
  };

  /* Résumé affiché après l'import */
  L.dlgImportDone = function (name, stats, warnings) {
    const lines = [];
    const add = (n, sing, plur) => { if (n) lines.push(n + ' ' + (n > 1 ? (plur || sing + 's') : sing)); };
    if (stats) {
      add(stats.pages, 'page');
      add(stats.titres, 'titre');
      add(stats.paragraphes, 'paragraphe');
      add(stats.listes, 'liste');
      add(stats.tableaux, 'tableau', 'tableaux');
      add(stats.equations, 'équation centrée');
      add(stats.formules, 'formule');
      add(stats.figures, 'image');
    }
    L.modal({
      title: 'Import terminé',
      body: L.h('div', null,
        L.h('p', null, L.h('b', { text: name }), ' a été converti : ' + (lines.join(', ') || 'document vide') + '.'),
        warnings && warnings.length ? L.h('div', { class: 'note' }, warnings.join(' ')) : null,
        L.h('p', { class: 'pp-help', text: 'Relisez le document : les coupures de paragraphes et les formules complexes (fractions, racines, matrices) peuvent demander une retouche. Ctrl+Z annule l\'import.' })),
      foot: [
        { text: 'Fermer', onClick: c => c() },
        { text: 'Exporter en .tex', cls: 'primary', onClick: c => { c(); App.exportTex(); } },
      ],
    });
  };
})();
