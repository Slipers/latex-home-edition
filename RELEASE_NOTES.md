## Correction : l'auteur ne s'affichait pas en mode « fiche »

En style de titre **« fiche » (feuille d'exercices / devoir)**, le champ **Auteur** n'apparaissait que pendant l'édition — il disparaissait de l'aperçu, du PDF et de l'export LaTeX. C'est corrigé : il s'affiche maintenant partout, en italique sous le titre.

## Zoomer dans l'éditeur, pas seulement dans l'aperçu

Une pastille de zoom apparaît maintenant en bas à droite de la feuille, **dans l'éditeur lui-même** (pas seulement dans l'aperçu paginé) : boutons **−** / **+** / **⟲**, **Ctrl + molette**, ou **Ctrl+/Ctrl-/Ctrl+0** au clavier. La mise en pages (sauts de page, feuilles A4) reste bien alignée à n'importe quel niveau de zoom.

## En-tête et pied de page : visibles et proposés sur chaque page

Le réglage existait déjà (« Document » → En-tête, pied de page), mais rien ne signalait qu'on pouvait en ajouter un tant que les pages suivantes restaient vides. Un rappel discret **« + En-tête »** / **« + Pied de page »** apparaît désormais en haut/bas de chaque page tant qu'aucun n'est défini ; un clic dessus ouvre directement les réglages. Une fois rempli, le texte (ex. `PCSI 1 - Lycée Joffre … {date}`) se répète automatiquement sur toutes les pages, comme pour un devoir de plusieurs pages.

## Un changement de page plus fluide pendant la frappe

Deux optimisations, sans rien changer visuellement :

- les formules KaTeX déjà affichées sont mises en cache, au lieu d'être reconstruites en entier à chaque repagination — le gain se sent surtout sur les documents chargés en formules ;
- la repagination (le calcul le plus lourd de l'éditeur) se déclenche désormais pendant un moment creux du navigateur plutôt que pile à la fin de la frappe, pour ne pas saccader le dernier caractère tapé.
