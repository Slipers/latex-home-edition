/* Partage par lien. Deux sortes de liens :
   - lien court (recommandé) : le document compressé est déposé sur le serveur
     de partage (Supabase) et le lien ne contient qu'un identifiant de 10
     caractères — https://slipers.github.io/latex-home-edition/p/#Ab3xK9pQ2z,
     cliquable partout ; la page ouvre l'application (lhe://s/Ab3xK9pQ2z) ;
   - lien long (sans connexion) : le document entier est compressé dans le
     lien lui-même (lhe://partage/…), rien n'est stocké en ligne.
   Celui qui reçoit le lien l'ouvre dans l'application (clic, « Partager » →
   « Ouvrir un lien reçu », ou Ctrl+V n'importe où) et obtient sa propre copie. */
(function () {
  /* Serveur de partage. La clé « publishable » est faite pour être publique :
     la base n'expose que quatre fonctions (créer, lire par identifiant, infos,
     désactiver avec le code du créateur) — voir supabase/partage.sql. */
  const SUPABASE_URL = 'https://temejdqaocdqqoodqjyk.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_MCpfjyXJgTyh64p80I5hiA_xAq30XtY';
  const PAGE_URL = 'https://slipers.github.io/latex-home-edition/p/';

  const PREFIX = 'lhe://partage/1/';
  // lhe://partage/<version>/<longueur>/<données> : la longueur dit où le lien
  // s'arrête (les messageries le coupent parfois en plusieurs lignes, et du
  // texte peut le suivre) et permet de repérer un lien tronqué.
  const LINK_RE = /lhe:\/\/partage\/(\d+)\/(\d+)\/([A-Za-z0-9_\-\s]+)/i;
  // Lien court : page web (…/p/#id), lien de l'application (lhe://s/id)
  const SHORT_RE = /(?:latex-home-edition\/p\/?#|lhe:\/\/s\/)([A-Za-z0-9]{10})(?![A-Za-z0-9])/i;
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

  const pack = async data => toB64url(await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('deflate-raw')));
  async function unpack(payload) {
    let json;
    try { json = new TextDecoder().decode(await pipe(fromB64url(payload), new DecompressionStream('deflate-raw'))); }
    catch (e) { throw new Error(CUT); }
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.blocks) || !d.meta) throw new Error('Ce lien ne contient pas de document valide.');
    return L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} });
  }
  async function encode(data) {
    const payload = await pack(data);
    return PREFIX + payload.length + '/' + payload;
  }

  /* ---------- Serveur de partage ---------- */
  const ERRORS = {
    LHE_RATE: 'Trop de liens créés en peu de temps depuis cette connexion. Réessayez dans une heure.',
    LHE_SIZE: 'Ce document est trop volumineux pour un lien (trop d\'images ?). Cochez « Alléger les images », ou envoyez le fichier .lhe.',
    LHE_FULL: 'Le serveur de partage est plein pour le moment. Utilisez le lien sans connexion, ou envoyez le fichier .lhe.',
    LHE_FORMAT: 'Document illisible par le serveur de partage.',
  };
  async function rpc(fn, body) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 30000);
    let r;
    try {
      r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
        method: 'POST', signal: ctl.signal,
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Impossible de joindre le serveur de partage. Vérifiez votre connexion internet (ou utilisez le lien sans connexion).');
    } finally { clearTimeout(t); }
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (e) { /* réponse non JSON */ }
    if (!r.ok) {
      const code = j && j.message && Object.keys(ERRORS).find(k => j.message.includes(k));
      throw new Error(code ? ERRORS[code] : 'Le serveur de partage ne répond pas correctement (' + r.status + '). Réessayez plus tard, ou utilisez le lien sans connexion.');
    }
    return j;
  }
  const shortUrl = id => PAGE_URL + '#' + id;

  /* Liens courts créés depuis cet ordinateur (pour pouvoir les désactiver) */
  const MINE = 'lhe-mes-partages';
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE) || '[]'); } catch (e) { return []; } };
  const saveMine = list => { try { localStorage.setItem(MINE, JSON.stringify(list.slice(0, 50))); } catch (e) { /* stockage indisponible */ } };

  async function createShort(data, title) {
    const r = await rpc('create_share', { p_payload: await pack(data), p_title: title });
    if (!r || !r.id) throw new Error('Le serveur de partage n\'a pas renvoyé de lien.');
    saveMine([{ id: r.id, token: r.token, title, at: Date.now(), exp: r.expires_at }, ...mine()]);
    return r;
  }
  async function revoke(id) {
    const e = mine().find(x => x.id === id);
    if (e) await rpc('delete_share', { p_id: id, p_token: e.token });
    saveMine(mine().filter(x => x.id !== id));
  }

  /* Texte collé / lien reçu → document (lien court ou lien long) */
  async function decode(text) {
    const s = String(text || '');
    const m = s.match(LINK_RE);
    if (m) {
      if (m[1] !== '1') throw new Error('Ce lien a été créé par une version plus récente de LaTeX Home Edition : mettez l\'application à jour pour l\'ouvrir.');
      const len = +m[2], data = m[3].replace(/\s+/g, '').slice(0, len);
      if (data.length < len) throw new Error(CUT);
      return unpack(data);
    }
    const k = s.match(SHORT_RE);
    if (k) {
      const r = await rpc('get_share', { p_id: k[1] });
      if (!r || !r.payload) throw new Error('Ce lien n\'existe plus : il a expiré ou a été désactivé par la personne qui l\'a créé.');
      return unpack(r.payload);
    }
    throw new Error('Aucun lien de partage LaTeX Home Edition trouvé dans ce texte.');
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

  async function docData(light) {
    App.commit();
    const data = JSON.parse(App.serialize());
    if (light) for (const k of Object.keys(data.assets)) data.assets[k] = await lighten(data.assets[k]);
    return data;
  }

  const fmtLen = n => n < 1000 ? n + ' caractères' : (Math.round(n / 100) / 10).toLocaleString('fr-FR') + ' k caractères';
  const fmtDate = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); L.toast(msg); }
    catch (e) { L.toast('Copie impossible : sélectionnez le texte et faites Ctrl+C.', 'err'); }
  };
  const docTitle = doc => L.plain(doc.meta.title) || 'Sans titre';
  const APP_URL = 'https://github.com/Slipers/latex-home-edition/releases/latest';
  const mailto = (subject, body) => window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));

  /* ---------- Envoyer : créer le lien ---------- */
  L.dlgShare = function () {
    const nImg = Object.keys(JSON.parse(App.serialize()).assets).length;
    const title = docTitle(App.doc);
    const light = L.h('input', { type: 'checkbox' });
    light.checked = nImg > 0;

    /* Lien court */
    const sOut = L.h('input', { class: 'shr-short', type: 'text', readonly: true, spellcheck: 'false' });
    sOut.onfocus = () => sOut.select();
    const sErr = L.h('div', { class: 'note', hidden: true });
    const sMeta = L.h('div', { class: 'shr-size' });
    let sLink = '', sId = '';
    const sMsg = () => 'Je te partage mon document « ' + title + ' » :\n' + sLink + '\n\n'
      + 'Ouvre le lien : il lance LaTeX Home Edition (ou te propose de l\'installer, c\'est gratuit), et tu obtiendras ta propre copie du document.\n';
    const sRes = L.h('div', { class: 'shr-res', hidden: true },
      sOut, sMeta,
      L.h('div', { class: 'shr-acts' },
        L.h('button', { class: 'btn primary', text: '⧉ Copier le lien', onclick: () => copy(sLink, 'Lien copié') }),
        L.h('button', { class: 'btn', text: 'Copier le message', onclick: () => copy(sMsg(), 'Message copié') }),
        L.h('button', { class: 'btn', text: '✉ Envoyer par e-mail…', onclick: () => mailto('Document partagé : ' + title, sMsg()) }),
        L.h('button', { class: 'btn danger-soft', text: 'Désactiver ce lien', onclick: async () => {
          if (!confirm('Désactiver ce lien ? Il ne fonctionnera plus pour personne (les copies déjà importées restent chez leurs destinataires).')) return;
          try { await revoke(sId); L.toast('Lien désactivé'); sRes.hidden = true; sBtn.hidden = false; sBtn.textContent = 'Créer un nouveau lien court'; renderMine(); }
          catch (e) { L.toast(e.message, 'err'); }
        } })));
    const sBtn = L.h('button', { class: 'btn primary', text: '🔗 Créer le lien court' });
    sBtn.onclick = async () => {
      sBtn.disabled = true; sBtn.textContent = 'Envoi du document…'; sErr.hidden = true;
      try {
        const r = await createShort(await docData(light.checked), title);
        sId = r.id; sLink = shortUrl(r.id);
        sOut.value = sLink;
        sMeta.textContent = 'Valable jusqu\'au ' + fmtDate(r.expires_at) + ' · vous pouvez le désactiver à tout moment';
        sRes.hidden = false; sBtn.hidden = true;
        renderMine();
        copy(sLink, 'Lien créé et copié');
      } catch (e) { sErr.hidden = false; sErr.textContent = e.message; sBtn.textContent = 'Réessayer'; }
      sBtn.disabled = false;
    };

    /* Lien long, sans connexion */
    const out = L.h('textarea', { class: 'shr-link', readonly: true, rows: 3, spellcheck: 'false' });
    out.onfocus = () => out.select();
    const size = L.h('div', { class: 'shr-size' });
    const warn = L.h('div', { class: 'note', hidden: true });
    let link = '';
    const msg = () => 'Je te partage mon document « ' + title + ' ».\n\n'
      + 'Pour l\'ouvrir : dans LaTeX Home Edition, clique sur « Partager » puis « Ouvrir un lien reçu » et colle ce lien (ou colle-le directement dans l\'application) — tu obtiendras ta propre copie.\n\n'
      + link + '\n\n'
      + 'Pas encore l\'application ? Elle est gratuite (Windows et Mac) : ' + APP_URL + '\n';
    const refresh = async () => {
      out.value = 'Création du lien…'; size.textContent = '';
      try { link = await encode(await docData(light.checked)); }
      catch (e) { out.value = ''; warn.hidden = false; warn.textContent = 'Impossible de créer le lien : ' + e.message; return; }
      out.value = link;
      size.textContent = 'Lien de ' + fmtLen(link.length) + (nImg ? ' · ' + nImg + ' image' + (nImg > 1 ? 's' : '') + ' incluse' + (nImg > 1 ? 's' : '') : '');
      warn.hidden = link.length < 60000;
      warn.textContent = 'Ce lien est très long : certaines messageries risquent de le couper. Préférez le lien court, ou envoyez le fichier .lhe.';
    };
    const long = L.h('details', { class: 'shr-more' },
      L.h('summary', { text: 'Sans connexion : lien long, rien n\'est stocké en ligne' }),
      L.h('p', { class: 'shr-foot', text: 'Le document entier est compressé dans le lien lui-même. Plus long et pas cliquable, mais aucun serveur n\'est utilisé : le destinataire le colle dans l\'application.' }),
      out, size, warn,
      L.h('div', { class: 'shr-acts' },
        L.h('button', { class: 'btn', text: '⧉ Copier le lien long', onclick: () => link && copy(link, 'Lien copié') }),
        L.h('button', { class: 'btn', text: 'Copier le message', onclick: () => link && copy(msg(), 'Message copié') })));
    long.addEventListener('toggle', () => { if (long.open && !link) refresh(); });
    light.onchange = () => { link = ''; if (long.open) refresh(); if (!sRes.hidden) { sRes.hidden = true; sBtn.hidden = false; sBtn.textContent = 'Créer un nouveau lien court'; } };

    /* Liens déjà créés depuis cet ordinateur */
    const mineBox = L.h('details', { class: 'shr-more' });
    const renderMine = () => {
      const list = mine();
      mineBox.hidden = !list.length;
      mineBox.replaceChildren(L.h('summary', { text: 'Vos liens courts (' + list.length + ')' }),
        L.h('div', { class: 'shr-mine' }, ...list.map(e => L.h('div', { class: 'shr-row' },
          L.h('span', { class: 'shr-row-t' }, L.h('b', { text: e.title || 'Sans titre' }), L.h('em', { text: ' · ' + fmtDate(e.at) })),
          L.h('button', { class: 'btn small', text: 'Copier', onclick: () => copy(shortUrl(e.id), 'Lien copié') }),
          L.h('button', { class: 'btn small', text: 'Désactiver', onclick: async () => {
            if (!confirm('Désactiver le lien de « ' + (e.title || 'Sans titre') + ' » ? Il ne fonctionnera plus pour personne.')) return;
            try { await revoke(e.id); L.toast('Lien désactivé'); renderMine(); } catch (err) { L.toast(err.message, 'err'); }
          } })))));
    };
    renderMine();

    const body = L.h('div', { class: 'shr' },
      L.h('p', { class: 'shr-intro', html: 'Toute personne qui reçoit le lien peut <b>importer sa propre copie</b> de « ' + L.escHtml(title) + ' » dans LaTeX Home Edition, sans que vous ayez à envoyer le fichier.' }),
      L.h('div', { class: 'shr-box' },
        L.h('div', { class: 'shr-h', text: 'Lien court' }),
        L.h('p', { class: 'shr-foot', text: 'Le document est déposé sur le serveur de partage (en Europe) pendant un an. Seules les personnes qui ont le lien peuvent l\'ouvrir, et vous pouvez le désactiver à tout moment.' }),
        sBtn, sErr, sRes),
      nImg ? L.h('label', { class: 'chk shr-light' }, light, 'Alléger les images (' + nImg + ') : envoi plus rapide, qualité suffisante pour l\'écran et l\'impression') : null,
      long, mineBox,
      L.h('p', { class: 'shr-foot', text: 'Le destinataire reçoit une copie figée : vos modifications ultérieures ne lui parviennent pas. Pour lui envoyer une nouvelle version, créez un nouveau lien.' }));
    L.modal({ title: 'Partager une copie par lien', body, wide: true });
  };

  /* ---------- Recevoir : importer une copie ---------- */
  L.dlgOpenShare = function (initial) {
    const inp = L.h('textarea', { class: 'shr-link', rows: 3, spellcheck: 'false', placeholder: 'Collez ici le lien reçu (https://slipers.github.io/latex-home-edition/p/#… ou lhe://…)' });
    const card = L.h('div', { class: 'shr-card', hidden: true });
    const err = L.h('div', { class: 'note', hidden: true });
    const wait = L.h('div', { class: 'shr-size', hidden: true, text: 'Récupération du document…' });
    let doc = null, dlg = null, seq = 0;
    const importBtn = L.h('button', { class: 'btn primary', text: 'Importer une copie', disabled: true });
    const check = async () => {
      const my = ++seq;
      doc = null; importBtn.disabled = true; card.hidden = true; err.hidden = true;
      const v = inp.value.trim();
      if (!v) return;
      wait.hidden = false;
      let d;
      try { d = await decode(v); }
      catch (e) { if (my === seq) { wait.hidden = true; err.hidden = false; err.textContent = e.message; } return; }
      if (my !== seq) return; // texte modifié entre-temps
      wait.hidden = true;
      doc = d;
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
    inp.oninput = L.debounce(check, 250);
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
      inp, wait, err, card,
      L.h('div', { class: 'shr-acts' }, importBtn));
    dlg = L.modal({ title: 'Ouvrir un lien de partage', body, wide: true });
    if (initial) { inp.value = initial; check(); }
  };

  L.Share = { encode, decode, pack, unpack, rpc, shortUrl, LINK_RE, SHORT_RE, isLink: t => LINK_RE.test(String(t || '')) || SHORT_RE.test(String(t || '')) };
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
