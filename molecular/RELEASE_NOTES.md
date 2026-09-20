# LaTeX MolecularChemistry Edition 1.0.0

Première version de l'application de modélisation moléculaire.

## Construction

- Bibliothèque de 143 molécules classées par thème du programme de PCSI.
- Lecture et écriture du format SMILES, stéréochimie comprise (`[C@H]`, `/`, `\`).
- Tableau périodique complet (118 éléments) avec fiche détaillée de chaque élément.
- Construction à la souris : atomes, liaisons simples à triples, aromatiques, coins pleins
  et hachurés, fragments usuels.
- Complétion automatique des valences et optimisation de la géométrie selon la théorie VSEPR,
  à configuration absolue conservée, avec choix de la conformation chaise la plus stable.
- Import XYZ, MDL Molfile, SDF, PDB, SMILES, par menu ou glisser-déposer.

## Représentations

- Vue 3D : boules et bâtonnets, bâtonnets, sphères de van der Waals, fil de fer, squelette.
- Représentation de Cram, projections de Newman, de Fischer et de Haworth, conformation chaise
  avec repérage des positions axiales et équatoriales.
- Doublets non liants, charges partielles, vecteur moment dipolaire, étiquettes d'atomes.
- Mesures interactives de distance, d'angle et d'angle dièdre, modifiables directement.
- Profil énergétique de rotation autour d'une liaison simple, en kJ·mol⁻¹.

## Analyse

- Formule brute, masse molaire, composition massique, degré d'insaturation.
- Schéma de Lewis : doublets, charges formelles, écarts à la règle de l'octet.
- Géométrie VSEPR atome par atome : type AXₘEₙ, hybridation, angles.
- Polarité et moment dipolaire.
- Reconnaissance d'une vingtaine de groupes caractéristiques.
- Nomenclature systématique des chaînes acycliques, cycloalcanes et dérivés du benzène.

## Stéréochimie

- Descripteurs R/S par les règles CIP, avec explication détaillée du classement.
- Descripteurs Z/E, chiralité, composés méso, dénombrement des stéréoisomères.
- Relation entre deux molécules : énantiomères, diastéréoisomères, isomères de constitution.
- Énantiomère, inversion d'un centre, isomérisation Z ⇄ E, inversion de cycle.

## Entraînement

- Douze thèmes du programme, banque d'exercices rédigés et générateurs de questions inédites.
- Corrections détaillées, indices, suivi de la progression par thème.

## Interface

- Thème jour, nuit ou automatique.
- Mises à jour automatiques, sur un canal distinct de celui de LaTeX Home Edition.
- Export PNG, SVG, XYZ, MOL, SDF, PDB, SMILES, chemfig et mhchem.
