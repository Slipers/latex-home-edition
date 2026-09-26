## Zoom de l'éditeur : corrigé et fluide

Le zoom ajouté dans la version précédente était très buggé. Il a été entièrement refait :

- **Les pages restent parfaitement alignées à tous les niveaux de zoom.** Avant, les feuilles blanches étaient dessinées trop grandes ou trop petites dès qu'on n'était plus à 100 % (1,5× trop hautes à 150 %), et le texte glissait dans les marges ou entre deux pages.
- **La mise en page ne change plus avec le zoom** : mêmes retours à la ligne et mêmes sauts de page qu'à 100 %, donc identiques au PDF, que l'on soit à 50 % ou à 200 %.
- **Zoom fluide** : le changement de niveau est animé en douceur et ne relance plus aucun calcul de mise en page. Un cran de molette (Ctrl + molette) fait environ 10 %, et le pincement du pavé tactile zoome progressivement au lieu de sauter de 10 % à chaque mouvement.
- **L'écran ne saute plus** : le point du document situé sous la souris (ou au centre de l'écran pour les boutons et le clavier) reste en place pendant le zoom.
- Les boutons **−** / **+** avancent par crans ronds (90 %, 100 %, 110 %…), et plusieurs clics rapides s'additionnent.
- Le niveau de zoom est mémorisé d'une ouverture à l'autre.
- **Mac** : Cmd+ / Cmd− agrandissaient toute l'interface (barres d'outils comprises) en plus de la feuille. Ces raccourcis zooment maintenant seulement la feuille, comme sous Windows.
