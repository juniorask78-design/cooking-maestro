# Cooking Maestro : document de game design (GDD)

> Version 0.1 du 14 novembre 2026. Ce document vit avec le jeu : on le met à jour à chaque décision.

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

Inspirations de genre : les jeux de cuisine en temps réel et les jeux de gestion de restaurant cosy. Cooking Maestro ne reprend ni leurs personnages, ni leurs niveaux, ni leurs visuels.

## 3. Boucle de jeu

```
Service (2 min 30)  →  Bilan (étoiles, recette)  →  Entre deux services (agrandir, améliorer, personnaliser)  →  Service suivant
```

### Pendant un service
1. Des clients entrent et s'assoient à une table libre. Une bulle montre le plat voulu et une jauge de patience.
2. Le joueur prend les ingrédients dans les caisses, les **coupe** sur la planche (il doit rester à côté) ou les **cuit** à la poêle (ça cuit tout seul, mais ça **brûle** si on oublie).
3. Il dresse le plat dans une **assiette** (sur un plan de travail ou directement depuis la poêle ou la planche).
4. Il apporte l'assiette à la bonne table : le client paie le prix du plat plus un **pourboire** qui dépend de sa patience restante.
5. 25 secondes avant la fin, on annonce les « dernières commandes » et plus aucun client n'entre. Le service se termine quand le dernier client est servi ou parti.

### Contrôles
- **Souris ou doigt** : toucher une station pour y aller et l'utiliser, toucher le sol pour se déplacer. C'est le même contrôle sur ordinateur et sur mobile.
- **Clavier** : flèches, ZQSD ou WASD pour bouger, Espace ou E pour interagir, R pour le livre de recettes (met le jeu en pause).

## 4. Rythme (pour un jeu détente mais exigeant)

| Paramètre | Jour 1 | Évolution | Plancher |
|---|---|---|---|
| Durée d'un service | 150 s | fixe | — |
| Intervalle entre clients | 15 s (± 3 s) | −1,2 s par jour | 8 s |
| Patience d'un client | 75 s | −4 s par jour | 45 s |
| Découpe | 2,4 s (joueur présent) | Couteau de chef : −35 % | — |
| Cuisson | 6 s | — | — |
| Brûle après | 7 s de plus | Poêles antiadhésives : ×1,8 | — |
| Objectif 1 étoile | 55 pièces | +22 par jour | — |
| 2 et 3 étoiles | ×1,45 et ×1,9 l'objectif | — | — |

La pression monte doucement chaque jour. Les agrandissements ajoutent des tables, donc plus de clients en même temps, mais aussi des poêles. Le joueur choisit son rythme : agrandir vite rapporte plus, mais demande plus d'organisation.

Tous ces chiffres sont dans `src/config/content.ts` (objet `BALANCE`).

## 5. Progression : du food truck au restaurant

| Étape | Coût | Tables | Poêles | Cuisine débloquée | Plats |
|---|---|---|---|---|---|
| 🚚 Food truck | départ | 2 | 2 | 🇲🇽 Mexique | Taco, Guacamole |
| ⛱️ Terrasse | 140 | 3 | 3 | 🇮🇹 Italie | Pâtes tomate, Caprese |
| 🏠 Petit restaurant | 280 | 5 | 3 | 🇯🇵 Japon | Sushi, Donburi |
| 🏛️ Grand restaurant | 480 | 6 | 4 | 🇮🇳 Inde | Curry |

Les ingrédients s'accumulent : le donburi japonais réutilise le bœuf mexicain, et le curry indien combine poulet, riz et tomate. Les menus deviennent donc plus riches, et plus exigeants.

### Recettes du prototype

| Plat | Composition | Prix |
|---|---|---|
| 🌮 Taco | tortilla + bœuf cuit + tomate coupée | 15 |
| 🥣 Guacamole | avocat coupé + tomate coupée | 12 |
| 🍝 Pâtes tomate | pâtes cuites + tomate cuite (coupée puis cuite) | 17 |
| 🥗 Caprese | tomate coupée + mozzarella coupée | 13 |
| 🍣 Sushi | riz cuit + saumon coupé | 18 |
| 🍱 Donburi | riz cuit + bœuf cuit | 18 |
| 🍛 Curry | poulet cuit + riz cuit + tomate cuite | 26 |

### Améliorations (boutique entre deux services)
- **Couteau de chef** (70) : découpe plus rapide.
- **Poêles antiadhésives** (65) : les plats brûlent moins vite.
- **Décoration cosy** (50, puis 120) : +20 % de patience par niveau.
- **Chaussures confort** (55) : +15 % de vitesse.

## 6. Personnalisation
- **Chef** : couleur de veste (6), chapeau (toque, casquette, bandana, aucun), nom.
- **Restaurant** : sol (4 teintes), murs (4 teintes). Le food truck et la terrasse ont une salle en plein air.
- À venir : objets de décoration à placer (plantes, lampes, tableaux), tenues par cuisine du monde, déco qui augmente la patience.

## 7. Coop en ligne (après le prototype)
- 2 à 4 joueurs dans la même cuisine, chacun avec son avatar.
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
1. **v0.1 (ce prototype)** : solo, food truck → grand restaurant, 7 plats, boutique, personnalisation, sauvegarde locale, version web.
2. **v0.2** : sprites et musique, tutoriel guidé, équilibrage après tests.
3. **v0.3** : comptes et sauvegarde cloud (Supabase).
4. **v0.4** : coop en ligne 2 joueurs, puis 4.
5. **v0.5** : décoration placée librement, nouvelles cuisines (Liban, Corée, Brésil…), événements du jour.
6. **v1.0** : version mobile (PWA, puis Capacitor pour les stores).
