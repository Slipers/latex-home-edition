## Nouveautés

- **Documents partagés : correction de l'erreur « Document inaccessible »** (« cannot add `presence` callbacks … after `subscribe()` ») qui apparaissait parfois à l'ouverture d'un fichier partagé.
  - Elle survenait quand le même document était ouvert deux fois de suite très vite (double clic, reprise du dernier document au démarrage pendant un clic dans « Partagés »), ou quand l'ancienne connexion du document n'avait pas été bien fermée (coupure réseau, document rouvert aussitôt).
  - L'ouverture repart maintenant toujours d'une connexion temps réel neuve, et deux ouvertures simultanées du même document n'en font plus qu'une.
