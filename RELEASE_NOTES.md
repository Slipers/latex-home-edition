## Nouveau : « Texte à droite » (barème, points…)

Vous pouvez maintenant caler un petit texte **à droite de la ligne**, sur le même paragraphe ou la même question. Idéal pour le barème d'un exercice :

    1. La somme de 25 et 38.                                    (/0.5)
    2. La différence entre 135 et 47.                            (/1)

Trois façons de l'ajouter :

- **Panneau de droite** : cliquez dans une question ou un paragraphe, puis remplissez le champ **« Texte à droite »**. Pour une liste, c'est le « barème de la question » où se trouve le curseur.
- **Menu d'alignement ☰** de la barre d'outils → **« ⇥ Texte à droite »**. Une fenêtre s'ouvre, avec des raccourcis tout prêts : (/0,5), (/1), (/2), (1 pt)…
- **Menu « / »** : tapez `/droite` sur une ligne vide.

Cliquez sur un texte à droite pour le modifier ou le retirer.

Il fonctionne partout : paragraphes, questions numérotées, sous-questions, encadrés. Il se place sur la **dernière ligne** si la question en fait plusieurs, exactement comme `\hfill` en LaTeX. Le PDF et le code LaTeX exporté (`\hfill\mbox{(/0.5)}`) donnent donc le même résultat que l'éditeur ; c'est vérifié avec un vrai compilateur LaTeX.
