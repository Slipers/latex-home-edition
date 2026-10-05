/* Coloration du code selon le langage (highlight.js, vendor/highlight) :
   dans l'éditeur (pendant la frappe), dans l'aperçu et le PDF. L'export LaTeX
   utilise de son côté le paquet listings avec les mêmes couleurs (latex.js). */
(function () {
  // [identifiant du document, nom affiché, langage highlight.js, langage listings]
  L.CODE_LANGS = [
    ['python', 'Python', 'python', 'Python'],
    ['ocaml', 'OCaml', 'ocaml', '[Objective]Caml'],
    ['c', 'C', 'c', 'C'],
    ['cpp', 'C++', 'cpp', 'C++'],
    ['java', 'Java', 'java', 'Java'],
    ['javascript', 'JavaScript', 'javascript', 'JavaScript'],
    ['typescript', 'TypeScript', 'typescript', 'JavaScript'],
    ['php', 'PHP', 'php', 'PHP'],
    ['csharp', 'C#', 'csharp', '[Sharp]C'],
    ['rust', 'Rust', 'rust', 'Rust'],
    ['go', 'Go', 'go', 'Go'],
    ['matlab', 'Matlab / Octave', 'matlab', 'Matlab'],
    ['r', 'R', 'r', 'R'],
    ['sql', 'SQL', 'sql', 'SQL'],
    ['html', 'HTML', 'xml', 'HTML'],
    ['css', 'CSS', 'css', 'CSS'],
    ['json', 'JSON', 'json', 'JSON'],
    ['latex', 'LaTeX', 'latex', '[LaTeX]TeX'],
    ['bash', 'Terminal (bash)', 'bash', 'bash'],
    ['texte', 'Texte brut', null, ''],
  ];
  const BY_ID = {};
  L.CODE_LANGS.forEach(l => { BY_ID[l[0]] = l; });
  L.codeLang = id => BY_ID[id] || BY_ID.texte;

  /* Code → HTML coloré (texte échappé, balises <span class="hljs-…">) */
  L.highlightCode = function (code, lang) {
    code = String(code || '');
    const hl = L.codeLang(lang)[2];
    if (hl && window.hljs && hljs.getLanguage(hl)) {
      try { return hljs.highlight(code, { language: hl, ignoreIllegals: true }).value; } catch (e) { /* texte brut */ }
    }
    return L.escHtml(code);
  };

  /* Même chose, ligne par ligne : une couleur qui court sur plusieurs lignes (commentaire,
     chaîne) est refermée en fin de ligne et rouverte au début de la suivante — chaque
     ligne est ainsi un morceau autonome (numéros de ligne, coupure entre deux pages). */
  L.highlightLines = function (code, lang) {
    const html = L.highlightCode(code, lang);
    const lines = [], open = [];
    let cur = '';
    const re = /(<span[^>]*>)|(<\/span>)|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
      if (m[1]) { open.push(m[1]); cur += m[1]; }
      else if (m[2]) { open.pop(); cur += m[2]; }
      else {
        m[3].split('\n').forEach((part, i) => {
          if (i > 0) { cur += '</span>'.repeat(open.length); lines.push(cur); cur = open.join(''); }
          cur += part;
        });
      }
    }
    lines.push(cur);
    return lines;
  };

  /* Éditeur : le code reste du texte simple, modifiable (champ transparent) ; une copie
     colorée, exactement superposée, est redessinée à chaque modification — frappe,
     collage, modification d'un autre utilisateur en Live, annulation… */
  L.codeOverlay = function (pre, lang) {
    const hl = L.h('pre', { class: 'code-hl', 'aria-hidden': 'true' });
    // innerText, comme l'enregistrement du champ : les retours à la ligne tapés peuvent être
    // des <br> (que textContent ignorerait), pas seulement des « \n »
    const text = () => (pre.isConnected ? pre.innerText : pre.textContent).replace(/\n$/, '');
    const paint = () => { hl.innerHTML = L.highlightCode(text(), lang) + '\n'; };
    paint();
    let raf = 0;
    new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); })
      .observe(pre, { characterData: true, childList: true, subtree: true });
    pre.addEventListener('input', paint);   // tout de suite pendant la frappe (pas de clignotement)
    return L.h('div', { class: 'code-wrap' + (L.codeLang(lang)[2] ? ' colored' : '') }, hl, pre);
  };
})();
