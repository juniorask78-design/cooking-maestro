# Architecture technique

## Vue d'ensemble

```
src/
  config/      contenu et équilibrage (content.ts) + habillage du thème (theme.ts)
  core/        logique pure, testable sans navigateur
    recipes.ts   règles des recettes et des cuisines
    sim.ts       simulation d'un service au toucher : dispatch(action) + tick(dt)
    progress.ts  sauvegarde, améliorations, étoiles, agrandissements
    save.ts      SaveService : local (localStorage) ou cloud (Supabase)
  net/
    supabase.ts  comptes + sauvegarde cloud (activé seulement si les variables d'environnement existent)
    coop.ts      contrat réseau de la coop (pas encore branché)
  scenes/      scènes Phaser : Boot, Menu, Kitchen, Result, Shop, Customize
  ui/          widgets (boutons, panneaux, chef), sons de synthèse
tests/         tests Vitest de la logique
```

**Règle d'or** : les scènes Phaser *affichent* l'état de `KitchenSim` et lui *envoient des actions*. Elles ne modifient jamais l'état de jeu directement. C'est ce qui rend la coop possible sans réécriture.

## Coop en ligne (prévu)

Modèle « l'hôte fait foi » :
1. L'hôte crée une salle (code à 4 lettres) sur un canal **Supabase Realtime**.
2. Chaque invité envoie ses `Action` (`tapBin`, `tapSlot`, `tapPlate`, `clearPlate`) sur le canal. Ce sont de simples touchers : peu de données, et aucune prédiction de mouvement à gérer.
3. L'hôte applique toutes les actions à sa `KitchenSim`, et diffuse un `Snapshot` environ 10 fois par seconde (`snapshotOf`).
4. Les invités affichent le snapshot et jouent tout de suite l'animation de leur toucher (retour immédiat), corrigée au snapshot suivant si besoin.
5. Si l'hôte quitte, la partie se termine proprement et chacun garde ses gains (la v1 n'a pas de migration d'hôte).

Pourquoi ce choix : ce modèle est simple, on n'a pas de serveur de jeu à héberger, et Supabase est gratuit pour un projet perso. Si on a besoin de plus de robustesse, on pourra passer à un serveur autoritaire (Colyseus) en réutilisant `KitchenSim` côté serveur.

## Comptes et sauvegarde cloud

- `supabase/schema.sql` crée les tables `profiles` et `saves` avec RLS (chacun ne voit que ses données).
- Connexion par lien magique envoyé par e-mail (`signInWithOtp`).
- `CloudSaveService` garde toujours une copie locale ; c'est la version la plus récente (`updatedAt`) qui gagne.
- Pour l'activer, crée un projet Supabase, exécute le schéma, puis renseigne `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`). Sans ces variables, le jeu reste 100 % local.

## Mobile

- Le canvas fait 960 × 640 (paysage), s'adapte à l'écran (`Scale.FIT`) et tout se joue au toucher, avec de grandes zones à toucher.
- Étapes suivantes : manifeste PWA et écran en paysage, puis Capacitor pour Android et iOS.

## Déploiement

GitHub Actions construit le jeu et le publie sur GitHub Pages à chaque push sur `main` (`.github/workflows/deploy.yml`).
