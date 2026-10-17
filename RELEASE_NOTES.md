## Nouveautés

- **Copier-coller entre documents** : Ctrl+C / Ctrl+V gardent la mise en forme (gras, italique, couleurs, encadrés), les **formules**, les références, les notes et les images, d'un fichier à un autre et même d'une fenêtre de LaTeX Home Edition à une autre. Collé dans Word ou ailleurs, le texte reste lisible (formules écrites en LaTeX).
- **Copier des blocs entiers** : cliquez sur un bloc, puis **Maj + clic** sur un autre pour sélectionner tous les blocs entre les deux (paragraphes, équations, tableaux, figures, encadrés…). **Ctrl+C** les copie, **Ctrl+X** les coupe, **Suppr** les efface ; collés, ils se placent après le bloc sélectionné, avec leurs images et leurs références bibliographiques.
- **Matrices de toutes tailles** : dans l'éditeur de formules, onglet *Matrices & systèmes*, le bouton **Matrice n × p…** ouvre un quadrillage (survolez puis cliquez) ou des cases « Lignes » et « Colonnes » pour aller jusqu'à 40 × 40. Choix des délimiteurs (parenthèses, crochets, barres, doubles barres, accolades ou aucun) et du contenu (cases vides, coefficients aᵢⱼ, zéros ou identité).
- **Agrandir ou réduire une matrice** : cliquez dans une case puis sur **+ Ligne**, **+ Colonne**, **− Ligne** ou **− Colonne**. Les nouvelles cases apparaissent prêtes à remplir et le curseur s'y place directement. Cela fonctionne aussi pour les systèmes d'équations (le « = » est repris dans la nouvelle ligne).
- **Beaucoup plus de symboles mathématiques**, dans l'éditeur de formules et dans la recherche de symboles (<kbd>Tab</kbd>) :
  - **partie entière** ⌊x⌋, E(x) et partie entière supérieure ⌈x⌉ ;
  - intervalles d'entiers ⟦1, n⟧ et intervalles semi-ouverts [a, b[ et ]a, b] ;
  - ⩽ et ⩾ (inclinés, à la française), « ne divise pas », égal par définition, isomorphe, non congru ;
  - analyse : limites à gauche et à droite, séries, intégrales généralisées, dérivée n-ième f⁽ⁿ⁾, « évalué en », composée, réciproque, classe 𝒞ᵏ, ch, sh, th, arcsin, arccos, lim sup, lim inf, grand O, flèche annotée ;
  - nouvel onglet **Algèbre & probas** : 𝓜ₙ(𝕂), GL, 𝕂[X], rang, Vect, noyau, image, trace, spectre, polynôme caractéristique, somme directe ⊕, produit scalaire ⟨u, v⟩, orthogonal, PGCD, PPCM, argument, e^{iθ}, 𝕌, ℤ/nℤ, probabilité, probabilité conditionnelle, espérance, variance, covariance, lois binomiale, normale, uniforme, géométrique et de Poisson ;
  - ensembles : ℕ*, ℝ₊, ℝⁿ, ∄, ⌀, grandes unions et intersections, cardinal, ensemble des parties ;
  - flèches ⟹, ⟺, ⇏, ↪ (injection), ↠ (surjection), ⟼ ; matrice générale, matrice diagonale, vecteur ligne, système de 3 équations, ⋮ et ⋱ ;
  - lettres grecques manquantes (ι, κ, ϖ, ϱ, ς, υ, ϑ, Υ), ∴, ∵, ■.
- Le code LaTeX exporté charge automatiquement ce qu'il faut (intervalles d'entiers, matrices de plus de 10 colonnes).

## Corrections

- **Fenêtre « Code LaTeX généré »** : elle s'ouvrait décalée, en partie hors de l'écran. Elle est maintenant centrée, avec une barre de défilement pour les lignes longues.
- **Encadrés vides dans le PDF** : un encadré (question, définition, exercice…) qui tombait en bas de page pouvait perdre son texte dans l'aperçu et dans le PDF. C'est corrigé.
- **Titre seul en bas de page** : un titre de section passe maintenant sur la page suivante avec le contenu qui le suit.
- **Dérivée seconde f''** : insérée depuis la palette, elle pouvait s'afficher en rouge (formule non reconnue). Elle s'affiche maintenant normalement, y compris dans les documents existants et dans le code LaTeX exporté.
- Le symbole « Texte dans une formule » s'affiche correctement dans la recherche de symboles.
