# LaTeX MolecularChemistry Edition

Application de **modélisation moléculaire en 3D** et d'**entraînement en chimie**, pensée pour le
programme de **PCSI** (première année de classe préparatoire). Elle se manipule à la souris, sans
aucune ligne de code à écrire, et couvre la chaîne complète : construire une molécule, l'observer
en trois dimensions, la traduire dans les représentations conventionnelles (Cram, Newman, Fischer,
Haworth, chaise), l'analyser (VSEPR, Lewis, polarité, stéréochimie) et s'exercer.

> Cette application est **distincte de LaTeX Home Edition**, qui reste dédiée à l'écriture
> scientifique. Les deux programmes s'installent et se mettent à jour indépendamment l'un de l'autre.

---

## Installation

### Windows — installateur

Téléchargez `MolecularChemistry-Edition-Setup-x.y.z.exe` depuis la
[page des versions](https://github.com/Slipers/latex-home-edition/releases/tag/molecular-latest),
lancez-le, et l'application s'installe avec ses raccourcis sur le bureau et dans le menu Démarrer.
Les mises à jour suivantes sont proposées automatiquement au lancement : un clic suffit, le
téléchargement et l'installation se font seuls, et l'application redémarre à jour.

### Sans installation

Double-cliquez sur **`Lancer.bat`** : l'application s'ouvre dans votre navigateur. Aucune connexion
internet n'est nécessaire, tout fonctionne en local.

### Depuis les sources

```bash
cd molecular
npm install
npm start        # application de bureau (Electron)
npm run web      # version navigateur sur http://localhost:8766
npm run dist     # construit l'installateur Windows dans dist/
```

---

## Ce que l'application sait faire

### Construire une molécule

- **Bibliothèque de 143 molécules** classées par thème : géométrie et VSEPR, alcanes et
  cycloalcanes, insaturés, aromatiques, alcools et dérivés, composés carbonylés, amines,
  stéréochimie, biomolécules.
- **Saisie SMILES** : `CCO` pour l'éthanol, `CC(=O)O` pour l'acide éthanoïque, `c1ccccc1` pour le
  benzène, avec la stéréochimie (`[C@H]`, `[C@@H]`, `/`, `\`).
- **Construction à la souris** : tableau périodique complet (118 éléments), pose d'atomes, création
  de liaisons simples, doubles, triples, aromatiques, coins pleins et hachurés, fragments prêts à
  l'emploi (méthyle, phényle, carboxyle…).
- **Complétion automatique des valences** et **optimisation de la géométrie**, qui construit la
  molécule selon la théorie VSEPR puis la relaxe — en conservant la configuration de chaque centre
  asymétrique et en choisissant la conformation chaise la plus stable.
- **Import** des formats XYZ, MDL Molfile, SDF, PDB, SMILES, par le menu ou par glisser-déposer.

### Représenter

| Mode 3D | Représentation 2D |
| --- | --- |
| Boules et bâtonnets | Représentation de **Cram** (coins pleins et hachurés) |
| Bâtonnets | Projection de **Newman**, avec rotation interactive du dièdre |
| Sphères de van der Waals | Projection de **Fischer** |
| Fil de fer | Projection de **Haworth** |
| Squelette | Conformation **chaise**, axial et équatorial repérés par couleur |

S'ajoutent l'affichage des **doublets non liants**, des **charges partielles δ+ / δ−**, du **vecteur
moment dipolaire**, des étiquettes d'atomes, et les mesures interactives de **distance**, d'**angle**
et d'**angle dièdre** — modifiables directement en saisissant la valeur voulue.

### Analyser

- Formule brute, masse molaire, composition massique, degré d'insaturation.
- **Schéma de Lewis** : électrons de valence, doublets liants et non liants, charges formelles,
  détection des écarts à la règle de l'octet (lacunes, hypervalence).
- **VSEPR** : type AXₘEₙ, nombre stérique, géométrie, hybridation et angles théoriques, atome
  par atome.
- **Polarité** : moment dipolaire calculé, caractère polaire ou apolaire, charges partielles.
- **Groupes caractéristiques** : une vingtaine de fonctions reconnues automatiquement (alcool et sa
  classe, phénol, éther-oxyde, époxyde, aldéhyde, cétone, acide carboxylique, ester, amide,
  anhydride, chlorure d'acyle, nitrile, amine, imine, thiol, nitro, dérivé halogéné, cycle
  aromatique, acide α-aminé…).
- **Nomenclature systématique** (UICPA) pour les chaînes acycliques, les cycloalcanes et les dérivés
  simples du benzène.

### Stéréochimie

- Détection des **carbones asymétriques** et attribution des descripteurs **R / S** par les règles
  séquentielles de **Cahn, Ingold et Prelog**, avec le détail du classement des quatre substituants
  sphère par sphère — c'est la partie la plus utile pour comprendre, pas seulement pour vérifier.
- Descripteurs **Z / E** des doubles liaisons stéréogènes.
- **Chiralité**, composés **méso**, nombre maximal de stéréoisomères (2ⁿ).
- Relation entre deux molécules : identiques, **énantiomères**, **diastéréoisomères** ou isomères de
  constitution.
- Transformations : former l'énantiomère, **inverser un centre** donné, isomériser **Z ⇄ E**,
  **inverser un cycle** (les positions axiales deviennent équatoriales).
- **Profil énergétique de rotation** autour d'une liaison simple, en kJ·mol⁻¹, avec les termes de
  torsion et de gêne stérique.

### S'entraîner

Un module d'exercices couvrant douze thèmes du programme : atomistique et classification
périodique, schémas de Lewis, géométrie VSEPR, polarité, formules et analyse, groupes
caractéristiques, nomenclature, isomérie de constitution, descripteurs R/S, descripteurs Z/E,
énantiomères et diastéréoisomères, conformations.

Les questions viennent de deux sources : une **banque d'exercices rédigés**, avec des corrections
détaillées, et des **générateurs** qui produisent des questions inédites à partir de la bibliothèque
de molécules — l'énoncé, la réponse et la correction sont alors calculés par le moteur chimique
lui-même, ce qui donne un nombre illimité d'exercices toujours cohérents. La molécule concernée
s'affiche en 3D pendant que vous cherchez, et la progression est suivie thème par thème.

### Exporter

- Image **PNG** de la vue 3D, **SVG** de la projection courante.
- **XYZ**, **MDL Molfile**, **SDF**, **PDB**, **SMILES**.
- Code **chemfig** prêt à coller dans un document LaTeX, et formule brute au format **mhchem**.
- Format natif **`.lmc`**, qui conserve la molécule et les réglages d'affichage.

---

## Thème jour et nuit

Le bouton ◐ de la barre supérieure fait alterner **automatique** (le thème suit celui de Windows),
**jour** et **nuit**. Le choix est conservé d'une session à l'autre, et la vue 3D comme les
projections 2D s'y adaptent.

---

## Raccourcis clavier

| Touche | Action |
| --- | --- |
| `V` `S` `G` `A` `B` `D` `M` | Naviguer · Sélectionner · Déplacer · Ajouter · Lier · Supprimer · Mesurer |
| `F` | Recadrer la vue |
| `H` | Compléter les valences par des hydrogènes |
| `O` | Optimiser la géométrie |
| `Ctrl+N` `Ctrl+O` `Ctrl+S` | Nouveau · Ouvrir · Enregistrer |
| `Ctrl+Z` `Ctrl+Y` | Annuler · Rétablir |
| `Ctrl+A` | Tout sélectionner |
| `Suppr` | Supprimer la sélection |
| `Échap` | Annuler la sélection, fermer les menus |
| `?` | Aide |

Dans la vue 3D : clic gauche glissé pour tourner, clic droit (ou `Maj` + clic) pour déplacer,
molette pour zoomer, double-clic sur un atome pour centrer dessus.

---

## Quelques précisions sur les calculs

La géométrie 3D n'est pas issue d'un calcul de chimie quantique : elle est construite selon la
théorie VSEPR puis relaxée par un solveur de contraintes de distance (longueurs de liaison, angles
de valence, planéité des systèmes conjugués, encombrement stérique). Les résultats sont fidèles pour
les molécules du programme — le benzène est rigoureusement plan à 1,390 Å, le cyclohexane adopte une
chaise, le β-D-glucopyranose place ses cinq substituants en position équatoriale — mais les
longueurs et les énergies restent des ordres de grandeur, destinés à l'enseignement.

Les descripteurs R/S appliquent les règles CIP 1a (numéro atomique), 1b (masse isotopique) et 2
(duplication des atomes engagés dans une liaison multiple), avec exploration sphère par sphère. Les
règles 3 à 5, qui ne départagent que des cas très particuliers, ne sont pas mises en œuvre.

La nomenclature couvre les chaînes acycliques, les cycloalcanes et les dérivés simples du benzène.
Lorsqu'une structure sort de ce cadre, l'application l'indique explicitement plutôt que de proposer
un nom approximatif.

---

## Licence

MIT — voir le fichier [LICENSE](../LICENSE) à la racine du dépôt.

La bibliothèque [three.js](https://threejs.org/) (licence MIT) est incluse dans `vendor/three/`.
