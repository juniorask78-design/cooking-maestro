# Cooking Maestro : document de game design (GDD)

> Version 0.3 du 14 novembre 2026 (niveaux à objectifs, boissons, pièces à ramasser, combos, réchaud). Ce document vit avec le jeu : on le met à jour à chaque décision.

## 1. Le jeu en une phrase

Tu démarres avec un petit **food truck** et tu le transformes, service après service, en **grand restaurant des saveurs du monde**, où chaque agrandissement fait découvrir une nouvelle cuisine.

## 2. Intentions

| Pilier | Ce que ça veut dire concrètement |
|---|---|
| **Calme** | Pas de game over, pas de chrono punitif. Un client trop impatient part sans payer, c'est tout. Ambiance douce, couleurs chaudes, sons légers. |
| **Mais exigeant** | Les étoiles (1 à 3) récompensent l'organisation : enchaîner découpe, cuisson et service sans laisser brûler un plat ni attendre un client. |
| **Progression visible** | Le restaurant grandit à l'écran : food truck, terrasse, petit restaurant, grand restaurant. |
| **À soi** | On personnalise son chef (veste, chapeau, nom) et son restaurant (sol, murs, puis décor). |
| **À plusieurs** | Coop en ligne : on cuisine à 2 à 4 dans la même cuisine (prévu après le prototype). |

Public : grand public, à partir d'environ 8 ans. Langue : français. Pas de monétisation.

Inspirations de genre : les jeux de gestion de restaurant au toucher, comme Cooking Diary, qu'on joue d'une main sur téléphone. On reprend des **mécaniques de genre** (niveaux à objectifs, plats et boissons, pièces à ramasser, combos, plateau de maintien, clients pressés, améliorations d'appareils), sans reprendre de personnages, de restaurants, de niveaux ni de visuels. Pas de vies ni de boosters payants : le projet n'a pas de monétisation.

**Choix de contrôle (v0.2)** : on ne déplace jamais le chef. Tout se fait en touchant les ingrédients, les appareils et les assiettes. C'est plus confortable sur mobile et plus fidèle à l'esprit détente.

## 3. Boucle de jeu

```
Niveau (service de 2 min 30, avec un objectif)  →  Bilan (objectif réussi ? 1 à 3 étoiles)  →  Boutique (améliorer, agrandir, personnaliser)  →  Niveau suivant (ou on retente)
```

### Niveaux et objectifs
- Chaque restaurant compte **5 niveaux**. Chaque niveau a un objectif affiché en haut de l'écran :
  - niveaux 1, 3 et 5 : **gagner X pièces** (le niveau 5 demande 25 % de plus) ;
  - niveau 2 : **servir N clients** ;
  - niveau 4 : **ne perdre aucun client** (une erreur permise).
- Objectif rempli : niveau réussi, avec 1 à 3 étoiles selon les pièces gagnées. Objectif manqué : on garde les pièces, et on retente quand on veut. Pas de vies, pas d'attente.
- Après les 5 niveaux, on peut **agrandir** le restaurant (s'il y a assez de pièces), ce qui ouvre la cuisine suivante et ses 5 nouveaux niveaux. Le grand restaurant a des niveaux sans fin.

### Pendant un service
1. Des clients s'installent. Leur bulle montre le **plat** voulu, parfois avec une **boisson**, et une jauge de patience. Un client **pressé** ⚡ a moins de patience mais laisse un plus gros pourboire.
2. **Toucher un bac d'ingrédient** l'envoie tout seul au bon endroit :
   - 🔪 sur une **planche** s'il faut le couper (la découpe se fait seule) ;
   - 🔥 sur un **feu** s'il faut le cuire (la cuisson se fait seule, mais **ça brûle** si on l'oublie) ;
   - directement sur une **assiette** s'il n'y a rien à faire (tortilla, épices).
3. Quand un ingrédient est prêt (il rebondit), **le toucher** le pose sur une assiette : celle déjà commencée qui correspond, ou celle que le joueur a **sélectionnée**. Si aucune assiette ne convient, un plat cuit part au **réchaud**, où il ne brûle plus.
4. **Boissons** : toucher la machine remplit un verre, puis toucher le verre plein le sert au client qui l'attend.
5. Une assiette complète brille et affiche « Servir ! » : la toucher sert le client. Si la commande n'est pas finie (il manque la boisson), le client reprend un peu patience.
6. Quand toute la commande est servie, le client mange puis laisse ses **pièces sur la table**. Il faut **les toucher pour les ramasser**, et la place reste prise tant qu'on ne l'a pas fait. Les pièces oubliées sont ramassées automatiquement à la fin.
7. **Combo** : finir des commandes à moins de 8 secondes d'écart fait monter le combo (jusqu'à x5), et chaque cran ajoute +10 % de pourboire.
8. Un plat brûlé se jette d'un toucher, et la croix ✖ vide une assiette ratée.
9. 20 secondes avant la fin, plus aucun client n'entre.

### Où est le défi ?
- Les feux et les planches sont **limités** : il faut lancer les préparations dans le bon ordre.
- Ce qui cuit **brûle** : il faut récupérer à temps tout en gérant le reste.
- Plusieurs commandes arrivent en même temps, avec des boissons : il faut jongler entre les assiettes, la machine et les pièces à ramasser.
- Le combo récompense un rythme régulier, et l'objectif de chaque niveau change la priorité (vitesse, volume ou zéro client perdu).
- La patience baisse et les clients arrivent plus vite chaque jour.

### Contrôles
- **Tout au toucher** (ou à la souris) : les bacs, les feux et planches, le réchaud, les machines à boissons, les assiettes et les tables. C'est le même jeu sur téléphone et sur ordinateur.
- Bouton 📖 (ou touche R) : livre de recettes, met le jeu en pause.

## 4. Rythme (pour un jeu détente mais exigeant)

| Paramètre | Niveau 1 | Évolution | Plancher |
|---|---|---|---|
| Durée d'un service | 150 s | fixe | — |
| Intervalle entre clients | 10 s (± 2 s) | −0,25 s par niveau, −6 % par agrandissement | 5,5 s |
| Patience d'un client | 50 s | −1 s par niveau (+15 % s'il commande une boisson) | 30 s |
| Client pressé ⚡ | à partir du niveau 3 | 18 % des clients, patience ×0,6, pourboire ×1,5 | — |
| Boisson commandée | 45 % des clients | dès qu'une machine existe | — |
| Découpe | 2,5 s | Couteau : −40 % | — |
| Cuisson | 5 s | Feux plus puissants : −15 % par niveau | — |
| Brûle après | 6 s de plus | Réchaud pour garder au chaud | — |
| Remplir un verre | 2,5 s | Machine rapide : −40 % | — |
| Pièces pour 1 étoile | 90 | +12 par niveau | — |
| 2 et 3 étoiles | ×1,3 et ×1,6 | — | — |

Au départ, on a 2 feux, 1 planche, 1 place au réchaud, 3 assiettes et la machine à limonade. Un taco demande environ 6 touchers et 5 secondes de cuisson : un service tranquille rapporte 1 étoile, un service bien organisé en rapporte 3.

La pression monte doucement chaque jour. Les agrandissements ajoutent des tables, donc plus de clients en même temps, mais aussi des poêles. Le joueur choisit son rythme : agrandir vite rapporte plus, mais demande plus d'organisation.

Tous ces chiffres sont dans `src/config/content.ts` (objet `BALANCE`).

## 5. Progression : du food truck au restaurant

| Étape (après 5 niveaux réussis) | Coût | Places clients | Feux | Cuisine débloquée | Plats |
|---|---|---|---|---|---|
| 🚚 Food truck | départ | 3 | 2 | 🇲🇽 Mexique | Taco, Guacamole |
| ⛱️ Terrasse | 220 | 4 | 3 | 🇮🇹 Italie | Pâtes sauce tomate, Caprese |
| 🏠 Petit restaurant | 480 | 5 | 3 | 🇯🇵 Japon | Sushi, Donburi |
| 🏛️ Grand restaurant | 850 | 6 | 4 | 🇮🇳 Inde | Curry |

Les ingrédients s'accumulent : le donburi japonais réutilise le bœuf mexicain, et le curry indien combine poulet, riz et épices. Chaque ingrédient a un seul mode de préparation (rien, couper ou cuire), pour qu'un seul toucher suffise. Les menus deviennent donc plus riches, et plus exigeants.

### Recettes du prototype

| Plat | Composition | Prix |
|---|---|---|
| 🌮 Taco | tortilla + bœuf cuit + tomate coupée | 15 |
| 🥣 Guacamole | avocat coupé + tomate coupée | 11 |
| 🍝 Pâtes sauce tomate | pâtes cuites + sauce tomate cuite | 16 |
| 🥗 Caprese | tomate coupée + mozzarella coupée | 12 |
| 🍣 Sushi | riz cuit + saumon coupé | 17 |
| 🍱 Donburi | riz cuit + bœuf cuit | 17 |
| 🍛 Curry | poulet cuit + riz cuit + épices | 24 |

### Boissons

| Boisson | Machine disponible | Prix |
|---|---|---|
| 🍹 Limonade | dès le food truck | 5 |
| 🍵 Thé vert | dès le petit restaurant (Japon) | 6 |

### Améliorations (boutique entre deux niveaux)
- **Feux plus puissants** (60, 130, 220) : cuisson −15 % par niveau.
- **Deuxième planche** (80) : on coupe deux ingrédients à la fois.
- **Couteau de chef** (70) : la découpe va plus vite.
- **Grand réchaud** (70) : une deuxième place au chaud.
- **Plan de dressage** (90) : une quatrième assiette.
- **Machine rapide** (80) : les boissons se remplissent plus vite.
- **Décoration cosy** (60, 140, 260) : clients +15 % plus patients et pourboires +10 % par niveau.

## 6. Personnalisation
- **Chef** : couleur de veste (6), chapeau (toque, casquette, bandana, aucun), nom.
- **Restaurant** : sol (4 teintes), murs (4 teintes). Le food truck et la terrasse servent en plein air.
- À venir : objets de décoration à placer (plantes, lampes, tableaux), tenues par cuisine du monde, déco qui augmente la patience.

## 7. Coop en ligne (après le prototype)
- 2 à 4 joueurs dans la même cuisine : chacun touche les bacs, les appareils et les assiettes depuis son propre écran.
- Salle privée rejointe par un code à 4 lettres.
- Récompenses partagées : chaque joueur crédite son propre restaurant.
- Technique : voir `docs/ARCHITECTURE.md` (hôte qui fait foi, Supabase Realtime).

## 8. Comptes et sauvegarde
- Sans compte : sauvegarde locale dans le navigateur (prototype actuel).
- Avec compte (Supabase, connexion par e-mail magique) : sauvegarde cloud synchronisée, nécessaire pour la coop.

## 9. Direction artistique
- 2D cartoon vue de dessus, formes rondes, contours prune foncé, palette chaude.
- Prototype : formes dessinées par le code et emoji en guise d'icônes. On les remplacera par des sprites dessinés (un atlas par cuisine).
- Chaque cuisine apporte sa touche visuelle : papel picado pour le Mexique, nappes à carreaux pour l'Italie, lanternes pour le Japon, tissus colorés pour l'Inde.

## 10. Feuille de route
1. **v0.1** : premier prototype avec déplacement libre du chef (abandonné, trop peu adapté au mobile).
2. **v0.2** : tout au toucher.
3. **v0.3 (ce prototype)** : niveaux à objectifs, boissons, pièces à ramasser, combos, réchaud, clients pressés.
4. **v0.4** : sprites et musique, tutoriel guidé, équilibrage après tests.
5. **v0.5** : comptes et sauvegarde cloud (Supabase).
6. **v0.6** : coop en ligne 2 joueurs, puis 4.
7. **v0.7** : décoration placée librement, nouvelles cuisines (Liban, Corée, Brésil…), événements du jour.
6. **v1.0** : version mobile (PWA, puis Capacitor pour les stores).
