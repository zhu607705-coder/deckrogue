import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
              return 'pixi-vendor';
            }
            if (id.includes('node_modules/motion')) {
              return 'motion-vendor';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icon-vendor';
            }
            if (id.includes('/src/runtimeV2/scenes/')) {
              if (id.includes('MapScene')) return 'scene-map';
              if (id.includes('CombatScene')) return 'scene-combat';
              if (id.includes('ShopScene')) return 'scene-shop';
              if (id.includes('EventScene')) return 'scene-event';
              if (id.includes('RestScene')) return 'scene-rest';
              if (id.includes('RewardScene')) return 'scene-reward';
              return 'scene-shared';
            }
            if (id.includes('/src/runtimeV2/pixi/')) {
              if (id.includes('Pixi')) return 'pixi-scenes';
              return 'pixi-shared';
            }
            if (id.includes('/src/content/data/')) {
              return 'content-data';
            }
            if (id.includes('/src/core/')) {
              return 'core-runtime';
            }
            if (id.includes('/src/ui/components/')) {
              return 'ui-components';
            }
            if (id.includes('/src/ui/overlays/')) {
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
