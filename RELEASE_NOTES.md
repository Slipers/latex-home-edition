## Nouveautés

- **Exécution Python : saisies dans la console** (module « Exécution Python » 1.1).
  - Quand le programme appelle `input()`, la console l'indique (« En attente d'une saisie ») : tapez la valeur juste après la question, puis Entrée, comme dans un terminal.
  - La sortie s'affiche en direct, pendant l'exécution.
  - Plusieurs lignes collées d'un coup sont envoyées ligne par ligne ; ↑ / ↓ reprennent une ligne déjà tapée ; **Ctrl+D** ou « Fin des saisies » terminent les entrées (`sys.stdin.read()` se termine).
  - Les valeurs saisies apparaissent en gras dans la console, et à leur place dans la sortie copiée ou insérée dans le document.
  - La limite de 60 s ne compte plus le temps passé à attendre une saisie.
  - Les valeurs données à l'avance (« Entrées ») restent possibles : elles sont lues en premier, la suite se tape dans la console.

## Corrections

- **En-tête et pied de page** : le texte tapé dans les réglages « Document » était parfois perdu.
- **Long code collé dans un bloc de code** : l'éditeur n'affiche plus des centaines de pages vides. Le code continue sur les pages suivantes, avec le même découpage que le PDF, et le collage de milliers de lignes est instantané.
- **Table des matières** : les numéros de page s'affichent dans l'éditeur, et une table longue continue sur la page suivante au lieu de déborder.
