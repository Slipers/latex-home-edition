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
      if (c.contains('fn')) { out += '\\footnote{' + L.texEsc(n.dataset.text) + '}'; return; }
      const inner = walk(n);
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

L.blockToLatex = function (b, X, indent = '') {
  const R = x => L.htmlToLatex(x, X);
  switch (b.type) {
    case 'paragraph': {
      if (L.isEmptyHtml(b.html)) return '';
      const t = R(b.html);
      if (b.align === 'center') return '\\begin{center}\n' + t + '\n\\end{center}';
      if (b.align === 'right') return '\\begin{flushright}\n' + t + '\n\\end{flushright}';
      return (b.noindent ? '\\noindent ' : '') + t;
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
      if (b.numbered) return '\\begin{equation}\\label{' + L.labelOf(b) + '}\n  ' + body + '\n\\end{equation}';
      return '\\[\n  ' + body + '\n\\]';
    }
    case 'list': return L.listToLatex(b, X);
    case 'box': {
      const k = L.KINDS[b.kind] || L.KINDS.theoreme;
      const inner = b.children.map(c => L.blockToLatex(c, X)).filter(Boolean).join('\n\n') || '\\mbox{}';
      if (k.style === 'abstract') return '\\begin{abstract}\n' + inner + '\n\\end{abstract}';
      if (b.kind === 'preuve') return '\\begin{proof}' + (b.title ? '[' + L.texEsc(b.title) + ']' : '') + '\n' + inner + '\n\\end{proof}';
      if (b.kind === 'solution') return '\\begin{proof}[' + L.texEsc(b.title || L.kindName('solution', X.lang)) + ']\n' + inner + '\n\\end{proof}';
      const env = b.kind + (b.numbered ? '' : '*');
      X.envs.add(env);
      return '\\begin{' + env + '}' + (b.title ? '[' + L.texEsc(b.title) + ']' : '') +
        (b.numbered ? '\\label{' + L.labelOf(b) + '}' : '') + '\n' + inner + '\n\\end{' + env + '}';
    }
    case 'table': {
      X.pk.add('booktabs');
      const cols = Math.max(...b.rows.map(r => r.length));
      const al = Array.from({ length: cols }, (_, i) => b.align[i] || 'c');
      const grid = b.style === 'grille';
      const spec = grid ? '|' + al.join('|') + '|' : al.join('');
      const lines = [];
      if (grid) lines.push('\\hline');
      else if (b.style === 'pro') lines.push('\\toprule');
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
      return '\\begin{table}[H]\n  \\centering\n  \\caption{' + R(b.caption) + '}\\label{' + L.labelOf(b) + '}\n' +
        '  \\begin{tabular}{' + spec + '}\n' + lines.map(l => '    ' + l).join('\n') + '\n  \\end{tabular}\n\\end{table}';
    }
    case 'figure': {
      const w = ((b.width || 60) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      let g;
      const src = b.src && X.doc.assets ? X.doc.assets[b.src] : null;
      if (src) {
        const m = /^data:image\/(png|jpe?g|gif|svg\+xml|webp)/.exec(src);
        let ext = m ? m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg') : 'png';
        const name = 'images/figure-' + (X.images.length + 1) + '.' + ext;
        X.images.push({ name, data: src, ext });
        if (ext === 'svg' || ext === 'gif' || ext === 'webp') X.warnings.add('Certaines images (SVG/GIF/WebP) doivent être converties en PNG ou PDF pour pdfLaTeX.');
        g = '\\includegraphics[width=' + w + '\\textwidth]{' + name + '}';
      } else g = '\\fbox{\\parbox{' + w + '\\textwidth}{\\centering\\vspace{2cm}Image manquante\\vspace{2cm}}}';
      return '\\begin{figure}[H]\n  \\centering\n  ' + g + '\n  \\caption{' + R(b.caption) + '}\\label{' + L.labelOf(b) + '}\n\\end{figure}';
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

L.listToLatex = function (b, X) {
  const lab = {
    number: ['\\arabic*.', '(\\alph*)', '\\roman*.'],
    alpha: ['\\alph*)', '\\roman*.', '\\Alph*.'],
    roman: ['\\roman*)', '\\alph*.', '\\Alph*.'],
  }[b.style];
  const envOf = lv => lab ? '\\begin{enumerate}[label=' + lab[lv] + ']' : '\\begin{itemize}';
  const endOf = () => lab ? '\\end{enumerate}' : '\\end{itemize}';
  let out = [], cur = -1;
  b.items.forEach(it => {
    const lv = Math.min(it.level || 0, 2);
    const target = Math.min(lv, cur + 1);
    while (cur < target) { cur++; out.push('  '.repeat(cur) + envOf(cur)); }
    while (cur > target) { out.push('  '.repeat(cur) + endOf()); cur--; }
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
      (has('subtitle') ? '\\\\[4pt]\n  {\\large ' + R(m.subtitle) + '}' : '') + '\n\\end{center}';
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
  P.push('\\documentclass[' + (m.fontSize || 11) + 'pt,a4paper]{article}');
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
  if (/\\ce\{/.test(body)) P.push('\\usepackage[version=4]{mhchem}');
  if (X.pk.has('booktabs')) P.push('\\usepackage{booktabs}');
  if (X.pk.has('tkz-tab')) P.push('\\usepackage{tkz-tab}');
  if (/\\coloneqq/.test(body)) P.push('\\usepackage{mathtools}');
  if (/\\cancel\{/.test(body)) P.push('\\usepackage{cancel}');
  if (m.margins === 'normales') P.push('\\usepackage[a4paper,margin=2.5cm]{geometry}');
  else if (m.margins === 'etroites') P.push('\\usepackage[a4paper,margin=1.5cm]{geometry}');
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
  if (m.pageNumbers === false) P.push('\\pagestyle{empty}');

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
  if (m.pageNumbers === false && m.titleStyle === 'article') D.push('\\thispagestyle{empty}', '');
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
