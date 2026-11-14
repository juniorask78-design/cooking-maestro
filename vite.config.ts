import { defineConfig } from 'vite';

// BASE_PATH permet de servir le jeu sous un sous-dossier (ex. GitHub Pages : /cooking-maestro/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { chunkSizeWarningLimit: 2000 },
});
