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
    // plusieurs espaces insécables de suite = un blanc voulu (\quad) ; une seule = espace normale
    .replace(/\u00a0{2,}/g, '\u0001').replace(/\u00a0/g, ' ').replace(/\u200b/g, '')
    .replace(/[\\{}$&#_%^~]/g, c => ({
      '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
      '_': '\\_', '%': '\\%', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
    }[c]))
    .replace(/[→←⇒⇔↔≤≥≠≈×±∞·÷√∈∀∃∑°€…µ’‘−αβγδεθλπρστφωΔΩΣΦ]/g, c => TEXT_UNI[c])
    .replace(/\u0001/g, '\\quad{}');
};

L.labelOf = function (b) {
  const p = { heading: 'sec', equation: 'eq', figure: 'fig', table: 'tab', box: 'thm' }[b.type] || 'x';
  return p + ':' + b.id;
};

L.htmlToLatex = function (html, X) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  const right = [];   // « Texte à droite » : rejeté en fin de texte, comme dans l'éditeur
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
      if (c.contains('fbox')) { out += '\\fbox{' + inner + '}'; return; }
      const sz = Array.from(c).find(k => L.TEXT_SIZES[k]);
      if (sz) { out += '{\\' + L.TEXT_SIZES[sz][1] + ' ' + inner + '}'; return; }
      if (c.contains('hfill')) { out += '\\hfill{}'; return; }
      if (c.contains('rtag')) { if (n.dataset.text) right.push(L.texEsc(n.dataset.text)); return; }
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
  const body = walk(d).replace(/\\\\\n$/, '').trim();
  return right.length ? body + '\\hfill\\mbox{' + right.join(' ') + '}' : body;
};

/* Langages que le paquet listings ne connaît pas : définis dans le préambule */
const LST_CUSTOM = {
  JavaScript: 'morekeywords={async,await,break,case,catch,class,const,continue,debugger,default,delete,do,else,enum,export,extends,false,finally,for,from,function,if,implements,import,in,instanceof,interface,let,new,null,of,private,protected,public,readonly,return,static,super,switch,this,throw,true,try,type,typeof,undefined,var,void,while,with,yield}, morecomment=[l]{//}, morecomment=[s]{/*}{*/}, morestring=[b]", morestring=[b]\', morestring=[b]`, sensitive=true',
  Rust: 'morekeywords={as,async,await,break,const,continue,crate,dyn,else,enum,extern,false,fn,for,if,impl,in,let,loop,match,mod,move,mut,pub,ref,return,self,Self,static,struct,super,trait,true,type,unsafe,use,where,while}, morecomment=[l]{//}, morecomment=[s]{/*}{*/}, morestring=[b]", sensitive=true',
  Go: 'morekeywords={break,case,chan,const,continue,default,defer,else,fallthrough,false,for,func,go,goto,if,import,interface,map,nil,package,range,return,select,struct,switch,true,type,var}, morecomment=[l]{//}, morecomment=[s]{/*}{*/}, morestring=[b]", morestring=[b]`, sensitive=true',
  JSON: 'morekeywords={true,false,null}, morestring=[b]", sensitive=true',
  CSS: 'morekeywords={important}, morecomment=[s]{/*}{*/}, morestring=[b]", morestring=[b]\', sensitive=false',
};

/* Numéro forcé : \setcounter avant le bloc, pour que LaTeX suive la même numérotation */
L.forceCounter = function (b, X) {
  if (b.forceNum === undefined || b.forceNum === null || b.forceNum === '' || isNaN(+b.forceNum)) return '';
  let c = null;
  if (b.type === 'heading' && b.numbered && b.level <= 3) c = ['section', 'subsection', 'subsubsection'][b.level - 1];
  else if (b.type === 'equation' && b.numbered) c = 'equation';
  else if (b.type === 'table' && (b.capMode || 'num') === 'num') c = 'table';
  else if ((b.type === 'figure' || b.type === 'tikz') && (b.capMode || 'num') === 'num') c = 'figure';
  else if (b.type === 'box' && b.numbered && !(L.KINDS[b.kind] || {}).fixed) {
    const cn = (b.customName || '').trim(), st = (L.KINDS[b.kind] || {}).style;
    const co = X && X.cours ? X.cours[(cn ? 'c:' + cn : b.kind)] : null;   // style « cours » : compteur = nom de l'environnement
    const cu = cn && X && X.custom ? X.custom.find(x => x.name === cn && x.style === st) : null;
    c = co ? co.env : cu ? cu.env : b.kind;
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
      return (b.noindent || /\\hfill\{\}/.test(t) ? '\\noindent ' : '') + t;
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
      if (k.style === 'cadre') { X.pk.add('cadre'); return '\\begin{lhecadre}\n' + inner + '\n\\end{lhecadre}'; }
      // Style « cours » : un environnement tcolorbox par type (onglet de titre coloré), exercices à la plume
      const g = X.doc.meta.boxTheme === 'cours' ? L.boxGroup(b.kind) : null;
      if (g) {
        X.cours = X.cours || {};
        const key = (cname ? 'c:' + cname : b.kind) + (b.numbered ? '' : '*');
        let e = X.cours[key];
        if (!e) {
          const n = Object.keys(X.cours).length;
          const env = !cname && b.numbered ? b.kind : 'lhe' + (cname ? 'perso' + String.fromCharCode(97 + n % 26) + (n >= 26 ? 'x' : '') : b.kind + 'nn');
          e = X.cours[key] = { env, name: cname || L.kindName(b.kind, X.lang), g, numbered: !!b.numbered };
        }
        return '\\begin{' + e.env + '}' + (b.title ? '[' + L.texEsc(b.title) + ']' : '') +
          (b.numbered ? '\\label{' + L.labelOf(b) + '}' : '') + '\n' + inner + '\n\\end{' + e.env + '}';
      }
      if (b.kind === 'preuve') return '\\begin{proof}' + (cname || b.title ? '[' + L.texEsc(cname || b.title) + ']' : '') + '\n' + inner + '\n\\end{proof}';
      if (b.kind === 'correction') {
        X.pk.add('correction');
        return '\\begin{correction}[' + ['0pt', '2.5em', '4.7em', '6.9em'][b.indent || 0] + ']\n' + inner + '\n\\end{correction}';
      }
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
          // Retour à la ligne dans une case : gardé dans une colonne « largeur restante » (X), sinon espace
          let t = R(r[ci] || '').replace(/\\\\\n/g, fill && sp === 1 && colw[ci] === 'fill' ? '\\newline ' : ' ');
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
      const lang = L.codeLang(b.lang)[3];
      // (entre accolades : « [Objective]Caml » contient des crochets)
      if (lang) { opts.push('language={' + lang + '}'); X.pk.add((LST_CUSTOM[lang] ? 'lst:' : 'lstb:') + lang); }
      if (b.numbers) opts.push('numbers=left');
      return '\\begin{lstlisting}' + (opts.length ? '[' + opts.join(', ') + ']' : '') + '\n' + (b.code || '') + '\n\\end{lstlisting}';
    }
    case 'tikz': {
      // Le code TikZ tel quel (le vrai LaTeX donne le même dessin) ; « Échelle » = scale=
      X.pk.add('tikz');
      let code = (b.code || '').replace(/\\usetikzlibrary\{([^}]*)\}/g, (m, l) => { l.split(',').forEach(x => x.trim() && X.pk.add('tikzlib:' + x.trim())); return ''; }).trim();
      const s = b.scale && b.scale !== 1 ? 'scale=' + b.scale : '';
      if (/\\begin\{tikzpicture\}/.test(code)) {
        if (s) code = code.replace(/\\begin\{tikzpicture\}(\[([^\]]*)\])?/, (m, o, inner) => '\\begin{tikzpicture}[' + (inner ? inner + ', ' : '') + s + ']');
      } else if (/^\\tikz\b/.test(code)) {
        if (s) code = code.replace(/^\\tikz\s*(\[([^\]]*)\])?/, (m, o, inner) => '\\tikz[' + (inner ? inner + ', ' : '') + s + ']');
      } else code = '\\begin{tikzpicture}' + (s ? '[' + s + ']' : '') + '\n' + code + '\n\\end{tikzpicture}';
      if (!code) return '';
      const cap = L.captionToLatex(b, X, 'figure');
      if (X.inCols) return '{\\centering\n' + code + '\\par\n' + (cap ? '  ' + cap + '\n' : '') + '\\par}';   // dans une colonne : comme une image
      if (cap) return '\\begin{figure}[H]\n  \\centering\n' + code + '\n' + '  ' + cap + '\n\\end{figure}';
      return '\\begin{center}\n' + code + '\n\\end{center}';
    }
    case 'tabvar': return L.tabvarToLatex(b, X);
    case 'pnote': { const h = L.pnoteHtml(b); return L.isEmptyHtml(h) ? '' : '{\\renewcommand{\\thefootnote}{}\\footnotetext{' + L.htmlToLatex(h, X) + '}}'; }
    case 'rule': return '\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par';
    case 'vspace': return '\\par' + (L.VSPACES[b.size || 'moyen'] || L.VSPACES.moyen)[1];
    case 'cols': {
      const r = (b.ratio || 50) / 100;
      const ws = [r - 0.02, 1 - r - 0.02];
      X.inCols = true;
      // \linewidth : juste aussi dans un encadré ; \vspace{0pt} : colonnes alignées par le haut (comme l'éditeur)
      const parts = b.children.map((col, i) => '\\begin{minipage}[t]{' + ws[i].toFixed(2) + '\\linewidth}\\vspace{0pt}\n' +
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
  // Style « cours » : en-tête en sans empattements gras (texte penché), pied : gras / machine à écrire / gras
  const cours = m.secStyle === 'cours';
  const deco = (where, k, t, isNum) => !cours || !t ? t
    : where === 'head' ? '{\\sffamily\\bfseries' + (isNum ? '' : '\\slshape') + ' ' + t + '}'
    : k === 'c' ? '{\\ttfamily ' + t + '}' : '{\\bfseries ' + t + '}';
  const out = [], foot = [];
  for (const [where, obj] of [['head', m.header || {}], ['foot', m.footer || {}]]) {
    for (const k of ['l', 'c', 'r']) {
      let t = deco(where, k, tok(obj[k]));
      const hasNum = num && slot[0] === where && slot[1] === k;
      if (hasNum) t = t ? t + '~--~' + deco(where, k, num, true) : deco(where, k, num, true);
      const pos = where === 'head' && m.headMirror ? { l: 'LO,RE', c: 'C', r: 'RO,LE' }[k] : k.toUpperCase();   // recto-verso
      if (t) (where === 'foot' ? foot : out).push('\\fancy' + where + '[' + pos + ']{' + t + '}');
    }
  }
  out.push(...foot);
  const rules = ['\\renewcommand{\\headrulewidth}{' + (m.headRule ? '0.4pt' : '0pt') + '}',
    '\\renewcommand{\\footrulewidth}{' + (m.footRule ? (cours ? '1pt' : '0.4pt') : '0pt') + '}'];
  const pre = ['\\usepackage{fancyhdr}'];
  if (/LastPage/.test(num)) pre.push('\\usepackage{lastpage}');
  pre.push('\\setlength{\\headheight}{14pt}');
  pre.push('\\fancypagestyle{lhe}{\\fancyhf{}' + out.join('') + rules.join('') + '}');
  pre.push('\\fancypagestyle{plain}{\\fancyhf{}' + out.join('') + rules.join('') + '}');
  // Première page avec le pied de page seulement
  if (m.hfFirst === 'foot') pre.push('\\fancypagestyle{lhefirst}{\\fancyhf{}' + foot.join('') + '\\renewcommand{\\headrulewidth}{0pt}' + rules[1] + '}');
  pre.push('\\pagestyle{lhe}');
  if (cours) pre.push('\\AtBeginDocument{\\setlength{\\headwidth}{\\textwidth}}');
  return { pre, empty: false };
};

L.listToLatex = function (b, X) {
  const lab = {
    number: ['\\arabic*.', '(\\alph*)', '\\roman*.'],
    alpha: ['\\alph*)', '\\roman*.', '\\Alph*.'],
    roman: ['\\roman*)', '\\alph*.', '\\Alph*.'],
    sujet: ['\\textbf{\\Roman*.}', '\\textbf{\\arabic*.}', '\\textbf{\\alph*.}'],
  }[b.style];
  const start = b.start !== undefined && b.start !== '' && !isNaN(+b.start) ? Math.trunc(+b.start) : 1;
  const tight = b.style === 'sujet' || b.style === 'puce' ? ', itemsep=0pt, parsep=0pt, topsep=2pt' : '';   // questions serrées, comme dans l'éditeur
  const bullets = {
    puce: ['\\textbullet', '--', '$\\ast$'], etoile: ['$\\star$', '--', '$\\ast$'],
    fleche: ['$\\blacktriangleright$', '$\\triangleright$', '--'], triangle: ['$\\triangleright$', '--', '$\\ast$'], carre: ['$\\blacksquare$', '--', '$\\ast$'],
  }[b.style];
  const envOf = lv => lab ? '\\begin{enumerate}[label=' + lab[lv] + (lv === 0 && start !== 1 ? ', start=' + start : '') + tight + ']' : (bullets ? '\\begin{itemize}[label=' + bullets[lv] + tight + ']' : '\\begin{itemize}');
  const endOf = () => lab ? '\\end{enumerate}' : '\\end{itemize}';
  let out = [], cur = -1;
  const hasItem = [false, false, false];
  b.items.forEach(it => {
    const lv = Math.min(it.level || 0, 2);
    // Une liste peut commencer par une sous-question (suite d'une question après une
    // formule centrée) : les niveaux au-dessus sont ouverts avec un élément sans étiquette
    const target = lv;
    while (cur < target) {
      if (cur >= 0 && !hasItem[cur]) { out.push('  '.repeat(cur + 1) + '\\item[]'); hasItem[cur] = true; }
      cur++; hasItem[cur] = false; out.push('  '.repeat(cur) + envOf(cur));
    }
    while (cur > target) { out.push('  '.repeat(cur) + endOf()); cur--; }
    hasItem[cur] = true;
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
  if (m.titleStyle === 'cadre') {
    X.pk.add('petitescaps');
    return '\\begin{center}\n' + (has('subtitle') ? '  {\\sffamily\\bfseries\\Large ' + R(m.subtitle) + '\\par}\\vspace{14pt}\n' : '') +
      '  {\\setlength{\\fboxrule}{1.4pt}\\setlength{\\fboxsep}{0pt}\\fbox{\\parbox[c][37.5pt][c]{0.93\\linewidth}{\\centering\\sffamily\\fontsize{28.4}{34}\\selectfont\\lhepetitescaps{' +
      L.texEsc(L.plain(m.title)) + '}}}\\par}\n\\end{center}\n\\vspace{10pt}';
  }
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

/* Préambule du style « cours » : encadrés colorés (tcolorbox), exercices à la plume (bclogo),
   encadré gris, titres I - / 1) / a. (titlesec), table des matières, titre encadré */
L.coursPreamble = function (m, X) {
  const P = [];
  const cours = X.cours ? Object.values(X.cours) : [];
  if (cours.length || X.pk.has('cadre')) P.push('\\usepackage[most]{tcolorbox}');
  if (X.pk.has('cadre')) P.push('\\newtcolorbox{lhecadre}{enhanced, breakable=false, sharp corners, boxrule=1.5pt, colframe=black, colback=black!25!white, left=4pt, right=4pt, top=5pt, bottom=3pt, before skip=10pt, after skip=10pt}');
  if (cours.length) {
    P.push('% Encadrés colorés (style « cours ») : onglet de titre posé sur le cadre');
    Object.entries(L.BOX_COLORS).forEach(([g, c]) => { if (cours.some(e => e.g === g)) P.push('\\definecolor{lhe' + g + 'a}{HTML}{' + c[0] + '}\\definecolor{lhe' + g + 'b}{HTML}{' + c[1] + '}\\definecolor{lhe' + g + 'c}{HTML}{' + c[2] + '}\\definecolor{lhe' + g + 'd}{HTML}{' + c[3] + '}'); });
    P.push('\\tcbset{lhecours/.style={enhanced, breakable=false, boxsep=0pt, left=9.5pt, right=9pt, top=11.25pt, bottom=19.25pt, left skip=16pt, right skip=16pt,',
      '  before skip balanced=0pt, after skip balanced=0pt, before={\\par\\addvspace{13pt}\\noindent}, after={\\par\\addvspace{12pt}},',
      '  arc=2.5pt, boxrule=1pt, fonttitle=\\rmfamily\\bfseries\\normalsize,',
      '  attach boxed title to top left={xshift=9.5pt, yshift*=-\\tcboxedtitleheight/2},',
      '  boxed title style={arc=3pt, boxrule=0.5pt, colframe=black, left=3pt, right=3pt, top=0.5pt, bottom=0.5pt}}}');
    P.push('\\newcommand{\\lhesoustitre}[1]{\\if\\relax\\detokenize{#1}\\relax\\else\\ \\ - #1\\fi}');
    if (cours.some(e => e.g === 'exo')) {
      P.push('\\usepackage[tikz]{bclogo}');
      P.push('\\newtcolorbox{lheexobarre}{blanker, breakable, left=14.4pt, borderline west={1.5pt}{3.1pt}{gray}, before skip=0pt, after skip=0pt}');
    }
    cours.forEach(e => {
      const name = L.texEsc(e.name);
      if (e.numbered) P.push('\\newcounter{' + e.env + '}' + (m.thmBySection ? '[section]' : ''));
      if (m.thmBySection && e.numbered) P.push('\\renewcommand{\\the' + e.env + '}{\\arabic{section}.\\arabic{' + e.env + '}}');
      const num = e.numbered ? '~\\the' + e.env : '';
      if (e.g === 'exo') {
        P.push('\\NewDocumentEnvironment{' + e.env + '}{O{}}{\\par\\addvspace{8pt}' + (e.numbered ? '\\refstepcounter{' + e.env + '}' : '') +
          '\\noindent\\makebox[22.4pt][l]{\\raisebox{-2pt}{\\resizebox{!}{11pt}{\\bcplume}}}\\textit{' + name + num + '\\ :\\if\\relax\\detokenize{#1}\\relax\\else\\ #1\\fi}\\par\\nobreak\\vspace{2.5pt}' +
          '\\begin{lheexobarre}\\itshape}{\\end{lheexobarre}\\par\\addvspace{32pt}}');
      } else {
        P.push('\\newtcolorbox{' + e.env + '}[1][]{lhecours, colframe=lhe' + e.g + 'a, colback=lhe' + e.g + 'b, boxed title style={colback=lhe' + e.g + 'c}, coltitle=lhe' + e.g + 'd,' +
          (e.numbered ? ' code={\\refstepcounter{' + e.env + '}},' : '') + ' title={' + name + num + '\\lhesoustitre{#1}}}');
      }
    });
  }
  if (X.pk.has('petitescaps')) {
    // Petites capitales en sans empattements (la police n'en a pas : minuscules en capitales réduites)
    P.push('\\ExplSyntaxOn',
      '\\NewDocumentCommand{\\lhepetitescaps}{m}{\\text_map_inline:nn{#1}{\\str_if_eq:eeTF{\\text_uppercase:n{##1}}{\\exp_not:n{##1}}{##1}{\\scalebox{0.77}{\\text_uppercase:n{##1}}}}}',
      '\\ExplSyntaxOff');
  }
  if (m.secStyle === 'cours') {
    P.push('% Titres I - / 1) / a. en sans empattements (Computer Modern Sans)');
    P.push('\\renewcommand{\\sfdefault}{cmss}');
    P.push('\\usepackage{titlesec}');
    P.push('\\renewcommand{\\thesection}{\\Roman{section}}\\renewcommand{\\thesubsection}{\\arabic{subsection}}\\renewcommand{\\thesubsubsection}{\\alph{subsubsection}}');
    P.push('\\titleformat{\\section}{\\sffamily\\bfseries\\Large}{\\thesection\\ -}{0.5em}{}');
    P.push('\\titleformat{\\subsection}{\\sffamily\\bfseries\\large}{\\hspace*{10.6pt}\\thesubsection)}{0.5em}{}');
    P.push('\\titleformat{\\subsubsection}{\\sffamily\\bfseries}{\\hspace*{10.6pt}\\thesubsubsection.}{0.5em}{}');
    P.push('\\titleformat{\\paragraph}[hang]{\\sffamily\\bfseries}{}{0pt}{}\\titlespacing*{\\paragraph}{0pt}{12pt}{4pt}');
    P.push('\\titlespacing*{\\section}{0pt}{19pt}{12pt}\\titlespacing*{\\subsection}{0pt}{10pt}{6.6pt}\\titlespacing*{\\subsubsection}{0pt}{10pt}{6pt}');
  }
  if (m.toc && (m.secStyle === 'cours' || m.tocPages === false)) {
    const pg = (lv) => m.tocPages === false ? '' : lv === 1 ? '\\hfill\\contentspage' : '\\titlerule*[0.6pc]{.}\\contentspage';
    P.push('\\usepackage{titletoc}');
    if (m.secStyle === 'cours') {
      P.push('\\titlecontents{section}[0pt]{\\addvspace{9pt}\\sffamily\\bfseries}{\\makebox[24.5pt][l]{\\thecontentslabel\\ -}}{}{' + pg(1) + '}');
      P.push('\\titlecontents{subsection}[34.6pt]{}{\\contentslabel[\\thecontentslabel)]{17.5pt}}{}{' + pg(2) + '}');
      P.push('\\titlecontents{subsubsection}[59.6pt]{}{\\contentslabel[\\thecontentslabel.]{17.6pt}}{}{' + pg(3) + '}');
      P.push('\\makeatletter\\renewcommand{\\tableofcontents}{{\\noindent\\rmfamily\\bfseries\\Large\\contentsname\\par}\\vspace{2pt}\\@starttoc{toc}}\\makeatother');
    } else {
      P.push('\\titlecontents{section}[1.5em]{\\addvspace{1em}\\bfseries}{\\contentslabel{1.5em}}{}{' + pg(1) + '}');
      P.push('\\titlecontents{subsection}[3.8em]{}{\\contentslabel{2.3em}}{}{' + pg(2) + '}');
      P.push('\\titlecontents{subsubsection}[7em]{}{\\contentslabel{3.2em}}{}{' + pg(3) + '}');
    }
  }
  return P;
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
  P.push('\\documentclass[' + fsz + 'pt,a4paper' + (m.headMirror ? ',twoside' : '') + ']{' + ([10, 11, 12].includes(fsz) ? 'article' : 'extarticle') + '}');
  P.push('\\usepackage[utf8]{inputenc}');
  P.push('\\usepackage[T1]{fontenc}');
  P.push('\\usepackage[' + (m.lang === 'en' ? 'english' : 'french') + ']{babel}');
  P.push('\\usepackage{lmodern}');
  if (m.fontFamily === 'sans') P.push('\\renewcommand{\\familydefault}{\\sfdefault}');   // texte sans empattements, formules inchangées
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
  if (X.pk.has('correction')) {
    // Correction d'un sujet : liste sans étiquette (décalage = celui des questions), en bleu et en italique
    P.push('\\usepackage{xcolor}');
    P.push('\\definecolor{lhecorr}{HTML}{1F4FBF}');
    P.push('\\newenvironment{correction}[1][0pt]{\\par\\begin{list}{}{\\setlength{\\leftmargin}{#1}\\setlength{\\rightmargin}{0pt}\\setlength{\\labelwidth}{0pt}\\setlength{\\labelsep}{0pt}\\setlength{\\itemindent}{0pt}\\setlength{\\listparindent}{0pt}\\setlength{\\itemsep}{0pt}\\setlength{\\parsep}{0pt}\\setlength{\\topsep}{3pt}}\\item[]\\leavevmode{\\color{lhecorr}\\bfseries Correction.}\\ \\color{lhecorr}\\itshape\\ignorespaces}{\\end{list}}');
  }
  L.coursPreamble(m, X).forEach(l => P.push(l));
  if (X.pk.has('tikz')) {
    P.push('\\usepackage{tikz}');
    const libs = new Set(['arrows', 'arrows.meta', 'positioning', 'calc', 'plotmarks']);
    [...X.pk].filter(k => k.startsWith('tikzlib:')).forEach(k => libs.add(k.slice(8)));
    P.push('\\usetikzlibrary{' + [...libs].join(',') + '}');
  }
  if (/\\coloneqq/.test(body)) P.push('\\usepackage{mathtools}');
  if (/\\cancel\{/.test(body)) P.push('\\usepackage{cancel}');
  if (/\\mathscr\{/.test(body)) P.push('\\usepackage{mathrsfs}');
  // footskip : pied de page à ~12 mm du bord (mêmes valeurs que l'éditeur)
  if (m.margins === 'normales') P.push('\\usepackage[a4paper,margin=2.5cm,footskip=13mm]{geometry}');
  else if (m.margins === 'etroites') P.push('\\usepackage[a4paper,margin=1.5cm,bottom=2.2cm,footskip=10mm]{geometry}');
  else if (m.margins === 'fines') P.push('\\usepackage[a4paper,left=1.25cm,right=1.25cm,top=2.48cm,bottom=2.12cm,headsep=25pt,footskip=9.5mm]{geometry}');
  if (m.spacing === 1.5) P.push('\\usepackage{setspace}\n\\onehalfspacing');
  if (m.boxedThm && X.envs.size) P.push('\\usepackage{mdframed}');
  if (X.pk.has('listings')) {
    P.push('\\usepackage{listings}');
    // Même coloration que dans l'éditeur et le PDF
    P.push('\\usepackage{xcolor}');
    P.push('\\definecolor{lstkw}{HTML}{1F4FBF}\\definecolor{lststr}{HTML}{A31515}\\definecolor{lstcom}{HTML}{2E7D32}\\definecolor{lstnum}{HTML}{7A7F88}');
    Object.keys(LST_CUSTOM).forEach(k => { if (X.pk.has('lst:' + k)) P.push('\\lstdefinelanguage{' + k + '}{' + LST_CUSTOM[k] + '}'); });
    // Langages de listings chargés dès le préambule : avec babel-french, les caractères
    // « actifs » du document (! ? ; :) cassent sinon certaines définitions (R…)
    const builtin = [...X.pk].filter(k => k.startsWith('lstb:')).map(k => k.slice(5));
    if (builtin.length) P.push('\\lstloadlanguages{' + builtin.join(',') + '}');
    P.push('\\lstset{basicstyle=\\ttfamily\\small, keywordstyle=\\color{lstkw}, stringstyle=\\color{lststr}, commentstyle=\\color{lstcom}\\itshape,\n' +
      '  numberstyle=\\tiny\\color{lstnum}, showstringspaces=false, upquote=true, frame=single, breaklines=true, columns=fullflexible, keepspaces=true,\n' +
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
  if (!HF.empty && m.hfFirst === false && (m.titleStyle === 'article' || m.titleStyle === 'fiche' || m.titleStyle === 'aucun' || m.titleStyle === 'cadre')) D.push('\\thispagestyle{empty}', '');
  if (!HF.empty && m.hfFirst === 'foot' && m.titleStyle !== 'pagegarde') D.push('\\thispagestyle{lhefirst}', '');
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
