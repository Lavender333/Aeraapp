import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(() => {
    return {
      // Use root base for custom domain deployment
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        legacy({
          targets: ['defaults', 'not IE 11', 'iOS >= 12'],
          modernPolyfills: true,
        }),
      ],
      build: {
        outDir: 'dist',
        sourcemap: false,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
