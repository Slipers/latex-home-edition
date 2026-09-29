/* Partage par lien.
   - Lien court (recommandé) : le document compressé est déposé sur le serveur
     de partage (Supabase) et le lien ne contient qu'un identifiant de 10
     caractères — https://slipers.github.io/latex-home-edition/p/#Ab3xK9pQ2z,
     cliquable partout ; la page ouvre l'application (lhe://s/Ab3xK9pQ2z).
     Un seul lien par document (meta.share) : l'auteur y envoie les nouvelles
     versions, en direct ou quand il le décide (voir js/live.js), et ceux qui
     ont importé une copie (meta.sharedFrom) se voient proposer la mise à jour.
   - Lien long (sans connexion) : le document entier est compressé dans le
     lien lui-même (lhe://partage/…), rien n'est stocké en ligne. */
(function () {
  /* Serveur de partage. La clé « publishable » est faite pour être publique :
     la base n'expose que quelques fonctions (créer, lire par identifiant,
     infos, mettre à jour / désactiver avec le code de l'auteur) — voir
     supabase/partage.sql. */
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
    const doc = L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} });
    delete doc.meta.share; delete doc.meta.sharedFrom;   // liens propres à l'auteur, jamais transmis
    return doc;
  }
  async function encode(data) {
    const payload = await pack(data);
    return PREFIX + payload.length + '/' + payload;
  }

  /* ---------- Serveur de partage ---------- */
  const ERRORS = {
    LHE_RATE: 'Trop d\'envois en peu de temps depuis cette connexion. Réessayez un peu plus tard.',
    LHE_SIZE: 'Ce document est trop volumineux pour un lien (trop d\'images ?). Cochez « Alléger les images », ou envoyez le fichier .lhe.',
    LHE_FULL: 'Le serveur de partage est plein pour le moment. Utilisez le lien sans connexion, ou envoyez le fichier .lhe.',
    LHE_FORMAT: 'Document illisible par le serveur de partage.',
    LHE_NOTFOUND: 'Ce lien n\'existe plus (désactivé ou expiré).',
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
      const err = new Error('Impossible de joindre le serveur de partage. Vérifiez votre connexion internet (ou utilisez le lien sans connexion).');
      err.offline = true;
      throw err;
    } finally { clearTimeout(t); }
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (e) { /* réponse non JSON */ }
    if (!r.ok) {
      const code = j && j.message && Object.keys(ERRORS).find(k => j.message.includes(k));
      const err = new Error(code ? ERRORS[code] : 'Le serveur de partage ne répond pas correctement (' + r.status + '). Réessayez plus tard, ou utilisez le lien sans connexion.');
      err.code = code || 'HTTP_' + r.status;
      throw err;
    }
    return j;
  }
  const shortUrl = id => PAGE_URL + '#' + id;

  /* Liens créés depuis cet ordinateur : le code de l'auteur (token) ne quitte
     jamais cet ordinateur — il n'est pas enregistré dans le fichier .lhe, qui
     peut être envoyé à d'autres. */
  const MINE = 'lhe-mes-partages';
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE) || '[]'); } catch (e) { return []; } };
  const saveMine = list => { try { localStorage.setItem(MINE, JSON.stringify(list.slice(0, 100))); } catch (e) { /* stockage indisponible */ } };
  const entryOf = id => mine().find(x => x.id === id) || null;
  const setEntry = (id, patch) => saveMine(mine().map(x => x.id === id ? Object.assign(x, patch) : x));

  /* Données envoyées : le document sans ses liens de partage */
  const imgCache = new Map();
  async function docData(light) {
    App.commit();
    const data = JSON.parse(App.serialize());
    delete data.meta.share; delete data.meta.sharedFrom;
    if (light) for (const k of Object.keys(data.assets)) {
      const src = data.assets[k], key = src.length + ':' + src.slice(-64);
      if (!imgCache.has(key)) imgCache.set(key, await lighten(src));
      data.assets[k] = imgCache.get(key);
    }
    return data;
  }

  async function createShort(live, light) {
    const title = docTitle(App.doc);
    const data = await docData(light);
    const r = await rpc('create_share', { p_payload: await pack(data), p_title: title, p_live: live });
    if (!r || !r.id) throw new Error('Le serveur de partage n\'a pas renvoyé de lien.');
    saveMine([{ id: r.id, token: r.token, title, at: Date.now(), exp: r.expires_at, v: r.version || 1, sentAt: r.updated_at, hash: L.Live.hash(App.doc) }, ...mine()]);
    App.doc.meta.share = { id: r.id, live: !!live, light: !!light };
    App.commit();
    return r;
  }
  async function revoke(id) {
    const e = entryOf(id);
    if (e) {
      try { await rpc('delete_share', { p_id: id, p_token: e.token }); }
      catch (err) { if (err.code !== 'LHE_NOTFOUND') throw err; }
    }
    saveMine(mine().filter(x => x.id !== id));
    if (App.doc.meta.share && App.doc.meta.share.id === id) { delete App.doc.meta.share; App.commit(); }
    if (L.Live) L.Live.docLoaded();
  }

  /* Texte collé / lien reçu → document (lien court ou lien long).
     Lien court : le document retient d'où il vient (meta.sharedFrom), pour
     proposer ensuite les nouvelles versions de l'auteur. */
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
      const doc = await unpack(r.payload);
      doc.meta.sharedFrom = { id: k[1], v: r.version || 1, at: r.updated_at || r.created_at, live: !!r.live };
      return doc;
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

  const fmtLen = n => n < 1000 ? n + ' caractères' : (Math.round(n / 100) / 10).toLocaleString('fr-FR') + ' k caractères';
  const fmtDate = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ago = t => {
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    return 'le ' + fmtDate(t);
  };
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); L.toast(msg); }
    catch (e) { L.toast('Copie impossible : sélectionnez le texte et faites Ctrl+C.', 'err'); }
  };
  const docTitle = doc => L.plain(doc.meta.title) || 'Sans titre';
  const APP_URL = 'https://github.com/Slipers/latex-home-edition/releases/latest';
  const mailto = (subject, body) => window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));

  /* ---------- Envoyer : le lien unique du document ---------- */
  L.dlgShare = function () {
    const nImg = Object.keys(JSON.parse(App.serialize()).assets).length;
    let dlg = null;
    const body = L.h('div', { class: 'shr' });

    const modeChoice = (live, onChange) => {
      const opt = (val, t, d) => {
        const i = L.h('input', { type: 'radio', name: 'shr-mode', value: val ? '1' : '0' });
        i.checked = live === val;
        i.onchange = () => onChange(val);
        return L.h('label', { class: 'shr-mode' + (live === val ? ' on' : '') }, i, L.h('span', null, L.h('b', { text: t }), L.h('em', { text: d })));
      };
      const box = L.h('div', { class: 'shr-modes' },
        opt(true, 'Mises à jour en direct', 'Chaque modification est envoyée automatiquement : ceux qui ont importé le document se voient proposer la nouvelle version.'),
        opt(false, 'Version figée', 'Le lien donne la version actuelle. Vous envoyez une nouvelle version seulement quand vous le décidez.'));
      box.addEventListener('change', () => box.querySelectorAll('.shr-mode').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)));
      return box;
    };
    const lightBox = sh => {
      if (!nImg) return null;
      const i = L.h('input', { type: 'checkbox' });
      i.checked = sh ? !!sh.light : true;
      i.onchange = () => { if (App.doc.meta.share) { App.doc.meta.share.light = i.checked; App.commit(); } else state.light = i.checked; };
      return L.h('label', { class: 'chk shr-light' }, i, 'Alléger les images (' + nImg + ') : envoi plus rapide, qualité suffisante pour l\'écran et l\'impression');
    };
    const state = { live: true, light: true };

    /* Lien long, sans connexion */
    const longBox = () => {
      const out = L.h('textarea', { class: 'shr-link', readonly: true, rows: 3, spellcheck: 'false' });
      out.onfocus = () => out.select();
      const size = L.h('div', { class: 'shr-size' });
      const warn = L.h('div', { class: 'note', hidden: true });
      let link = '';
      const title = docTitle(App.doc);
      const msg = () => 'Je te partage mon document « ' + title + ' ».\n\n'
        + 'Pour l\'ouvrir : dans LaTeX Home Edition, clique sur « Partager » puis « Ouvrir un lien reçu » et colle ce lien (ou colle-le directement dans l\'application) — tu obtiendras ta propre copie.\n\n'
        + link + '\n\n'
        + 'Pas encore l\'application ? Elle est gratuite (Windows et Mac) : ' + APP_URL + '\n';
      const refresh = async () => {
        out.value = 'Création du lien…'; size.textContent = '';
        const sh = App.doc.meta.share;
        try { link = await encode(await docData(sh ? sh.light : state.light)); }
        catch (e) { out.value = ''; warn.hidden = false; warn.textContent = 'Impossible de créer le lien : ' + e.message; return; }
        out.value = link;
        size.textContent = 'Lien de ' + fmtLen(link.length);
        warn.hidden = link.length < 60000;
        warn.textContent = 'Ce lien est très long : certaines messageries risquent de le couper. Préférez le lien court, ou envoyez le fichier .lhe.';
      };
      const d = L.h('details', { class: 'shr-more' },
        L.h('summary', { text: 'Sans connexion : lien long, rien n\'est stocké en ligne (copie figée)' }),
        L.h('p', { class: 'shr-foot', text: 'Le document entier est compressé dans le lien lui-même. Plus long et pas cliquable, sans mises à jour, mais aucun serveur n\'est utilisé : le destinataire le colle dans l\'application.' }),
        out, size, warn,
        L.h('div', { class: 'shr-acts' },
          L.h('button', { class: 'btn', text: '⧉ Copier le lien long', onclick: () => link && copy(link, 'Lien copié') }),
          L.h('button', { class: 'btn', text: 'Copier le message', onclick: () => link && copy(msg(), 'Message copié') })));
      d.addEventListener('toggle', () => { if (d.open && !link) refresh(); });
      return d;
    };

    /* Tous les liens créés depuis cet ordinateur */
    const mineBox = () => {
      const list = mine();
      if (!list.length) return null;
      const cur = App.doc.meta.share && App.doc.meta.share.id;
      return L.h('details', { class: 'shr-more' },
        L.h('summary', { text: 'Tous vos liens (' + list.length + ')' }),
        L.h('div', { class: 'shr-mine' }, ...list.map(e => L.h('div', { class: 'shr-row' + (e.id === cur ? ' cur' : '') },
          L.h('span', { class: 'shr-row-t' }, L.h('b', { text: e.title || 'Sans titre' }), L.h('em', { text: (e.id === cur ? ' · ce document' : '') + ' · ' + fmtDate(e.at) })),
          L.h('button', { class: 'btn small', text: 'Copier', onclick: () => copy(shortUrl(e.id), 'Lien copié') }),
          L.h('button', { class: 'btn small', text: 'Désactiver', onclick: async () => {
            if (!confirm('Désactiver le lien de « ' + (e.title || 'Sans titre') + ' » ? Il ne fonctionnera plus pour personne (les copies déjà importées restent chez leurs destinataires).')) return;
            try { await revoke(e.id); L.toast('Lien désactivé'); build(); } catch (err) { L.toast(err.message, 'err'); }
          } })))));
    };

    const build = () => {
      if (dlg && dlg._off) { dlg._off(); dlg._off = null; }
      const m = App.doc.meta, sh = m.share, e = sh && entryOf(sh.id);
      const title = docTitle(App.doc);
      const parts = [];
      if (sh && e) {
        /* Le document a déjà son lien : on le gère */
        const link = shortUrl(sh.id);
        const sMsg = () => 'Je te partage mon document « ' + title + ' » :\n' + link + '\n\n'
          + 'Ouvre le lien : il lance LaTeX Home Edition (ou te propose de l\'installer, c\'est gratuit), et tu obtiendras ta propre copie du document.'
          + (sh.live ? ' Quand je le modifierai, l\'application te proposera de mettre ta copie à jour.' : '') + '\n';
        const out = L.h('input', { class: 'shr-short', type: 'text', readonly: true, value: link, spellcheck: 'false' });
        out.onfocus = () => out.select();
        const status = L.h('div', { class: 'shr-status' });
        const sendBtn = L.h('button', { class: 'btn', text: '⇪ Envoyer la version actuelle' });
        const paint = () => {
          const st = L.Live.ownerState();
          status.replaceChildren(
            L.h('span', { class: 'dot ' + st.kind }),
            L.h('span', { text: st.text }));
          sendBtn.hidden = sh.live;
          sendBtn.disabled = st.kind === 'ok' || st.kind === 'busy';
        };
        sendBtn.onclick = async () => { await L.Live.publish(true); paint(); };
        const off = L.Live.onState(paint);
        paint();
        parts.push(
          L.h('div', { class: 'shr-box' },
            L.h('div', { class: 'shr-h', text: 'Lien de ce document' }),
            out,
            L.h('div', { class: 'shr-acts' },
              L.h('button', { class: 'btn primary', text: '⧉ Copier le lien', onclick: () => copy(link, 'Lien copié') }),
              L.h('button', { class: 'btn', text: 'Copier le message', onclick: () => copy(sMsg(), 'Message copié') }),
              L.h('button', { class: 'btn', text: '✉ Envoyer par e-mail…', onclick: () => mailto('Document partagé : ' + title, sMsg()) })),
            L.h('div', { class: 'shr-h2', text: 'Mises à jour' }),
            modeChoice(!!sh.live, async live => {
              sh.live = live; App.commit();
              try { await rpc('update_share', { p_id: sh.id, p_token: e.token, p_live: live }); } catch (err) { /* l'information sera renvoyée avec la prochaine version */ }
              if (live) L.Live.publish(false);
              L.Live.refresh(); paint();
            }),
            L.h('div', { class: 'shr-line' }, status, sendBtn),
            lightBox(sh),
            L.h('div', { class: 'shr-acts shr-end' },
              L.h('button', { class: 'btn danger-soft', text: 'Désactiver le lien', onclick: async () => {
                if (!confirm('Désactiver ce lien ? Il ne fonctionnera plus pour personne (les copies déjà importées restent chez leurs destinataires, sans mises à jour).')) return;
                try { await revoke(sh.id); L.toast('Lien désactivé'); off(); build(); } catch (err) { L.toast(err.message, 'err'); }
              } }))));
        dlg && (dlg._off = off);
      } else {
        /* Pas encore de lien : on le crée, en choisissant le mode */
        const err = L.h('div', { class: 'note', hidden: true });
        const btn = L.h('button', { class: 'btn primary', text: '🔗 Créer le lien de ce document' });
        btn.onclick = async () => {
          btn.disabled = true; btn.textContent = 'Envoi du document…'; err.hidden = true;
          try {
            if (sh && !e) delete m.share;
            await createShort(state.live, nImg ? state.light : false);
            copy(shortUrl(App.doc.meta.share.id), 'Lien créé et copié');
            L.Live.docLoaded();
            build();
          } catch (x) { err.hidden = false; err.textContent = x.message; btn.disabled = false; btn.textContent = 'Réessayer'; }
        };
        parts.push(
          L.h('div', { class: 'shr-box' },
            L.h('div', { class: 'shr-h', text: 'Lien court' }),
            L.h('p', { class: 'shr-foot', text: 'Un seul lien pour ce document. Il est déposé sur le serveur de partage (en Europe) : seules les personnes qui ont le lien peuvent l\'ouvrir, et vous pouvez le désactiver à tout moment.' }),
            sh && !e ? L.h('div', { class: 'note', text: 'Ce document a déjà un lien, créé depuis un autre ordinateur : il ne peut être mis à jour que depuis celui-ci. Vous pouvez créer un nouveau lien ici (l\'ancien continuera de donner l\'ancienne version).' }) : null,
            modeChoice(state.live, live => { state.live = live; }),
            lightBox(null),
            btn, err));
      }
      parts.push(longBox());
      const mb = mineBox();
      if (mb) parts.push(mb);
      parts.push(L.h('p', { class: 'shr-foot', text: 'Chaque destinataire importe sa propre copie, qu\'il peut modifier librement. Les modifications qu\'il fait de son côté ne vous parviennent pas.' }));
      body.replaceChildren(L.h('p', { class: 'shr-intro', html: 'Toute personne qui reçoit le lien peut <b>importer sa propre copie</b> de « ' + L.escHtml(title) + ' » dans LaTeX Home Edition, sans que vous ayez à envoyer le fichier.' }), ...parts);
    };
    dlg = L.modal({ title: 'Partager ce document', body, wide: true, onClose: () => { if (dlg && dlg._off) dlg._off(); } });
    build();
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
      const m = doc.meta, sf = m.sharedFrom;
      const prev = L.h('div', { class: 'shr-prev' });
      try { prev.appendChild(L.renderDoc(doc, 'view')); } catch (e) { /* aperçu facultatif */ }
      card.replaceChildren(
        L.h('div', { class: 'shr-info' },
          L.h('b', { text: docTitle(doc) }),
          L.plain(m.author) ? L.h('span', { text: 'par ' + L.plain(m.author) }) : null,
          L.h('span', { class: 'shr-stats', text: blocks + ' élément' + (blocks > 1 ? 's' : '') + ' · ' + eqs + ' formule' + (eqs > 1 ? 's' : '') + (nImg ? ' · ' + nImg + ' image' + (nImg > 1 ? 's' : '') : '') + (sf ? ' · version du ' + fmtDate(sf.at) : '') }),
          sf ? L.h('span', { class: 'shr-live' + (sf.live ? ' on' : ''), text: sf.live
            ? '● Mises à jour en direct : l\'application vous proposera chaque nouvelle version de l\'auteur.'
            : 'Si l\'auteur envoie une nouvelle version, l\'application vous la proposera.' }) : null,
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
      if (App.doc.meta.sharedFrom) App.doc.meta.sharedFrom.hash = L.Live.hash(App.doc);
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

  L.Share = {
    encode, decode, pack, unpack, rpc, shortUrl, docData, mine, entryOf, setEntry, revoke, ago, fmtDate,
    LINK_RE, SHORT_RE, isLink: t => LINK_RE.test(String(t || '')) || SHORT_RE.test(String(t || '')),
  };
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
