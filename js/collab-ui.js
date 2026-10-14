/* Interface de la « Live Modification » : compte (connexion, inscription,
   profil), fenêtre de partage en direct (invitations par e-mail et rôles),
   documents en ligne, préférences de l'application. */
(function () {
  const C = () => L.Cloud, K = () => L.Collab;
  const ROLES = [['editor', 'Éditeur', 'modifie le document en direct avec vous'], ['commenter', 'Commentateur', 'lit et ajoute des commentaires'], ['viewer', 'Lecteur', 'lit seulement, sans rien modifier']];
  const roleName = r => ({ owner: 'Propriétaire', editor: 'Éditeur', commenter: 'Commentateur', viewer: 'Lecteur' }[r] || r);
  const errBox = () => L.h('div', { class: 'note', hidden: true });
  const showErr = (box, e) => { box.hidden = false; box.textContent = typeof e === 'string' ? e : C().fr(e); };
  const field = (label, input, hint) => L.h('div', { class: 'field' }, L.h('label', { text: label }), input, hint ? L.h('div', { class: 'fhint', text: hint }) : null);
  const input = (type, ph, auto) => L.h('input', { type, placeholder: ph || '', autocomplete: auto || 'off', spellcheck: 'false' });
  const pwOk = p => p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
  const busy = (btn, on, txt) => { btn.disabled = on; if (txt) btn.textContent = txt; };
  /* Anti-spam des boutons qui envoient un e-mail : un seul envoi à la fois, puis un délai
     (affiché sur le bouton) avant de pouvoir recommencer. Le délai est gardé même si l'on
     ferme la fenêtre ou relance l'application. Le serveur a ses propres limites en plus. */
  const DELAY_KEY = 'lhe-delai-';
  const waitLeft = key => { try { return Math.max(0, Math.ceil(((+localStorage.getItem(DELAY_KEY + key) || 0) - Date.now()) / 1000)); } catch (e) { return 0; } };
  const startWait = (key, s) => { try { localStorage.setItem(DELAY_KEY + key, String(Date.now() + s * 1000)); } catch (e) { /* stockage indisponible */ } };
  function mailButton(btn, key, seconds, send) {
    const label = btn.textContent;
    let running = false, timer = null;
    const k = () => (typeof key === 'function' ? key() : key);
    const paint = () => {
      clearTimeout(timer);
      if (!btn.isConnected && timer !== null) return;
      const s = waitLeft(k());
      if (running) return;
      btn.disabled = s > 0;
      btn.textContent = s > 0 ? label + ' (' + s + ' s)' : label;
      if (s > 0) timer = setTimeout(paint, 1000);
    };
    const run = async () => {
      if (running || btn.disabled || waitLeft(k()) > 0) return;
      running = true; btn.disabled = true; btn.textContent = 'Envoi…';
      const key0 = k();
      try { if (await send() !== false) startWait(key0, seconds); }
      finally { running = false; paint(); }
    };
    btn.onclick = run;
    btn.refreshWait = paint;
    setTimeout(paint, 0);
    return run;
  }
  const unavailable = () => { L.toast('La Live Modification a besoin du module de connexion, qui n\'a pas pu être chargé.', 'err'); };

  /* ================= Éléments communs (compte, partage) ================= */
  const ico = (n, s) => L.svg(n, s || 16);
  const mailOk = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim());
  // Champ avec son libellé, une aide facultative et son propre message d'erreur
  function afield(label, control, opts = {}) {
    const msg = L.h('div', { class: 'au-msg', hidden: true });
    const f = L.h('div', { class: 'au-field' },
      L.h('div', { class: 'au-lab' }, L.h('label', { text: label }), opts.extra || null),
      control, opts.hint ? L.h('div', { class: 'fhint', text: opts.hint }) : null, opts.after || null, msg);
    f.err = t => { msg.hidden = !t; msg.textContent = t || ''; f.classList.toggle('bad', !!t); };
    return f;
  }
  // Mot de passe avec le bouton « afficher / masquer »
  function pwInput(ph, auto) {
    const i = input('password', ph, auto);
    const eye = L.h('button', { type: 'button', class: 'au-eye', title: 'Afficher le mot de passe', tabindex: '-1' }, ico('eye'));
    eye.onclick = () => {
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      eye.replaceChildren(ico(show ? 'eyeOff' : 'eye'));
      eye.title = show ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
    };
    const w = L.h('div', { class: 'au-pw' }, i, eye);
    w.input = i;
    return w;
  }
  // Critères du mot de passe, cochés au fur et à mesure de la frappe
  function pwRules(i) {
    const rules = [['8 caractères', p => p.length >= 8], ['une lettre', p => /[a-zA-Z]/.test(p)], ['un chiffre', p => /\d/.test(p)]];
    const box = L.h('div', { class: 'au-rules' });
    const paint = () => box.replaceChildren(...rules.map(([t, ok]) => L.h('span', { class: 'au-rule' + (ok(i.value) ? ' ok' : '') }, ico(ok(i.value) ? 'check' : 'x', 12), t)));
    i.addEventListener('input', paint);
    paint();
    return box;
  }

  /* ================= Connexion / inscription =================
     Fenêtre en deux parties : à gauche ce qu'apporte un compte, à droite le formulaire
     (se connecter, créer un compte, mot de passe oublié, e-mail envoyé). */
  L.dlgAuth = function (mode, onDone) {
    if (!C().available()) return unavailable();
    let dlg = null, email = '';
    const main = L.h('div', { class: 'au-main' });
    const point = (icon, t) => L.h('li', null, L.h('span', { class: 'au-pt-ic' }, ico(icon, 16)), L.h('span', { text: t }));
    const side = L.h('div', { class: 'au-side' },
      L.h('div', { class: 'au-brand' }, L.h('span', { class: 'logo', text: '∑' }), L.h('span', { html: 'LaTeX <b>Home</b> Edition' })),
      L.h('h3', { text: 'Un compte pour travailler à plusieurs' }),
      L.h('ul', { class: 'au-points' },
        point('users', 'Modifier un document à plusieurs, en direct'),
        point('cloud', 'Retrouver vos fichiers en ligne, sur tous vos ordinateurs'),
        point('mail', 'Recevoir les invitations de vos camarades et professeurs')),
      L.h('div', { class: 'au-foot' }, ico('shield', 14), L.h('span', { text: 'Gratuit. Seuls votre adresse e-mail et votre pseudo sont conservés.' })));
    const setMode = m => { mode = m; build(); };
    const tabs = () => L.h('div', { class: 'seg au-tabs' },
      L.h('button', { class: mode === 'login' ? 'on' : '', text: 'Se connecter', onclick: () => setMode('login') }),
      L.h('button', { class: mode === 'signup' ? 'on' : '', text: 'Créer un compte', onclick: () => setMode('signup') }));
    const title = (t, sub) => L.h('div', { class: 'au-title' }, L.h('h2', { text: t }), sub ? L.h('p', { text: sub }) : null);
    const switchLine = (t, lab, m) => L.h('div', { class: 'au-switch' }, t + ' ', L.h('button', { class: 'linkish', text: lab, onclick: () => setMode(m) }));

    const build = () => {
      const err = errBox();
      if (mode === 'login') {
        const em = input('email', 'vous@exemple.fr', 'username'), pw = pwInput('Votre mot de passe', 'current-password');
        em.value = email;
        const fEm = afield('Adresse e-mail', em), fPw = afield('Mot de passe', pw, { extra: L.h('button', { class: 'linkish', text: 'Mot de passe oublié ?', onclick: () => { email = em.value; setMode('reset'); } }) });
        const go = L.h('button', { class: 'btn primary big wide', text: 'Se connecter' });
        const resend = L.h('button', { class: 'linkish', text: 'Renvoyer l\'e-mail de confirmation', hidden: true });
        mailButton(resend, () => 'confirm:' + em.value.trim().toLowerCase(), 60, async () => {
          try { await C().resend(em.value); L.toast('E-mail de confirmation renvoyé à ' + em.value.trim()); } catch (e) { showErr(err, e); return false; }
        });
        const submit = async () => {
          err.hidden = true; resend.hidden = true; fEm.err(''); fPw.err('');
          if (!mailOk(em.value)) return fEm.err(em.value.trim() ? 'Cette adresse e-mail n\'est pas valide.' : 'Indiquez votre adresse e-mail.');
          if (!pw.input.value) return fPw.err('Indiquez votre mot de passe.');
          busy(go, true, 'Connexion…');
          try {
            await C().signIn(em.value, pw.input.value);
            dlg.close();
            L.toast('Connecté : ' + C().pseudo());
            if (onDone) onDone();
          } catch (e) { showErr(err, e); if (/confirm/i.test(e.message)) { resend.hidden = false; resend.refreshWait(); } busy(go, false, 'Se connecter'); }
        };
        [em, pw.input].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
        go.onclick = submit;
        main.replaceChildren(tabs(), title('Bon retour !', 'Connectez-vous avec l\'adresse e-mail de votre compte.'),
          L.h('div', { class: 'au-form' }, fEm, fPw, err, resend, go),
          switchLine('Pas encore de compte ?', 'Créer un compte gratuit', 'signup'));
        setTimeout(() => (em.value ? pw.input : em).focus(), 30);
      } else if (mode === 'signup') {
        const nk = input('text', 'Ex. : Marie D.', 'nickname'), em = input('email', 'vous@exemple.fr', 'email');
        const pw = pwInput('Choisissez un mot de passe', 'new-password'), pw2 = pwInput('Retapez le mot de passe', 'new-password');
        nk.maxLength = 40; em.value = email;
        const match = L.h('div', { class: 'au-match', hidden: true });
        const paintMatch = () => { const v = pw2.input.value; match.hidden = !v; match.className = 'au-match' + (v && v === pw.input.value ? ' ok' : ''); match.replaceChildren(ico(v === pw.input.value ? 'check' : 'x', 12), v === pw.input.value ? 'Les mots de passe correspondent' : 'Les mots de passe sont différents'); };
        pw.input.addEventListener('input', paintMatch); pw2.input.addEventListener('input', paintMatch);
        const fNk = afield('Pseudo', nk, { hint: 'Affiché à côté de votre curseur et de vos commentaires.' });
        const fEm = afield('Adresse e-mail', em, { hint: 'Celle avec laquelle on vous invitera à modifier des documents.' });
        const fPw = afield('Mot de passe', pw, { after: pwRules(pw.input) });
        const fPw2 = afield('Confirmer le mot de passe', pw2, { after: match });
        const go = L.h('button', { class: 'btn primary big wide', text: 'Créer mon compte' });
        let signing = false;
        go.onclick = async () => {
          if (signing) return;
          err.hidden = true; [fNk, fEm, fPw, fPw2].forEach(f => f.err(''));
          const wait = waitLeft('signup:' + em.value.trim().toLowerCase());
          if (wait) return showErr(err, 'Un e-mail vient d\'être envoyé à cette adresse : patientez ' + wait + ' s avant de recommencer.');
          let bad = false;
          if (!nk.value.trim()) { fNk.err('Choisissez un pseudo : c\'est le nom affiché à côté de votre curseur.'); bad = true; }
          if (!mailOk(em.value)) { fEm.err('Cette adresse e-mail n\'est pas valide.'); bad = true; }
          if (!pwOk(pw.input.value)) { fPw.err('Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.'); bad = true; }
          else if (pw.input.value !== pw2.input.value) { fPw2.err('Les deux mots de passe ne correspondent pas.'); bad = true; }
          if (bad) return;
          busy(go, true, 'Création…'); signing = true;
          try {
            await C().signUp(em.value, pw.input.value, nk.value);
            startWait('signup:' + em.value.trim().toLowerCase(), 60);
            startWait('confirm:' + em.value.trim().toLowerCase(), 60);
            email = em.value.trim();
            setMode('sent');
          } catch (e) { showErr(err, e); busy(go, false, 'Créer mon compte'); }
          signing = false;
        };
        main.replaceChildren(tabs(), title('Créer un compte', 'Gratuit, en une minute.'),
          L.h('div', { class: 'au-form' }, fNk, fEm, fPw, fPw2, err,
            L.h('p', { class: 'au-small', text: 'Un e-mail de confirmation vous sera envoyé : le compte n\'est actif qu\'après un clic sur son lien. C\'est ce qui garantit que personne ne peut utiliser votre adresse — et donc accéder aux documents partagés avec vous.' }),
            go),
          switchLine('Déjà un compte ?', 'Se connecter', 'login'));
        setTimeout(() => nk.focus(), 30);
      } else if (mode === 'reset') {
        const em = input('email', 'vous@exemple.fr', 'username'); em.value = email;
        const fEm = afield('Adresse e-mail du compte', em);
        const go = L.h('button', { class: 'btn primary big wide', text: 'Recevoir un lien' });
        const form = L.h('div', { class: 'au-form' }, fEm, err, go);
        mailButton(go, () => 'reset:' + em.value.trim().toLowerCase(), 60, async () => {
          err.hidden = true; fEm.err('');
          if (!mailOk(em.value)) { fEm.err('Cette adresse e-mail n\'est pas valide.'); return false; }
          try {
            await C().resetPassword(em.value);
            email = em.value.trim();
            form.replaceChildren(L.h('div', { class: 'au-done' }, L.h('span', { class: 'au-done-ic' }, ico('mail', 26)),
              L.h('b', { text: 'E-mail envoyé' }),
              L.h('p', { text: 'Si un compte existe pour ' + email + ', un lien vient d\'y être envoyé. Ouvrez-le pour choisir un nouveau mot de passe (pensez aux courriers indésirables).' })));
          } catch (e) { showErr(err, e); }
        });
        em.addEventListener('input', () => go.refreshWait());
        main.replaceChildren(title('Mot de passe oublié', 'Vous recevrez un lien pour choisir un nouveau mot de passe.'), form,
          L.h('div', { class: 'au-switch' }, L.h('button', { class: 'linkish', text: '← Retour à la connexion', onclick: () => setMode('login') })));
        setTimeout(() => em.focus(), 30);
      } else {
        const resend = L.h('button', { class: 'linkish', text: 'Renvoyer l\'e-mail' });
        mailButton(resend, 'confirm:' + email.toLowerCase(), 60, async () => { try { await C().resend(email); L.toast('E-mail renvoyé'); } catch (e) { showErr(err, e); return false; } });
        main.replaceChildren(
          L.h('div', { class: 'au-done big' }, L.h('span', { class: 'au-done-ic' }, ico('mail', 30)),
            L.h('h2', { text: 'Vérifiez votre boîte mail' }),
            L.h('p', null, 'Un lien de confirmation vient d\'être envoyé à ', L.h('b', { text: email }), ' (s\'il n\'y avait pas déjà un compte avec cette adresse). Cliquez dessus, puis revenez ici pour vous connecter.'),
            L.h('p', { class: 'au-small', text: 'Rien reçu ? Regardez dans les courriers indésirables.' })),
          err,
          L.h('div', { class: 'au-form' }, L.h('button', { class: 'btn primary big wide', text: 'J\'ai confirmé : me connecter', onclick: () => setMode('login') })),
          L.h('div', { class: 'au-switch' }, resend));
      }
    };
    build();
    dlg = L.modal({ title: 'Compte', body: L.h('div', { class: 'au' }, side, main), cls: 'auth-modal', bare: true });
  };

  /* ================= Mon compte ================= */
  L.dlgAccount = function () {
    if (!C().user()) return L.dlgAuth('login');
    const err = errBox();
    const nk = input('text', 'Pseudo'); nk.value = C().pseudo(); nk.maxLength = 40;
    const saveNk = L.h('button', { class: 'btn', text: 'Enregistrer', onclick: async () => {
      err.hidden = true;
      if (!nk.value.trim()) return showErr(err, 'Le pseudo ne peut pas être vide.');
      try { await C().setPseudo(nk.value); L.toast('Pseudo enregistré'); paintAccount(); } catch (e) { showErr(err, e); }
    } });
    const p1 = pwInput('Nouveau mot de passe', 'new-password'), p2 = pwInput('Retapez-le', 'new-password');
    const savePw = L.h('button', { class: 'btn', text: 'Changer le mot de passe', onclick: async () => {
      err.hidden = true;
      if (!pwOk(p1.input.value)) return showErr(err, 'Au moins 8 caractères, avec des lettres et des chiffres.');
      if (p1.input.value !== p2.input.value) return showErr(err, 'Les deux mots de passe ne correspondent pas.');
      try { await C().setPassword(p1.input.value); p1.input.value = p2.input.value = ''; L.toast('Mot de passe changé'); } catch (e) { showErr(err, e); }
    } });
    let dlg;
    const sec = (t, ...c) => L.h('section', { class: 'ac-sec' }, L.h('h5', { text: t }), ...c);
    const body = L.h('div', { class: 'ac' },
      L.h('div', { class: 'ac-head' },
        L.h('span', { class: 'avatar lg', text: K().initials(C().pseudo()), style: { background: K().colorOf(C().uid()) } }),
        L.h('div', { class: 'ac-id' }, L.h('b', { text: C().pseudo() }), L.h('span', { text: C().email() })),
        L.h('span', { class: 'ac-badge' }, L.h('span', { class: 'dot ok' }), 'Connecté')),
      sec('Profil', afield('Pseudo', L.h('div', { class: 'row-in' }, nk, saveNk), { hint: 'Affiché à côté de votre curseur et de vos commentaires.' })),
      L.h('details', { class: 'sh-more ac-sec' }, L.h('summary', { text: 'Changer de mot de passe' }),
        L.h('div', { class: 'sh-more-b' }, afield('Nouveau mot de passe', p1, { after: pwRules(p1.input) }), afield('Confirmer', p2), savePw)),
      err,
      L.h('div', { class: 'ac-acts' },
        L.h('button', { class: 'btn', onclick: () => { dlg.close(); L.Drive.dialog(); } }, ico('cloud', 15), 'Mes fichiers'),
        L.h('button', { class: 'btn', onclick: () => { dlg.close(); L.dlgShareHub('live'); } }, ico('users', 15), 'Partager ce document'),
        L.h('span', { class: 'sb-flex' }),
        L.h('button', { class: 'btn', onclick: async () => { await C().signOut(); dlg.close(); L.toast('Déconnecté'); } }, ico('logout', 15), 'Se déconnecter')),
      L.h('details', { class: 'sh-more danger' }, L.h('summary', { text: 'Supprimer mon compte' }),
        L.h('div', { class: 'sh-more-b' },
          L.h('p', { class: 'au-small', text: 'Supprime définitivement votre compte, les documents en ligne dont vous êtes propriétaire (pour tous leurs participants) et vos commentaires. Vos fichiers enregistrés sur l\'ordinateur ne sont pas touchés.' }),
          L.h('button', { class: 'btn danger-soft', text: 'Supprimer définitivement mon compte…', onclick: async () => {
            const v = await L.askText({ title: 'Supprimer mon compte', label: 'Pour confirmer, tapez SUPPRIMER', value: '', ok: 'Supprimer définitivement' });
            if (v !== 'SUPPRIMER') return;
            try { K().leave(true); await C().deleteAccount(); dlg.close(); L.toast('Compte supprimé'); } catch (e) { showErr(err, e); }
          } }))));
    dlg = L.modal({ title: 'Mon compte', body, cls: 'acct-modal' });
  };

  /* ================= Documents en ligne =================
     Une seule fenêtre pour tout : « Mes fichiers » (js/fichiers.js) liste les fichiers
     en ligne ET les documents Live, ceux-ci marqués « Fichier partagé ». */
  L.dlgCloudDocs = () => L.Drive.dialog();

  /* Ouvre un document en ligne (lien reçu, liste…) */
  async function openDocUI(id) {
    if (!C().available()) return unavailable();
    if (!C().user()) return L.dlgAuth('login', () => openDocUI(id));
    if (K().session() && K().session().id === id) return;
    if (App.dirty && !K().active() && !confirm('Le document actuel contient des modifications non enregistrées. L\'ouvrir quand même ? (Une copie reste dans la sauvegarde automatique.)')) return;
    L.toast('Ouverture du document en direct…');
    try { await K().open(id); App.fileHandle = null; App.filePath = null; }
    catch (e) {
      const m = C().fr(e);
      L.modal({ title: 'Document inaccessible', body: L.h('div', { class: 'auth' },
        L.h('p', { text: m }),
        /accès/.test(m) ? L.h('p', { class: 'auth-small', text: 'Vous êtes connecté avec ' + C().email() + '. Le document n\'est visible que par les personnes invitées : demandez à la personne qui l\'a partagé de vous inviter avec cette adresse, ou connectez-vous avec l\'adresse invitée.' }) : null) });
    }
  }
  L.openLiveDoc = openDocUI;

  /* ================= Partager (fenêtre unique) =================
     Deux façons de partager, côte à côte :
     - « Modifier ensemble » : Live Modification, invitations par e-mail et rôles ;
     - « Envoyer une copie » : un lien, chacun importe sa propre copie (js/share.js). */
  let collabDlg = null, repaint = null;
  L.dlgShareHub = function (tab) {
    const title = L.plain(App.doc.meta.title) || 'Sans titre';
    const tabs = L.h('div', { class: 'sh-tabs', role: 'tablist' });
    const pane = L.h('div', { class: 'sh-pane' });
    let dispose = null;
    const show = id => {
      if (dispose) { dispose(); dispose = null; }
      tabs.querySelectorAll('.sh-tab').forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
      pane.replaceChildren();
      dispose = id === 'live' ? livePane(pane, () => show('copy')) : L.Share.copyPane(pane, { toLive: () => show('live') });
    };
    const tabBtn = (id, icon, t, d) => L.h('button', { class: 'sh-tab', 'data-tab': id, role: 'tab', onclick: () => show(id) },
      L.h('span', { class: 'sh-tab-ic' }, ico(icon, 19)), L.h('span', { class: 'sh-tab-t' }, L.h('b', { text: t }), L.h('small', { text: d })));
    tabs.append(
      tabBtn('live', 'users', 'Modifier ensemble', 'En direct, chacun avec son compte'),
      tabBtn('copy', 'link', 'Envoyer une copie', 'Un lien : chacun reçoit sa copie'));
    const body = L.h('div', { class: 'sh' },
      L.h('div', { class: 'sh-head' }, L.h('h2', { text: 'Partager' }), L.h('span', { class: 'sh-doc', text: '« ' + title + ' »', title })),
      tabs, pane);
    collabDlg = L.modal({ title: 'Partager', body, cls: 'share-modal', bare: true, onClose: () => { if (dispose) dispose(); dispose = null; collabDlg = null; repaint = null; } });
    show(tab === 'copy' ? 'copy' : 'live');
  };
  L.dlgCollab = () => L.dlgShareHub('live');

  /* Volet « Modifier ensemble » */
  function livePane(host, toCopy) {
    let gone = false;
    const reopen = () => L.dlgShareHub('live');   // après la connexion, retour à cette fenêtre
    const empty = (cta, note) => L.h('div', { class: 'sh-empty' },
      L.h('div', { class: 'sh-avs' }, ...[['M', '#e8590c'], ['N', '#1971c2'], ['L', '#2b8a3e']].map(([t, c]) => L.h('span', { class: 'avatar', text: t, style: { background: c } })),
        L.h('span', { class: 'sh-live-dot' })),
      L.h('h3', { text: 'Écrivez à plusieurs, en même temps' }),
      L.h('ul', { class: 'sh-points' },
        L.h('li', null, ico('check', 15), 'Chacun voit les modifications des autres au moment où elles sont faites, avec leur curseur et leur pseudo.'),
        L.h('li', null, ico('check', 15), 'Vous invitez par adresse e-mail et choisissez le rôle : éditeur, commentateur ou lecteur.'),
        L.h('li', null, ico('check', 15), 'Personne d\'autre ne peut ouvrir le document ; vous pouvez retirer un accès à tout moment.')),
      cta, note || null);
    const build = () => {
      const s = K().session();
      const live = App.doc.meta.live;
      if (!C().user()) {
        host.replaceChildren(empty(
          L.h('div', { class: 'sh-cta' },
            L.h('div', { class: 'sh-row' },
              L.h('button', { class: 'btn primary big', text: 'Créer un compte gratuit', onclick: () => L.dlgAuth('signup', reopen) }),
              L.h('button', { class: 'btn big', text: 'J\'ai déjà un compte', onclick: () => L.dlgAuth('login', reopen) })),
            L.h('div', { class: 'sh-foot' }, ico('user', 13), 'Chaque participant a besoin d\'un compte : une adresse e-mail et un pseudo.'))));
        return;
      }
      if (!s) {
        const err = errBox();
        const go = L.h('button', { class: 'btn primary big' }, ico('bolt', 16), L.h('span', { text: live ? 'Se reconnecter au document en direct' : 'Démarrer la modification en direct' }));
        go.onclick = async () => {
          go.disabled = true; go.lastChild.textContent = 'Mise en ligne…'; err.hidden = true;
          try { if (live) await K().open(live.id, { keepFile: true }); else await K().create(); build(); }
          catch (e) { showErr(err, e); go.disabled = false; go.lastChild.textContent = 'Réessayer'; }
        };
        host.replaceChildren(empty(L.h('div', { class: 'sh-cta' }, go,
          L.h('div', { class: 'sh-foot' }, ico('lock', 13), 'Le document est enregistré en ligne (serveur en Europe) et visible seulement par les personnes que vous invitez.')), err));
        return;
      }
      /* Document en direct */
      const isOwner = s.role === 'owner';
      const people = L.h('div', { class: 'sh-people' }, L.h('div', { class: 'shr-size', text: 'Chargement…' }));
      const count = L.h('span', { class: 'sh-count' });
      const link = C().docLink(s.id);
      const linkIn = L.h('input', { class: 'sh-input mono', type: 'text', readonly: true, value: link, onfocus: e => e.target.select() });
      host.replaceChildren(...[
        L.h('div', { class: 'sh-status' }, L.h('span', { class: 'dot ok' }),
          L.h('span', null, L.h('b', { text: 'En direct' }), ' — tout est enregistré en ligne automatiquement.'),
          L.h('span', { class: 'role-badge ' + s.role, text: 'Vous : ' + roleName(s.role) })),
        isOwner ? inviteForm(s, () => loadPeople()) : null,
        L.h('div', { class: 'sh-label' }, 'Personnes ayant accès', count),
        people,
        L.h('div', { class: 'sh-label', text: 'Lien du document' }),
        L.h('div', { class: 'sh-linkrow' }, linkIn,
          L.h('button', { class: 'btn', onclick: () => navigator.clipboard.writeText(link).then(() => L.toast('Lien copié')) }, ico('copy', 15), 'Copier')),
        L.h('div', { class: 'sh-foot' }, ico('lock', 13), 'Réservé aux personnes invitées : les autres verront « accès refusé ».'),
        L.h('div', { class: 'sh-row sh-end' },
          isOwner
            ? L.h('button', { class: 'btn danger-soft', text: 'Arrêter la modification en direct…', onclick: async () => {
              if (!confirm('Arrêter la Live Modification ? Le document en ligne sera supprimé pour toutes les personnes invitées. Vous gardez la version actuelle sur votre ordinateur.')) return;
              try { const id = s.id; K().leave(); await C().deleteDoc(id); App.commit(); L.toast('Live Modification arrêtée : le document est redevenu local'); build(); } catch (e) { L.toast(C().fr(e), 'err'); }
            } })
            : L.h('button', { class: 'btn danger-soft', text: 'Quitter ce document…', onclick: async () => {
              if (!confirm('Quitter ce document ? Vous n\'y aurez plus accès (la version affichée reste sur votre ordinateur).')) return;
              try { const id = s.id; K().leave(); await C().removeMember(id, C().email()); App.commit(); build(); } catch (e) { L.toast(C().fr(e), 'err'); }
            } }))].filter(Boolean));
      async function loadPeople() {
        if (gone) return;
        let list;
        try { list = await C().people(s.id); } catch (e) { people.replaceChildren(L.h('div', { class: 'note', text: C().fr(e) })); return; }
        if (gone) return;
        const online = new Set(Array.from((K().session() || s).people.values()).map(p => p.uid));
        count.textContent = String(list.length);
        people.replaceChildren(...list.map(p => personRow(s, p, online.has(p.user_id), isOwner, loadPeople)));
      }
      repaint = loadPeople;
      loadPeople();
    };
    build();
    return () => { gone = true; repaint = null; };
  }

  function inviteForm(s, done) {
    const em = input('email', 'Adresse e-mail de la personne à inviter', 'off');
    const role = L.h('select', { class: 'sh-select' }, ...ROLES.map(([v, t]) => L.h('option', { value: v, text: t })));
    const notify = L.h('input', { type: 'checkbox' }); notify.checked = true;
    const err = errBox();
    const after = L.h('div', { class: 'invite-after', hidden: true });
    const go = L.h('button', { class: 'btn primary', text: 'Inviter' });
    const desc = L.h('span', { class: 'sh-roledesc' });
    const paintDesc = () => { const r = ROLES.find(x => x[0] === role.value); desc.textContent = r ? r[1] + ' : ' + r[2] + '.' : ''; };
    role.onchange = paintDesc; paintDesc();
    const submit = mailButton(go, 'invite', 3, async () => {
      err.hidden = true; after.hidden = true;
      const mail = em.value.trim().toLowerCase();
      if (!mailOk(mail)) { showErr(err, 'Cette adresse e-mail n\'est pas valide.'); return false; }
      try {
        await C().invite(s.id, mail, role.value);
        em.value = '';
        done();
        if (notify.checked && waitLeft('invite-mail:' + s.id + ':' + mail)) L.toast(mail + ' a déjà été prévenu(e) il y a moins de 10 minutes : pas de nouvel e-mail.');
        else if (notify.checked) {
          startWait('invite-mail:' + s.id + ':' + mail, 600);
          try { await C().notifyInvite(s.id, mail); L.toast('Invitation envoyée par e-mail à ' + mail); }
          catch (x) {
            if (/LHE_RATE/.test(x.message)) L.toast(mail + ' a bien accès au document, mais aucun e-mail n\'est parti : cette personne a déjà été prévenue il y a moins de 10 minutes, ou vous avez envoyé beaucoup d\'invitations en une heure.');
            else offerMail(after, s, mail, role.value);
          }
        } else L.toast(mail + ' a maintenant accès au document');
      } catch (e) {
        showErr(err, /LHE_RATE|Trop d/.test(String(e.message)) ? 'Trop d\'invitations en peu de temps : patientez quelques minutes avant de recommencer.' : e);
        return false;
      }
    });
    em.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    return L.h('div', { class: 'sh-invite' },
      L.h('div', { class: 'sh-label', text: 'Inviter quelqu\'un' }),
      L.h('div', { class: 'sh-invrow' }, L.h('div', { class: 'sh-inwrap' }, ico('mail', 16), em), role, go),
      L.h('div', { class: 'sh-invsub' },
        L.h('label', { class: 'chk sw' }, notify, L.h('span', { class: 'sw-t' }), L.h('span', { class: 'sw-l', text: 'Prévenir par e-mail' })),
        desc),
      err, after);
  }
  /* L'e-mail automatique n'est pas disponible : on prépare l'e-mail dans la messagerie de l'utilisateur */
  function offerMail(box, s, mail, role) {
    const title = L.plain(App.doc.meta.title) || 'Sans titre';
    const link = C().docLink(s.id);
    const text = 'Bonjour,\n\n' + C().pseudo() + ' vous invite à ' + ({ editor: 'modifier', commenter: 'commenter', viewer: 'lire' }[role]) + ' le document « ' + title + ' » dans LaTeX Home Edition, en direct.\n\n'
      + 'Ouvrir le document : ' + link + '\n\n'
      + 'Il faut un compte LaTeX Home Edition créé avec cette adresse e-mail (' + mail + '). Pas encore l\'application ? Elle est gratuite (Windows et Mac) : https://github.com/Slipers/latex-home-edition/releases/latest\n';
    box.hidden = false;
    box.replaceChildren(
      L.h('span', { text: '✓ ' + mail + ' a accès au document. L\'envoi automatique d\'e-mails n\'est pas configuré : prévenez cette personne vous-même.' }),
      L.h('div', { class: 'row-in' },
        L.h('button', { class: 'btn small', text: '✉ Écrire l\'e-mail d\'invitation', onclick: () => window.open('mailto:' + encodeURIComponent(mail) + '?subject=' + encodeURIComponent('Invitation : « ' + title + ' »') + '&body=' + encodeURIComponent(text)) }),
        L.h('button', { class: 'btn small', text: 'Copier le message', onclick: () => navigator.clipboard.writeText(text).then(() => L.toast('Message copié')) })));
  }
  function personRow(s, p, online, isOwner, reload) {
    const me = p.user_id && p.user_id === C().uid();
    const name = p.pseudo || (p.email ? p.email.split('@')[0] : 'Invité');
    const roleCell = isOwner && p.role !== 'owner'
      ? (() => {
        const sel = L.h('select', { class: 'sh-select small' }, ...ROLES.map(([v, t]) => L.h('option', { value: v, text: t })));
        sel.value = p.role;
        sel.onchange = async () => { try { await C().invite(s.id, p.email, sel.value); L.toast(name + ' : ' + roleName(sel.value)); } catch (e) { L.toast(C().fr(e), 'err'); reload(); } };
        return sel;
      })()
      : L.h('span', { class: 'role-badge ' + p.role, text: roleName(p.role) });
    const state = p.pending ? L.h('span', { class: 'sh-pending', title: 'Pas encore de compte avec cette adresse, ou adresse pas encore confirmée', text: 'Invitation en attente' })
      : online ? L.h('span', { class: 'sh-online' }, L.h('span', { class: 'dot ok' }), 'en ligne') : null;
    return L.h('div', { class: 'sh-person' + (p.pending ? ' pending' : '') },
      L.h('span', { class: 'avatar', text: K().initials(name), style: { background: p.pending ? '#adb5bd' : K().colorOf(p.user_id) } }),
      L.h('div', { class: 'sh-person-t' },
        L.h('b', null, name + (me ? ' (vous)' : ''), state),
        L.h('span', { text: p.email || '' })),
      roleCell,
      isOwner && p.role !== 'owner' ? L.h('button', { class: 'sh-x', title: 'Retirer l\'accès', onclick: async () => {
        if (!confirm('Retirer l\'accès de ' + (p.email || name) + ' ?')) return;
        try { await C().removeMember(s.id, p.email); reload(); } catch (e) { L.toast(C().fr(e), 'err'); }
      } }, ico('x', 14)) : L.h('span', { class: 'sh-x-sp' }));
  }

  /* ================= Préférences de l'application ================= */
  L.dlgPrefs = async function () {
    const body = L.h('div', { class: 'auth' });
    if (window.lheDesktop && lheDesktop.getPrefs) {
      const prefs = await lheDesktop.getPrefs();
      const multi = L.h('input', { type: 'checkbox' }); multi.checked = !!prefs.multiInstance;
      const newWin = L.h('button', { class: 'btn', text: 'Ouvrir une nouvelle fenêtre', hidden: !prefs.multiInstance, onclick: () => lheDesktop.newWindow() });
      multi.onchange = async () => { await lheDesktop.setPrefs({ multiInstance: multi.checked }); newWin.hidden = !multi.checked; L.toast(multi.checked ? 'Plusieurs fenêtres autorisées' : 'Une seule fenêtre à la fois'); paintAccount(); };
      body.append(
        L.h('label', { class: 'chk pref' }, multi, L.h('span', null, L.h('b', { text: 'Autoriser plusieurs instances de LaTeX Home Edition' }),
          L.h('div', { class: 'fhint', text: 'Chaque nouvelle fenêtre est une instance indépendante (Ctrl+Maj+N, menu du compte, ou en relançant l\'application) : son propre document, sa sauvegarde automatique, et sa propre connexion — vous pouvez par exemple y être connecté avec un autre compte pour tester la Live Modification.' }))),
        newWin);
    } else {
      body.append(L.h('p', { class: 'auth-small', text: 'Dans la version web, ouvrez simplement l\'application dans un autre onglet pour avoir une deuxième instance.' }));
    }
    body.append(L.Theme.settingsSection());
    if (L.Spell) body.append(L.Spell.settingsSection());
    L.modal({ title: 'Préférences', body });
  };

  /* ================= Bouton du compte (en haut à droite) ================= */
  function paintAccount() {
    const b = L.$('#accountBtn');
    if (!b) return;
    const u = C().available() && C().user();
    b.replaceChildren(u
      ? L.h('span', { class: 'avatar sm', text: K().initials(C().pseudo()), style: { background: K().colorOf(C().uid()) } })
      : L.h('i', { text: '👤' }),
    L.h('span', { text: u ? C().pseudo() : 'Se connecter' }));
    b.title = u ? 'Connecté : ' + C().email() : 'Se connecter ou créer un compte';
  }
  async function accountMenu() {
    const m = L.$('#accountMenu');
    const u = C().available() && C().user();
    const multi = window.lheDesktop && lheDesktop.getPrefs ? (await lheDesktop.getPrefs()).multiInstance : false;
    const item = (t, act, sub) => L.h('button', { 'data-act': act }, t, sub ? L.h('small', { text: sub }) : null);
    m.replaceChildren(...[...(u ? [
      L.h('div', { class: 'menu-head' }, L.h('b', { text: C().pseudo() }), L.h('small', { text: C().email() })),
      item('☁ Mes fichiers…', 'drive', 'Ctrl+Maj+O'), item('⚡ Live Modification…', 'collab'), item('Mon compte…', 'account'), L.h('hr'),
    ] : [item('Se connecter…', 'login'), item('Créer un compte…', 'signup'), L.h('hr')]),
    item('Préférences…', 'prefs'),
    multi ? item('Nouvelle fenêtre', 'newwindow', 'Ctrl+Maj+N') : null,
    u ? L.h('hr') : null, u ? item('Se déconnecter', 'logout') : null].filter(Boolean));
    App.toggleMenu('#accountMenu');
  }

  /* Document ouvert en local qui est en Live Modification, sans être connecté */
  function askLogin(id) {
    const c = L.$('#updCard');
    if (!c) return;
    c.replaceChildren(
      L.h('button', { class: 'uc-x', title: 'Fermer', text: '×', onclick: () => { c.hidden = true; } }),
      L.h('div', { class: 'uc-h' }, L.h('span', { class: 'uc-dot' }), 'Document en Live Modification'),
      L.h('div', { class: 'uc-m', text: 'Connectez-vous pour retrouver la dernière version et modifier en direct avec les autres.' }),
      L.h('div', { class: 'uc-acts' },
        L.h('button', { class: 'btn primary small', text: 'Se connecter', onclick: () => { c.hidden = true; L.dlgAuth('login', () => openDocUI(id)); } }),
        L.h('button', { class: 'btn small', text: 'Plus tard', onclick: () => { c.hidden = true; } })));
    c.hidden = false;
  }

  L.CollabUI = { askLogin, peopleChanged: () => { if (repaint) repaint(); }, paintAccount, accountMenu, openDocUI, pwInput, pwRules };
})();
