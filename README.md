# LaTeX Home Edition

Éditeur visuel pour écrire des documents scientifiques (comptes rendus de TP, cours, feuilles d'exercices, articles) **avec le rendu typographique de LaTeX, sans écrire de code**.

## Installer (Windows)

1. Téléchargez **`LaTeX-Home-Edition-Setup-x.y.z.exe`** depuis la page [Releases](https://github.com/Slipers/latex-home-edition/releases/latest).
2. Lancez-le. Windows peut afficher « Windows a protégé votre ordinateur » (l'application n'est pas signée numériquement) : cliquez sur **Informations complémentaires → Exécuter quand même**.
3. L'application s'ouvre depuis le raccourci du Bureau ou le menu Démarrer. Les fichiers `.lhe` s'ouvrent par double-clic.

**Mises à jour automatiques** : au démarrage (puis toutes les 4 h), l'application vérifie s'il existe une nouvelle version sur GitHub et propose de l'installer ; elle se télécharge, s'installe et l'application redémarre toute seule. Vérification manuelle : bouton **?** → « Rechercher des mises à jour ».

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
| En-têtes, pieds de page, numérotation des pages | « Document » → En-tête, pied de page (ou double-clic sur le pied de page) |
| Forcer un numéro (ex. commencer à 0) | Panneau de droite du titre, tableau, équation… |
| Coller du code LaTeX (texte + formules) | Ctrl+V dans le document : converti en paragraphes et équations |

Tapez `/` sur une ligne vide pour chercher n'importe quel élément.

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
js/dialogs.js       fenêtres de dialogue
js/app.js           démarrage, fichiers, exports
js/import.js        conversion de code LaTeX collé en éléments modifiables
vendor/             KaTeX, MathLive, polices Computer Modern (licences libres)
electron/main.js    application de bureau : fenêtre, fichiers, PDF natif, mises à jour
electron/preload.js pont sécurisé entre la page et Windows
```

## Développement

```bash
npm install
npm start            # lance l'application de bureau
npm run dist         # construit l'installateur dans dist/
```

### Publier une nouvelle version (déclenche la mise à jour chez les utilisateurs)

```bash
npm version minor    # 1.1.0 -> 1.2.0 (ou patch / major)
git push --follow-tags
npm run release
```

`npm run release` crée la Release GitHub (notes : `RELEASE_NOTES.md`), y téléverse l'installateur et le fichier `latest.yml`, puis la publie. Au lancement suivant, chaque application installée propose la mise à jour, l'installe et redémarre toute seule.
