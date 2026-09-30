/* « Live Modification » : co-édition en direct d'un document en ligne.

   Le document est représenté dans un document Yjs (structure CRDT : les
   modifications simultanées de plusieurs personnes se fusionnent toujours de
   la même façon chez tout le monde, au caractère près dans les textes).
     - Local → Yjs : après chaque frappe / opération, le modèle de l'éditeur
       (App.doc) est comparé à l'état Yjs et seules les différences y sont
       appliquées (textes : insertion/suppression au caractère près).
     - Yjs → autres : chaque modification locale est diffusée immédiatement sur
       le canal temps réel privé du document, et enregistrée en base (pour
       ceux qui arrivent plus tard ou étaient hors ligne).
     - Autres → local : on intègre d'abord les modifications locales en attente,
       puis celles reçues, et on met à jour l'éditeur au plus juste (seulement
       les champs de texte modifiés quand c'est possible), en gardant le
       curseur de chacun à sa place.
   Les curseurs des autres (trait coloré + pseudo) et leur sélection sont
   dessinés par-dessus la feuille. */
(function () {
  const LOCAL = 'local', REMOTE = 'remote', LOAD = 'load';
  const LOCAL_META = ['share', 'sharedFrom', 'live', '_hfMigrated'];
  const TEXT_KEYS = new Set(['html', 'latex', 'code', 'caption', 'title', 'subtitle', 'author', 'institution', 'extra', 'date', 'text']);
  const CHIP = '.imath, .xref, .cite, .fn, .timg, .hfill, .katex';
  const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#e67700', '#0c8599', '#d6336c', '#4263eb', '#66a80f', '#c2255c'];
  const ROLE_NAMES = { owner: 'Propriétaire', editor: 'Éditeur', commenter: 'Commentateur', viewer: 'Lecteur' };
  const BROADCAST_MAX = 120000;       // au-delà, la modification passe seulement par la base

  const C = () => L.Cloud;
  let S = null;                       // session en cours

  /* ================= Utilitaires ================= */
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const b = atob(str); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const colorOf = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = name => (String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();

  /* ================= Correspondance JSON ⇄ Yjs ================= */
  const isText = (key, ctx) => ctx.cell || TEXT_KEYS.has(key);
  const arrCtx = (key, ctx) => ({ type: ctx.type, cell: ctx.cell || (key === 'rows' && ctx.type === 'table') });
  const objCtx = (o, ctx) => ({ type: o && o.id && o.type ? o.type : ctx.type, cell: false });

  function toY(v, key, ctx) {
    if (Array.isArray(v)) { const c2 = arrCtx(key, ctx); const a = new Y.Array(); a.insert(0, v.map(x => toY(x, key, c2))); return a; }
    if (v && typeof v === 'object') {
      const c2 = objCtx(v, ctx); const m = new Y.Map();
      for (const k of Object.keys(v)) if (v[k] !== undefined) m.set(k, toY(v[k], k, c2));
      return m;
    }
    if (typeof v === 'string' && isText(key, ctx)) return new Y.Text(v);
    return v === undefined ? null : v;
  }
  function fits(cur, nv, key, ctx) {
    if (Array.isArray(nv)) return cur instanceof Y.Array;
    if (nv && typeof nv === 'object') return cur instanceof Y.Map;
    if (typeof nv === 'string' && isText(key, ctx)) return cur instanceof Y.Text;
    return !(cur instanceof Y.AbstractType);
  }
  function update(cur, nv, key, ctx) {
    if (cur instanceof Y.Array) syncArray(cur, nv, key, arrCtx(key, ctx));
    else if (cur instanceof Y.Map) syncMap(cur, nv, objCtx(nv, ctx));
    else if (cur instanceof Y.Text) syncText(cur, nv);
  }
  function syncText(yt, str) {
    const old = yt.toString();
    if (old === str) return;
    let p = 0; const n = Math.min(old.length, str.length);
    while (p < n && old.charCodeAt(p) === str.charCodeAt(p)) p++;
    if (p > 0 && old.charCodeAt(p - 1) >= 0xd800 && old.charCodeAt(p - 1) <= 0xdbff) p--;   // ne pas couper un emoji
    let s = 0;
    while (s < old.length - p && s < str.length - p && old.charCodeAt(old.length - 1 - s) === str.charCodeAt(str.length - 1 - s)) s++;
    if (s > 0 && old.charCodeAt(old.length - s) >= 0xdc00 && old.charCodeAt(old.length - s) <= 0xdfff) s--;
    if (old.length - p - s > 0) yt.delete(p, old.length - p - s);
    if (str.length - p - s > 0) yt.insert(p, str.slice(p, str.length - s));
  }
  function syncMap(ym, obj, ctx) {
    for (const k of Object.keys(obj)) {
      const nv = obj[k];
      if (nv === undefined) continue;
      const cur = ym.get(k);
      if (ym.has(k) && fits(cur, nv, k, ctx)) {
        if (cur instanceof Y.AbstractType) update(cur, nv, k, ctx);
        else if (cur !== nv) ym.set(k, toY(nv, k, ctx));
      } else ym.set(k, toY(nv, k, ctx));
    }
    for (const k of Array.from(ym.keys())) if (!(k in obj) || obj[k] === undefined) ym.delete(k);
  }
  const jsonOf = v => v instanceof Y.AbstractType ? v.toJSON() : v;
  const same = (yv, v) => JSON.stringify(jsonOf(yv)) === JSON.stringify(v);
  function syncArray(ya, arr, key, ctx) {
    const cur = ya.toArray();
    const ids = cur.map(x => x instanceof Y.Map ? x.get('id') : undefined);
    const byId = arr.length && arr.every(x => x && typeof x === 'object' && !Array.isArray(x) && x.id) && ids.every(Boolean);
    if (byId) {
      /* Blocs : on suit les identifiants (un bloc déplacé est retiré puis réinséré) */
      const want = arr.map(x => x.id);
      for (let i = ids.length - 1; i >= 0; i--) if (!want.includes(ids[i])) { ya.delete(i, 1); ids.splice(i, 1); }
      for (let i = 0; i < want.length; i++) {
        if (ids[i] === want[i]) { syncMap(ya.get(i), arr[i], objCtx(arr[i], ctx)); continue; }
        const j = ids.indexOf(want[i]);
        if (j > i) { ya.delete(j, 1); ids.splice(j, 1); }
        ya.insert(i, [toY(arr[i], key, ctx)]); ids.splice(i, 0, want[i]);
      }
      if (ya.length > want.length) ya.delete(want.length, ya.length - want.length);
      return;
    }
    /* Listes sans identifiants (éléments de liste, lignes de tableau…) : début et
       fin communs conservés, milieu mis à jour élément par élément */
    const n = cur.length, m = arr.length;
    let p = 0; while (p < n && p < m && same(cur[p], arr[p])) p++;
    let s = 0; while (s < n - p && s < m - p && same(cur[n - 1 - s], arr[m - 1 - s])) s++;
    const midOld = n - p - s, midNew = m - p - s, common = Math.min(midOld, midNew);
    for (let i = 0; i < common; i++) {
      const c = cur[p + i], nv = arr[p + i];
      if (c instanceof Y.AbstractType && fits(c, nv, key, ctx)) update(c, nv, key, ctx);
      else { ya.delete(p + i, 1); ya.insert(p + i, [toY(nv, key, ctx)]); }
    }
    if (midOld > common) ya.delete(p + common, midOld - common);
    if (midNew > common) ya.insert(p + common, arr.slice(p + common, p + midNew).map(x => toY(x, key, ctx)));
  }

  /* Modèle de l'éditeur → données partagées (sans les réglages propres à cet ordinateur) */
  function appJson(withAssets) {
    const d = App.doc, meta = Object.assign({}, d.meta);
    LOCAL_META.forEach(k => delete meta[k]);
    const o = { meta, blocks: d.blocks, bib: d.bib || [] };
    if (withAssets) o.assets = d.assets || {};
    return JSON.parse(JSON.stringify(o));
  }
  const assetsSig = a => Object.keys(a || {}).sort().map(k => k + ':' + String(a[k]).length).join('|');

  /* ================= Positions dans un champ de texte =================
     Chaque caractère compte pour 1, une formule / référence / note pour 1. */
  function units(root, cb) {
    const rec = n => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (cb('t', c, c.nodeValue.length) === false) return false; }
        else if (c.nodeType === 1) {
          if (c.matches(CHIP)) { if (cb('c', c, 1) === false) return false; }
          else if (c.tagName === 'BR') { if (cb('b', c, 1) === false) return false; }
          else if (rec(c) === false) return false;
        }
      }
    };
    rec(root);
  }
  function textOf(root) { let s = ''; units(root, (k, n) => { s += k === 't' ? n.nodeValue : k === 'c' ? '￼' : '\n'; }); return s; }
  function offsetOf(root, node, off) {
    if (!root.contains(node)) return null;
    const p = document.createRange(); p.setStart(node, off); p.collapse(true);
    let acc = 0, res = null;
    units(root, (k, n, len) => {
      if (k === 't' && n === node) { res = acc + off; return false; }
      if (k !== 't' && (n === node || n.contains(node))) { res = acc + (off > 0 && k !== 'b' ? 1 : 0); return false; }
      if (p.comparePoint(n, 0) >= 0) { res = acc; return false; }   // ce morceau commence après le point
      acc += len;
    });
    return res === null ? acc : res;
  }
  function rangeAt(root, a, h) {
    const pos = off => {
      let acc = 0, out = null, last = null;
      units(root, (k, n, len) => {
        last = { k, n };
        if (k === 't' && off <= acc + len) { out = [n, off - acc]; return false; }
        if (k !== 't' && off <= acc) { out = ['before', n]; return false; }
        acc += len;
      });
      if (out) return out;
      if (last) return last.k === 't' ? [last.n, last.n.nodeValue.length] : ['after', last.n];
      return [root, 0];
    };
    const r = document.createRange();
    const set = (fn, p) => { if (p[0] === 'before') r[fn === 'setStart' ? 'setStartBefore' : 'setEndBefore'](p[1]); else if (p[0] === 'after') r[fn === 'setStart' ? 'setStartAfter' : 'setEndAfter'](p[1]); else r[fn](p[0], p[1]); };
    const lo = Math.min(a, h === undefined ? a : h), hi = Math.max(a, h === undefined ? a : h);
    set('setStart', pos(lo)); set('setEnd', pos(hi));
    return r;
  }
  function selOffsets(field) {
    const s = window.getSelection();
    if (!s.rangeCount || !field.contains(s.anchorNode)) return null;
    const a = offsetOf(field, s.anchorNode, s.anchorOffset), h = offsetOf(field, s.focusNode, s.focusOffset);
    return a === null || h === null ? null : { a, h };
  }
  function setSel(field, a, h) {
    const s = window.getSelection();
    const r = rangeAt(field, a, h);
    s.removeAllRanges();
    if (a <= h || s.setBaseAndExtent === undefined) { s.addRange(r); return; }
    const f = rangeAt(field, h), b = rangeAt(field, a);
    s.setBaseAndExtent(b.startContainer, b.startOffset, f.startContainer, f.startOffset);
  }
  /* Déplace une position quand le texte change autour d'elle */
  function mapOffset(off, oldT, newT) {
    let p = 0; const n = Math.min(oldT.length, newT.length);
    while (p < n && oldT[p] === newT[p]) p++;
    let s = 0;
    while (s < oldT.length - p && s < newT.length - p && oldT[oldT.length - 1 - s] === newT[newT.length - 1 - s]) s++;
    if (off <= p) return off;
    if (off >= oldT.length - s) return off + newT.length - oldT.length;
    return newT.length - s;
  }
  const fieldEl = (b, f) => L.$('#paper [data-b="' + CSS.escape(b) + '"][data-f="' + CSS.escape(f) + '"]');
  function getPath(o, path) { for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o; }
  const blockOf = (doc, id) => { const f = id === 'meta' ? { block: doc.meta } : L.find(doc, id); return f ? f.block : null; };

  /* ================= Session ================= */
  const canEdit = () => S && (S.role === 'owner' || S.role === 'editor');
  const canComment = () => S && S.role !== 'viewer';
  const active = () => !!S;

  async function open(id, opts = {}) {
    if (!C().available()) throw new Error('La Live Modification n\'est pas disponible (module de connexion absent).');
    if (!C().user()) { L.dlgAuth('login', () => open(id, opts)); return; }
    leave(true);
    const info = await C().openDoc(id);   // lève LHE_FORBIDDEN si pas d'accès
    const ydoc = new Y.Doc();
    const s = S = {
      id, role: info.role, owner: info.owner, title: info.title, ydoc, root: ydoc.getMap('doc'),
      outbox: [], persistQ: [], inbox: [], lastDbId: info.snapshot_upto || 0, loading: true,
      people: new Map(), cursors: new Map(), status: 'connexion', assetsSig: '', composing: false, retry: 0,
    };
    if (info.snapshot) Y.applyUpdate(ydoc, unb64(info.snapshot), LOAD);
    // Canal d'abord (rien ne se perd entre le chargement et l'abonnement), modifications ensuite
    s.ch = C().channel(id, {
      onUpdate: u => { if (S === s && u) { s.inbox.push(u); scheduleInbox(); } },
      onDbUpdate: row => { if (S !== s || !row) return; s.lastDbId = Math.max(s.lastDbId, row.id || 0); if (row.data) { s.inbox.push(row.data); scheduleInbox(); } else catchUp(); },
      onCursor: p => { if (S === s) remoteCursor(p); },
      onPresence: list => { if (S === s) presence(list); },
      onComments: () => { if (S === s && L.Comments) L.Comments.refreshSoon(); },
      onMembers: ev => { if (S === s) membersChanged(ev); },
      onStatus: st => { if (S === s) channelStatus(st); },
    });
    let rows;
    try { rows = await C().fetchUpdates(id, s.lastDbId); }
    catch (e) { if (S === s) leave(true); throw e; }
    if (S !== s) return;
    rows.forEach(r => { try { Y.applyUpdate(ydoc, unb64(r.data), LOAD); } catch (e) { console.warn('maj illisible', r.id); } s.lastDbId = Math.max(s.lastDbId, r.id); });
    // Modifications faites ici et pas encore envoyées (fermeture brutale, coupure réseau)
    const pend = loadPending(id);
    pend.forEach(u => { try { Y.applyUpdate(ydoc, unb64(u), LOCAL); } catch (e) { /* ignoré */ } });
    if (pend.length) { s.persistQ.push(...pend); schedulePersist(200); }

    ydoc.on('update', (u, origin) => { if (origin === LOCAL || origin === s.undo) { s.outbox.push(u); scheduleOutbox(); } });
    s.undo = new Y.UndoManager(s.root, { trackedOrigins: new Set([LOCAL]), captureTimeout: 600 });
    s.root.observeDeep((ev, tr) => { if (tr.origin !== LOCAL && !s.loading) schedulePull(); });

    // Document vide (création) : on part du document ouvert dans l'éditeur
    const empty = !s.root.has('blocks');
    if (empty && opts.fromApp && canEdit()) ydoc.transact(() => syncMap(s.root, appJson(true), { type: null, cell: false }), LOCAL);

    s.loading = true;
    const json = s.root.toJSON();
    const keep = opts.keepFile ? { fileName: App.fileName, filePath: App.filePath, fileHandle: App.fileHandle } : null;
    const doc = { meta: Object.assign({}, json.meta || {}, { live: { id } }), blocks: json.blocks || [], bib: json.bib || [], assets: json.assets || {} };
    App.load(doc, keep ? keep.fileName : (info.title || null));
    if (keep) { App.filePath = keep.filePath; App.fileHandle = keep.fileHandle; }
    s.assetsSig = assetsSig(App.doc.assets);
    s.loading = false;
    applyRole();
    if (s.inbox.length) scheduleInbox();
    if (rows.length > 150 && canEdit()) setTimeout(() => compactNow(s), 4000);
    // Filet de sécurité : sans canal temps réel (réseau filtrant, serveur indisponible),
    // on récupère quand même les modifications des autres toutes les 3 secondes
    s.poll = setInterval(() => { if (S === s && s.status !== 'ok') catchUp(); }, 3000);
    if (L.Comments) L.Comments.start(s);
    paintBar();
    return s;
  }

  /* Active la Live Modification pour le document ouvert */
  async function create() {
    if (!C().user()) { L.dlgAuth('signup', () => create()); return; }
    App.commit();
    const title = L.plain(App.doc.meta.title) || 'Sans titre';
    const id = await C().createDoc(title);
    // Premier état : tout le document
    const ydoc = new Y.Doc();
    ydoc.transact(() => syncMap(ydoc.getMap('doc'), appJson(true), { type: null, cell: false }));
    await C().pushUpdate(id, b64(Y.encodeStateAsUpdate(ydoc)));
    await open(id, { keepFile: true });
    return id;
  }

  function leave(silent) {
    const s = S;
    if (!s) return;
    flushOutbox(s);
    if (s.persistQ.length) { savePending(s); persist(s, true); }
    S = null;
    try { s.ch && s.ch.close(); } catch (e) { /* ignoré */ }
    try { s.undo && s.undo.destroy(); } catch (e) { /* ignoré */ }
    clearTimeout(s.tPull); clearTimeout(s.tIn); clearTimeout(s.tOut); clearTimeout(s.tPersist); clearTimeout(s.tTitle); clearInterval(s.poll);
    if (L.Comments) L.Comments.stop();
    document.body.classList.remove('ro', 'ro-comment', 'live');
    const layer = L.$('#paper .collab-layer'); if (layer) layer.remove();
    paintBar();
    if (!silent && App.doc && App.doc.meta.live) { delete App.doc.meta.live; }
  }

  /* ================= Local → partagé ================= */
  function localChanged() {
    if (!S || S.loading) return;
    clearTimeout(S.tPush);
    S.tPush = setTimeout(pushLocal, 60);
  }
  function pushLocal() {
    const s = S;
    if (!s || s.loading) return;
    clearTimeout(s.tPush);
    if (!canEdit()) {
      // Lecture seule : toute modification locale est annulée (le serveur la refuserait de toute façon)
      if (JSON.stringify(appJson(false)) !== JSON.stringify(sharedJson(false))) pull(true);
      return;
    }
    const sig = assetsSig(App.doc.assets);
    const withAssets = sig !== s.assetsSig;
    const json = appJson(withAssets);
    s.ydoc.transact(() => {
      syncMap(s.root.get('meta') || setNew(s.root, 'meta'), json.meta, { type: null, cell: false });
      syncArray(s.root.get('blocks') || setNew(s.root, 'blocks', true), json.blocks, 'blocks', { type: null, cell: false });
      syncArray(s.root.get('bib') || setNew(s.root, 'bib', true), json.bib, 'bib', { type: null, cell: false });
      if (withAssets) syncMap(s.root.get('assets') || setNew(s.root, 'assets'), json.assets, { type: null, cell: false });
    }, LOCAL);
    s.assetsSig = sig;
    titleSoon();
  }
  const setNew = (root, k, arr) => { const v = arr ? new Y.Array() : new Y.Map(); root.set(k, v); return v; };
  /* Réglages du document complétés comme à l'ouverture (valeurs par défaut),
     sans les réglages propres à cet ordinateur */
  function normMeta(m) {
    const x = L.fixMeta(Object.assign(L.defaultMeta(), m || {}));
    LOCAL_META.forEach(k => delete x[k]);
    return x;
  }
  function sharedJson(withAssets) {
    const j = S.root.toJSON();
    const o = { meta: normMeta(j.meta), blocks: j.blocks || [], bib: j.bib || [] };
    if (withAssets) o.assets = j.assets || {};
    return o;
  }
  function titleSoon() {
    const s = S;
    clearTimeout(s.tTitle);
    s.tTitle = setTimeout(() => {
      const t = L.plain(App.doc.meta.title) || 'Sans titre';
      if (S === s && t !== s.title) { s.title = t; C().renameDoc(s.id, t).catch(() => {}); }
    }, 2500);
  }

  function scheduleOutbox() { if (!S.tOut) S.tOut = setTimeout(() => { S && (S.tOut = null); flushOutbox(S); }, 90); }
  function flushOutbox(s) {
    if (!s || !s.outbox.length) return;
    const u = s.outbox.length === 1 ? s.outbox[0] : Y.mergeUpdates(s.outbox);
    s.outbox = [];
    const data = b64(u);
    if (data.length < BROADCAST_MAX && s.ch) s.ch.send('y', { u: data });
    s.persistQ.push(data);
    savePending(s);
    schedulePersist();
    paintBar();
  }
  function schedulePersist(ms) {
    const s = S;
    if (!s || s.tPersist) return;
    s.tPersist = setTimeout(() => { s.tPersist = null; persist(s); }, ms === undefined ? 700 : ms);
  }
  async function persist(s, final) {
    if (!s.persistQ.length || s.persisting) return;
    s.persisting = true;
    const batch = s.persistQ.slice();
    const data = batch.length === 1 ? batch[0] : b64(Y.mergeUpdates(batch.map(unb64)));
    try {
      await C().pushUpdate(s.id, data);
      s.persistQ.splice(0, batch.length);
      s.retry = 0; s.offline = false;
      savePending(s);
    } catch (e) {
      s.offline = true;
      s.retry = Math.min(6, s.retry + 1);
      if (!final && S === s) setTimeout(() => { if (S === s) schedulePersist(0); }, 1000 * Math.pow(2, s.retry));
    }
    s.persisting = false;
    if (S === s) paintBar();
    if (!final && s.persistQ.length && S === s) schedulePersist();
  }
  /* Modifications non encore enregistrées : gardées sur l'ordinateur en cas de fermeture */
  const pendKey = id => 'lhe-live-attente-' + id;
  function savePending(s) { try { if (s.persistQ.length) localStorage.setItem(pendKey(s.id), JSON.stringify(s.persistQ)); else localStorage.removeItem(pendKey(s.id)); } catch (e) { /* trop gros : tant pis */ } }
  function loadPending(id) { try { const v = JSON.parse(localStorage.getItem(pendKey(id)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }

  async function compactNow(s) {
    if (S !== s || !canEdit()) return;
    try {
      const rows = await C().fetchUpdates(s.id, 0);
      if (S !== s || !rows.length) return;
      const tmp = new Y.Doc();
      const info = await C().openDoc(s.id);
      if (info.snapshot) Y.applyUpdate(tmp, unb64(info.snapshot));
      rows.forEach(r => { try { Y.applyUpdate(tmp, unb64(r.data)); } catch (e) { /* ignoré */ } });
      await C().compact(s.id, b64(Y.encodeStateAsUpdate(tmp)), rows[rows.length - 1].id);
    } catch (e) { console.warn('Compaction', e); }
  }

  /* ================= Partagé → local ================= */
  function scheduleInbox() { if (!S.tIn) S.tIn = setTimeout(() => { if (S) { S.tIn = null; processInbox(); } }, 16); }
  function processInbox() {
    const s = S;
    if (!s || s.loading || !s.inbox.length) return;
    pushLocal();                                    // d'abord ce que l'on vient de taper
    const list = s.inbox; s.inbox = [];
    s.ydoc.transact(() => list.forEach(u => { try { Y.applyUpdate(s.ydoc, typeof u === 'string' ? unb64(u) : u, REMOTE); } catch (e) { console.warn('maj illisible', e); } }), REMOTE);
  }
  function schedulePull() { if (!S.tPull) S.tPull = setTimeout(() => { if (S) { S.tPull = null; pull(); } }, 0); }
  async function catchUp() {
    const s = S;
    if (!s) return;
    try {
      const rows = await C().fetchUpdates(s.id, s.lastDbId);
      if (S !== s) return;
      rows.forEach(r => { s.lastDbId = Math.max(s.lastDbId, r.id); s.inbox.push(r.data); });
      if (rows.length) scheduleInbox();
    } catch (e) { /* hors ligne */ }
  }

  /* Met l'éditeur à jour d'après les données partagées, au plus juste */
  const skeleton = (v, key, ctx) => {
    if (Array.isArray(v)) { const c2 = arrCtx(key, ctx); return v.map(x => skeleton(x, key, c2)); }
    if (v && typeof v === 'object') { const c2 = objCtx(v, ctx); const o = {}; Object.keys(v).sort().forEach(k => { o[k] = skeleton(v[k], k, c2); }); return o; }
    return typeof v === 'string' && isText(key, ctx) ? '' : v;
  };
  function textDiffs(a, b, key, ctx, path, out) {
    if (Array.isArray(a)) { const c2 = arrCtx(key, ctx); a.forEach((x, i) => textDiffs(x, b[i], key, c2, path.concat(i), out)); return; }
    if (a && typeof a === 'object') { const c2 = objCtx(a, ctx); Object.keys(a).forEach(k => textDiffs(a[k], b[k], k, c2, path.concat(k), out)); return; }
    if (typeof a === 'string' && a !== b) out.push(path);
  }
  /* Chemin JSON → (bloc, champ) de l'éditeur */
  function locate(doc, path) {
    if (path[0] === 'meta') return { b: 'meta', f: path.slice(1).join('.') };
    let o = doc, bid = null, from = 0;
    for (let i = 0; i < path.length; i++) {
      o = o[path[i]];
      if (o && typeof o === 'object' && !Array.isArray(o) && o.id && o.type) { bid = o.id; from = i + 1; }
    }
    return bid ? { b: bid, f: path.slice(from).join('.') } : null;
  }

  function pull(force) {
    const s = S;
    if (!s || s.loading) return;
    const j = s.root.toJSON();
    const old = App.doc;
    const localMeta = {}; LOCAL_META.forEach(k => { if (old.meta[k] !== undefined) localMeta[k] = old.meta[k]; });
    const nd = { meta: Object.assign(normMeta(j.meta), localMeta), blocks: (j.blocks && j.blocks.length) ? j.blocks : [L.newBlock('paragraph')], bib: j.bib || [], assets: j.assets || old.assets || {} };
    const oldCmp = { meta: old.meta, blocks: old.blocks, bib: old.bib || [] }, newCmp = { meta: nd.meta, blocks: nd.blocks, bib: nd.bib };
    const assetsChanged = assetsSig(old.assets) !== assetsSig(nd.assets);
    if (!force && !assetsChanged && JSON.stringify(oldCmp) === JSON.stringify(newCmp)) return;
    const ctx0 = { type: null, cell: false };
    let fieldOnly = !assetsChanged && JSON.stringify(skeleton(oldCmp, '', ctx0)) === JSON.stringify(skeleton(newCmp, '', ctx0));
    let targets = [];
    if (fieldOnly) {
      const paths = []; textDiffs(oldCmp, newCmp, '', ctx0, [], paths);
      for (const p of paths) {
        const loc = locate(nd, p);
        const el = loc && fieldEl(loc.b, loc.f);
        const val = loc && getPath(p[0] === 'meta' ? nd.meta : blockOf(nd, loc.b), loc.f);
        if (!el || typeof val !== 'string' || /class="fn"/.test(val) || (s.composing && el.contains(document.activeElement))) { fieldOnly = false; break; }
        targets.push({ el, val, code: loc.f === 'code' });
      }
    }
    Object.assign(App.doc, nd);
    s.assetsSig = assetsSig(App.doc.assets);
    if (fieldOnly) {
      const info = L.computeNumbers(App.doc);
      const ctx = { doc: App.doc, mode: 'edit', nums: info.nums, toc: info.toc, bib: info.bib, lang: App.doc.meta.lang, meta: App.doc.meta };
      targets.forEach(t => patchField(t.el, t.val, t.code, ctx));
      App.pagesSoon();
      App.refreshAux();
      if (!canEdit()) lockFields();
    } else {
      const keep = captureSel();
      App.render();
      restoreSel(keep);
    }
    if (App.sel && !L.find(App.doc, App.sel)) App.select(null);
    App.updateName();
    redraw();
    if (L.Comments) L.Comments.redraw();
  }
  function patchField(el, html, isCode, ctx) {
    const sel = selOffsets(el);
    const oldT = sel ? textOf(el) : '';
    if (isCode) { el.textContent = html; el.classList.toggle('is-empty', !html); }
    else {
      el.innerHTML = html || '';
      L.hydrate(el, ctx);
      el.classList.toggle('is-empty', L.isEmptyHtml(html));
    }
    if (sel) {
      const newT = textOf(el);
      setSel(el, mapOffset(sel.a, oldT, newT), mapOffset(sel.h, oldT, newT));
    }
  }
  function captureSel() {
    const s = window.getSelection();
    if (!s.rangeCount) return null;
    const n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
    const field = el && el.closest && el.closest('#paper [data-b][data-f]');
    if (!field) return null;
    const o = selOffsets(field);
    return o ? { b: field.dataset.b, f: field.dataset.f, a: o.a, h: o.h, t: textOf(field), focus: document.activeElement === field || field.contains(document.activeElement) } : null;
  }
  function restoreSel(k) {
    if (!k) return;
    const field = fieldEl(k.b, k.f);
    if (!field) return;
    const t = textOf(field);
    if (k.focus && canEdit()) field.focus({ preventScroll: true });
    try { setSel(field, mapOffset(k.a, k.t, t), mapOffset(k.h, k.t, t)); } catch (e) { /* position disparue */ }
  }

  /* ================= Annuler / rétablir (seulement ses propres modifications) ================= */
  function undo() { if (!S) return; pushLocal(); if (!S.undo.canUndo()) return L.toast('Rien à annuler'); S.undo.undo(); pull(); }
  function redo() { if (!S) return; pushLocal(); if (!S.undo.canRedo()) return L.toast('Rien à rétablir'); S.undo.redo(); pull(); }

  /* ================= Rôles : lecture seule ================= */
  function applyRole() {
    const ro = !canEdit();
    document.body.classList.add('live');
    document.body.classList.toggle('ro', ro);
    document.body.classList.toggle('ro-comment', ro && canComment());
    if (ro) lockFields();
  }
  function lockFields() { L.$$('#paper [contenteditable="true"]').forEach(el => { el.setAttribute('contenteditable', 'false'); el.dataset.ro = '1'; }); }
  function guard(e) {
    if (!S || canEdit()) return;
    if (e.target.closest && e.target.closest('#modal, .popmenu, #findBar, .cmt-panel, input, textarea, select, math-field')) return;
    const k = e.key || '';
    const mod = e.ctrlKey || e.metaKey;
    const editing = e.type !== 'keydown' || ['Enter', 'Delete', 'Backspace', 'Tab'].includes(k) || (k.length === 1 && !mod) || (mod && /^[xvzybiumek]$/i.test(k));
    if (editing && !(mod && /^[cafp]$/i.test(k))) { e.preventDefault(); e.stopPropagation(); }
  }

  /* ================= Présence et curseurs ================= */
  function presence(list) {
    const s = S;
    const seen = new Map();
    list.forEach(p => { if (p && p.uid) seen.set(p.tab || p.uid, p); });
    s.people = seen;
    for (const k of Array.from(s.cursors.keys())) if (!seen.has(k)) s.cursors.delete(k);
    paintBar();
    redraw();
  }
  function channelStatus(st) {
    const s = S;
    s.status = st === 'SUBSCRIBED' ? 'ok' : st === 'CLOSED' ? 'ferme' : (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') ? 'erreur' : st;
    if (st === 'SUBSCRIBED') {
      s.ch.track({ uid: C().uid(), tab: s.ch.tab, pseudo: C().pseudo(), color: colorOf(C().uid()), role: s.role, t: Date.now() });
      if (s.everSubscribed) catchUp();       // reconnexion : on rattrape ce qui a été manqué
      s.everSubscribed = true;
      if (s.persistQ.length) schedulePersist(0);
      sendCursor(true);
    }
    paintBar();
  }
  async function membersChanged(ev) {
    const s = S;
    const row = (ev && (ev.new && Object.keys(ev.new).length ? ev.new : ev.old)) || {};
    if (row.email && row.email === C().email()) {
      if (ev.eventType === 'DELETE') {
        leave(true);
        L.toast('Votre accès à ce document a été retiré. La version affichée reste sur votre ordinateur.', 'err');
        delete App.doc.meta.live; App.render();
        return;
      }
      // Rôle modifié : on se reconnecte avec les nouveaux droits
      L.toast('Votre rôle sur ce document a changé.');
      open(s.id).catch(e => L.toast(C().fr(e), 'err'));
      return;
    }
    if (L.CollabUI) L.CollabUI.peopleChanged();
  }

  /* Mon curseur, envoyé aux autres (éditeurs seulement : le serveur refuse les autres) */
  let lastSent = '';
  function sendCursor(force) {
    const s = S;
    if (!s || !canEdit() || !s.ch) return;
    const sel = window.getSelection();
    let p = { tab: s.ch.tab, uid: C().uid(), pseudo: C().pseudo(), color: colorOf(C().uid()), b: null };
    if (sel.rangeCount) {
      const n = sel.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
      const field = el && el.closest && el.closest('#paper [data-b][data-f]');
      if (field) { const o = selOffsets(field); if (o) Object.assign(p, { b: field.dataset.b, f: field.dataset.f, a: o.a, h: o.h }); }
    }
    const key = JSON.stringify([p.b, p.f, p.a, p.h]);
    if (!force && key === lastSent) return;
    lastSent = key;
    s.ch.send('cursor', p);
  }
  const sendCursorSoon = L.debounce(() => sendCursor(false), 80);
  function remoteCursor(p) {
    if (!p || !p.tab) return;
    const s = S;
    if (p.b === null) s.cursors.delete(p.tab);
    else s.cursors.set(p.tab, Object.assign({ at: Date.now() }, p));
    redraw();
  }
  /* Dessin des curseurs et sélections des autres, par-dessus la feuille */
  function layer() {
    const paper = L.$('#paper');
    let l = paper.querySelector(':scope > .collab-layer');
    if (!l) { l = L.h('div', { class: 'collab-layer', 'aria-hidden': 'true' }); paper.appendChild(l); }
    return l;
  }
  function redraw() {
    const s = S;
    const paper = L.$('#paper');
    if (!s) { const l = paper.querySelector(':scope > .collab-layer'); if (l) l.remove(); return; }
    const l = layer();
    l.replaceChildren();
    const pr = paper.getBoundingClientRect(), z = App.editZoom || 1;
    const rel = r => ({ x: (r.left - pr.left) / z, y: (r.top - pr.top) / z, w: r.width / z, h: r.height / z });
    for (const c of s.cursors.values()) {
      const field = fieldEl(c.b, c.f);
      if (!field) continue;
      const len = textOf(field).length;
      const a = Math.min(c.a, len), h = Math.min(c.h, len);
      let rects = [];
      if (a !== h) rects = Array.from(rangeAt(field, a, h).getClientRects()).filter(r => r.width > 0.5);
      rects.forEach(r => { const q = rel(r); l.appendChild(L.h('div', { class: 'cc-sel', style: { left: q.x + 'px', top: q.y + 'px', width: q.w + 'px', height: q.h + 'px', background: c.color } })); });
      let cr = rangeAt(field, h).getClientRects()[0];
      if (!cr || (!cr.height && !cr.width)) {
        const fr = field.getBoundingClientRect();
        cr = { left: fr.left + 2, top: fr.top, height: parseFloat(getComputedStyle(field).lineHeight) * z || 18 * z, width: 0 };
      }
      const q = rel(cr);
      const idle = Date.now() - c.at > 4000;
      l.appendChild(L.h('div', { class: 'cc-caret', style: { left: q.x + 'px', top: q.y + 'px', height: Math.max(q.h, 12) + 'px', background: c.color } },
        L.h('span', { class: 'cc-name' + (idle ? ' idle' : ''), text: c.pseudo || 'Anonyme', style: { background: c.color } })));
    }
    clearTimeout(s.tIdle);
    if (s.cursors.size) s.tIdle = setTimeout(() => S === s && redraw(), 4200);
  }

  /* ================= Barre « Live » (en haut) ================= */
  function paintBar() {
    const bar = L.$('#collabBar');
    if (!bar) return;
    const s = S;
    // Indicateur « non enregistré » du nom du document : modifications pas encore envoyées
    if (s && App.doc) { const d = hasPending(); if (App.dirty !== d) { App.dirty = d; L.$('#docName').classList.toggle('dirty', d); } }
    if (!s) { bar.hidden = true; bar.replaceChildren(); return; }
    bar.hidden = false;
    const pending = s.persistQ.length + s.outbox.length;
    const st = s.offline ? 'off' : s.status !== 'ok' ? (s.status === 'erreur' ? 'off' : 'wait') : pending ? 'sync' : 'ok';
    const label = { ok: 'Live', sync: 'Live · envoi…', wait: 'Live · connexion…', off: 'Live · hors ligne' }[st];
    const tip = { ok: 'Modification en direct : tout est enregistré en ligne', sync: 'Envoi de vos dernières modifications…', wait: 'Connexion au document en direct…', off: 'Hors ligne : vos modifications sont gardées et seront envoyées au retour de la connexion' }[st];
    const others = [];
    const mine = C().uid();
    const byUser = new Map();
    for (const p of s.people.values()) if (!byUser.has(p.uid)) byUser.set(p.uid, p);
    for (const p of byUser.values()) others.push(p);
    others.sort((a, b) => (a.uid === mine) - (b.uid === mine));
    bar.replaceChildren(...[
      L.h('button', { class: 'live-pill ' + st, title: tip + ' — cliquer pour gérer le partage', text: '● ' + label, onclick: () => L.dlgCollab && L.dlgCollab() }),
      L.h('div', { class: 'live-people' }, ...others.slice(0, 6).map(p => L.h('span', {
        class: 'avatar' + (p.uid === mine ? ' me' : ''), text: initials(p.pseudo), style: { background: p.color || colorOf(p.uid) },
        title: (p.pseudo || 'Anonyme') + (p.uid === mine ? ' (vous)' : '') + ' — ' + (ROLE_NAMES[p.role] || ''),
        onclick: () => jumpTo(p),
      })), others.length > 6 ? L.h('span', { class: 'avatar more', text: '+' + (others.length - 6) }) : null),
      s.role !== 'owner' ? L.h('span', { class: 'live-role ' + s.role, text: ROLE_NAMES[s.role] }) : null,
      L.Comments ? L.h('button', { class: 'live-cmt', title: 'Commentaires', onclick: () => L.Comments.toggle() }, '💬', L.h('span', { class: 'n', text: L.Comments.count() ? String(L.Comments.count()) : '' })) : null].filter(Boolean));
  }
  function jumpTo(p) {
    const c = Array.from(S.cursors.values()).find(x => x.uid === p.uid);
    const field = c && fieldEl(c.b, c.f);
    if (field) field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ================= Branchements dans l'éditeur ================= */
  function docLoaded() {
    if (S && S.loading) return;
    // Au démarrage, la session du compte se recharge en arrière-plan : on attend qu'elle soit prête
    if (C() && C().available() && !C().state.ready && App.doc && App.doc.meta.live) {
      const off = C().onChange(st => { if (st.ready) { off(); docLoaded(); } });
      return;
    }
    const live = App.doc && App.doc.meta.live;
    if (S && (!live || live.id !== S.id)) leave(true);
    if (live && !S && C() && C().available()) {
      if (C().user()) open(live.id, { keepFile: true }).catch(e => { L.toast(C().fr(e), 'err'); });
      else if (L.CollabUI) L.CollabUI.askLogin(live.id);
    }
    paintBar();
  }
  function afterRender() {
    if (!S) return;
    if (!canEdit()) lockFields();
    redraw();
  }
  const hasPending = () => !!(S && (S.persistQ.length || S.outbox.length));

  document.addEventListener('selectionchange', () => { if (S && canEdit()) sendCursorSoon(); });
  window.addEventListener('resize', L.debounce(() => { redraw(); }, 100));
  document.addEventListener('DOMContentLoaded', () => {
    const paper = L.$('#paper');
    ['beforeinput', 'paste', 'drop', 'cut', 'dragstart'].forEach(t => paper.addEventListener(t, guard, true));
    document.addEventListener('keydown', guard, true);
    paper.addEventListener('compositionstart', () => { if (S) S.composing = true; });
    paper.addEventListener('compositionend', () => { if (S) { S.composing = false; if (S.inbox.length) scheduleInbox(); } });
  });
  window.addEventListener('online', () => { if (S) { S.offline = false; schedulePersist(0); catchUp(); } });
  window.addEventListener('beforeunload', () => { if (S) { flushOutbox(S); savePending(S); } });

  L.Collab = {
    open, create, leave, active, docLoaded, afterRender, redraw, localChanged, pushLocal, undo, redo, hasPending,
    session: () => S, role: () => S && S.role, canEdit, canComment, colorOf, initials, ROLE_NAMES,
    textOf, offsetOf, rangeAt, selOffsets, fieldEl, pull,
    _int: { toY, syncMap, syncArray, syncText, skeleton, mapOffset, appJson, b64, unb64 },
  };
})();
