## L'application est maintenant disponible sur macOS

Cette release contient **deux installateurs** :

- **Windows** : `LaTeX-Home-Edition-Setup-1.9.0.exe` (comme d'habitude, avec mise à jour automatique) ;
- **macOS** : `LaTeX-Home-Edition-1.9.0-arm64.dmg` pour les Mac Apple Silicon (M1 à M4) et `LaTeX-Home-Edition-1.9.0-x64.dmg` pour les Mac Intel. macOS 11 ou plus récent.

**Installation sur Mac** : ouvrez le `.dmg`, glissez l'application dans le dossier **Applications**, puis au premier lancement faites un **clic droit → Ouvrir** et confirmez (l'application n'est pas signée par Apple, une seule confirmation suffit).

L'application a été adaptée à macOS :

- **menus natifs** en français (Fichier, Édition, Insertion, Affichage, Fenêtre, Aide) avec les raccourcis Cmd habituels — Cmd+S, Cmd+O, Cmd+P, Cmd+Z, Cmd+F, Cmd+M… ;
- **double-clic sur un fichier `.lhe`** dans le Finder : il s'ouvre dans l'application ;
- **mises à jour** : l'application signale les nouvelles versions et ouvre la page de téléchargement (l'installation automatique demanderait une signature Apple payante) ; sur Windows, rien ne change, la mise à jour reste entièrement automatique.

Les installateurs sont désormais construits automatiquement par GitHub Actions, sur un runner Windows et un runner macOS.
