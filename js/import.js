/* Conversion de code LaTeX collé (texte + formules) en blocs de l'éditeur :
   paragraphes (gras, italique, formules en ligne), équations, titres, listes, tableaux. */

/* Le texte ressemble-t-il à du LaTeX « document » (et pas à une simple formule) ? */
L.looksLikeLatexDoc = function (s) {
  s = String(s || '');
  return /\\\[|\\\(|\$\$|\\text(bf|it)\{|\\emph\{|\\(sub)*section\*?\{|\\begin\{(itemize|enumerate|equation|align|gather|center|tabular|document)\}|\\item\b|\\par\b/.test(s)
    || /\$[^$\n]+\$/.test(s) && /[a-zA-ZÀ-ÿ]{3,}\s+[a-zA-ZÀ-ÿ]{3,}/.test(s.replace(/\$[^$]*\$/g, ''));
};

/* Lit un groupe {…} équilibré à partir de s[i] === '{' ; renvoie [contenu, index après] */
function readGroup(s, i) {
  if (s[i] !== '{') return ['', i];
  let depth = 0, j = i;
  for (; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (!depth) break; }
  }
  return [s.slice(i + 1, j), j + 1];
}
const skipSpaces = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };
const chip = latex => '<span class="imath" data-latex="' + L.escHtml(latex.trim()) + '"></span>';

/* Texte LaTeX « en ligne » → HTML de l'éditeur */
L.inlineLatexToHtml = function (s) {
  let out = '', i = 0;
  const TEXT_CMDS = { textbf: 'b', emph: 'i', textit: 'i', textsl: 'i', underline: 'u', texttt: 'code', textsuperscript: 'sup', textsubscript: 'sub' };
  const SYMBOLS = { og: '« ', fg: ' »', ldots: '…', dots: '…', textdegree: '°', euro: '€', texteuro: '€', S: '§', LaTeX: 'LaTeX', TeX: 'TeX', quad: ' ', qquad: '  ', newline: '<br>', noindent: '', centering: '', medskip: '', smallskip: '', bigskip: '', par: '<br>' };
  while (i < s.length) {
    const c = s[i];
    if (c === '$') {
      const j = s.indexOf('$', i + 1);
      if (j > i) { out += chip(s.slice(i + 1, j)); i = j + 1; continue; }
    }
    if (c === '\\') {
      const nx = s[i + 1];
      if (nx === '(') { const j = s.indexOf('\\)', i + 2); if (j > 0) { out += chip(s.slice(i + 2, j)); i = j + 2; continue; } }
      if (nx === '\\') { out += '<br>'; i += 2; if (s[i] === '[') { const k = s.indexOf(']', i); if (k > 0) i = k + 1; } continue; }
      if (nx && /[%&_#${}]/.test(nx)) { out += L.escHtml(nx); i += 2; continue; }
      if (nx === ',' || nx === ';' || nx === ':' || nx === ' ') { out += nx === ',' ? '\u202f' : ' '; i += 2; continue; }
      const m = /^[a-zA-Z]+\*?/.exec(s.slice(i + 1));
      if (!m) { i++; continue; }
      const name = m[0].replace('*', '');
      i += 1 + m[0].length;
      if (TEXT_CMDS[name]) {
        const k = skipSpaces(s, i);
        const [arg, j] = readGroup(s, k);
        const t = TEXT_CMDS[name];
        out += '<' + t + '>' + L.inlineLatexToHtml(arg) + '</' + t + '>';
        i = j; continue;
      }
      if (name === 'textcolor' || name === 'color') {
        const [col, j1] = readGroup(s, skipSpaces(s, i));
        const map = { red: 'rouge', blue: 'bleu', green: 'vert', orange: 'orange', violet: 'violet', purple: 'violet', gray: 'gris' };
        if (name === 'color') { i = j1; continue; }
        const [arg, j2] = readGroup(s, skipSpaces(s, j1));
        const k = map[col.trim()];
        out += k ? '<span class="c-' + k + '">' + L.inlineLatexToHtml(arg) + '</span>' : L.inlineLatexToHtml(arg);
        i = j2; continue;
      }
      if (name === 'footnote') {
        const [arg, j] = readGroup(s, skipSpaces(s, i));
        const nh = L.inlineLatexToHtml(arg).trim();
        out += '<span class="fn" data-text="' + L.escHtml(L.plain(nh)) + '" data-html="' + L.escHtml(nh) + '"></span>';
        i = j; continue;
      }
      if (name === 'ce') { const [arg, j] = readGroup(s, skipSpaces(s, i)); out += chip('\\ce{' + arg + '}'); i = j; continue; }
      if (name === 'label' || name === 'vspace' || name === 'hspace' || name === 'ref' || name === 'cite') {
        const [, j] = readGroup(s, skipSpaces(s, i)); i = j; continue;
      }
      if (name in SYMBOLS) { out += SYMBOLS[name]; if (s[i] === '{' && s[i + 1] === '}') i += 2; continue; }
      // Commande inconnue : on garde le contenu de son argument
      if (s[i] === '{') { const [arg, j] = readGroup(s, i); out += L.inlineLatexToHtml(arg); i = j; }
      continue;
    }
    if (c === '{' ) { const [arg, j] = readGroup(s, i); out += L.inlineLatexToHtml(arg); i = j; continue; }
    if (c === '}') { i++; continue; }
    if (c === '~') { out += ' '; i++; continue; }
    if (c === '-' && s.startsWith('---', i)) { out += '—'; i += 3; continue; }
    if (c === '-' && s.startsWith('--', i)) { out += '–'; i += 2; continue; }
    if (c === '`' && s[i + 1] === '`') { out += '“'; i += 2; continue; }
    if (c === "'" && s[i + 1] === "'") { out += '”'; i += 2; continue; }
    out += L.escHtml(c);
    i++;
  }
  return out.replace(/\s+/g, ' ');
};

function textToParagraphs(t, blocks) {
  t.split(/\n\s*\n|\\par\b/).forEach(p => {
    const html = L.inlineLatexToHtml(p).replace(/^\s+|\s+$/g, '').replace(/^(<br>\s*)+|(\s*<br>)+$/g, '');
    if (!L.isEmptyHtml(html)) blocks.push(L.newBlock('paragraph', { html }));
  });
}

function parseList(body, env, opts) {
  const style = env === 'enumerate' ? (/\\alph|a\)/.test(opts || '') ? 'alpha' : /\\roman|i\)/.test(opts || '') ? 'roman' : 'number') : 'bullet';
  const items = [];
  const re = /\\item\b(?:\[[^\]]*\])?|\\begin\{(?:itemize|enumerate)\}(?:\[[^\]]*\])?|\\end\{(?:itemize|enumerate)\}/g;
  let level = 0, last = 0, cur = null, m;
  const flush = end => { if (cur) cur.html += body.slice(last, end); };
  while ((m = re.exec(body))) {
    flush(m.index);
    if (m[0].startsWith('\\item')) { cur = { html: '', level: Math.min(level, 2) }; items.push(cur); }
    else if (m[0].startsWith('\\begin')) level++;
    else level = Math.max(0, level - 1);
    last = re.lastIndex;
  }
  flush(body.length);
  items.forEach(it => { it.html = L.inlineLatexToHtml(it.html).trim(); });
  return L.newBlock('list', { style, items: items.length ? items : [{ html: '', level: 0 }] });
}

function parseTabular(spec, body) {
  const rows = body.replace(/\\(hline|toprule|midrule|bottomrule|cline\{[^}]*\})/g, '')
    .split(/\\\\/).map(r => r.trim()).filter(Boolean)
    .map(r => r.split(/(?<!\\)&/).map(c => L.inlineLatexToHtml(c.trim()).trim()));
  const cols = Math.max(1, ...rows.map(r => r.length));
  const align = (spec.replace(/[|\s]|@\{[^}]*\}|p\{[^}]*\}/g, m => m.startsWith('p') ? 'l' : '').match(/[lcr]/g) || []).slice(0, cols);
  while (align.length < cols) align.push('c');
  return L.newBlock('table', { head: false, style: /\|/.test(spec) ? 'grille' : 'simple', align, rows: rows.map(r => { while (r.length < cols) r.push(''); return r; }), caption: '', capMode: 'none' });
}

/* Code LaTeX → liste de blocs */
L.latexToBlocks = function (src) {
  let s = String(src || '').replace(/\r/g, '');
  const doc = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(s);
  if (doc) s = doc[1];
  s = s.replace(/(^|[^\\])%.*$/gm, '$1').replace(/\\(maketitle|tableofcontents)\b/g, '');
  const blocks = [];
  const re = new RegExp([
    '\\\\\\[([\\s\\S]*?)\\\\\\]',                                                   // 1 \[ … \]
    '\\$\\$([\\s\\S]*?)\\$\\$',                                                      // 2 $$ … $$
    '\\\\begin\\{(equation\\*?|align\\*?|gather\\*?|multline\\*?|eqnarray\\*?)\\}([\\s\\S]*?)\\\\end\\{\\3\\}', // 3,4
    '\\\\(section|subsection|subsubsection|paragraph)(\\*?)\\s*\\{',                // 5,6 titres
    '\\\\begin\\{(itemize|enumerate)\\}(\\[[^\\]]*\\])?',                            // 7,8 listes
    '\\\\begin\\{(tabular)\\}\\s*\\{',                                               // 9 tableau
    '\\\\(newpage|clearpage)\\b',                                                    // 10
    '\\\\begin\\{(center|table|figure|flushleft|flushright|document)\\}(\\[[^\\]]*\\])?|\\\\end\\{(center|table|figure|flushleft|flushright|document)\\}', // 11-13
  ].join('|'), 'g');
  let last = 0, m;
  while ((m = re.exec(s))) {
    textToParagraphs(s.slice(last, m.index), blocks);
    last = re.lastIndex;
    if (m[1] !== undefined || m[2] !== undefined) {
      blocks.push(L.newBlock('equation', { latex: (m[1] ?? m[2]).replace(/\\label\{[^}]*\}/g, '').trim(), numbered: false }));
    } else if (m[3]) {
      const env = m[3].replace('*', '');
      let body = m[4].replace(/\\label\{[^}]*\}/g, '').replace(/\\(nonumber|notag)\b/g, '').trim();
      if (env === 'gather') body = '\\begin{gathered}' + body + '\\end{gathered}';
      else if (env === 'multline') body = body.replace(/\\\\/g, ' ');
      else if (env === 'eqnarray') body = body.replace(/&([=<>])&/g, '&$1');
      blocks.push(L.newBlock('equation', { latex: body, numbered: !m[3].endsWith('*') }));
    } else if (m[5]) {
      const [title, j] = readGroup(s, re.lastIndex - 1);
      last = re.lastIndex = j;
      const lv = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4 }[m[5]];
      blocks.push(L.newBlock('heading', { level: lv, html: L.inlineLatexToHtml(title).trim(), numbered: !m[6] }));
    } else if (m[7]) {
      // fin de liste équilibrée (listes imbriquées)
      const tag = /\\(begin|end)\{(itemize|enumerate)\}/g;
      tag.lastIndex = re.lastIndex;
      let depth = 1, t, end = s.length, after = s.length;
      while ((t = tag.exec(s))) { depth += t[1] === 'begin' ? 1 : -1; if (!depth) { end = t.index; after = tag.lastIndex; break; } }
      blocks.push(parseList(s.slice(re.lastIndex, end), m[7], m[8]));
      last = re.lastIndex = after;
    } else if (m[9]) {
      const [spec, j] = readGroup(s, re.lastIndex - 1);
      const endIdx = s.indexOf('\\end{tabular}', j);
      const e = endIdx < 0 ? s.length : endIdx;
      blocks.push(parseTabular(spec, s.slice(j, e)));
      last = re.lastIndex = endIdx < 0 ? s.length : e + '\\end{tabular}'.length;
    } else if (m[10]) {
      blocks.push(L.newBlock('pagebreak'));
    }
    // environnements d'habillage (center, table…) : on garde simplement leur contenu
  }
  textToParagraphs(s.slice(last), blocks);
  // « à : » suivi d'une équation : pas de retrait pour le paragraphe qui suit une équation (comme LaTeX)
  blocks.forEach((b, k) => { if (b.type === 'paragraph' && k > 0 && blocks[k - 1].type === 'equation') b.noindent = true; });
  return blocks;
};

/* ---------- Boîte « Importer du code LaTeX » ---------- */
L.dlgImportLatex = function () {
  const ta = L.h('textarea', { rows: 14, spellcheck: 'false', placeholder: 'Collez ici du code LaTeX : texte, $formules$, \\[ équations \\], \\section{…}, listes, tableaux…', style: { width: '100%', font: '12.5px Consolas, monospace', padding: '10px', border: '1px solid var(--line2)', borderRadius: '8px' } });
  const info = L.h('div', { class: 'pp-help', style: { marginTop: '6px' } });
  ta.oninput = () => {
    const b = L.latexToBlocks(ta.value);
    const n = t => b.filter(x => x.type === t).length;
    info.textContent = b.length ? b.length + ' élément(s) : ' + n('paragraph') + ' paragraphe(s), ' + n('equation') + ' équation(s), ' + n('heading') + ' titre(s), ' + n('list') + ' liste(s), ' + n('table') + ' tableau(x).' : '';
  };
  L.modal({
    title: 'Importer du code LaTeX', wide: true,
    body: L.h('div', null, L.h('p', { class: 'pp-help', text: 'Le code est converti en éléments modifiables : paragraphes (gras, italique, formules dans le texte), équations centrées, titres, listes et tableaux.' }), ta, info),
    foot: [{ text: 'Annuler', onClick: c => c() }, { text: 'Insérer', cls: 'primary', onClick: c => { c(); App.insertLatex(ta.value); } }],
  });
};
