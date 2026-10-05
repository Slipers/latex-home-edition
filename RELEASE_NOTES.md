## Nouveau : dessins TikZ

Un nouvel élément **« Dessin TikZ »** (colonne de gauche, rubrique Objets, ou `/tikz`) permet de dessiner avec le langage **TikZ** de LaTeX : repères, courbes de fonctions, figures de géométrie, schémas avec des boîtes et des flèches…

- **Le dessin s'affiche directement sur la feuille et suit la frappe :** le code TikZ se modifie juste en dessous quand l'élément est sélectionné, avec la coloration LaTeX.
- **Huit exemples prêts à l'emploi** dans le panneau de droite, inspirés du tutoriel « TikZ – Basic Drawing » d'Overleaf : repère et cercle, formes de base, courbe de fonction, cercle trigonométrique, triangle, schéma avec nœuds, rosace…
- **Pris en charge :**
  - les commandes `\draw`, `\fill`, `\filldraw`, `\node`, `\coordinate`, `\foreach`, `\clip`, `\shade`, et les `scope` ;
  - les formes : traits, rectangles, cercles, ellipses, arcs, grilles, courbes de Bézier, `to[out=…, in=…]`, tracés de fonctions (`plot`) avec marques ;
  - les options : couleurs (`red!30!blue`…), épaisseurs, pointillés, flèches, coins arrondis, transparence, transformations ;
  - les nœuds avec texte et formules ($…$), et les styles.
- En cas d'erreur, un message clair s'affiche sous le code (par exemple « il manque un ; »), et le reste du dessin reste visible.
- **Légende facultative**, numérotée comme une figure, et **échelle** réglable.
- **Export LaTeX :** votre code TikZ est repris tel quel, donc LaTeX (ou Overleaf) donne le même dessin. Vérifié avec un vrai compilateur.

## Code informatique en couleur

Le code est maintenant **coloré selon le langage**, comme dans un éditeur de code : mots-clés, chaînes, commentaires, nombres, fonctions…

- La couleur apparaît **pendant la frappe**, dans l'aperçu, dans le PDF et dans l'export LaTeX (mêmes couleurs).
- **20 langages :** Python, OCaml, C, C++, Java, JavaScript, TypeScript, PHP, C#, Rust, Go, Matlab, R, SQL, HTML, CSS, JSON, LaTeX, Bash, et texte brut.
- Corrections :
  - les numéros de ligne continuent correctement quand un code passe sur la page suivante ;
  - l'export LaTeX d'un code en R ne bloque plus la compilation.

## Envoi d'e-mails : fini le « spam » du bouton

- Les boutons qui envoient un e-mail (Inviter, renvoyer l'e-mail de confirmation, mot de passe oublié, créer un compte) ne peuvent plus être cliqués plusieurs fois de suite : **un seul envoi**, puis un court délai affiché sur le bouton.
- Une même personne n'est prévenue par e-mail qu'une fois toutes les 10 minutes.
- **Côté serveur aussi :** au plus 20 invitations par tranche de 10 minutes et 15 e-mails d'invitation par heure et par compte, même en contournant l'application. Pour l'activer, le script `supabase/collab.sql` est à relancer une fois dans Supabase (sans risque : il n'efface rien).
