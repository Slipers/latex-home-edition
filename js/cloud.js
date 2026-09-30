/* Comptes et serveur de la « Live Modification » (Supabase).
   Ce module ne fait que parler au serveur : comptes (inscription avec
   confirmation de l'adresse e-mail, connexion, mot de passe oublié, profil),
   documents en ligne, personnes invitées, commentaires, et canal temps réel
   privé d'un document. La co-édition elle-même est dans js/collab.js.
   Toute la sécurité est appliquée par le serveur (supabase/collab.sql) :
   l'application ne fait qu'afficher ce que le serveur autorise. */
(function () {
  const URL = 'https://temejdqaocdqqoodqjyk.supabase.co';
  const KEY = 'sb_publishable_MCpfjyXJgTyh64p80I5hiA_xAq30XtY';
  const SITE = 'https://slipers.github.io/latex-home-edition/';
  const ACCOUNT_URL = SITE + 'compte/';
  const DOC_URL = SITE + 'd/';

  let sb = null;
  const client = () => {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Le module de connexion n\'a pas pu être chargé.');
    sb = window.supabase.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'lhe-compte' },
      realtime: { params: { eventsPerSecond: 25 } },
    });
    sb.auth.onAuthStateChange((ev, session) => {
      state.session = session || null;
      if (session && sb.realtime) sb.realtime.setAuth(session.access_token);
      if (ev === 'SIGNED_OUT') state.profile = null;
      emit();
      if (session && !state.profile) loadProfile();
    });
    return sb;
  };

  /* ---------- État du compte ---------- */
  const state = { session: null, profile: null, ready: false };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(state); } catch (e) { console.warn(e); } });
  const onChange = f => { listeners.add(f); return () => listeners.delete(f); };
  const user = () => state.session && state.session.user;
  const uid = () => user() && user().id;
  const email = () => user() && (user().email || '').toLowerCase();
  const pseudo = () => (state.profile && state.profile.pseudo) || (user() && user().user_metadata && user().user_metadata.pseudo) || (email() || '').split('@')[0];

  async function init() {
    try {
      const { data } = await client().auth.getSession();
      state.session = data.session || null;
      if (state.session) { client().realtime.setAuth(state.session.access_token); await loadProfile(); }
    } catch (e) { console.warn('Compte', e); }
    state.ready = true;
    emit();
  }
  async function loadProfile() {
    if (!uid()) return;
    const { data } = await client().from('profiles').select('pseudo').eq('id', uid()).maybeSingle();
    state.profile = data || { pseudo: pseudo() };
    emit();
  }

  /* ---------- Erreurs en français ---------- */
  const MSG = {
    LHE_FORBIDDEN: 'Vous n\'avez pas accès à ce document (ou plus).',
    LHE_AUTH: 'Connectez-vous d\'abord.',
    LHE_EMAIL: 'Cette adresse e-mail n\'est pas valide.',
    LHE_SELF: 'C\'est votre propre adresse : vous avez déjà accès à ce document.',
    LHE_ROLE: 'Rôle inconnu.',
    LHE_RATE: 'Trop d\'invitations en peu de temps. Réessayez dans une heure.',
    LHE_SIZE: 'Contenu trop volumineux.',
  };
  function fr(err) {
    const m = String((err && (err.message || err.error_description || err.msg)) || err || '');
    const code = Object.keys(MSG).find(k => m.includes(k));
    if (code) return MSG[code];
    if (/Invalid login credentials/i.test(m)) return 'Adresse e-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Adresse e-mail pas encore confirmée : cliquez sur le lien reçu par e-mail (pensez aux indésirables).';
    if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse : connectez-vous.';
    if (/Password should be|weak_password|at least/i.test(m)) return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.';
    if (/rate limit|too many|over_email_send_rate_limit|security purposes/i.test(m)) return 'Trop de tentatives : patientez une minute avant de réessayer.';
    if (/Unable to validate email|invalid format|Email address .* is invalid/i.test(m)) return 'Cette adresse e-mail n\'est pas valide.';
    if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'Impossible de joindre le serveur : vérifiez votre connexion internet.';
    if (/JWT|expired|refresh_token/i.test(m)) return 'Votre session a expiré : reconnectez-vous.';
    if (/new row violates row-level security|permission denied|42501/i.test(m)) return 'Action non autorisée pour votre rôle sur ce document.';
    if (/schema cache|Could not find the (function|table)/i.test(m)) return 'Le serveur de la Live Modification n\'est pas encore installé (script supabase/collab.sql à exécuter dans Supabase).';
    if (/MissingPartition|unable to find the expected messages partition/i.test(m)) return 'Le temps réel du serveur n\'est pas encore prêt : réessayez dans quelques minutes.';
    return m || 'Erreur inattendue.';
  }
  const must = async p => { const r = await p; if (r.error) throw new Error(fr(r.error)); return r.data; };

  /* ---------- Compte ---------- */
  async function signUp(mail, password, nick) {
    const r = await client().auth.signUp({ email: mail.trim().toLowerCase(), password, options: { data: { pseudo: nick.trim() }, emailRedirectTo: ACCOUNT_URL } });
    if (r.error) throw new Error(fr(r.error));
    // Adresse déjà inscrite : Supabase ne le dit pas (anti-énumération) et renvoie un compte sans identité
    const already = r.data && r.data.user && Array.isArray(r.data.user.identities) && r.data.user.identities.length === 0;
    return { needsConfirm: !r.data.session, already };
  }
  async function signIn(mail, password) {
    await must(client().auth.signInWithPassword({ email: mail.trim().toLowerCase(), password }));
    await loadProfile();
  }
  const resend = mail => must(client().auth.resend({ type: 'signup', email: mail.trim().toLowerCase(), options: { emailRedirectTo: ACCOUNT_URL } }));
  const resetPassword = mail => must(client().auth.resetPasswordForEmail(mail.trim().toLowerCase(), { redirectTo: ACCOUNT_URL }));
  async function signOut() { if (L.Collab) L.Collab.leave(true); await client().auth.signOut(); state.profile = null; emit(); }
  async function setPseudo(nick) {
    nick = nick.trim().slice(0, 40);
    if (!nick) throw new Error('Choisissez un pseudo.');
    await must(client().from('profiles').update({ pseudo: nick }).eq('id', uid()));
    await client().auth.updateUser({ data: { pseudo: nick } });
    state.profile = { pseudo: nick }; emit();
  }
  const setPassword = pw => must(client().auth.updateUser({ password: pw }));
  async function deleteAccount() { await must(client().rpc('lhe_delete_account')); await client().auth.signOut(); state.profile = null; emit(); }

  /* ---------- Documents en ligne ---------- */
  const myDocs = () => must(client().rpc('lhe_my_docs'));
  async function createDoc(title) {
    const d = await must(client().from('collab_docs').insert({ title: (title || '').slice(0, 300) }).select('id').single());
    return d.id;
  }
  const openDoc = id => must(client().rpc('lhe_open_doc', { p_doc: id }));
  async function fetchUpdates(id, after) {
    const out = [];
    for (let from = after || 0; ;) {
      const rows = await must(client().from('collab_updates').select('id, data').eq('doc_id', id).gt('id', from).order('id').limit(500));
      out.push(...rows);
      if (rows.length < 500) break;
      from = rows[rows.length - 1].id;
    }
    return out;
  }
  const pushUpdate = (id, data) => must(client().from('collab_updates').insert({ doc_id: id, data }));
  const compact = (id, snapshot, upto) => must(client().rpc('lhe_compact', { p_doc: id, p_snapshot: snapshot, p_upto: upto }));
  const renameDoc = (id, title) => must(client().from('collab_docs').update({ title: (title || '').slice(0, 300) }).eq('id', id));
  const deleteDoc = id => must(client().from('collab_docs').delete().eq('id', id));

  /* ---------- Personnes ---------- */
  const people = id => must(client().rpc('lhe_doc_people', { p_doc: id }));
  const invite = (id, mail, role) => must(client().rpc('lhe_invite', { p_doc: id, p_email: mail, p_role: role }));
  const removeMember = (id, mail) => must(client().rpc('lhe_remove_member', { p_doc: id, p_email: mail }));
  /* E-mail d'invitation envoyé par le serveur (fonction « send-invite ») ; si elle
     n'est pas installée, l'appelant propose d'écrire l'e-mail soi-même. */
  async function notifyInvite(id, mail) {
    const r = await client().functions.invoke('send-invite', { body: { doc_id: id, email: mail } });
    if (r.error) {
      let msg = r.error.message;
      try { const b = await r.error.context.json(); if (b && b.error) msg = b.error; } catch (e) { /* pas de détail */ }
      throw new Error(msg);
    }
    return r.data;
  }

  /* ---------- Commentaires ---------- */
  const comments = id => must(client().rpc('lhe_comments', { p_doc: id }));
  const addComment = (id, body, anchor, parent) => must(client().from('collab_comments').insert({ doc_id: id, body, anchor: anchor || null, parent: parent || null }));
  const updateComment = (cid, body, resolved) => must(client().rpc('lhe_comment_update', { p_id: cid, p_body: body === undefined ? null : body, p_resolved: resolved === undefined ? null : resolved }));
  const deleteComment = cid => must(client().from('collab_comments').delete().eq('id', cid));

  /* ---------- Canal temps réel privé d'un document ----------
     h = { onUpdate(b64), onDbUpdate(row), onCursor(p), onPresence(list), onComments(), onMembers(ev), onStatus(s) } */
  function channel(id, h) {
    const c = client();
    if (state.session) c.realtime.setAuth(state.session.access_token);
    const tab = Math.random().toString(36).slice(2, 8);
    const ch = c.channel('doc:' + id, { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: uid() + ':' + tab } } });
    ch.on('broadcast', { event: 'y' }, m => h.onUpdate && h.onUpdate(m.payload && m.payload.u))
      .on('broadcast', { event: 'cursor' }, m => h.onCursor && h.onCursor(m.payload))
      .on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState(), list = [];
        Object.keys(st).forEach(k => st[k].forEach(p => list.push(p)));
        h.onPresence && h.onPresence(list);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_updates', filter: 'doc_id=eq.' + id }, m => h.onDbUpdate && h.onDbUpdate(m.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_comments', filter: 'doc_id=eq.' + id }, () => h.onComments && h.onComments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_members', filter: 'doc_id=eq.' + id }, m => h.onMembers && h.onMembers(m));
    ch.subscribe((status, err) => { h.onStatus && h.onStatus(status, err); });
    return {
      tab,
      send: (event, payload) => ch.send({ type: 'broadcast', event, payload }).catch(() => {}),
      track: meta => ch.track(meta).catch(() => {}),
      close: () => { try { c.removeChannel(ch); } catch (e) { /* déjà fermé */ } },
    };
  }

  /* Liens vers un document en ligne : …/d/#<uuid> ou lhe://d/<uuid> */
  const DOC_RE = /(?:latex-home-edition\/d\/?#|lhe:\/\/d\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const docLink = id => DOC_URL + '#' + id;

  L.Cloud = {
    init, onChange, state, user, uid, email, pseudo, fr, client,
    signUp, signIn, resend, resetPassword, signOut, setPseudo, setPassword, deleteAccount,
    myDocs, createDoc, openDoc, fetchUpdates, pushUpdate, compact, renameDoc, deleteDoc,
    people, invite, removeMember, notifyInvite,
    comments, addComment, updateComment, deleteComment,
    channel, DOC_RE, docLink, ACCOUNT_URL,
    available: () => !!(window.supabase && window.supabase.createClient),
  };
})();
