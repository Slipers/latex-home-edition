/* Partage par lien : le document entier (texte, formules, images) est
   compressé dans le lien lui-même — aucun serveur, rien n'est stocké en
   ligne. Celui qui reçoit le lien l'ouvre dans l'application (bouton
   « Partager » → « Ouvrir un lien reçu », collage direct, ou clic sur le lien
   quand l'application est installée) et obtient sa propre copie. */
(function () {
  const PREFIX = 'lhe://partage/1/';
  // lhe://partage/<version>/<longueur>/<données> : la longueur dit où le lien
  // s'arrête (les messageries le coupent parfois en plusieurs lignes, et du
  // texte peut le suivre) et permet de repérer un lien tronqué.
  const LINK_RE = /lhe:\/\/partage\/(\d+)\/(\d+)\/([A-Za-z0-9_\-\s]+)/i;
  const CUT = 'Ce lien est incomplet ou abîmé (il a peut-être été coupé en le copiant). Demandez à l\'expéditeur de vous le renvoyer.';

  /* ---------- Encodage : JSON → deflate → base64url ---------- */
  const toB64url = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64url = str => {
    const b = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  };
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

  async function encode(data) {
    const z = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate-raw'));
    const payload = toB64url(z);
    return PREFIX + payload.length + '/' + payload;
  }
  async function decode(text) {
    const m = String(text || '').match(LINK_RE);
    if (!m) throw new Error('Aucun lien de partage LaTeX Home Edition trouvé dans ce texte.');
    if (m[1] !== '1') throw new Error('Ce lien a été créé par une version plus récente de LaTeX Home Edition : mettez l\'application à jour pour l\'ouvrir.');
    const len = +m[2], data = m[3].replace(/\s+/g, '').slice(0, len);
    if (data.length < len) throw new Error(CUT);
    let json;
    try { json = new TextDecoder().decode(await pipe(fromB64url(data), new DecompressionStream('deflate-raw'))); }
    catch (e) { throw new Error(CUT); }
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.blocks) || !d.meta) throw new Error('Ce lien ne contient pas de document valide.');
    return L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} });
  }

  /* ---------- Images allégées (lien plus court) ---------- */
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function lighten(src) {
    try {
      const img = await loadImg(src);
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      // Transparence ? on garde du PNG ; sinon JPEG (pdfLaTeX lit les deux)
      const px = g.getImageData(0, 0, c.width, c.height).data;
      let alpha = false;
      for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { alpha = true; break; }
      let out;
      if (alpha) out = c.toDataURL('image/png');
      else {
        const w = document.createElement('canvas'); w.width = c.width; w.height = c.height;
        const wg = w.getContext('2d'); wg.fillStyle = '#fff'; wg.fillRect(0, 0, w.width, w.height); wg.drawImage(c, 0, 0);
        out = w.toDataURL('image/jpeg', 0.82);
      }
      return out.length < src.length ? out : src;
    } catch (e) { return src; }
  }

  async function buildLink(light) {
    App.commit();
    const data = JSON.parse(App.serialize());
    if (light) for (const k of Object.keys(data.assets)) data.assets[k] = await lighten(data.assets[k]);
    return encode(data);
  }

  const fmtLen = n => n < 1000 ? n + ' caractères' : (Math.round(n / 100) / 10).toLocaleString('fr-FR') + ' k caractères';
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); L.toast(msg); }
    catch (e) { L.toast('Copie impossible : sélectionnez le texte et faites Ctrl+C.', 'err'); }
  };
  const docTitle = doc => L.plain(doc.meta.title) || 'Sans titre';

  /* ---------- Envoyer : créer le lien ---------- */
  L.dlgShare = function () {
    const nImg = Object.keys(JSON.parse(App.serialize()).assets).length;
    const title = docTitle(App.doc);
    const out = L.h('textarea', { class: 'shr-link', readonly: true, rows: 4, spellcheck: 'false' });
    out.onfocus = () => out.select();
    const size = L.h('div', { class: 'shr-size' });
    const warn = L.h('div', { class: 'note', hidden: true });
    const light = L.h('input', { type: 'checkbox' });
    light.checked = nImg > 0;
    let link = '';
    const msg = () => 'Je te partage mon document « ' + title + ' ».\n\n'
      + 'Pour l\'ouvrir : dans LaTeX Home Edition, clique sur « Partager » puis « Ouvrir un lien reçu » et colle ce lien (ou colle-le directement dans l\'application) — tu obtiendras ta propre copie.\n\n'
      + link + '\n\n'
      + 'Pas encore l\'application ? Elle est gratuite (Windows et Mac) : https://github.com/Slipers/latex-home-edition/releases/latest\n';
    const mailBtn = L.h('button', { class: 'btn', text: '✉ Envoyer par e-mail…' });
    const refresh = async () => {
      out.value = 'Création du lien…'; size.textContent = '';
      try { link = await buildLink(light.checked); }
      catch (e) { out.value = ''; warn.hidden = false; warn.textContent = 'Impossible de créer le lien : ' + e.message; return; }
      out.value = link;
      size.textContent = 'Lien de ' + fmtLen(link.length) + (nImg ? ' · ' + nImg + ' image' + (nImg > 1 ? 's' : '') + ' incluse' + (nImg > 1 ? 's' : '') : '');
      warn.hidden = link.length < 60000;
      warn.textContent = 'Ce lien est très long' + (nImg && !light.checked ? ' (images en pleine qualité)' : '') + ' : certaines messageries risquent de le couper. Préférez l\'e-mail ou « Copier le message », ou envoyez plutôt le fichier .lhe (Enregistrer).';
      // Les liens mailto longs sont tronqués par Windows : au-delà, on passe par le presse-papiers
      mailBtn.title = link.length > 1500 ? 'Ouvre votre messagerie ; le message complet (avec le lien) est copié : collez-le dans le corps du mail.' : '';
    };
    light.onchange = refresh;
    mailBtn.onclick = async () => {
      if (!link) return;
      const subject = 'Document partagé : ' + title;
      if (link.length <= 1500) { window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg())); return; }
      await copy(msg(), 'Message copié : collez-le dans le corps de l\'e-mail (Ctrl+V)');
      window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent('(Collez ici le message copié : Ctrl+V)'));
    };
    const body = L.h('div', { class: 'shr' },
      L.h('p', { class: 'shr-intro', html: 'Toute personne qui reçoit ce lien peut <b>importer sa propre copie</b> de « ' + L.escHtml(title) + ' » dans LaTeX Home Edition, sans que vous ayez à envoyer le fichier. Le document est entièrement contenu dans le lien : rien n\'est envoyé sur internet.' }),
      out, size,
      L.h('div', { class: 'shr-acts' },
        L.h('button', { class: 'btn primary', text: '⧉ Copier le lien', onclick: () => link && copy(link, 'Lien copié') }),
        L.h('button', { class: 'btn', text: 'Copier le message (avec explications)', onclick: () => link && copy(msg(), 'Message copié') }),
        mailBtn),
      nImg ? L.h('label', { class: 'chk shr-light' }, light, 'Alléger les images (lien plus court, qualité suffisante pour l\'écran et l\'impression)') : null,
      warn,
      L.h('p', { class: 'shr-foot', text: 'Le destinataire reçoit une copie figée : vos modifications ultérieures ne lui parviennent pas. Pour lui envoyer une nouvelle version, créez un nouveau lien.' }));
    L.modal({ title: 'Partager une copie par lien', body, wide: true });
    refresh();
  };

  /* ---------- Recevoir : importer une copie ---------- */
  L.dlgOpenShare = function (initial) {
    const inp = L.h('textarea', { class: 'shr-link', rows: 4, spellcheck: 'false', placeholder: 'Collez ici le lien reçu (il commence par lhe://partage/…)' });
    const card = L.h('div', { class: 'shr-card', hidden: true });
    const err = L.h('div', { class: 'note', hidden: true });
    let doc = null, dlg = null;
    const importBtn = L.h('button', { class: 'btn primary', text: 'Importer une copie', disabled: true });
    const check = async () => {
      doc = null; importBtn.disabled = true; card.hidden = true; err.hidden = true;
      const v = inp.value.trim();
      if (!v) return;
      try { doc = await decode(v); }
      catch (e) { err.hidden = false; err.textContent = e.message; return; }
      if (inp.value.trim() !== v) return; // texte modifié entre-temps
      let blocks = 0, eqs = 0;
      L.walk(doc.blocks, b => { blocks++; if (b.type === 'equation') eqs++; });
      eqs += (JSON.stringify(doc.blocks).match(/class=\\"imath\\"/g) || []).length;
      const nImg = Object.keys(doc.assets).length;
      const m = doc.meta;
      const prev = L.h('div', { class: 'shr-prev' });
      try { prev.appendChild(L.renderDoc(doc, 'view')); } catch (e) { /* aperçu facultatif */ }
      card.replaceChildren(
        L.h('div', { class: 'shr-info' },
          L.h('b', { text: docTitle(doc) }),
          L.plain(m.author) ? L.h('span', { text: 'par ' + L.plain(m.author) }) : null,
          L.h('span', { class: 'shr-stats', text: blocks + ' élément' + (blocks > 1 ? 's' : '') + ' · ' + eqs + ' formule' + (eqs > 1 ? 's' : '') + (nImg ? ' · ' + nImg + ' image' + (nImg > 1 ? 's' : '') : '') }),
          L.h('span', { class: 'shr-hint', text: 'Une copie indépendante sera ouverte : enregistrez-la pour la garder.' })),
        prev);
      card.hidden = false;
      importBtn.disabled = false;
    };
    inp.oninput = L.debounce(check, 200);
    importBtn.onclick = () => {
      if (!doc) return;
      if (App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Ouvrir la copie quand même ?')) return;
      dlg.close();
      App.fileHandle = null; App.filePath = null;
      App.load(doc, null);
      App.fileName = null;
      App.setDirty(true);
      App.updateName();
      L.toast('Copie importée : enregistrez-la (Ctrl+S) pour la garder');
    };
    const body = L.h('div', { class: 'shr' },
      L.h('p', { class: 'shr-intro', text: 'Collez le lien de partage qu\'on vous a envoyé : vous obtiendrez votre propre copie du document, modifiable librement.' }),
      inp, err, card,
      L.h('div', { class: 'shr-acts' }, importBtn));
    dlg = L.modal({ title: 'Ouvrir un lien de partage', body, wide: true });
    if (initial) { inp.value = initial; check(); }
  };

  L.Share = { encode, decode, LINK_RE, isLink: t => LINK_RE.test(String(t || '')) };
})();

/* ---------- Nettoyage d'un document venu d'ailleurs ----------
   Un lien ou un fichier .lhe reçu peut avoir été fabriqué à la main : le texte
   enrichi est inséré tel quel dans la page (innerHTML), il ne doit donc
   contenir que ce que l'éditeur produit lui-même — pas de script, de lien,
   d'attribut d'événement ni d'image distante. */
(function () {
  const TAGS = new Set(['B', 'I', 'U', 'SUB', 'SUP', 'CODE', 'SPAN', 'BR', 'DIV', 'P', 'STRONG', 'EM']);
  const ATTRS = new Set(['class', 'data-latex', 'data-ref', 'data-text', 'data-html', 'data-src', 'data-w']);
  const PLAIN = new Set(['code', 'latex']);   // texte brut (programme, LaTeX), jamais inséré comme HTML
  const IMG = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]*$/i;
  const parser = new DOMParser();

  function cleanHtml(s) {
    if (typeof s !== 'string' || s.indexOf('<') < 0) return s;
    const body = parser.parseFromString('<body>' + s, 'text/html').body;
    let bad = false;
    body.querySelectorAll('*').forEach(el => {
      if (!TAGS.has(el.tagName)) bad = true;
      for (const a of Array.from(el.attributes)) {
        if (!ATTRS.has(a.name)) bad = true;
        else if (a.name === 'data-html') { const c = cleanHtml(a.value); if (c !== a.value) { el.setAttribute('data-html', c); bad = true; } }
      }
    });
    return bad ? L.sanitizeNode(body) : s;
  }
  function walk(v, key) {
    if (typeof v === 'string') return PLAIN.has(key) ? v : cleanHtml(v);
    if (Array.isArray(v)) return v.map(x => walk(x, key));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) if (k !== '__proto__') o[k] = walk(v[k], k); return o; }
    return v;
  }
  L.sanitizeDoc = function (doc) {
    const assets = {};
    Object.keys(doc.assets || {}).forEach(k => { const v = doc.assets[k]; if (typeof v === 'string' && IMG.test(v)) assets[k] = v; });
    return {
      meta: walk(doc.meta || {}, 'meta'),
      blocks: walk(doc.blocks || [], 'blocks'),
      bib: Array.isArray(doc.bib) ? doc.bib : [],   // bibliographie : toujours échappée à l'affichage
      assets,
    };
  };
})();
