## Nouveau : tout pour mettre en forme un sujet de DS

- **Police sans empattements :** *Document → Mise en page → Police → Sans empattements*. Le texte passe en Computer Modern Sans, comme dans beaucoup de sujets de prépa, et les formules restent en Computer Modern. L'export LaTeX utilise `\sfdefault`.
- **Listes « I. 1. a. » :** parties en chiffres romains, questions, sous-questions, avec des numéros en gras et des questions serrées, comme dans un sujet de DS. Choix dans le panneau de droite d'une liste : *Style → I. 1. a.*
- **Puces rondes (•) :** nouveau style de liste, en plus des tirets.
- **Texte encadré :** sélectionnez un mot, puis menu des couleurs (A) → bouton encadré. Équivaut à `\fbox{…}` en LaTeX. Recliquez pour retirer le cadre.

## Améliorations

- Le numéro d'une question (1., a., I.…) est maintenant aligné sur la ligne du texte, même quand la ligne contient une grande formule (somme, produit, fraction…).
- Les paragraphes centrés ont le même petit espace avant et après qu'en LaTeX : l'aperçu, le PDF et l'export LaTeX se ressemblent davantage.
- Une liste peut reprendre à une sous-question après une formule centrée (par exemple « 3. » après une équation) : l'export LaTeX est correct.
- Plusieurs espaces insécables à la suite gardent leur largeur dans l'export LaTeX.
