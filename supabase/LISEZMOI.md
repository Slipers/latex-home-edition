# Serveur Supabase de LaTeX Home Edition

Trois fonctionnalités utilisent le projet Supabase :

| Fichier | Rôle |
|---|---|
| `partage.sql` | Liens de partage (copie importée, mises à jour de l'auteur) |
| `collab.sql` | **Live Modification** : comptes, documents en ligne, invitations, commentaires, temps réel |
| `fichiers.sql` | **Mes fichiers en ligne** : documents rangés avec le compte, privés, versions, corbeille |
| `functions/send-invite/` | E-mail d'invitation automatique (facultatif) |
| `emails/*.html` | Modèles d'e-mails en français (confirmation, mot de passe) |

Les scripts SQL peuvent être relancés sans risque : ils mettent la base à jour sans rien effacer.

## Installation de la Live Modification (une seule fois)

1. **Base de données** — *SQL Editor → New query* : coller `collab.sql`, **Run**.
2. **Comptes** — *Authentication → Sign In / Providers → Email* : activé, **Confirm email activé** (indispensable : sans confirmation, n'importe qui pourrait créer un compte avec l'adresse d'une personne invitée).
3. **Adresses de retour** — *Authentication → URL Configuration* :
   - Site URL : `https://slipers.github.io/latex-home-edition/compte/`
   - Redirect URLs : ajouter la même adresse.
4. **Envoi des e-mails** — *Authentication → Emails → SMTP Settings* → *Enable custom SMTP*. Le service d'e-mail intégré de Supabase n'envoie qu'aux membres de l'équipe du projet : sans SMTP, personne d'autre ne recevrait l'e-mail de confirmation. Avec Gmail :
   - Host `smtp.gmail.com`, Port `465`, Username : l'adresse Gmail, Password : un **mot de passe d'application** (compte Google → Sécurité → Validation en deux étapes → Mots de passe des applications), Sender email : la même adresse, Sender name : `LaTeX Home Edition`.
5. **Modèles d'e-mails** (facultatif, en français) — *Authentication → Emails → Templates* : coller `emails/confirmation.html` dans *Confirm signup* (objet : « Confirmez votre compte LaTeX Home Edition ») et `emails/mot-de-passe.html` dans *Reset Password* (objet : « Nouveau mot de passe LaTeX Home Edition »).
6. **Temps réel** — *Realtime → Settings* : désactiver **Allow public access** (seuls les canaux privés, protégés par les règles de `collab.sql`, restent possibles).
7. **E-mail d'invitation automatique** (facultatif) — *Edge Functions → Deploy a new function → Via Editor*, nom `send-invite`, coller `functions/send-invite/index.ts`, **Deploy**. Puis *Edge Functions → Secrets* : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (mêmes valeurs qu'à l'étape 4). Sans cette fonction, l'application propose d'écrire l'e-mail d'invitation depuis la messagerie de l'utilisateur.

## Installation de « Mes fichiers en ligne » (une seule fois)

*SQL Editor → New query* : coller `fichiers.sql`, **Run**. Il utilise les mêmes comptes que la Live Modification (étapes 2 à 4 ci-dessus). Le script crée seulement la table `lhe_files` et ses fonctions : il ne touche à aucune autre table et n'efface rien.

## Sécurité, en bref

- Toutes les tables sont protégées par la sécurité au niveau des lignes (RLS) ; l'application n'utilise que la clé publique.
- Le rôle de chacun sur un document (propriétaire, éditeur, commentateur, lecteur) est calculé par le serveur ; une invitation ne donne accès qu'à un compte dont l'adresse est **confirmée**.
- Les canaux temps réel `doc:<id>` sont privés : seuls les membres les reçoivent, seuls propriétaire et éditeurs y diffusent des modifications.
- « Mes fichiers en ligne » : un fichier n'est lisible que par son propriétaire, et toutes les écritures passent par des fonctions qui le vérifient. Un enregistrement depuis un autre ordinateur ne peut pas écraser sans le savoir une version plus récente, la version précédente est gardée, et « Supprimer » met à la corbeille (vidée après 30 jours). Limite : 500 fichiers et environ 45 Mo par compte.
- Les règles sont vérifiées par un banc d'essai (118 vérifications, `npm run test:sql`) exécuté sur un PostgreSQL local avant chaque changement des scripts.
