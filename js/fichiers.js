/* « Mes fichiers en ligne » : les documents du compte connecté, rangés en ligne
   (Supabase, espace privé de chaque compte — voir supabase/fichiers.sql).
   Un document ouvert depuis « Mes fichiers » s'enregistre tout seul en ligne
   quelques secondes après chaque modification ; les fichiers du PC ne sont
   jamais modifiés ni supprimés (ils sont seulement copiés en ligne). */
(function () {
  const C = () => L.Cloud;
  const LINK_KEY = 'lhe-fichier-en-ligne';   // fichier en ligne lié au document de la sauvegarde automatique
  const PREFIX = 'z1:';                      // document compressé (deflate) en base64
  const MAX = 15000000;

  /* ---------- Fichier en ligne lié au document ouvert ---------- */
  let link = null;          // { id, name, version, owner }
  let nextLink = null;      // lien à poser au prochain App.load (ouverture d'un fichier en ligne)
  const saveLink = () => { try { if (link) localStorage.setItem(LINK_KEY, JSON.stringify(link)); else localStorage.removeItem(LINK_KEY); } catch (e) { /* stockage indisponible */ } };
  // Appelé par App.load : tout autre document (fichier du PC, modèle, lien…) n'est plus lié
  function docLoaded() {
    link = nextLink; nextLink = null;
    saved = link ? App.snapshot() : null;
    status = link ? 'ok' : null;
    blocked = false; clearTimeout(tSave); tSave = null; first = 0;
    // Modifications pas encore envoyées à la fermeture : on les envoie maintenant
    if (link && link.pending) { delete link.pending; saved = null; }
    if (link) { App.fileName = link.name; App.updateName(); }
    saveLink(); paint();
    if (link && saved === null) changed();
  }
  // Au démarrage, le document repris de la sauvegarde automatique garde son lien
  function restoreLink() { try { nextLink = JSON.parse(localStorage.getItem(LINK_KEY) || 'null'); } catch (e) { nextLink = null; } }

  /* ---------- Compression ---------- */
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function packDoc() {
    const json = App.serialize();
    return PREFIX + toB64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
  }
  async function unpackDoc(data) {
    let json;
    if (data.startsWith(PREFIX)) json = new TextDecoder().decode(await pipe(fromB64(data.slice(PREFIX.length)), new DecompressionStream('deflate-raw')));
    else json = data;
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.blocks) || !d.meta) throw new Error('Ce fichier en ligne n\'est pas un document valide.');
    return L.sanitizeDoc({ meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} });
  }

  /* ---------- Serveur ---------- */
  const MSG = {
    LHE_AUTH: 'Connectez-vous d\'abord.',
    LHE_QUOTA: 'Votre espace en ligne est plein (45 Mo environ, corbeille et versions précédentes comprises) : videz la corbeille ou supprimez d\'anciens fichiers.',
    LHE_SIZE: 'Document trop volumineux pour être enregistré en ligne (images trop lourdes).',
    LHE_GONE: 'Ce fichier n\'existe plus en ligne, ou appartient à un autre compte.',
    LHE_TRASHED: 'Ce fichier est dans la corbeille.',
    LHE_NOT_TRASHED: 'Mettez d\'abord le fichier à la corbeille.',
    LHE_NO_PREV: 'Pas de version précédente pour ce fichier.',
    LHE_CONFLICT: 'Ce fichier a été modifié ailleurs entre-temps.',
  };
  const codeOf = e => Object.keys(MSG).find(k => String((e && e.message) || e).includes(k)) || null;
  function frErr(e) {
    const m = String((e && e.message) || e || '');
    const c = codeOf(e);
    if (c) return MSG[c];
    if (/schema cache|Could not find the (function|table)|lhe_file|lhe_my_files/i.test(m)) return 'Le stockage en ligne n\'est pas encore installé sur le serveur (script supabase/fichiers.sql à exécuter dans Supabase).';
    return C().fr(e);
  }
  async function rpc(fn, args) {
    const r = await C().client().rpc(fn, args || {});
    if (r.error) { const e = new Error(r.error.message || String(r.error)); e.raw = r.error; throw e; }
    return r.data;
  }
  const list = () => rpc('lhe_my_files');
  const usage = () => rpc('lhe_files_usage');
  async function fetchFile(id) {
    const r = await C().client().from('lhe_files').select('id, name, data, version, owner, deleted_at').eq('id', id).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    if (!r.data) throw new Error('LHE_GONE');
    return r.data;
  }
  const saveRpc = (id, name, data, version, force) => rpc('lhe_file_save', { p_id: id, p_name: name, p_data: data, p_version: version, p_force: !!force });

  /* ---------- Enregistrement automatique du document lié ---------- */
  let saved = null;         // instantané du document au dernier enregistrement en ligne réussi
  let status = null;        // 'ok' | 'saving' | 'pending' | 'offline' | 'login' | 'error'
  let blocked = false;      // conflit / fichier disparu : on attend la décision de l'utilisateur
  let busy = false, tSave = null, first = 0;
  const linked = () => !!link && !(L.Collab && L.Collab.active());

  function changed() {
    if (!linked() || blocked) return;
    if (App.snapshot() === saved) { App.setDirty(false); status = 'ok'; paint(); return; }
    if (!first) first = Date.now();
    status = status === 'offline' || status === 'login' ? status : 'pending';
    paint();
    clearTimeout(tSave);
    // quelques secondes après la dernière modification, et au moins toutes les 20 s en continu
    tSave = setTimeout(() => saveNow(true), Date.now() - first > 20000 ? 0 : 2500);
  }

  async function saveNow(auto) {
    if (!link) return false;
    App.commit();
    clearTimeout(tSave); tSave = null;
    if (busy) { if (!auto) setTimeout(() => saveNow(auto), 300); return false; }
    if (!C() || !C().available() || !C().user()) {
      status = 'login'; paint();
      if (!auto) L.dlgAuth('login', () => saveNow(false));
      return false;
    }
    const snap = App.snapshot();
    if (snap === saved && !blocked) {   // rien de nouveau : déjà en ligne
      first = 0; status = 'ok'; App.setDirty(false); paint();
      if (!auto) L.toast('Enregistré en ligne : ' + link.name);
      return true;
    }
    busy = true; status = 'saving'; paint();
    const target = link;
    try {
      const data = await packDoc();
      if (data.length > MAX) throw new Error('LHE_SIZE');
      const r = await saveRpc(target.id, null, data, target.version, false);
      if (link !== target) return true;      // un autre document a été ouvert entre-temps
      link = Object.assign({}, link, { version: r.version, name: r.name }); saveLink();
      saved = snap; first = 0;
      if (App.snapshot() === snap) { status = 'ok'; App.setDirty(false); }
      else { status = 'pending'; changed(); }
      paint();
      if (!auto) L.toast('Enregistré en ligne : ' + link.name);
      return true;
    } catch (e) {
      if (link !== target) return false;
      const c = codeOf(e);
      if (c === 'LHE_CONFLICT' || c === 'LHE_GONE' || c === 'LHE_TRASHED') { blocked = true; status = 'error'; paint(); problem(c); return false; }
      if (c === 'LHE_QUOTA' || c === 'LHE_SIZE') { blocked = true; status = 'error'; paint(); L.toast(MSG[c], 'err'); return false; }
      if (/JWT|expired|LHE_AUTH/i.test(String(e.message))) { status = 'login'; paint(); return false; }
      // Hors ligne (ou serveur injoignable) : on réessaie plus tard ; le document reste
      // dans la sauvegarde automatique de l'ordinateur en attendant
      status = 'offline'; paint();
      if (!auto) L.toast(frErr(e), 'err');
      clearTimeout(tSave); tSave = setTimeout(() => saveNow(true), 30000);
      return false;
    } finally { busy = false; }
  }

  /* Conflit ou fichier disparu : on ne détruit rien, on demande */
  function problem(code) {
    const name = link ? link.name : '';
    const text = {
      LHE_CONFLICT: '« ' + name + ' » a été modifié depuis un autre ordinateur ou une autre fenêtre depuis que vous l\'avez ouvert. Pour ne rien perdre, choisissez :',
      LHE_GONE: '« ' + name + ' » n\'existe plus dans vos fichiers en ligne (supprimé, ou vous êtes connecté avec un autre compte : ' + (C().email() || '?') + ').',
      LHE_TRASHED: '« ' + name + ' » a été mis à la corbeille depuis un autre ordinateur ou une autre fenêtre.',
    }[code];
    const foot = [
      { text: 'Enregistrer comme nouveau fichier', cls: 'primary', onClick: c => { c(); saveAsNew(name + (code === 'LHE_CONFLICT' ? ' (copie)' : '')); } },
    ];
    if (code === 'LHE_CONFLICT') foot.push({ text: 'Remplacer la version en ligne', onClick: async c => {
      if (!confirm('Remplacer la version en ligne par la vôtre ? La version remplacée reste récupérable : « Mes fichiers » → « Version précédente ».')) return;
      c(); await force();
    } });
    if (code === 'LHE_TRASHED') foot.push({ text: 'Le sortir de la corbeille', onClick: async c => {
      c();
      try { await rpc('lhe_file_trash', { p_id: link.id, p_trash: false }); const f = await fetchFile(link.id); link.version = f.version; link.name = f.name; saveLink(); blocked = false; saveNow(false); }
      catch (e) { L.toast(frErr(e), 'err'); }
    } });
    foot.push({ text: 'Plus tard', onClick: c => c() });
    L.modal({ title: 'Enregistrement en ligne en pause', body: L.h('div', { class: 'auth' },
      L.h('p', { text }),
      L.h('p', { class: 'auth-small', text: 'Votre travail n\'est pas perdu : il reste ouvert ici et dans la sauvegarde automatique de l\'ordinateur. Vous pouvez aussi l\'enregistrer sur le PC (Ctrl+Maj+S).' })), foot });
  }
  async function force() {
    try {
      App.commit();
      const snap = App.snapshot();
      const r = await saveRpc(link.id, null, await packDoc(), link.version, true);
      link = Object.assign({}, link, { version: r.version, name: r.name }); saveLink();
      saved = snap; blocked = false; status = 'ok'; App.setDirty(App.snapshot() !== snap); paint();
      L.toast('Version en ligne remplacée (l\'ancienne est gardée comme version précédente)');
    } catch (e) { L.toast(frErr(e), 'err'); }
  }

  /* Enregistre le document ouvert comme NOUVEAU fichier en ligne (jamais d'écrasement :
     un nom déjà pris devient « nom (2) ») ; il est ensuite lié à ce fichier */
  async function saveAsNew(name) {
    if (!C() || !C().available()) return L.toast('Le stockage en ligne n\'est pas disponible.', 'err');
    if (!C().user()) return L.dlgAuth('login', () => saveAsNew(name));
    if (L.Collab && L.Collab.active()) return L.toast('Ce document est en Live Modification : il est déjà enregistré en ligne.');
    App.commit();
    const snap = App.snapshot();
    try {
      const data = await packDoc();
      if (data.length > MAX) throw new Error('LHE_SIZE');
      const r = await saveRpc(null, name || defaultName(), data, null, false);
      link = { id: r.id, name: r.name, version: r.version, owner: C().uid() };
      saved = snap; blocked = false; status = 'ok'; first = 0;
      App.fileName = r.name; App.filePath = null; App.fileHandle = null;
      saveLink(); App.setDirty(App.snapshot() !== snap); App.updateName(); paint();
      L.toast('Enregistré dans vos fichiers en ligne : « ' + r.name + ' ». Il s\'enregistrera désormais tout seul.');
      return r;
    } catch (e) { L.toast(frErr(e), 'err'); return null; }
  }
  const defaultName = () => (App.fileName ? App.fileName.replace(/\.(lhe|json)$/i, '') : '') || L.plain(App.doc.meta.title) || 'Sans titre';

  async function openFile(id) {
    if (link && link.id === id) return;
    // Le document en cours : enregistré en ligne d'abord s'il en vient, sinon on demande
    const safe = linked() ? (status === 'ok' || await saveNow(true)) : !App.dirty;
    if (!safe && !confirm('Le document actuel contient des modifications non enregistrées. Ouvrir l\'autre fichier quand même ? (Une copie reste dans la sauvegarde automatique de l\'ordinateur jusqu\'au prochain changement.)')) return false;
    try {
      const f = await fetchFile(id);
      if (f.deleted_at) throw new Error('LHE_TRASHED');
      const doc = await unpackDoc(f.data);
      nextLink = { id: f.id, name: f.name, version: f.version, owner: f.owner };
      App.fileHandle = null; App.filePath = null;
      App.load(doc, f.name);
      L.toast('Ouvert depuis vos fichiers en ligne : ' + f.name);
      return true;
    } catch (e) { L.toast(frErr(e), 'err'); return false; }
  }

  /* Copie en ligne de fichiers .lhe du PC (les fichiers du PC ne bougent pas) */
  function uploadFromPc(done) {
    const inp = L.h('input', { type: 'file', multiple: true, accept: '.lhe,.json', style: { display: 'none' } });
    document.body.appendChild(inp);
    inp.onchange = async () => {
      const files = Array.from(inp.files || []); inp.remove();
      let ok = 0; const bad = [];
      for (const f of files) {
        try {
          const d = JSON.parse(await f.text());
          if (!d || !Array.isArray(d.blocks) || !d.meta) throw new Error('format');
          const json = JSON.stringify({ app: 'LaTeX Home Edition', version: 1, meta: d.meta, blocks: d.blocks, bib: d.bib || [], assets: d.assets || {} });
          const data = PREFIX + toB64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
          if (data.length > MAX) throw new Error('LHE_SIZE');
          await saveRpc(null, f.name.replace(/\.(lhe|json)$/i, ''), data, null, false);
          ok++;
        } catch (e) { bad.push(f.name + ' (' + (codeOf(e) ? MSG[codeOf(e)] : /format|JSON/.test(e.message) ? 'pas un document LaTeX Home Edition' : frErr(e)) + ')'); if (codeOf(e) === 'LHE_QUOTA') break; }
      }
      if (ok) L.toast(ok + ' fichier' + (ok > 1 ? 's copiés' : ' copié') + ' en ligne (les fichiers du PC restent à leur place).');
      if (bad.length) L.toast('Non copiés : ' + bad.join(', '), 'err');
      if (done) done();
    };
    inp.click();
  }

  /* ---------- Fenêtre « Mes fichiers en ligne » ---------- */
  const fmtSize = n => n < 1000 ? n + ' o' : n < 1e6 ? Math.round(n / 1000) + ' Ko' : (n / 1e6).toFixed(1).replace('.', ',') + ' Mo';
  async function dialog() {
    if (!C() || !C().available()) return L.toast('Le stockage en ligne n\'est pas disponible (module de connexion non chargé).', 'err');
    if (!C().user()) return L.dlgAuth('login', () => dialog());
    const body = L.h('div', { class: 'drive' }, L.h('div', { class: 'fhint', text: 'Chargement…' }));
    const dlg = L.modal({ title: 'Mes fichiers en ligne', body, wide: true });
    let showTrash = false, filter = '';
    const search = L.h('input', { type: 'search', class: 'drive-search', placeholder: 'Rechercher un fichier…' });
    search.oninput = () => { filter = search.value.trim().toLowerCase(); paintList(); };
    let files = [], use = null;
    const listBox = L.h('div');
    const reload = async () => {
      try { [files, use] = await Promise.all([list(), usage()]); }
      catch (e) { body.replaceChildren(L.h('div', { class: 'note', text: frErr(e) })); return false; }
      paintAll(); return true;
    };
    const act = (label, fn, cls) => L.h('button', { class: 'btn small' + (cls ? ' ' + cls : ''), text: label, onclick: async ev => { ev.stopPropagation(); try { await fn(); } catch (e) { L.toast(frErr(e), 'err'); } } });
    const row = f => {
      const isCur = link && link.id === f.id;
      const name = L.h('b', { text: f.name });
      const r = L.h('div', { class: 'cdoc drive-row' + (isCur ? ' cur' : ''), title: f.deleted_at ? '' : 'Ouvrir' },
        L.h('div', { class: 'cdoc-t' }, name,
          L.h('span', { class: 'fhint', text: (f.deleted_at ? 'mis à la corbeille ' + L.Share.ago(f.deleted_at) : 'modifié ' + L.Share.ago(f.updated_at)) + ' · ' + fmtSize(f.size) + (isCur ? ' · ouvert' : '') })),
        ...(f.deleted_at ? [
          act('Restaurer', async () => { await rpc('lhe_file_trash', { p_id: f.id, p_trash: false }); L.toast('Fichier restauré'); await reload(); }),
          act('Supprimer définitivement', async () => {
            if (!confirm('Supprimer DÉFINITIVEMENT « ' + f.name + ' » ? Cette fois, il ne pourra plus être récupéré.')) return;
            await rpc('lhe_file_purge', { p_id: f.id }); await reload();
          }, 'danger-soft'),
        ] : [
          act('Ouvrir', async () => { if (await openFile(f.id) !== false) dlg.close(); }, 'primary'),
          act('Renommer', async () => {
            const n = prompt('Nouveau nom :', f.name);
            if (!n || !n.trim() || n.trim() === f.name) return;
            const r2 = await rpc('lhe_file_rename', { p_id: f.id, p_name: n.trim() });
            if (isCur) { link.name = r2.name; saveLink(); App.fileName = r2.name; App.updateName(); }
            await reload();
          }),
          act('⬇ PC', async () => { const x = await fetchFile(f.id); const d = await unpackDoc(x.data); L.download(f.name + '.lhe', JSON.stringify({ app: 'LaTeX Home Edition', version: 1, meta: d.meta, blocks: d.blocks, bib: d.bib, assets: d.assets }), 'application/json'); }),
          f.prev_at ? act('Version précédente', async () => {
            if (!confirm('Revenir à la version de « ' + f.name + ' » du ' + new Date(f.prev_at).toLocaleString('fr-FR') + ' ?\n\nLa version actuelle n\'est pas perdue : elle devient à son tour la « version précédente ».')) return;
            if (isCur && status !== 'ok') await saveNow(true);
            await rpc('lhe_file_revert', { p_id: f.id });
            if (isCur) { link = null; await openFile(f.id); }
            L.toast('Version précédente rétablie'); await reload();
          }) : null,
          act('🗑', async () => {
            if (!confirm('Mettre « ' + f.name + ' » à la corbeille ? Vous pourrez le restaurer pendant 30 jours.')) return;
            await rpc('lhe_file_trash', { p_id: f.id, p_trash: true });
            if (isCur) { link = null; saveLink(); paint(); }
            await reload();
          }, 'danger-soft'),
        ]).filter(Boolean));
      if (!f.deleted_at) r.addEventListener('dblclick', async () => { if (await openFile(f.id) !== false) dlg.close(); });
      return r;
    };
    const paintList = () => {
      const live = files.filter(f => !f.deleted_at && (!filter || f.name.toLowerCase().includes(filter)));
      const trash = files.filter(f => f.deleted_at);
      listBox.replaceChildren(...[
        live.length ? L.h('div', { class: 'cdoc-list' }, ...live.map(row))
          : L.h('div', { class: 'fhint drive-empty', text: filter ? 'Aucun fichier ne correspond à « ' + search.value + ' ».' : 'Aucun fichier en ligne pour le moment. Enregistrez le document actuel, ou copiez des fichiers de votre PC.' }),
        trash.length ? L.h('button', { class: 'linkish drive-trash-btn', text: (showTrash ? '▾ ' : '▸ ') + 'Corbeille (' + trash.length + ')', onclick: () => { showTrash = !showTrash; paintList(); } }) : null,
        showTrash && trash.length ? L.h('div', null, L.h('div', { class: 'fhint', text: 'Les fichiers de la corbeille sont supprimés automatiquement au bout de 30 jours.' }), L.h('div', { class: 'cdoc-list' }, ...trash.map(row))) : null].filter(Boolean));
    };
    const paintAll = () => {
      const isLinked = linked();
      const collab = L.Collab && L.Collab.active();
      body.replaceChildren(...[
        L.h('p', { class: 'fhint', text: 'Vos documents rangés en ligne, privés (visibles seulement avec votre compte ' + C().email() + '). Retrouvez-les depuis n\'importe quel ordinateur en vous connectant. Les fichiers de votre PC ne sont jamais modifiés ni supprimés.' }),
        L.h('div', { class: 'drive-top' },
          collab ? L.h('span', { class: 'fhint', text: '⚡ Le document ouvert est en Live Modification : il est déjà en ligne.' })
            : isLinked ? L.h('span', { class: 'drive-cur', text: '☁ Le document ouvert est « ' + link.name + ' » : il s\'enregistre tout seul.' })
              : L.h('button', { class: 'btn primary', text: '☁ Enregistrer le document actuel en ligne', onclick: async () => { const r = await saveAsNew(); if (r) reload(); } }),
          L.h('button', { class: 'btn', text: '⬆ Copier des fichiers du PC…', onclick: () => uploadFromPc(reload) }),
          isLinked ? L.h('button', { class: 'btn', text: '＋ Enregistrer une copie', onclick: async () => { const n = prompt('Nom de la copie :', link.name + ' (copie)'); if (n && n.trim()) { await saveNow(true); const r = await saveAsNew(n.trim()); if (r) reload(); } } }) : null),
        search, listBox,
        use ? L.h('div', { class: 'drive-usage' },
          L.h('div', { class: 'drive-bar' }, L.h('i', { style: { width: Math.min(100, Math.round(use.used / use.max * 100)) + '%' } })),
          L.h('span', { class: 'fhint', text: 'Espace utilisé : ' + fmtSize(Math.round(use.used * 0.75)) + ' sur ' + fmtSize(Math.round(use.max * 0.75)) + ' environ' })) : null].filter(Boolean));
      paintList();
      setTimeout(() => search.focus(), 30);
    };
    await reload();
  }

  /* ---------- Indicateur à côté du nom du document ---------- */
  function paint() {
    const el = L.$('#driveStatus');
    if (!el) return;
    if (!linked()) { el.hidden = true; return; }
    const s = status || 'ok';
    el.hidden = false;
    el.className = 'share-pill drive-pill ' + { ok: 'live', saving: 'live busy', pending: 'live busy', offline: 'wait', login: 'wait', error: 'err' }[s];
    el.textContent = { ok: '☁ En ligne', saving: '☁ Enregistrement…', pending: '☁ Modifié', offline: '☁ Hors ligne', login: '☁ Connexion requise', error: '☁ En pause' }[s];
    el.title = {
      ok: 'Enregistré dans vos fichiers en ligne (« ' + link.name + ' ») — cliquer pour voir vos fichiers',
      saving: 'Enregistrement en ligne en cours…',
      pending: 'Modifications enregistrées en ligne dans quelques secondes',
      offline: 'Pas de connexion : vos modifications sont gardées sur cet ordinateur et seront envoyées dès le retour de la connexion',
      login: 'Connectez-vous pour enregistrer ce document en ligne',
      error: 'Enregistrement en ligne en pause — cliquer pour choisir quoi faire',
    }[s];
  }
  function pillClick() {
    if (status === 'login') return L.dlgAuth('login', () => saveNow(false));
    if (status === 'error') { blocked = false; return saveNow(false); }
    if (status === 'offline') return saveNow(false);
    dialog();
  }

  // Retour de la connexion / connexion au compte : on renvoie ce qui attend
  window.addEventListener('online', () => { if (linked() && status !== 'ok') saveNow(true); });
  document.addEventListener('DOMContentLoaded', () => {
    const el = L.$('#driveStatus');
    if (el) el.addEventListener('click', pillClick);
    if (C()) C().onChange(st => { if (st.session && linked() && status === 'login') saveNow(true); paint(); });
  });
  // Fermeture : ce qui n'est pas encore en ligne est marqué, et sera envoyé à la réouverture
  window.addEventListener('beforeunload', () => {
    if (linked() && App.snapshot() !== saved) {
      if (App.autosaveNow) App.autosaveNow();
      link.pending = true; saveLink(); delete link.pending;
    }
  });

  L.Drive = {
    dialog, saveNow, saveAsNew, openFile, changed, docLoaded, restoreLink,
    linked, link: () => link, status: () => status,
  };
})();
