## Correction : les menus de la barre d'outils étaient coupés

Le menu **LaTeX ▾** (et les autres menus déroulants) s'ouvrait à l'intérieur de la barre d'outils, qui le rognait : il fallait faire défiler la barre pour atteindre « Télécharger le fichier .tex » ou « Importer un PDF ». Les menus s'affichent désormais par-dessus la page, toujours entiers et à l'intérieur de la fenêtre.

Dans la foulée, **la barre d'outils passe à la ligne** au lieu de défiler quand la fenêtre est trop étroite. Avant, jusqu'à cinq boutons — dont **PDF** et **LaTeX ▾** — pouvaient se retrouver hors écran sans aucun indice ; plus aucun bouton n'est inaccessible.

## Des tailles beaucoup plus libres

- **Texte : 9 paliers** au lieu de 4 (minuscule, très petit, assez petit, petit, grand, très grand, énorme, géant, maximal) — toute l'échelle de LaTeX, de `\tiny` à `\Huge`.
- **Équations centrées** : chaque équation a sa propre taille, réglable dans le panneau de droite ou avec le bouton **A A** de la barre d'outils. Une formule dans le texte s'agrandit en la sélectionnant et en choisissant une taille.
- **Taille du document : 8 pt, 9, 10, 11, 12, 14, 17 et 20 pt** au lieu des trois tailles imposées. À l'export, les tailles hors 10–12 pt utilisent la classe `extarticle`, prise en charge par TeX Live, MiKTeX et Overleaf.
