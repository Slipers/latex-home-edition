## Importer un PDF et le convertir

Nouveau : **LaTeX ▾ → « Importer un PDF et le convertir »**, ou simplement **glissez un PDF sur la feuille**. Le document est analysé page par page et reconstruit en éléments modifiables — puis exportable en `.tex` comme n'importe quel document de l'application.

Sont reconnus :

- le **texte** (gras, italique, machine à écrire) avec les césures de fin de ligne recollées ;
- les **titres et sections** : la numérotation d'origine est retirée, l'application renumérote ;
- les **listes**, les **tableaux** (colonnes alignées, légende récupérée) et les **blocs de code** ;
- les **formules** : lettres grecques, symboles, indices, exposants, primes et racines carrées ;
- les **images** du PDF, et les pages sans texte (scans) insérées en image ;
- le **titre, l'auteur et la date** de la page de titre ; les en-têtes et pieds de page répétés sont ignorés.

Vous choisissez les pages, ce qui doit être reconnu, et si le résultat ouvre un nouveau document ou s'insère dans le document courant. Les fichiers **`.tex`** s'importent par la même fenêtre.

Les fractions, matrices et intégrales complexes restent approximatives : le texte est conservé, mais la structure demande une retouche.

## Vérifier le document

**LaTeX ▾ → « Vérifier le document »** : nombre de mots, de signes, de formules, de titres, de tableaux et d'images, puis la liste des anomalies — formule illisible, référence croisée cassée, citation absente de la bibliographie, figure sans image, titre vide, tableau irrégulier. Un clic sur une ligne amène directement à l'élément concerné. Pratique juste après un import de PDF.
