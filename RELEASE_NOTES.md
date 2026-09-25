## Import de PDF : les documents « en bouillie » sont corrigés

Certains PDF ressortaient illisibles, le texte éparpillé et les formules cassées. Deux causes, toutes deux réglées :

- **Texte tracé de travers.** Beaucoup de PDF (sortie d'imprimante, scan, page en paysage) stockent leur texte pivoté à 90°, sans l'indiquer. L'analyse lisait alors les coordonnées dans le mauvais sens et reconstruisait les lignes n'importe comment. Le texte est désormais **redressé automatiquement** avant analyse.
- **Filigranes.** Un tampon écrit en très grand en travers de la page (un nom, « CONFIDENTIEL »…) se retrouvait au milieu des lignes et faisait passer tout le texte pour des indices et des exposants. Les filigranes sont maintenant **reconnus et retirés**.

Autres améliorations de l'import : les paragraphes sont recollés d'après l'interligne réel du document (un texte en interligne 1,5 ne donne plus un paragraphe par ligne), un mot isolé en gras ne crée plus un faux titre, un nombre seul n'est plus transformé en formule, et le résumé de fin d'import dit ce que l'analyse a fait (redressement, filigranes retirés, pages illisibles).

## Réagencer un import, en comparant avec le PDF

Nouveau : **LaTeX ▾ → « Réagencer le PDF importé »**. Le PDF d'origine s'affiche **à gauche**, le résultat reconstruit **à droite**, page par page.

On y règle l'orientation du texte, le découpage en paragraphes (recoller les lignes, ou une ligne = un paragraphe), la prise en compte des filigranes, des en-têtes répétés, des titres, formules, listes, tableaux, blocs de code et images ; on relance l'analyse autant de fois qu'on veut, et on applique au document quand les deux côtés correspondent. Le PDF importé reste en mémoire pendant toute la session.

C'est un réagencement **algorithmique**, calculé sur la position réelle des caractères dans le PDF : l'application fonctionne hors ligne, sans intelligence artificielle ni envoi de vos documents sur un serveur.
