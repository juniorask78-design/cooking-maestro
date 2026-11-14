# Cooking Maestro : guide pour Claude

Jeu de gestion de restaurant en français, calme mais exigeant, sur le thème « Saveurs du Monde » (du food truck au grand restaurant). Projet perso, sans monétisation. Phaser 3 + TypeScript + Vite.

## Commandes
- `npm run dev` : serveur de développement
- `npm test` : tests Vitest
- `npm run typecheck` puis `npm run build` : à faire passer avant chaque commit

## Règles du projet
- Tout ce que voit le joueur est en français, et les commentaires de code aussi.
- Tout se joue au toucher, sans déplacer le chef (choix d'Ange : esprit gestion de restaurant mobile, pas de déplacement libre).
- La logique de jeu (`src/core/`) est pure et sans Phaser. Les scènes affichent l'état et envoient des actions (indispensable pour la coop).
- Le contenu et l'équilibrage vont dans `src/config/content.ts`, l'habillage dans `src/config/theme.ts`.
- On s'inspire du genre, sans copier un jeu existant (pas de noms, de personnages, de niveaux ni d'assets repris).
- Documentation : `docs/GDD.md` (design) et `docs/ARCHITECTURE.md` (technique).

## Studio
Les rôles du studio sont des sous-agents dans `.claude/agents/` : game-designer, gameplay-dev, art-ui, audio-designer, netcode-backend, qa-tester, release-ops.
