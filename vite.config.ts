import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function normalizeChunkId(id: string): string {
  return id.replace(/\\/g, '/');
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const disableHmr = process.env.DISABLE_HMR === 'true';
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      // Pixi's umbrella package is a stable 508 kB vendor chunk; splitting it by internals creates circular chunks.
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = normalizeChunkId(id);
            if (normalizedId.includes('/node_modules/pixi.js/') || normalizedId.includes('/node_modules/@pixi/')) {
              return 'pixi-vendor';
            }
            if (normalizedId.includes('node_modules/motion')) {
              return 'motion-vendor';
            }
            if (normalizedId.includes('node_modules/react') || normalizedId.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (normalizedId.includes('node_modules/lucide-react')) {
              return 'icon-vendor';
            }
            if (normalizedId.includes('/src/runtimeV2/scenes/')) {
              if (normalizedId.includes('MapScene')) return 'scene-map';
              if (normalizedId.includes('CombatScene')) return 'scene-combat';
              if (normalizedId.includes('ShopScene')) return 'scene-shop';
              if (normalizedId.includes('EventScene')) return 'scene-event';
              if (normalizedId.includes('RestScene')) return 'scene-rest';
              if (normalizedId.includes('RewardScene')) return 'scene-reward';
              return 'scene-shared';
            }
            if (normalizedId.includes('/src/runtimeV2/pixi/')) {
              if (normalizedId.includes('Pixi')) return 'pixi-scenes';
              return 'pixi-shared';
            }
            if (normalizedId.includes('/src/content/data/')) {
              return 'content-data';
            }
            if (normalizedId.includes('/src/core/')) {
              return 'core-runtime';
            }
            if (normalizedId.includes('/src/ui/components/')) {
              return 'ui-components';
            }
            if (normalizedId.includes('/src/ui/overlays/')) {
              return 'ui-overlays';
            }
          },
        },
      },
    },
    server: {
      // Smoke/agent sessions should not live-reload when generated artifacts or local edits change.
      hmr: !disableHmr,
      watch: disableHmr
        ? {
            ignored: ['**/*'],
          }
        : {
            ignored: [
              '**/reports/**',
              '**/output/**',
              '**/.omx/**',
              '**/docs/development-reports/**',
            ],
          },
    },
  };
});
