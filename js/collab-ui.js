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
  const unavailable = () => { L.toast('La Live Modification a besoin du module de connexion, qui n\'a pas pu être chargé.', 'err'); };

  /* ================= Connexion / inscription ================= */
  L.dlgAuth = function (mode, onDone) {
    if (!C().available()) return unavailable();
    let dlg = null;
    const body = L.h('div', { class: 'auth' });
    const tabs = L.h('div', { class: 'seg auth-tabs' });
    const setMode = m => { mode = m; build(); };
    const build = () => {
      tabs.replaceChildren(
        L.h('button', { class: mode === 'login' || mode === 'reset' ? 'on' : '', text: 'Se connecter', onclick: () => setMode('login') }),
        L.h('button', { class: mode === 'signup' || mode === 'sent' ? 'on' : '', text: 'Créer un compte', onclick: () => setMode('signup') }));
      const err = errBox();
      let form;
      if (mode === 'login') {
        const em = input('email', 'vous@exemple.fr', 'username'), pw = input('password', 'Mot de passe', 'current-password');
        em.value = L.Collab && body.dataset.email || '';
        const go = L.h('button', { class: 'btn primary', text: 'Se connecter' });
        const resend = L.h('button', { class: 'linkish', text: 'Renvoyer l\'e-mail de confirmation', hidden: true, onclick: async () => {
          try { await C().resend(em.value); L.toast('E-mail de confirmation renvoyé à ' + em.value.trim()); } catch (e) { showErr(err, e); }
        } });
        const submit = async () => {
          err.hidden = true; resend.hidden = true;
          if (!em.value.trim() || !pw.value) return showErr(err, 'Indiquez votre adresse e-mail et votre mot de passe.');
          busy(go, true, 'Connexion…');
          try {
            await C().signIn(em.value, pw.value);
            dlg.close();
            L.toast('Connecté : ' + C().pseudo());
            if (onDone) onDone();
          } catch (e) { showErr(err, e); if (/confirm/i.test(e.message)) resend.hidden = false; busy(go, false, 'Se connecter'); }
        };
        pw.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        go.onclick = submit;
        form = L.h('div', { class: 'auth-form' },
          field('Adresse e-mail', em), field('Mot de passe', pw), err, resend,
          L.h('div', { class: 'auth-acts' }, go, L.h('button', { class: 'linkish', text: 'Mot de passe oublié ?', onclick: () => { body.dataset.email = em.value; setMode('reset'); } })));
        setTimeout(() => (em.value ? pw : em).focus(), 30);
      } else if (mode === 'reset') {
        const em = input('email', 'vous@exemple.fr', 'username'); em.value = body.dataset.email || '';
        const go = L.h('button', { class: 'btn primary', text: 'Recevoir un lien pour choisir un nouveau mot de passe' });
        go.onclick = async () => {
          err.hidden = true;
          busy(go, true, 'Envoi…');
          try { await C().resetPassword(em.value); form.replaceChildren(L.h('div', { class: 'auth-ok' }, L.h('b', { text: '✉ E-mail envoyé' }), L.h('p', { text: 'Si un compte existe pour ' + em.value.trim() + ', un lien vient d\'y être envoyé. Ouvrez-le pour choisir un nouveau mot de passe (pensez aux courriers indésirables).' }))); }
          catch (e) { showErr(err, e); busy(go, false, 'Réessayer'); }
        };
        form = L.h('div', { class: 'auth-form' }, L.h('p', { class: 'auth-p', text: 'Indiquez l\'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.' }), field('Adresse e-mail', em), err, L.h('div', { class: 'auth-acts' }, go, L.h('button', { class: 'linkish', text: 'Retour', onclick: () => setMode('login') })));
      } else if (mode === 'signup') {
        const nk = input('text', 'Ex. : Marie D.', 'nickname'), em = input('email', 'vous@exemple.fr', 'email'), pw = input('password', 'Au moins 8 caractères, lettres et chiffres', 'new-password'), pw2 = input('password', 'Retapez le mot de passe', 'new-password');
        nk.maxLength = 40;
        const go = L.h('button', { class: 'btn primary', text: 'Créer mon compte' });
        go.onclick = async () => {
          err.hidden = true;
          if (!nk.value.trim()) return showErr(err, 'Choisissez un pseudo : c\'est le nom affiché à côté de votre curseur.');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())) return showErr(err, 'Cette adresse e-mail n\'est pas valide.');
          if (!pwOk(pw.value)) return showErr(err, 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.');
          if (pw.value !== pw2.value) return showErr(err, 'Les deux mots de passe ne correspondent pas.');
          busy(go, true, 'Création…');
          try {
            await C().signUp(em.value, pw.value, nk.value);
            body.dataset.email = em.value.trim();
            setMode('sent');
          } catch (e) { showErr(err, e); busy(go, false, 'Créer mon compte'); }
        };
        form = L.h('div', { class: 'auth-form' },
          field('Pseudo', nk, 'Affiché à côté de votre curseur et de vos commentaires.'),
          field('Adresse e-mail', em, 'C\'est l\'adresse à laquelle on vous invitera à modifier des documents.'),
          field('Mot de passe', pw), field('Confirmer le mot de passe', pw2), err,
          L.h('p', { class: 'auth-small', text: 'Un e-mail de confirmation vous sera envoyé : le compte n\'est actif qu\'après un clic sur son lien. C\'est ce qui garantit que personne ne peut utiliser votre adresse — et donc accéder aux documents partagés avec vous. Seuls votre adresse et votre pseudo sont conservés.' }),
          L.h('div', { class: 'auth-acts' }, go));
        setTimeout(() => nk.focus(), 30);
      } else {
        const mail = body.dataset.email || '';
        form = L.h('div', { class: 'auth-form' },
          L.h('div', { class: 'auth-ok' },
            L.h('b', { text: '✉ Vérifiez votre boîte mail' }),
            L.h('p', { text: 'Un lien de confirmation vient d\'être envoyé à ' + mail + ' (s\'il n\'y avait pas déjà un compte avec cette adresse). Cliquez dessus, puis revenez ici pour vous connecter. Pensez à regarder dans les courriers indésirables.' })),
          err,
          L.h('div', { class: 'auth-acts' },
            L.h('button', { class: 'btn primary', text: 'J\'ai confirmé : me connecter', onclick: () => setMode('login') }),
            L.h('button', { class: 'linkish', text: 'Renvoyer l\'e-mail', onclick: async () => { try { await C().resend(mail); L.toast('E-mail renvoyé'); } catch (e) { showErr(err, e); } } })));
      }
      body.replaceChildren(
        L.h('p', { class: 'auth-intro', text: 'Un compte permet de modifier des documents à plusieurs en direct (Live Modification) et de recevoir des invitations.' }),
        tabs, form);
    };
    build();
    dlg = L.modal({ title: 'Compte LaTeX Home Edition', body });
  };

  /* ================= Mon compte ================= */
  L.dlgAccount = function () {
    if (!C().user()) return L.dlgAuth('login');
    const err = errBox();
    const nk = input('text', 'Pseudo'); nk.value = C().pseudo(); nk.maxLength = 40;
    const saveNk = L.h('button', { class: 'btn', text: 'Enregistrer', onclick: async () => {
      try { await C().setPseudo(nk.value); L.toast('Pseudo enregistré'); } catch (e) { showErr(err, e); }
    } });
    const p1 = input('password', 'Nouveau mot de passe', 'new-password'), p2 = input('password', 'Confirmer', 'new-password');
    const savePw = L.h('button', { class: 'btn', text: 'Changer le mot de passe', onclick: async () => {
      err.hidden = true;
      if (!pwOk(p1.value)) return showErr(err, 'Au moins 8 caractères, avec des lettres et des chiffres.');
      if (p1.value !== p2.value) return showErr(err, 'Les deux mots de passe ne correspondent pas.');
      try { await C().setPassword(p1.value); p1.value = p2.value = ''; L.toast('Mot de passe changé'); } catch (e) { showErr(err, e); }
    } });
    let dlg;
    const body = L.h('div', { class: 'auth' },
      L.h('div', { class: 'acct-head' }, L.h('span', { class: 'avatar lg', text: K().initials(C().pseudo()), style: { background: K().colorOf(C().uid()) } }),
        L.h('div', null, L.h('b', { text: C().pseudo() }), L.h('div', { class: 'fhint', text: C().email() }))),
      field('Pseudo', L.h('div', { class: 'row-in' }, nk, saveNk)),
      L.h('details', { class: 'shr-more' }, L.h('summary', { text: 'Changer de mot de passe' }), field('Nouveau mot de passe', p1), field('Confirmer', p2), savePw),
      err,
      L.h('div', { class: 'auth-acts' },
        L.h('button', { class: 'btn', text: '☁ Mes fichiers…', onclick: () => { dlg.close(); L.Drive.dialog(); } }),
        L.h('button', { class: 'btn', text: 'Se déconnecter', onclick: async () => { await C().signOut(); dlg.close(); L.toast('Déconnecté'); } })),
      L.h('details', { class: 'shr-more danger' }, L.h('summary', { text: 'Supprimer mon compte' }),
        L.h('p', { class: 'auth-small', text: 'Supprime définitivement votre compte, les documents en ligne dont vous êtes propriétaire (pour tous leurs participants) et vos commentaires. Vos fichiers enregistrés sur l\'ordinateur ne sont pas touchés.' }),
        L.h('button', { class: 'btn danger-soft', text: 'Supprimer définitivement mon compte…', onclick: async () => {
          const v = await L.askText({ title: 'Supprimer mon compte', label: 'Pour confirmer, tapez SUPPRIMER', value: '', ok: 'Supprimer définitivement' });
          if (v !== 'SUPPRIMER') return;
          try { K().leave(true); await C().deleteAccount(); dlg.close(); L.toast('Compte supprimé'); } catch (e) { showErr(err, e); }
        } })));
    dlg = L.modal({ title: 'Mon compte', body });
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

  /* ================= Live Modification (fenêtre principale) ================= */
  let collabDlg = null, repaint = null;
  L.dlgCollab = function () {
    if (!C().available()) return unavailable();
    const body = L.h('div', { class: 'collab' });
    const build = async () => {
      const s = K().session();
      const live = App.doc.meta.live;
      if (!C().user()) {
        body.replaceChildren(
          intro(),
          L.h('div', { class: 'note info', text: 'Pour modifier à plusieurs, chacun a besoin d\'un compte (gratuit) : une adresse e-mail et un pseudo.' }),
          L.h('div', { class: 'auth-acts' },
            L.h('button', { class: 'btn primary', text: 'Créer un compte', onclick: () => { close(); L.dlgAuth('signup', () => L.dlgCollab()); } }),
            L.h('button', { class: 'btn', text: 'Se connecter', onclick: () => { close(); L.dlgAuth('login', () => L.dlgCollab()); } })));
        return;
      }
      if (!s) {
        const err = errBox();
        const go = L.h('button', { class: 'btn primary', text: live ? 'Se reconnecter au document en direct' : '⚡ Activer la Live Modification pour ce document' });
        go.onclick = async () => {
          busy(go, true, 'Mise en ligne…'); err.hidden = true;
          try { if (live) await K().open(live.id, { keepFile: true }); else await K().create(); build(); }
          catch (e) { showErr(err, e); busy(go, false, 'Réessayer'); }
        };
        body.replaceChildren(intro(),
          L.h('ul', { class: 'collab-points' },
            L.h('li', { text: 'Le document est enregistré en ligne, et chaque modification apparaît en direct chez tous les participants — avec leur curseur et leur pseudo.' }),
            L.h('li', { text: 'Vous invitez des personnes par leur adresse e-mail, en choisissant leur rôle : Éditeur, Commentateur ou Lecteur.' }),
            L.h('li', { text: 'Personne d\'autre ne peut l\'ouvrir. Vous pouvez retirer un accès ou arrêter le partage à tout moment.' })),
          err, L.h('div', { class: 'auth-acts' }, go));
        return;
      }
      /* Document en direct */
      const isOwner = s.role === 'owner';
      const people = L.h('div', { class: 'people' }, L.h('div', { class: 'shr-size', text: 'Chargement…' }));
      const parts = [
        L.h('div', { class: 'collab-state' }, L.h('span', { class: 'dot ok' }), L.h('span', { text: 'Document en direct — tout est enregistré en ligne automatiquement. Votre rôle : ' + roleName(s.role) + '.' })),
      ];
      if (isOwner) parts.push(inviteForm(s, () => loadPeople()));
      parts.push(L.h('div', { class: 'set-h', text: 'Personnes ayant accès' }), people);
      const link = C().docLink(s.id);
      parts.push(
        L.h('div', { class: 'set-h', text: 'Lien du document' }),
        L.h('div', { class: 'row-in' },
          L.h('input', { class: 'shr-short', type: 'text', readonly: true, value: link, onfocus: e => e.target.select() }),
          L.h('button', { class: 'btn', text: '⧉ Copier', onclick: () => navigator.clipboard.writeText(link).then(() => L.toast('Lien copié')) })),
        L.h('div', { class: 'fhint', text: 'Réservé aux personnes invitées : les autres verront « accès refusé ».' }),
        L.h('div', { class: 'auth-acts collab-end' },
          isOwner
            ? L.h('button', { class: 'btn danger-soft', text: 'Arrêter la Live Modification…', onclick: async () => {
              if (!confirm('Arrêter la Live Modification ? Le document en ligne sera supprimé pour toutes les personnes invitées. Vous gardez la version actuelle sur votre ordinateur.')) return;
              try { const id = s.id; K().leave(); await C().deleteDoc(id); App.commit(); L.toast('Live Modification arrêtée : le document est redevenu local'); close(); } catch (e) { L.toast(C().fr(e), 'err'); }
            } })
            : L.h('button', { class: 'btn danger-soft', text: 'Quitter ce document', onclick: async () => {
              if (!confirm('Quitter ce document ? Vous n\'y aurez plus accès (la version affichée reste sur votre ordinateur).')) return;
              try { const id = s.id; K().leave(); await C().removeMember(id, C().email()); App.commit(); close(); } catch (e) { L.toast(C().fr(e), 'err'); }
            } })));
      body.replaceChildren(...parts);
      async function loadPeople() {
        let list;
        try { list = await C().people(s.id); } catch (e) { people.replaceChildren(L.h('div', { class: 'note', text: C().fr(e) })); return; }
        const online = new Set(Array.from((K().session() || s).people.values()).map(p => p.uid));
        people.replaceChildren(...list.map(p => personRow(s, p, online.has(p.user_id), isOwner, loadPeople)));
      }
      repaint = loadPeople;
      loadPeople();
    };
    const close = () => { if (collabDlg) collabDlg.close(); };
    collabDlg = L.modal({ title: 'Live Modification', body, wide: true, onClose: () => { collabDlg = null; repaint = null; } });
    build();
  };
  const intro = () => L.h('p', { class: 'shr-intro', html: 'Modifiez ce document <b>à plusieurs, en direct</b>, comme sur Google Docs : chacun voit les modifications des autres au moment où elles sont faites, et l\'endroit où ils écrivent.' });

  function inviteForm(s, done) {
    const em = input('email', 'Adresse e-mail de la personne', 'off');
    const role = L.h('select', null, ...ROLES.map(([v, t]) => L.h('option', { value: v, text: t })));
    const notify = L.h('input', { type: 'checkbox' }); notify.checked = true;
    const err = errBox();
    const after = L.h('div', { class: 'invite-after', hidden: true });
    const go = L.h('button', { class: 'btn primary', text: 'Inviter' });
    const legend = L.h('div', { class: 'fhint roles-legend' }, ...ROLES.map(([, t, d]) => L.h('span', null, L.h('b', { text: t }), ' : ' + d + '. ')));
    const submit = async () => {
      err.hidden = true; after.hidden = true;
      const mail = em.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return showErr(err, 'Cette adresse e-mail n\'est pas valide.');
      busy(go, true, 'Invitation…');
      try {
        await C().invite(s.id, mail, role.value);
        em.value = '';
        done();
        if (notify.checked) {
          try { await C().notifyInvite(s.id, mail); L.toast('Invitation envoyée par e-mail à ' + mail); }
          catch (x) {
            if (/LHE_RATE/.test(x.message)) L.toast(mail + ' a déjà été prévenu(e) il y a moins de 10 minutes.');
            else offerMail(after, s, mail, role.value);
          }
        } else L.toast(mail + ' a maintenant accès au document');
      } catch (e) { showErr(err, e); }
      busy(go, false, 'Inviter');
    };
    em.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    go.onclick = submit;
    return L.h('div', { class: 'invite' },
      L.h('div', { class: 'set-h', text: 'Inviter quelqu\'un' }),
      L.h('div', { class: 'invite-row' }, em, role, go),
      L.h('label', { class: 'chk' }, notify, 'Prévenir la personne par e-mail'),
      legend, err, after);
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
        const sel = L.h('select', { class: 'role-sel' }, ...ROLES.map(([v, t]) => L.h('option', { value: v, text: t })));
        sel.value = p.role;
        sel.onchange = async () => { try { await C().invite(s.id, p.email, sel.value); L.toast(name + ' : ' + roleName(sel.value)); } catch (e) { L.toast(C().fr(e), 'err'); reload(); } };
        return sel;
      })()
      : L.h('span', { class: 'role-badge ' + p.role, text: roleName(p.role) });
    return L.h('div', { class: 'person' },
      L.h('span', { class: 'avatar', text: K().initials(name), style: { background: p.pending ? '#adb5bd' : K().colorOf(p.user_id) } }),
      L.h('div', { class: 'person-t' },
        L.h('b', { text: name + (me ? ' (vous)' : '') }),
        L.h('span', { class: 'fhint', text: [p.email, p.pending ? 'invitation en attente (pas encore de compte, ou adresse pas encore confirmée)' : online ? '● en ligne' : ''].filter(Boolean).join(' · ') })),
      roleCell,
      isOwner && p.role !== 'owner' ? L.h('button', { class: 'uc-x', title: 'Retirer l\'accès', text: '×', onclick: async () => {
        if (!confirm('Retirer l\'accès de ' + (p.email || name) + ' ?')) return;
        try { await C().removeMember(s.id, p.email); reload(); } catch (e) { L.toast(C().fr(e), 'err'); }
      } }) : null);
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

  L.CollabUI = { askLogin, peopleChanged: () => { if (repaint) repaint(); }, paintAccount, accountMenu, openDocUI };
})();
