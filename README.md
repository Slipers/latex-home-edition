# LaTeX Home Edition

Éditeur visuel pour écrire des documents scientifiques (comptes rendus de TP, cours, feuilles d'exercices, articles) **avec le rendu typographique de LaTeX, sans écrire de code**.

## Installer (Windows)

1. Téléchargez **`LaTeX-Home-Edition-Setup-x.y.z.exe`** depuis la page [Releases](https://github.com/Slipers/latex-home-edition/releases/latest).
2. Lancez-le. Windows peut afficher « Windows a protégé votre ordinateur » (l'application n'est pas signée numériquement) : cliquez sur **Informations complémentaires → Exécuter quand même**.
3. L'application s'ouvre depuis le raccourci du Bureau ou le menu Démarrer. Les fichiers `.lhe` s'ouvrent par double-clic.

**Mises à jour automatiques** : au démarrage (puis toutes les 4 h), l'application vérifie s'il existe une nouvelle version sur GitHub et propose de l'installer ; elle se télécharge, s'installe et l'application redémarre toute seule. Vérification manuelle : bouton **?** → « Rechercher des mises à jour ».

## Installer (macOS)

1. Téléchargez le `.dmg` qui correspond à votre Mac depuis la page [Releases](https://github.com/Slipers/latex-home-edition/releases/latest) :
   - **`LaTeX-Home-Edition-x.y.z-arm64.dmg`** pour les Mac Apple Silicon (M1, M2, M3, M4) ;
   - **`LaTeX-Home-Edition-x.y.z-x64.dmg`** pour les Mac Intel.
2. Ouvrez le `.dmg`, puis glissez **LaTeX Home Edition** dans le dossier **Applications**.
3. Au premier lancement, macOS refuse d'ouvrir une application non signée par Apple : faites un **clic droit sur l'application → Ouvrir**, puis confirmez **Ouvrir**. (Si le message persiste : **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**.) Une seule fois suffit.

Sur macOS, l'application signale les nouvelles versions et ouvre la page de téléchargement : la mise à jour se fait en remplaçant l'application dans le dossier Applications, faute de signature Apple permettant l'installation automatique. macOS 11 (Big Sur) ou plus récent.

Tout fonctionne hors ligne : les bibliothèques et les polices sont incluses dans l'application.

## Version web (sans installation)

Ouvrez **`index.html`** dans Chrome, Edge ou Firefox, ou double-cliquez sur **`Lancer.bat`**.

## Ce que l'on peut faire

| Besoin | Comment |
|---|---|
| Titres, sections numérotées | Colonne « Insérer », ou tapez `#` / `##` puis espace |
| Formule dans le texte | Bouton **Formule**, `Ctrl+M` ou tapez `$` |
| Équation centrée numérotée | Bouton **Équation**, `Ctrl+Maj+M` ou tapez `$$` |
| Théorème, définition, démonstration, exemple, remarque… | Colonne « Insérer » — numérotation automatique |
| Exercices, questions, sous-questions, corrigés | Encadré « Exercice » + liste numérotée (`Tab` pour décaler) |
| Tableaux (style professionnel « booktabs », grille, simple) | Colonne « Insérer » → Tableau |
| Images / graphiques | Glisser-déposer, coller (`Ctrl+V`), ou bloc « Image » |
| Équations chimiques | Onglet « Chimie » de l'éditeur de formules |
| Références croisées | Bouton **Référence** — les numéros restent justes |
| Bibliographie et citations | Bouton **Citation** |
| Notes de bas de page | Bouton **Note** |
| Table des matières | Réglages « Document » |
| Code informatique | Bloc « Code » (Python, C, Java, Matlab…) |
| Exécuter du code Python et voir le résultat | Module complémentaire « Exécution Python » : bouton **▶ Exécuter** sur les blocs de code Python |
| Dessiner à la souris (géométrie, courbes de fonctions, physique) sans code | Module complémentaire « TikZ visuel » : colonne « Insérer » → Dessin à la souris |
| Ajouter ou retirer des fonctions | Bouton **Modules** de l'accueil, ou 🧩 dans la barre d'outils |
| Symboles (maths, physique, chimie…) | Touche **Tab** : menu avec recherche |
| Tableau de variations / de signes | Colonne « Insérer » — exporté avec `tkz-tab` |
| Schéma-bloc (sciences de l'ingénieur) | Module complémentaire « Schémas-blocs » : colonne « Insérer » → Schéma-bloc (blocs, comparateurs, flèches tirées à la souris, formules — exporté en TikZ) |
| Tableau d'avancement (chimie) | Colonne « Insérer » — construit depuis l'équation, calcule x_max |
| Fusionner des cases de tableau | Panneau de droite du tableau |
| Tableaux / images côte à côte | Colonne « Insérer » → Objets |
| Image ou capture dans une case de tableau | Coller (Ctrl+V) dans la case, ou panneau de droite |
| Couleur du texte | Bouton **A** de la barre d'outils |
| Taille du texte (9 paliers, de « minuscule » à « maximal ») | Bouton **A A** : sélectionnez le texte, puis la taille |
| Agrandir une équation centrée | Cliquez sur l'équation → **Taille** dans le panneau de droite (ou bouton **A A**) |
| Taille du texte du document (8 pt à 20 pt) | « Document » → Mise en page → Taille du texte |
| En-têtes, pieds de page, numérotation des pages | « Document » → En-tête, pied de page (ou double-clic sur le pied de page) ; se répète sur chaque page — un rappel discret « + En-tête » apparaît en haut de chaque page tant qu'aucun n'est défini |
| Zoomer dans l'éditeur (pas seulement l'aperçu) | Pastille en bas à droite de la feuille, Ctrl + molette, ou Ctrl+/Ctrl-/Ctrl+0 |
| Forcer un numéro (ex. commencer à 0) | Panneau de droite du titre, tableau, équation… |
| Coller du code LaTeX (texte + formules) | Ctrl+V dans le document : converti en paragraphes et équations |
| Alignement d'un paragraphe | Menu ☰ de la barre, ou Ctrl+J / L / E / R |
| Texte à gauche + texte à droite sur une ligne | Menu ☰ → Espace extensible |
| Barème ou petit texte à droite d'une question | Panneau de droite → « Texte à droite », ou menu ☰ → Texte à droite |
| Numéro d'une question, supprimer / déplacer une question | Panneau de droite (curseur dans la question) |
| Renommer un encadré, une figure, un tableau | Panneau de droite → « Nom affiché » / « Nom devant le numéro » |
| Rechercher / remplacer | Ctrl+F / Ctrl+H |
| Sujets de contrôle et fiches d'exercices prêts à l'emploi | **Nouveau** → « Contrôle / Évaluation » ou « Feuille d'exercices de maths » |
| Corrigé d'un sujet de la banque | Menu **Corrigé** en haut à droite |
| Importer un PDF et le convertir | Menu **LaTeX ▾** → « Importer un PDF », ou glissez le PDF sur la feuille |
| Importer un fichier `.tex` | Même fenêtre que l'import PDF |
| Vérifier références, citations et formules | Menu **LaTeX ▾** → « Vérifier le document » |
| Partager une copie sans envoyer le fichier | **Partager ▾** → « Partager une copie par lien » |
| Modifier à plusieurs en direct (invitation par e-mail) | Bouton **⚡ Live** |
| Commenter un passage | Sélection → **💬 Commenter** (document en Live Modification) |
| Ouvrir plusieurs fenêtres | Menu du compte → **Préférences** |
| Thème sombre | **Document** → Apparence de l'application (Clair / Sombre / Comme le système) |

Tapez `/` sur une ligne vide pour chercher n'importe quel élément.

## Schémas-blocs (sciences de l'ingénieur)

Module complémentaire **Schémas-blocs** (page Modules). Une fois installé, **Insérer → Schéma-bloc** ouvre un éditeur à la souris pour les schémas d'asservissement et les chaînes fonctionnelles :

- **Modèles prêts** : boucle fermée (retour unitaire ou avec capteur), perturbation, blocs en série, boucles imbriquées, chaîne d'information / d'énergie. Tout reste modifiable.
- **Éléments** : bloc, comparateur / sommateur (signe + ou − sur chaque entrée, signes à côté ou croix ⊗), point de prélèvement, entrée, sortie, texte libre, cadre en pointillés avec titre.
- **Flèches** : survolez un élément et tirez depuis un de ses points bleus jusqu'à un autre élément ; le tracé à angles droits se fait tout seul. Lâchée dans le vide, la flèche devient une entrée ou une sortie. Un double-clic sur une flèche y pose un point de prélèvement (boucle de retour).
- **Formules** : le contenu d'un bloc et le nom d'un signal se saisissent comme une formule (fractions, indices, lettres grecques, touche **Tab** pour les symboles) ou comme du texte.
- **Construire vite** : avec un élément sélectionné, le suivant se place à sa droite, déjà relié ; avec une flèche sélectionnée, il s'insère dessus.
- Annuler / rétablir, dupliquer, copier-coller, alignement, zoom ; la barre du bas prévient si le schéma dépasse la largeur de la page.

Dans le document, un clic sur le schéma rouvre l'éditeur. L'export LaTeX produit du code TikZ ordinaire (aucun paquet supplémentaire) ; le panneau de droite permet de convertir le schéma en dessin TikZ pour le retoucher à la main. Sans le module, les schémas déjà présents dans un document restent affichés et exportés ; le panneau de droite propose le module pour les modifier.

## Dessins à la souris (TikZ visuel)

Module complémentaire **TikZ visuel** (page Modules). Une fois installé, **Insérer → Dessin à la souris** (ou `/dessin`) ouvre une feuille de dessin : aucun code à écrire, tout se règle avec des menus.

- **Outils** : point (nommé A, B, C… automatiquement), segment, flèche / vecteur, ligne brisée, polygone, rectangle, cercle, ellipse, arc, angle (arc ou angle droit), texte ou formule, quadrillage. L'outil reste actif ; **Échap** revient au choix.
- **Aimants** : la souris s'accroche à la grille (libre, 1 mm, 2,5 mm, 5 mm, 1 cm) et aux points déjà placés ; **Alt** pour placer librement.
- **Courbes de fonctions** : un **repère** gradué (pas, unités, quadrillage, graduations en multiples de π) et une **courbe** dont on écrit la formule comme en maths : `2x² − 3`, `0,5x`, `sin(x)`, `e^(−x)`, `√x`, `1/x`… La courbe est coupée proprement aux valeurs interdites et aux asymptotes, et suit son repère quand on le déplace.
- **Réglages** dans le panneau de droite : couleur, remplissage, épaisseur, tirets ou pointillés, pointes de flèche, nom et place du nom, coordonnées exactes au clavier. Les petits carrés de l'élément choisi le déforment (bouts d'un segment, rayon d'un cercle, sommets, bouts des axes…).
- **Modèles prêts** : repère et parabole, sinus et cosinus, triangle ABC, triangle rectangle, cercle trigonométrique, forces sur un objet, plan incliné, lentille convergente.
- Annuler / rétablir, dupliquer, copier-coller, premier plan / arrière-plan, zoom ; la barre du bas donne la position de la souris et prévient si le dessin dépasse la largeur de la page.

Le dessin est un bloc TikZ ordinaire : même rendu dans l'éditeur et le PDF, code TikZ standard dans l'export LaTeX (aucun paquet supplémentaire). Un clic sur le dessin le rouvre ; le panneau de droite permet de le convertir en code TikZ pour le retoucher à la main.

## Modules complémentaires

Le bouton **Modules** de l'accueil (ou 🧩 dans la barre d'outils) ouvre la page des modules : des fonctions en plus, à installer quand on veut et à désinstaller quand on veut. Trois modules sont disponibles : **Exécution Python**, **TikZ visuel** et **Schémas-blocs**. Chaque module a sa fiche (présentation, fonctionnalités, prérequis, confidentialité, nombre d'installations) et une **note sur 5 étoiles**. Désinstaller un module ne touche pas aux documents.

- **Compte nécessaire** : les modules s'installent avec un compte LaTeX Home Edition (gratuit) et sont rangés avec lui ; déconnecté, ou avec un autre compte, ils sont en pause.
- **Noter un module** : il faut l'avoir installé et s'en être servi au moins 3 fois (3 exécutions de code, 3 dessins ou 3 schémas créés ou modifiés) ; la fiche montre où l'on en est. Une note par compte, modifiable ou retirée. Cette règle est aussi vérifiée par le serveur.

### Exécution Python

- Chaque bloc de code Python reçoit un bouton **▶ Exécuter** (ou **Ctrl+Entrée** dans le code) ; le résultat s'affiche dans une **console** en bas de la fenêtre, sans modifier le document.
- Erreurs expliquées en français, avec un lien vers la ligne fautive ; commande `pip` à copier quand une bibliothèque manque.
- `input()` : les entrées se saisissent à l'avance dans la console. Bouton **Arrêter**, arrêt automatique après 60 s.
- Graphiques **matplotlib** affichés dans la console, à insérer dans le document en un clic.
- Le code s'exécute **sur l'ordinateur**, avec le Python installé (3.6 ou plus récent) : rien n'est envoyé sur Internet. À la première exécution d'un document, une confirmation est demandée (un document reçu pourrait contenir du code malveillant).
- À l'installation, le module cherche Python ; s'il manque, il propose de l'installer (Windows : Python officiel via winget, sans droits administrateur), d'ouvrir python.org, ou d'annuler.

Notes des modules côté serveur : [supabase/modules.sql](supabase/modules.sql) (voir [supabase/LISEZMOI.md](supabase/LISEZMOI.md)).

## Importer un PDF et le convertir en LaTeX

**LaTeX ▾ → « Importer un PDF et le convertir »** (ou glissez-déposez le fichier sur la feuille). Le PDF est analysé page par page et reconstruit en éléments modifiables :

- **texte** avec gras, italique, machine à écrire, césures recollées ;
- **titres et sections**, dont la numérotation d'origine est retirée puis refaite automatiquement ;
- **listes** à puces ou numérotées, **tableaux** (colonnes alignées) et **blocs de code** ;
- **formules** : lettres grecques, symboles, indices, exposants, primes et racines sont retranscrits en LaTeX ;
- **images** extraites du PDF, et pages sans texte (documents scannés) insérées en image ;
- **titre, auteur et date** repris de la page de titre ; en-têtes et pieds de page répétés ignorés.

On choisit les pages à importer, ce que l'on veut reconnaître, et si le résultat ouvre un nouveau document ou s'insère dans le document courant. Ensuite, **LaTeX ▾ → Télécharger le fichier .tex** donne le code LaTeX.

L'analyse redresse d'elle-même le texte tracé de travers (page en paysage sans indicateur de rotation) et écarte les filigranes ; le résumé de fin d'import signale ce qu'elle a fait.

### Réagencer un import raté

Si le résultat ne ressemble pas au PDF, **LaTeX ▾ → « Réagencer le PDF importé »** ouvre une comparaison **page à page** : le PDF d'origine à gauche, le résultat reconstruit à droite. On change alors l'orientation du texte, le découpage en paragraphes, la prise en compte des filigranes, des titres, des formules, des tableaux ou du code, on relance l'analyse, et on applique au document quand les deux côtés se correspondent. Le PDF reste en mémoire pour toute la session : on peut réessayer autant de fois que nécessaire.

Ce que la conversion ne sait pas faire : les fractions, matrices et intégrales complexes sortent approximatives (le texte est conservé, la structure est à retoucher), les PDF protégés ou sans couche texte ne donnent que des images, et la mise en page multicolonne est remise à plat. **LaTeX ▾ → Vérifier le document** liste justement les formules illisibles, les références cassées et les éléments vides, et amène directement dessus.

## Partager un document par lien

**Partager ▾ → « Partager une copie par lien »**, puis **« Créer le lien court »** : on obtient un lien du type `https://slipers.github.io/latex-home-edition/p/#Ab3xK9pQ2z`, cliquable partout. Pas besoin d'envoyer le fichier `.lhe`.

Celui qui clique dessus voit le titre du document et un bouton **« Ouvrir dans LaTeX Home Edition »** qui lance l'application et importe **sa propre copie**, modifiable librement (ou un lien pour installer l'application). Coller le lien dans l'application (Ctrl+V n'importe où) fonctionne aussi.

- Le document est déposé sur le serveur de partage (Supabase, en Europe) pendant un an. Seules les personnes qui ont le lien peuvent l'ouvrir : les documents partagés ne peuvent être ni listés ni devinés.
- Chaque lien peut être désactivé à tout moment (« Désactiver ce lien », ou la liste « Vos liens courts »).
- **Un seul lien par document**, au choix **en direct** (chaque modification est envoyée automatiquement) ou **figé** (« Envoyer la version actuelle » quand on le décide). Une pastille à côté du nom du document indique l'état.
- Ceux qui ont importé le document voient une carte **« Nouvelle version disponible »** (Mettre à jour / Plus tard / Ne plus suivre) ; s'ils ont modifié leur copie, une confirmation est demandée, et Ctrl+Z ramène à leur version. Leurs propres modifications ne remontent pas vers l'auteur.
- Le code qui permet de modifier un lien reste sur l'ordinateur qui l'a créé (jamais dans le fichier `.lhe`).
- **Sans connexion**, un lien long (`lhe://partage/…`) contient le document entier et ne dépose rien en ligne ; il se colle dans l'application.
- Un document reçu (lien ou fichier) est nettoyé à l'ouverture : il ne peut contenir que ce que l'éditeur produit lui-même.

Côté serveur : [supabase/partage.sql](supabase/partage.sql) (à exécuter une fois dans le SQL Editor du projet Supabase), page du lien dans [docs/p/index.html](docs/p/index.html) (GitHub Pages, branche `main`, dossier `/docs`).

## Live Modification : modifier à plusieurs en direct

Comme sur Google Docs : bouton **⚡ Live** (ou **Partager ▾ → Live Modification**), puis **« Activer la Live Modification pour ce document »**. Le document est mis en ligne et on invite des personnes **par leur adresse e-mail**, avec un rôle :

| Rôle | Peut… |
|---|---|
| **Éditeur** | modifier le document en direct |
| **Commentateur** | lire et ajouter des commentaires |
| **Lecteur** | lire seulement |

- Chaque modification apparaît **immédiatement** chez tous les participants, sans bouton « mettre à jour ». Les modifications simultanées (même dans la même phrase) se fusionnent sans rien perdre.
- On voit **où écrivent les autres** : un trait de couleur avec leur pseudo, et leur sélection surlignée. Leurs avatars sont affichés en haut, à côté de la pastille **● Live**.
- **Ctrl+Z** n'annule que ses propres modifications, jamais celles des autres.
- **Commentaires** : sélectionner un passage → **💬 Commenter** (Ctrl+Alt+M). Fils de discussion avec réponses, « Résoudre », passage commenté surligné sur la feuille.
- Tout est enregistré en ligne automatiquement ; hors connexion, les modifications sont gardées sur l'ordinateur et envoyées au retour du réseau.
- Pour modifier, chacun a besoin d'un **compte** (bouton en haut à droite, ou page [Créer un compte](https://slipers.github.io/latex-home-edition/compte/)) : pseudo, adresse e-mail et mot de passe. L'adresse est **confirmée par e-mail** : une invitation ne donne accès qu'au compte qui possède vraiment cette adresse.
- **Documents en ligne** (menu du compte) : les documents partagés avec vous et les vôtres.

Sécurité : chaque règle (qui peut lire, écrire, commenter, inviter, diffuser en temps réel) est appliquée **par le serveur**, pas seulement par l'application — voir [supabase/collab.sql](supabase/collab.sql) et son banc d'essai (`npm run test:sql`). Installation côté serveur : [supabase/LISEZMOI.md](supabase/LISEZMOI.md).

## Plusieurs fenêtres (instances)

Menu du compte → **Préférences** → « Autoriser plusieurs instances ». Chaque nouvelle fenêtre (Ctrl+Maj+N, menu du compte, ou en relançant l'application) est une instance indépendante : son propre document, sa sauvegarde automatique et sa propre connexion — on peut par exemple s'y connecter avec un autre compte.

## Banque de sujets de mathématiques

Le menu **Nouveau** propose deux entrées reliées à une banque de 80 documents originaux, avec leur corrigé :

- **Contrôle / Évaluation** : par niveau (première, terminale, prépa 1re année, prépa 2e année), **10 sujets** — 5 contrôles d'une heure et 5 devoirs de deux à trois heures, avec barème.
- **Feuille d'exercices de maths** : par niveau, **10 fiches thématiques** de 4 exercices.

Chaque sujet s'ouvre comme un document normal : modifiable, imprimable en PDF, exportable en LaTeX. Le menu **Corrigé**, en haut à droite, bascule entre l'énoncé, le corrigé et une version « énoncé + corrigé » dans un seul document.

## Sorties

- **Aperçu** : les pages A4 exactement comme dans le PDF (coupures de page, notes en bas de page, numéros de page).
- **PDF** : fenêtre d'impression → « Enregistrer au format PDF ».
- **LaTeX** : un vrai fichier `.tex`, ou un projet `.zip` avec les images, compilable avec pdfLaTeX (TeX Live, MiKTeX) ou sur Overleaf.
- **Enregistrer** : fichier `.lhe` à rouvrir plus tard. Le document en cours est aussi sauvegardé automatiquement dans le navigateur.

## Rapport avec LaTeX / LaTeX3

LaTeX3 (`expl3`) est écrit dans le langage de macros de TeX et ne peut s'exécuter que dans un moteur TeX : on ne peut pas le « brancher » tel quel dans une interface graphique. Ce logiciel adopte donc une autre approche :

1. **L'aperçu reproduit les règles de mise en page de LaTeX** : dimensions de la classe `article` (`size10/11/12.clo`), styles `amsthm` (théorèmes en italique, définitions en romain, démonstration terminée par □), conventions de `babel-french` (« Table 1 – », listes à tirets, espaces fines avant `; ! ?`), polices Computer Modern de Knuth, formules composées par KaTeX (algorithme de TeX).
2. **L'export produit du LaTeX standard** (`amsmath`, `amsthm`, `booktabs`, `enumitem`, `babel`…) qui passe par le noyau LaTeX actuel, donc par LaTeX3. Pour un rendu 100 % LaTeX, compilez le `.tex` exporté.

## Organisation du code

```
index.html          interface
css/paper.css       typographie « papier » (imitation de la classe article)
css/app.css         interface de l'application
js/model.js         modèle du document, numérotation, texte enrichi
js/render.js        rendu (édition et aperçu)
js/editor.js        édition directe, clavier, glisser-déposer, propriétés
js/mathdock.js      éditeur visuel de formules (MathLive) et chimie (mhchem)
js/paginate.js      mise en pages A4
js/latex.js         export LaTeX et archive .zip
js/templates.js     modèles de départ
js/banque.js        banque de sujets : menus, fabrication du sujet et du corrigé
js/banque-*.js      contenu des sujets (1re, terminale, sup, spé)
js/dialogs.js       fenêtres de dialogue
js/app.js           démarrage, fichiers, exports
js/tikz.js          dessins TikZ : interpréteur qui dessine en SVG (éditeur, aperçu, PDF)
js/sciences.js      tableaux de variations / de signes, tableau d'avancement
js/schemabloc.js    schémas-blocs : modèle, tracé automatique des flèches, code TikZ, modèles prêts
js/schemabloc-ui.js schémas-blocs : éditeur à la souris (css/schemabloc.css)
js/tikzdraw.js      TikZ visuel : modèle d'un dessin, formules des courbes, code TikZ, modèles prêts
js/tikzdraw-ui.js   TikZ visuel : éditeur à la souris (css/tikzdraw.css)
js/modules.js       modules complémentaires : registre, installation, notes ★
js/marketplace.js   page Modules : liste, fiches, avis, fenêtre d'installation (css/marketplace.css)
js/mod-python.js    module « Exécution Python » : boutons ▶, console, figures
js/mod-tikzdraw.js  module « TikZ visuel » : fiche, menu Insérer → Dessin à la souris
js/mod-schemabloc.js module « Schémas-blocs » : fiche, menu Insérer → Schéma-bloc
js/import.js        conversion de code LaTeX collé en éléments modifiables
js/pdfimport.js     import de PDF : analyse de la mise en page, formules, tableaux, images
js/share.js         partage par lien (court via Supabase, ou long hors ligne) et nettoyage des documents reçus
js/live.js          partage en direct : envoi des modifications, nouvelles versions proposées aux destinataires
js/theme.js         apparence : thème clair / sombre / automatique, feuille sombre
js/cloud.js         comptes et serveur de la Live Modification (Supabase)
js/collab.js        co-édition en direct (Yjs) : fusion des modifications, curseurs des autres, rôles
js/comments.js      commentaires (fils, résoudre, passages surlignés)
js/collab-ui.js     fenêtres : compte, Live Modification (invitations, rôles), documents en ligne, préférences
supabase/           schémas SQL, fonction d'e-mail d'invitation, modèles d'e-mails (voir supabase/LISEZMOI.md)
docs/               pages web (GitHub Pages) : lien de partage, document en ligne, compte
js/check.js         vérification du document (références, formules, statistiques)
js/find.js          rechercher / remplacer
vendor/             KaTeX, MathLive, polices Computer Modern (licences libres)
electron/main.js    application de bureau : fenêtre, fichiers, PDF natif, mises à jour
electron/preload.js pont sécurisé entre la page et Windows
electron/python.js  exécution de Python (application de bureau et serveur local server.js)
```

## Développement

```bash
npm install
npm start            # lance l'application de bureau
npm run dist         # installateur Windows dans dist/ (sur Windows)
npm run dist:mac     # .dmg dans dist/ (sur macOS uniquement)
```

### Publier une nouvelle version (déclenche la mise à jour chez les utilisateurs)

```bash
npm version minor    # 1.1.0 -> 1.2.0 (ou patch / major)
npm run release
```

`npm run release` pousse le tag ; **GitHub Actions** construit alors les deux installateurs — `.exe` sur un runner Windows, `.dmg` (Apple Silicon et Intel) sur un runner macOS, le format `.dmg` ne pouvant être fabriqué que sur macOS — les téléverse dans la Release (notes : `RELEASE_NOTES.md`) avec le fichier `latest.yml`, puis la publie. Le script suit la construction et affiche la liste des fichiers publiés. Au lancement suivant, chaque application Windows installée propose la mise à jour, l'installe et redémarre toute seule ; sur macOS, elle signale la nouvelle version et ouvre la page de téléchargement.

Dépannage : `npm run release -- --local` construit et publie l'installateur Windows depuis ce poste, sans passer par GitHub Actions.
