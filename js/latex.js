/* Génération d'un vrai fichier LaTeX (.tex) à partir du document */

const TEXT_UNI = {
  '→': '$\\rightarrow$', '←': '$\\leftarrow$', '⇒': '$\\Rightarrow$', '⇔': '$\\Leftrightarrow$', '↔': '$\\leftrightarrow$',
  '≤': '$\\leq$', '≥': '$\\geq$', '≠': '$\\neq$', '≈': '$\\approx$', '×': '$\\times$', '±': '$\\pm$', '∞': '$\\infty$',
  '·': '$\\cdot$', '÷': '$\\div$', '√': '$\\surd$', '∈': '$\\in$', '∀': '$\\forall$', '∃': '$\\exists$', '∑': '$\\sum$',
  '°': '\\textdegree{}', '€': '\\texteuro{}', '…': '\\ldots{}', 'µ': '$\\mu$', '’': "'", '‘': '`', '−': '$-$',
  'α': '$\\alpha$', 'β': '$\\beta$', 'γ': '$\\gamma$', 'δ': '$\\delta$', 'ε': '$\\varepsilon$', 'θ': '$\\theta$',
  'λ': '$\\lambda$', 'π': '$\\pi$', 'ρ': '$\\rho$', 'σ': '$\\sigma$', 'τ': '$\\tau$', 'φ': '$\\varphi$', 'ω': '$\\omega$',
  'Δ': '$\\Delta$', 'Ω': '$\\Omega$', 'Σ': '$\\Sigma$', 'Φ': '$\\Phi$',
};

L.texEsc = function (s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ').replace(/\u200b/g, '')
    .replace(/[\\{}$&#_%^~]/g, c => ({
      '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
      '_': '\\_', '%': '\\%', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
    }[c]))
    .replace(/[→←⇒⇔↔≤≥≠≈×±∞·÷√∈∀∃∑°€…µ’‘−αβγδεθλπρστφωΔΩΣΦ]/g, c => TEXT_UNI[c]);
};

L.labelOf = function (b) {
  const p = { heading: 'sec', equation: 'eq', figure: 'fig', table: 'tab', box: 'thm' }[b.type] || 'x';
  return p + ':' + b.id;
};

L.htmlToLatex = function (html, X) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  const walk = node => {
    let out = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += L.texEsc(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const c = n.classList;
      if (c.contains('imath')) { const s = L.cleanLatex(n.dataset.latex); if (s) out += '$' + s + '$'; return; }
      if (c.contains('xref')) {
        const t = L.find(X.doc, n.dataset.ref);
        if (!t) { out += '??'; return; }
        out += (t.block.type === 'equation' ? '\\eqref{' : '\\ref{') + L.labelOf(t.block) + '}';
        return;
      }
      if (c.contains('cite')) { out += '\\cite{' + n.dataset.ref + '}'; return; }
      if (c.contains('fn')) { out += '\\footnote{' + (n.dataset.html ? L.htmlToLatex(n.dataset.html, X) : L.texEsc(n.dataset.text)) + '}'; return; }
      if (c.contains('timg')) {
        const src = X.doc.assets ? X.doc.assets[n.dataset.src] : null;
        const name = src ? L.imageFile(X, src) : null;
        if (name) out += '\\raisebox{-0.5\\height}{\\includegraphics[width=' + (+n.dataset.w || 3) + 'cm]{' + name + '}}';
        return;
      }
      const inner = walk(n);
      const col = Array.from(c).find(k => k.startsWith('c-') && L.TEXT_COLORS[k.slice(2)]);
      if (col) { X.colors = true; out += '\\textcolor{lhe' + col.slice(2) + '}{' + inner + '}'; return; }
      const sz = Array.from(c).find(k => L.TEXT_SIZES[k]);
      if (sz) { out += '{\\' + L.TEXT_SIZES[sz][1] + ' ' + inner + '}'; return; }
      if (c.contains('hfill')) { out += '\\hfill{}'; return; }
      switch (n.tagName) {
        case 'B': case 'STRONG': out += '\\textbf{' + inner + '}'; break;
        case 'I': case 'EM': out += '\\emph{' + inner + '}'; break;
        case 'U': out += '\\underline{' + inner + '}'; break;
        case 'SUB': out += '\\textsubscript{' + inner + '}'; break;
        case 'SUP': out += '\\textsuperscript{' + inner + '}'; break;
        case 'CODE': out += '\\texttt{' + inner + '}'; break;
        case 'BR': out += '\\\\\n'; break;
        default: out += inner;
      }
    });
    return out;
  };
  return walk(d).replace(/\\\\\n$/, '').trim();
};

const LST_LANG = { python: 'Python', c: 'C', cpp: 'C++', java: 'Java', matlab: 'Matlab', r: 'R', html: 'HTML', sql: 'SQL', bash: 'bash', javascript: '', texte: '' };

/* Numéro forcé : \setcounter avant le bloc, pour que LaTeX suive la même numérotation */
L.forceCounter = function (b, X) {
  if (b.forceNum === undefined || b.forceNum === null || b.forceNum === '' || isNaN(+b.forceNum)) return '';
  let c = null;
  if (b.type === 'heading' && b.numbered && b.level <= 3) c = ['section', 'subsection', 'subsubsection'][b.level - 1];
  else if (b.type === 'equation' && b.numbered) c = 'equation';
  else if (b.type === 'table' && (b.capMode || 'num') === 'num') c = 'table';
  else if (b.type === 'figure' && (b.capMode || 'num') === 'num') c = 'figure';
  else if (b.type === 'box' && b.numbered && !(L.KINDS[b.kind] || {}).fixed) {
    const cn = (b.customName || '').trim(), st = (L.KINDS[b.kind] || {}).style;
    const cu = cn && X && X.custom ? X.custom.find(x => x.name === cn && x.style === st) : null;
    c = cu ? cu.env : b.kind;
  }
  return c ? '\\setcounter{' + c + '}{' + (+b.forceNum - 1) + '}\n' : '';
};

L.blockToLatex = function (b, X, indent = '') {
  const out = L.blockToLatexRaw(b, X, indent);
  const pre = L.forceCounter(b, X);
  return out && pre ? pre + out : out;
};

L.blockToLatexRaw = function (b, X, indent = '') {
  const R = x => L.htmlToLatex(x, X);
  switch (b.type) {
    case 'paragraph': {
      if (L.isEmptyHtml(b.html)) return '\\mbox{}';   // ligne vide, comme dans l'éditeur
      const t = R(b.html);
      if (b.align === 'center') return '\\begin{center}\n' + t + '\n\\end{center}';
      if (b.align === 'right') return '\\begin{flushright}\n' + t + '\n\\end{flushright}';
      if (b.align === 'left') return '\\begin{flushleft}\n' + t + '\n\\end{flushleft}';
      return (b.noindent || /\\hfill/.test(t) ? '\\noindent ' : '') + t;
    }
    case 'heading': {
      const cmd = ['section', 'subsection', 'subsubsection', 'paragraph'][Math.min(b.level, 4) - 1];
      const t = R(b.html) || '~';
      if (b.level === 4) return '\\paragraph{' + t + '}';
      if (b.numbered) return '\\' + cmd + '{' + t + '}\\label{' + L.labelOf(b) + '}';
      return '\\' + cmd + '*{' + t + '}\n\\addcontentsline{toc}{' + cmd + '}{' + t + '}';
    }
    case 'equation': {
      const s = L.cleanLatex(b.latex);
      if (!s) return '';
      const body = L.displayLatex(s);
      const eq = b.numbered
        ? '\\begin{equation}\\label{' + L.labelOf(b) + '}\n  ' + body + '\n\\end{equation}'
        : '\\[\n  ' + body + '\n\\]';
      const sz = b.size && L.TEXT_SIZES[b.size];
      return sz ? '{\\' + sz[1] + '\n' + eq + '\n}' : eq;
    }
    case 'list': return L.listToLatex(b, X);
    case 'box': {
      const k = L.KINDS[b.kind] || L.KINDS.theoreme;
      const inner = b.children.map(c => L.blockToLatex(c, X)).filter(Boolean).join('\n\n') || '\\mbox{}';
      if (k.style === 'abstract') return '\\begin{abstract}\n' + inner + '\n\\end{abstract}';
      const cname = (b.customName || '').trim();
      if (b.kind === 'preuve') return '\\begin{proof}' + (cname || b.title ? '[' + L.texEsc(cname || b.title) + ']' : '') + '\n' + inner + '\n\\end{proof}';
      if (b.kind === 'solution') return '\\begin{proof}[' + L.texEsc(cname || b.title || L.kindName('solution', X.lang)) + ']\n' + inner + '\n\\end{proof}';
      let env;
      if (cname) {
        // Nom personnalisé : un environnement dédié (même style que le type d'origine)
        X.custom = X.custom || [];
        let c = X.custom.find(x => x.name === cname && x.style === k.style);
        if (!c) { c = { name: cname, style: k.style, env: 'lhecustom' + String.fromCharCode(97 + X.custom.length % 26) + (X.custom.length >= 26 ? 'x' : ''), star: false, num: false }; X.custom.push(c); }
        if (b.numbered) c.num = true; else c.star = true;
        env = c.env + (b.numbered ? '' : '*');
      } else {
        env = b.kind + (b.numbered ? '' : '*');
        X.envs.add(env);
      }
      return '\\begin{' + env + '}' + (b.title ? '[' + L.texEsc(b.title) + ']' : '') +
        (b.numbered ? '\\label{' + L.labelOf(b) + '}' : '') + '\n' + inner + '\n\\end{' + env + '}';
    }
    case 'table': {
      X.pk.add('booktabs');
      const cols = Math.max(...b.rows.map(r => r.length));
      const colw = b.colw || [];
      const fill = colw.slice(0, cols).some(w => w === 'fill');
      const al = Array.from({ length: cols }, (_, i) => {
        const a = b.align[i] || 'c';
        if (!fill || colw[i] !== 'fill') return a;
        return '>{' + { l: '\\raggedright', c: '\\centering', r: '\\raggedleft' }[a] + '\\arraybackslash}X';
      });
      if (fill) X.pk.add('tabularx');
      const grid = b.style === 'grille';
      const spec = grid ? '|' + al.join('|') + '|' : al.join('');
      const lines = [];
      if (grid) lines.push('\\hline');
      else if (b.style === 'pro') lines.push('\\toprule');
      if (b.headColor && L.HEAD_COLORS[b.headColor]) { X.colors = true; lines.push('\\rowcolor{lhehead' + b.headColor + '}'); }
      const spans = b.spans || {};
      b.rows.forEach((r, ri) => {
        const cells = [];
        for (let ci = 0; ci < cols;) {
          const sp = Math.max(1, Math.min(spans[ri + ':' + ci] || 1, cols - ci));
          let t = R(r[ci] || '').replace(/\\\\\n/g, ' ');
          if (b.head && ri === 0 && t) t = '\\textbf{' + t + '}';
          if (sp > 1) t = '\\multicolumn{' + sp + '}{' + (grid ? (ci === 0 ? '|' : '') + 'c|' : 'c') + '}{' + t + '}';
          cells.push(t);
          ci += sp;
        }
        lines.push(cells.join(' & ') + ' \\\\');
        if (grid) lines.push('\\hline');
        else if (b.head && ri === 0) lines.push(b.style === 'pro' ? '\\midrule' : '\\hline');
      });
      if (b.style === 'pro') lines.push('\\bottomrule');
      const env = fill ? 'tabularx' : 'tabular';
      let tab = '  \\begin{' + env + '}' + (fill ? '{\\linewidth}' : '') + (X.inCols ? '[t]' : '') + '{' + spec + '}\n' + lines.map(l => '    ' + l).join('\n') + '\n  \\end{' + env + '}';
      // Un tableau trop large est réduit pour tenir dans la largeur de la page (jamais agrandi)
      if (!fill) { X.pk.add('adjustbox'); tab = '  \\begin{adjustbox}{max width=\\linewidth' + (X.inCols ? ',valign=t' : '') + '}\n' + tab + '\n  \\end{adjustbox}'; }
      const cap = L.captionToLatex(b, X, 'table');
      if (X.inCols) return '{\\centering\n' + (cap ? '  ' + cap + '\n' : '') + tab + '\\par}';
      return '\\begin{table}[H]\n  \\centering\n' + (cap ? '  ' + cap + '\n' : '') + tab + '\n\\end{table}';
    }
    case 'figure': {
      const w = ((b.width || 60) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      let g;
      const src = b.src && X.doc.assets ? X.doc.assets[b.src] : null;
      if (src) {
        const name = L.imageFile(X, src);
        g = '\\includegraphics[width=' + w + '\\linewidth]{' + name + '}';
      } else g = '\\fbox{\\parbox{' + w + '\\linewidth}{\\centering\\vspace{2cm}Image manquante\\vspace{2cm}}}';
      const cap = L.captionToLatex(b, X, 'figure');
      if (X.inCols) return '{\\centering\n  ' + g + '\\par\n' + (cap ? '  ' + cap + '\n' : '') + '\\par}';
      return '\\begin{figure}[H]\n  \\centering\n  ' + g + '\n' + (cap ? '  ' + cap + '\n' : '') + '\\end{figure}';
    }
    case 'code': {
      X.pk.add('listings');
      const opts = [];
      const lang = LST_LANG[b.lang];
      if (lang) opts.push('language=' + lang);
      if (b.numbers) opts.push('numbers=left');
      return '\\begin{lstlisting}' + (opts.length ? '[' + opts.join(', ') + ']' : '') + '\n' + (b.code || '') + '\n\\end{lstlisting}';
    }
    case 'tabvar': return L.tabvarToLatex(b, X);
    case 'pnote': { const h = L.pnoteHtml(b); return L.isEmptyHtml(h) ? '' : '{\\renewcommand{\\thefootnote}{}\\footnotetext{' + L.htmlToLatex(h, X) + '}}'; }
    case 'rule': return '\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par';
    case 'vspace': return '\\par' + (L.VSPACES[b.size || 'moyen'] || L.VSPACES.moyen)[1];
    case 'cols': {
      const r = (b.ratio || 50) / 100;
      const ws = [r - 0.02, 1 - r - 0.02];
      X.inCols = true;
      const parts = b.children.map((col, i) => '\\begin{minipage}[t]{' + ws[i].toFixed(2) + '\\textwidth}\n' +
        col.children.map(c => L.blockToLatex(c, X)).filter(Boolean).join('\n\n') + '\n\\end{minipage}');
      X.inCols = false;
      return '\\par\\medskip\\noindent\n' + parts.join('\\hfill\n') + '\\par\\medskip';
    }
    case 'pagebreak': return '\\newpage';
    case 'bibliography': {
      const bib = X.doc.bib || [];
      if (!bib.length) return '';
      return '\\begin{thebibliography}{' + (bib.length > 9 ? '99' : '9') + '}\n' + bib.map(e => {
        const parts = [];
        if (e.authors) parts.push(L.texEsc(e.authors) + '.');
        if (e.title) parts.push('\\emph{' + L.texEsc(e.title) + '}.');
        const src = [e.source, e.year].filter(Boolean).map(L.texEsc).join(', ');
        if (src) parts.push(src + '.');
        if (e.url) { parts.push('\\url{' + e.url.replace(/[%#]/g, '\\$&') + '}'); }
        return '  \\bibitem{' + e.id + '} ' + parts.join(' ');
      }).join('\n') + '\n\\end{thebibliography}';
    }
  }
  return '';
};

/* Enregistre une image du document dans le projet exporté (images/figure-N.ext) */
L.imageFile = function (X, src) {
  const m = /^data:image\/(png|jpe?g|gif|svg\+xml|webp)/.exec(src);
  const ext = m ? m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg') : 'png';
  const name = 'images/figure-' + (X.images.length + 1) + '.' + ext;
  X.images.push({ name, data: src, ext });
  if (ext === 'svg' || ext === 'gif' || ext === 'webp') X.warnings.add('Certaines images (SVG/GIF/WebP) doivent être converties en PNG ou PDF pour pdfLaTeX.');
  return name;
};

/* Légende : numérotée (\caption ou \captionof dans une colonne), sans numéro, ou aucune */
L.captionToLatex = function (b, X, kind) {
  const mode = b.capMode || 'num';
  if (mode === 'none') return '';
  const t = L.htmlToLatex(b.caption, X);
  if (mode === 'nonum') return kind === 'table' ? t + '\\par\\vspace{10pt}' : '\\vspace{10pt}' + t + '\\par';
  // Nom propre à cet objet (« Graphique 1 – ») : redéfini localement
  const own = (b.capLabel || '').trim() ? '\\renewcommand{\\' + kind + 'name}{' + L.texEsc(b.capLabel.trim()) + '}' : '';
  if (X.inCols) { X.pk.add('capt-of'); return own + '\\captionof{' + kind + '}{' + t + '}\\label{' + L.labelOf(b) + '}'; }
  return own + '\\caption{' + t + '}\\label{' + L.labelOf(b) + '}';
};

/* En-têtes et pieds de page (fancyhdr) + numérotation des pages */
L.hfToLatex = function (m, X) {
  const fmt = m.numFormat || 'arabic';
  const hasText = ['l', 'c', 'r'].some(k => (m.header || {})[k] || (m.footer || {})[k]);
  if (fmt === 'none' && !hasText) return { pre: ['\\pagestyle{empty}'], empty: true };
  const lang = m.lang || 'fr';
  const P = lang === 'en' ? 'Page' : 'Page', S = lang === 'en' ? 'of' : 'sur';
  const num0 = { arabic: '\\thepage', 'n/N': '\\thepage/\\pageref{LastPage}', page: P + '~\\thepage', 'page-sur': P + '~\\thepage{} ' + S + ' \\pageref{LastPage}', tirets: '--~\\thepage~--' }[fmt] || '';
  const num = !num0 ? '' : m.numStyle === 'gras' ? '\\textbf{' + num0 + '}' : m.numStyle === 'cadre' ? '\\fbox{' + num0 + '}' : num0;
  const tok = s => L.texEsc(s || '')
    .replace(/\\\{titre\\\}/g, L.texEsc(L.plain(m.title))).replace(/\\\{auteur\\\}/g, L.texEsc(L.plain(m.author)))
    .replace(/\\\{date\\\}/g, L.texEsc(L.plain(m.date)));
  const slot = { 'head-l': ['head', 'l'], 'head-c': ['head', 'c'], 'head-r': ['head', 'r'], 'foot-l': ['foot', 'l'], 'foot-c': ['foot', 'c'], 'foot-r': ['foot', 'r'] }[m.numPos || 'foot-c'];
  const out = [];
  for (const [where, obj] of [['head', m.header || {}], ['foot', m.footer || {}]]) {
    for (const k of ['l', 'c', 'r']) {
      let t = tok(obj[k]);
      if (num && slot[0] === where && slot[1] === k) t = t ? t + '~--~' + num : num;
      if (t) out.push('\\fancy' + where + '[' + k.toUpperCase() + ']{' + t + '}');
    }
  }
  out.push('\\renewcommand{\\headrulewidth}{' + (m.headRule ? '0.4pt' : '0pt') + '}');
  out.push('\\renewcommand{\\footrulewidth}{' + (m.footRule ? '0.4pt' : '0pt') + '}');
  const pre = ['\\usepackage{fancyhdr}'];
  if (/LastPage/.test(num)) pre.push('\\usepackage{lastpage}');
  pre.push('\\setlength{\\headheight}{14pt}');
  pre.push('\\fancypagestyle{lhe}{\\fancyhf{}' + out.join('') + '}');
  pre.push('\\fancypagestyle{plain}{\\fancyhf{}' + out.join('') + '}');
  pre.push('\\pagestyle{lhe}');
  return { pre, empty: false };
};

L.listToLatex = function (b, X) {
  const lab = {
    number: ['\\arabic*.', '(\\alph*)', '\\roman*.'],
    alpha: ['\\alph*)', '\\roman*.', '\\Alph*.'],
    roman: ['\\roman*)', '\\alph*.', '\\Alph*.'],
  }[b.style];
  const start = b.start !== undefined && b.start !== '' && !isNaN(+b.start) ? Math.trunc(+b.start) : 1;
  const envOf = lv => lab ? '\\begin{enumerate}[label=' + lab[lv] + (lv === 0 && start !== 1 ? ', start=' + start : '') + ']' : '\\begin{itemize}';
  const endOf = () => lab ? '\\end{enumerate}' : '\\end{itemize}';
  let out = [], cur = -1;
  b.items.forEach(it => {
    const lv = Math.min(it.level || 0, 2);
    const target = Math.min(lv, cur + 1);
    while (cur < target) { cur++; out.push('  '.repeat(cur) + envOf(cur)); }
    while (cur > target) { out.push('  '.repeat(cur) + endOf()); cur--; }
    // Numéro choisi pour cette question
    if (lab && it.num !== undefined && it.num !== '' && !isNaN(+it.num)) out.push('  '.repeat(cur + 1) + '\\setcounter{enum' + ['i', 'ii', 'iii'][cur] + '}{' + (Math.trunc(+it.num) - 1) + '}');
    out.push('  '.repeat(cur + 1) + '\\item ' + (L.htmlToLatex(it.html, X) || '\\mbox{}'));
  });
  while (cur >= 0) { out.push('  '.repeat(cur) + endOf()); cur--; }
  return out.join('\n');
};

L.titleToLatex = function (m, X) {
  const R = x => L.htmlToLatex(x, X);
  const has = k => !L.isEmptyHtml(m[k]);
  if (m.titleStyle === 'aucun') return '';
  if (m.titleStyle === 'fiche') {
    return '\\noindent ' + (has('institution') ? R(m.institution) : '') + '\\hfill ' + (has('date') ? R(m.date) : '') + '\\\\[-0.6em]\n' +
      '\\rule{\\textwidth}{0.4pt}\n\\begin{center}\n  {\\Large\\bfseries ' + R(m.title) + '}' +
      (has('subtitle') ? '\\\\[4pt]\n  {\\large ' + R(m.subtitle) + '}' : '') +
      (has('author') ? '\\\\[5pt]\n  {\\itshape ' + R(m.author) + '}' : '') + '\n\\end{center}';
  }
  if (m.titleStyle === 'pagegarde') {
    return '\\begin{titlepage}\n  \\centering\n' +
      (has('institution') ? '  {\\large\\MakeUppercase{' + R(m.institution) + '}}\\par\n' : '') +
      '  \\vfill\n  \\rule{\\linewidth}{0.8pt}\\\\[10pt]\n  {\\huge\\bfseries ' + R(m.title) + '\\par}\n' +
      (has('subtitle') ? '  \\vspace{10pt}{\\Large ' + R(m.subtitle) + '\\par}\n' : '') +
      '  \\rule{\\linewidth}{0.8pt}\\\\[3em]\n' + (has('author') ? '  {\\large ' + R(m.author) + '\\par}\n' : '') +
      (has('extra') ? '  \\vspace{0.5em}{' + R(m.extra) + '\\par}\n' : '') +
      '  \\vfill\n' + (has('date') ? '  {\\large ' + R(m.date) + '\\par}\n' : '') + '\\end{titlepage}';
  }
  return '\\maketitle';
};

L.docToLatex = function (doc) {
  const m = doc.meta;
  const X = { doc, lang: m.lang || 'fr', envs: new Set(), pk: new Set(), images: [], warnings: new Set() };
  const body = doc.blocks.map(b => L.blockToLatex(b, X)).filter(Boolean).join('\n\n');
  const title = L.titleToLatex(m, X);
  const R = x => L.htmlToLatex(x, X);

  const P = [];
  P.push('% Document généré par LaTeX Home Edition — compilable avec pdfLaTeX (Overleaf, TeX Live, MiKTeX)');
  // 10, 11 et 12 pt sont natifs ; les autres tailles passent par extarticle (extsizes)
  const fsz = +m.fontSize || 11;
  P.push('\\documentclass[' + fsz + 'pt,a4paper]{' + ([10, 11, 12].includes(fsz) ? 'article' : 'extarticle') + '}');
  P.push('\\usepackage[utf8]{inputenc}');
  P.push('\\usepackage[T1]{fontenc}');
  P.push('\\usepackage[' + (m.lang === 'en' ? 'english' : 'french') + ']{babel}');
  P.push('\\usepackage{lmodern}');
  P.push('\\usepackage{microtype}');
  P.push('\\usepackage{amsmath,amssymb,amsthm}');
  P.push('\\usepackage{graphicx}');
  P.push('\\usepackage{float}');
  P.push('\\usepackage{enumitem}');
  P.push('\\usepackage{textcomp}');
  P.push('\\usepackage{url}');
  if (X.colors) {
    P.push('\\usepackage[table]{xcolor}');
    Object.entries(L.TEXT_COLORS).forEach(([k, v]) => P.push('\\definecolor{lhe' + k + '}{HTML}{' + v + '}'));
    Object.entries(L.HEAD_COLORS).forEach(([k, v]) => P.push('\\definecolor{lhehead' + k + '}{HTML}{' + v + '}'));
  }
  if (X.pk.has('tabularx')) P.push('\\usepackage{tabularx}');
  if (X.pk.has('capt-of')) P.push('\\usepackage{capt-of}');
  if (X.pk.has('adjustbox')) P.push('\\usepackage{adjustbox}');
  if (/\\ce\{/.test(body)) P.push('\\usepackage[version=4]{mhchem}');
  if (X.pk.has('booktabs')) P.push('\\usepackage{booktabs}');
  if (X.pk.has('tkz-tab')) P.push('\\usepackage{tkz-tab}');
  if (/\\coloneqq/.test(body)) P.push('\\usepackage{mathtools}');
  if (/\\cancel\{/.test(body)) P.push('\\usepackage{cancel}');
  // footskip : pied de page à ~12 mm du bord (mêmes valeurs que l'éditeur)
  if (m.margins === 'normales') P.push('\\usepackage[a4paper,margin=2.5cm,footskip=13mm]{geometry}');
  else if (m.margins === 'etroites') P.push('\\usepackage[a4paper,margin=1.5cm,bottom=2.2cm,footskip=10mm]{geometry}');
  if (m.spacing === 1.5) P.push('\\usepackage{setspace}\n\\onehalfspacing');
  if (m.boxedThm && X.envs.size) P.push('\\usepackage{mdframed}');
  if (X.pk.has('listings')) {
    P.push('\\usepackage{listings}');
    P.push('\\lstset{basicstyle=\\ttfamily\\small, frame=single, breaklines=true, columns=fullflexible, keepspaces=true,\n' +
      '  literate={é}{{\\\'e}}1 {è}{{\\`e}}1 {ê}{{\\^e}}1 {à}{{\\`a}}1 {ç}{{\\c{c}}}1 {ù}{{\\`u}}1 {ô}{{\\^o}}1 {î}{{\\^i}}1 {É}{{\\\'E}}1}');
  }
  P.push('\\usepackage[hidelinks]{hyperref}');
  P.push('');
  P.push('% Commandes produites par l\'éditeur visuel de formules');
  P.push('\\providecommand{\\exponentialE}{\\mathrm{e}}');
  P.push('\\providecommand{\\imaginaryI}{\\mathrm{i}}');
  P.push('\\providecommand{\\imaginaryJ}{\\mathrm{j}}');
  P.push('\\providecommand{\\differentialD}{\\mathrm{d}}');
  P.push('\\providecommand{\\capitalDifferentialD}{\\mathrm{D}}');

  if (X.envs.size) {
    P.push('');
    P.push('% Environnements théorème / définition / exercice…');
    const byStyle = { plain: [], definition: [], remark: [] };
    X.envs.forEach(env => {
      const kind = env.replace('*', '');
      const st = (L.KINDS[kind] || L.KINDS.theoreme).style;
      (byStyle[st] || byStyle.plain).push(env);
    });
    for (const st of ['plain', 'definition', 'remark']) {
      if (!byStyle[st].length) continue;
      P.push('\\theoremstyle{' + st + '}');
      byStyle[st].sort().forEach(env => {
        const kind = env.replace('*', '');
        const name = L.kindName(kind, X.lang);
        if (env.endsWith('*')) P.push('\\newtheorem*{' + env + '}{' + name + '}');
        else P.push('\\newtheorem{' + env + '}{' + name + '}' + (m.thmBySection ? '[section]' : ''));
      });
    }
    if (m.boxedThm) X.envs.forEach(env => P.push('\\surroundwithmdframed{' + env + '}'));
  }
  if (X.custom && X.custom.length) {
    P.push('% Encadrés aux noms personnalisés');
    X.custom.forEach(c => {
      P.push('\\theoremstyle{' + (['plain', 'definition', 'remark'].includes(c.style) ? c.style : 'plain') + '}');
      if (c.num) P.push('\\newtheorem{' + c.env + '}{' + L.texEsc(c.name) + '}' + (m.thmBySection ? '[section]' : ''));
      if (c.star) P.push('\\newtheorem*{' + c.env + '*}{' + L.texEsc(c.name) + '}');
      if (m.boxedThm) { if (c.num) P.push('\\surroundwithmdframed{' + c.env + '}'); if (c.star) P.push('\\surroundwithmdframed{' + c.env + '*}'); }
    });
  }
  const HF = L.hfToLatex(L.fixMeta(m), X);
  // Style des notes de bas de page (même présentation que l'éditeur : pas de « 1. » à la française)
  if (m.lang !== 'en') P.push('\\frenchsetup{FrenchFootnotes=false}');
  if (m.fnStyle === 'crochets') P.push('\\renewcommand{\\thefootnote}{[\\arabic{footnote}]}', '\\makeatletter\\renewcommand{\\@makefnmark}{\\mbox{\\normalfont\\@thefnmark}}\\makeatother');
  else if (m.fnStyle === 'symboles') P.push('\\renewcommand{\\thefootnote}{\\fnsymbol{footnote}}');
  P.push('', '% En-têtes, pieds de page et numérotation');
  HF.pre.forEach(l => P.push(l));
  // Noms des légendes (« Tableau 1 – » au lieu de « Table 1 – »)
  const tn = (m.tableName || '').trim(), fnm = (m.figureName || '').trim();
  if (tn || fnm) {
    const lg = m.lang === 'en' ? 'english' : 'french';
    P.push('\\addto\\captions' + lg + '{' + (tn ? '\\def\\tablename{' + L.texEsc(tn) + '}' : '') + (fnm ? '\\def\\figurename{' + L.texEsc(fnm) + '}' : '') + '}');
  }

  if (m.titleStyle === 'article' || !m.titleStyle) {
    P.push('');
    const t = R(m.title) + (L.isEmptyHtml(m.subtitle) ? '' : '\\\\[0.5em]\\large ' + R(m.subtitle));
    P.push('\\title{' + t + '}');
    const au = R(m.author) + (L.isEmptyHtml(m.institution) ? '' : '\\\\ \\normalsize ' + R(m.institution)) +
      (L.isEmptyHtml(m.extra) ? '' : '\\\\ \\normalsize ' + R(m.extra));
    P.push('\\author{' + au + '}');
    P.push('\\date{' + R(m.date) + '}');
  }

  const D = ['', '\\begin{document}', ''];
  if (title) D.push(title, '');
  if (!HF.empty && m.hfFirst === false && (m.titleStyle === 'article' || m.titleStyle === 'fiche' || m.titleStyle === 'aucun')) D.push('\\thispagestyle{empty}', '');
  const ps = L.pageStart(m);
  if (!HF.empty && ps !== 1) D.push('\\setcounter{page}{' + ps + '}', '');
  if (m.toc) D.push('\\tableofcontents', '');
  D.push(body, '', '\\end{document}', '');
  return { tex: P.join('\n') + '\n' + D.join('\n'), images: X.images, warnings: [...X.warnings] };
};

/* ---------- Archive ZIP minimale (sans compression) ---------- */
L.makeZip = function (files) {
  const crcTable = L._crcT || (L._crcT = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })());
  const crc32 = u8 => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const csize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
};

L.dataUrlToBytes = function (url) {
  const b64 = url.split(',')[1] || '';
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};
