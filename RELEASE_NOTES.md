## Changement de page instantané pendant l'écriture

Quand vous écriviez en bas d'une page, ou que vous appuyiez sur Entrée à la fin d'une page, le nouveau texte apparaissait d'abord **dans la marge du bas**. Il ne passait à la page suivante qu'après **plusieurs secondes**, et seulement une fois la frappe arrêtée.

C'est corrigé : **le texte passe à la page suivante immédiatement**, au moment même où il dépasse, comme dans Word.

Deux causes ont été corrigées :

- **La pagination était recalculée seulement après une pause de frappe.** Désormais, l'éditeur vérifie à chaque touche si du texte dépasse le bas d'une page et recoupe aussitôt, en quelques millisecondes. La mise en page complète, celle du PDF, suit en arrière-plan.
- **L'éditeur n'affichait pas toujours exactement la même chose que le PDF**, par exemple la ligne « Titre du document » d'un titre encore vide, ou un emplacement d'image vide. Les coupures calculées pour le PDF pouvaient alors laisser du texte déborder dans la marge du bas, même après la pause. L'éditeur découpe maintenant ses pages d'après ce qu'il affiche réellement, en gardant les règles de la mise en page :
  - jamais de titre seul en bas de page ;
  - pas de ligne isolée d'un paragraphe ;
  - sauts de page imposés toujours respectés.

Tant que l'éditeur affiche la même chose que le PDF, ses pages restent identiques à celles du PDF.
