# Menteur (cartes) — Liar Game

Variante demandée:
- Paquet: 8×Roi, 8×Dame, 8×Valet, 8×As, 2×Joker (34 cartes) ; pour >4 joueurs, utiliser 2 paquets.
- 2 à 8 joueurs.
- Début de manche: 1 carte face visible qui fixe la figure (si Joker, choisir la figure).
- Tours suivants: le joueur suivant doit poser +1 carte face cachée, toutes annoncées de la même figure. Les Jokers comptent comme la figure.
- Seul le joueur suivant peut accuser. On ne peut pas passer.
- Borne d’exigence: cap = 10 par paquet (8 de la figure + 2 Jokers). Si l’exigence dépasse le cap, l’accusation est obligatoire.
- Les cartes restantes ne sont pas redistribuées avant la fin de la manche.

## Démarrer localement
Ouvrez `index.html` dans un navigateur récent (Chrome/Edge/Firefox). Aucun serveur requis.

## Règles d’UI
- Écran de démarrage: choisissez 2–8 joueurs (les noms sont éditables).
- Pendant la manche: l’interface guide l’ouverture (1 carte visible) puis les poses (+1 face cachée). Après chaque pose, le joueur suivant reçoit le choix "Menteur" ou "Laisser passer".
- Les mains sont visibles localement; partagez l’appareil et utilisez l’écran "Passer l’appareil".

## Hébergement sur XXXXX/liargame
Le projet est 100% statique. Déployez le dossier tel quel sous le chemin `/liargame` de votre hébergeur XXXXX.

Exemples (au choix):
- Si XXXXX est un serveur web (IIS/Apache/Nginx), placez ces fichiers dans le répertoire `wwwroot/liargame/` et servez-les comme statiques.
- Si XXXXX propose un gestionnaire de sites statiques: créez un site/app "liargame" et uploadez ces fichiers.

Assurez-vous que l’URL finale soit `https://XXXXX/liargame/` et que `index.html` soit le document par défaut.

### Option: chemin de base
Si votre hébergeur nécessite un chemin de base, cette app n’a pas d’assets avec chemins absolus; tout est relatif (`./styles.css`, `./app.js`). Elle fonctionnera depuis `/liargame/` sans changement.

## Notes techniques
- Aucune dépendance externe.
- Le code borne l’exigence à `cap = 10×paquets`. Au‑delà, l’accusation est forcée.
- Les Jokers sont sauvages lors de la vérification d’accusation.
- Après une accusation:
  - Si vrai: l’accusateur ramasse la pile, et l’accusé (poseur précédent) mène la nouvelle manche.
  - Si mensonge: le poseur ramasse la pile, et l’accusateur mène la nouvelle manche.
- Victoire: un joueur qui n’a plus de carte gagne dès la résolution courante.

## Débogage léger
- La "Dernière pose" montre les cartes réellement posées (pour transparence pendant les tests). Pour le jeu réel à plusieurs sur un même appareil, évitez de regarder cette zone hors accusation.
