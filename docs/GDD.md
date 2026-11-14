# Cooking Maestro : document de game design (GDD)

> Version 0.2 du 14 novembre 2026 (gameplay repensé pour le tactile). Ce document vit avec le jeu : on le met à jour à chaque décision.

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

Inspirations de genre : les jeux de gestion de restaurant au toucher, qu'on joue d'une main sur téléphone. Cooking Maestro ne reprend ni leurs personnages, ni leurs niveaux, ni leurs visuels.

**Choix de contrôle (v0.2)** : on ne déplace jamais le chef. Tout se fait en touchant les ingrédients, les appareils et les assiettes. C'est plus confortable sur mobile et plus fidèle à l'esprit détente.

## 3. Boucle de jeu

```
Service (2 min 30)  →  Bilan (étoiles, recette)  →  Entre deux services (agrandir, améliorer, personnaliser)  →  Service suivant
```

### Pendant un service
1. Des clients s'installent au comptoir. Une bulle montre le plat voulu et une jauge de patience.
2. **Toucher un bac d'ingrédient** l'envoie tout seul au bon endroit :
   - 🔪 sur une **planche** s'il faut le couper (la découpe se fait seule) ;
   - 🔥 sur un **feu** s'il faut le cuire (la cuisson se fait seule, mais **ça brûle** si on l'oublie) ;
   - directement sur une **assiette** s'il n'y a rien à faire (tortilla, épices).
3. Quand un ingrédient est prêt (il rebondit), **le toucher** le pose sur une assiette. Le jeu choisit l'assiette déjà commencée qui correspond, ou l'assiette que le joueur a **sélectionnée** en la touchant.
4. Une assiette complète brille et affiche « Servir ! ». **La toucher** sert le client qui attend ce plat depuis le plus longtemps. Il paie le prix plus un **pourboire** qui dépend de sa patience restante.
5. Un plat brûlé se jette d'un toucher, et la croix ✖ vide une assiette ratée.
6. 20 secondes avant la fin, plus aucun client n'entre. Le service se termine quand le dernier client est servi ou parti.

### Où est le défi ?
- Les feux et les planches sont **limités** : il faut lancer les préparations dans le bon ordre.
- Ce qui cuit **brûle** : il faut récupérer à temps tout en gérant le reste.
- Plusieurs commandes arrivent en même temps : il faut jongler entre les assiettes.
- La patience baisse et les clients arrivent plus vite chaque jour.

### Contrôles
- **Tout au toucher** (ou à la souris) : les bacs, les feux et planches, les assiettes. C'est le même jeu sur téléphone et sur ordinateur.
- Bouton 📖 (ou touche R) : livre de recettes, met le jeu en pause.

## 4. Rythme (pour un jeu détente mais exigeant)

| Paramètre | Jour 1 | Évolution | Plancher |
|---|---|---|---|
| Durée d'un service | 150 s | fixe | — |
| Intervalle entre clients | 10 s (± 2 s) | −0,6 s par jour, −6 % par agrandissement | 5,5 s |
| Patience d'un client | 50 s | −2,5 s par jour | 30 s |
| Découpe | 2,5 s | Couteau de chef : −40 % | — |
| Cuisson | 5 s | — | — |
| Brûle après | 6 s de plus | Poêles antiadhésives : ×2 | — |
| Objectif 1 étoile | 90 pièces | +22 par jour | — |
| 2 et 3 étoiles | ×1,4 et ×1,8 l'objectif | — | — |

Au départ, on a 2 feux, 1 planche et 3 assiettes. Un taco demande environ 6 touchers et 5 secondes de cuisson : un service tranquille rapporte 1 étoile, un service bien organisé en rapporte 3.

La pression monte doucement chaque jour. Les agrandissements ajoutent des tables, donc plus de clients en même temps, mais aussi des poêles. Le joueur choisit son rythme : agrandir vite rapporte plus, mais demande plus d'organisation.

Tous ces chiffres sont dans `src/config/content.ts` (objet `BALANCE`).

## 5. Progression : du food truck au restaurant

| Étape | Coût | Places clients | Feux | Cuisine débloquée | Plats |
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

### Améliorations (boutique entre deux services)
- **Deuxième planche** (80) : on coupe deux ingrédients à la fois.
- **Plan de dressage** (90) : une quatrième assiette.
- **Couteau de chef** (70) : la découpe va plus vite.
- **Poêles antiadhésives** (75) : les plats brûlent deux fois moins vite.
- **Décoration cosy** (60, puis 120) : +20 % de patience par niveau.

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
2. **v0.2 (ce prototype)** : tout au toucher, du food truck au grand restaurant, 7 plats, boutique, personnalisation, sauvegarde locale, version web.
3. **v0.3** : sprites et musique, tutoriel guidé, équilibrage après tests.
4. **v0.4** : comptes et sauvegarde cloud (Supabase).
5. **v0.5** : coop en ligne 2 joueurs, puis 4.
6. **v0.6** : décoration placée librement, nouvelles cuisines (Liban, Corée, Brésil…), événements du jour.
6. **v1.0** : version mobile (PWA, puis Capacitor pour les stores).
