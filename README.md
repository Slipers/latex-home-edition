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
| Symboles (maths, physique, chimie…) | Touche **Tab** : menu avec recherche |
| Tableau de variations / de signes | Colonne « Insérer » — exporté avec `tkz-tab` |
| Tableau d'avancement (chimie) | Colonne « Insérer » — construit depuis l'équation, calcule x_max |
| Fusionner des cases de tableau | Panneau de droite du tableau |
| Tableaux / images côte à côte | Colonne « Insérer » → Objets |
| Image ou capture dans une case de tableau | Coller (Ctrl+V) dans la case, ou panneau de droite |
| Couleur du texte | Bouton **A** de la barre d'outils |
| Taille du texte (9 paliers, de « minuscule » à « maximal ») | Bouton **A A** : sélectionnez le texte, puis la taille |
| Agrandir une équation centrée | Cliquez sur l'équation → **Taille** dans le panneau de droite (ou bouton **A A**) |
| Taille du texte du document (8 pt à 20 pt) | « Document » → Mise en page → Taille du texte |
| En-têtes, pieds de page, numérotation des pages | « Document » → En-tête, pied de page (ou double-clic sur le pied de page) |
| Forcer un numéro (ex. commencer à 0) | Panneau de droite du titre, tableau, équation… |
| Coller du code LaTeX (texte + formules) | Ctrl+V dans le document : converti en paragraphes et équations |
| Alignement d'un paragraphe | Menu ☰ de la barre, ou Ctrl+J / L / E / R |
| Texte à gauche + texte à droite sur une ligne | Menu ☰ → Espace extensible |
| Numéro d'une question, supprimer / déplacer une question | Panneau de droite (curseur dans la question) |
| Renommer un encadré, une figure, un tableau | Panneau de droite → « Nom affiché » / « Nom devant le numéro » |
| Rechercher / remplacer | Ctrl+F / Ctrl+H |
| Sujets de contrôle et fiches d'exercices prêts à l'emploi | **Nouveau** → « Contrôle / Évaluation » ou « Feuille d'exercices de maths » |
| Corrigé d'un sujet de la banque | Menu **Corrigé** en haut à droite |
| Importer un PDF et le convertir | Menu **LaTeX ▾** → « Importer un PDF », ou glissez le PDF sur la feuille |
| Importer un fichier `.tex` | Même fenêtre que l'import PDF |
| Vérifier références, citations et formules | Menu **LaTeX ▾** → « Vérifier le document » |

Tapez `/` sur une ligne vide pour chercher n'importe quel élément.

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
js/import.js        conversion de code LaTeX collé en éléments modifiables
js/pdfimport.js     import de PDF : analyse de la mise en page, formules, tableaux, images
js/check.js         vérification du document (références, formules, statistiques)
js/find.js          rechercher / remplacer
vendor/             KaTeX, MathLive, polices Computer Modern (licences libres)
electron/main.js    application de bureau : fenêtre, fichiers, PDF natif, mises à jour
electron/preload.js pont sécurisé entre la page et Windows
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
