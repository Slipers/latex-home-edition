## Corrections

- **Annuler (Ctrl+Z)** : une fusion de paragraphes (Retour arrière), un décalage de question ou un alignement s'annulent en une seule fois (il fallait parfois appuyer deux fois). Le texte tapé juste avant une opération (Entrée, fusion…) forme maintenant sa propre étape d'annulation.
- **Rien n'est perdu à la fermeture** : la frappe des dernières secondes est prise en compte avant de fermer la fenêtre ou d'installer une mise à jour (la question « Enregistrer ? » pouvait ne pas s'afficher).
- **Reprise au démarrage** : le document rouvert automatiquement retrouve son fichier (Ctrl+S le réenregistre au même endroit) et reste marqué « non enregistré » s'il l'était.
- **Fichiers** : un enregistrement ou un export impossible (PDF encore ouvert dans le lecteur, fichier en lecture seule, disque plein…) affiche maintenant un message au lieu d'échouer sans rien dire.
- **Glisser-déposer** : un fichier déposé hors de la feuille ne remplace plus l'application ; un document .lhe déposé s'ouvre ; un fichier qui n'est pas une image ne laisse plus de cadre d'image vide.
- **Import de PDF** : les images extraites du PDF s'affichent (elles disparaissaient).
- **Mise en forme** : une couleur, une taille ou un cadre appliqués à une sélection qui déborde sur le paragraphe suivant ne dupliquent plus de texte.
- **Équations** : le bouton « Numérotée » de l'éditeur de formules fonctionne (il provoquait une erreur).
- **Tableaux** : ajouter ou supprimer une colonne garde les largeurs et les cases fusionnées au bon endroit.
- **Fenêtres** : une fenêtre qui en remplace une autre ne laisse plus la touche Échap refermer la suivante par erreur.
- **Style cours** : les notes de bas de page d'un encadré ou d'un exercice restent en bas de l'encadré, comme dans le PDF LaTeX, sans décaler les numéros des notes de la page ; un exercice coupé entre deux pages ne répète plus son titre ; les encadrés colorés ne sont plus coupés entre deux feuilles dans l'éditeur.
- **Divers** : numéros romains au-delà de 39 (xl, xc…), listes qui commencent à 0, colonnes ajoutées dans une colonne placées à côté, titre encadré avec une formule exporté correctement, recherche de symboles (Tab) qui ne perd plus les premières lettres tapées, « Vérifier le document » contrôle aussi les dessins TikZ et les textes en bas de page.
