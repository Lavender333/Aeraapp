import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Use root base for custom domain deployment
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('supabase-js') || id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('jspdf')) return 'vendor-jspdf';
              if (id.includes('html2canvas')) return 'vendor-html2canvas';
              if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-maps';
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('@google/genai')) return 'vendor-ai';
              if (id.includes('react-router-dom')) return 'vendor-router';
              if (id.includes('zod')) return 'vendor-validation';
              if (id.includes('dompurify')) return 'vendor-utils';
              return 'vendor';
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
