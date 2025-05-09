import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import removeReactDevToolsPlugin from './vite-plugin-remove-react-devtools';

// https://vitejs.dev/config/
export default defineConfig({
  // Force production mode to disable React DevTools messages
  mode: 'production',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [
    removeReactDevToolsPlugin(),
    react()
  ],
  base: './', // Ajout d'une base URL relative
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@context': path.resolve(__dirname, './src/context'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // Augmenter la limite d'avertissement pour les chunks à 1000 Ko (au lieu de 500 Ko par défaut)
    chunkSizeWarningLimit: 100000,

    // Configuration des options Rollup pour le découpage du code
    rollupOptions: {
      output: {
        // Configuration du code splitting manuel pour regrouper les modules de manière plus optimale
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          vendor: ['axios', 'socket.io-client']
        },
      },
    },

    // Optimisation du CSS
    cssCodeSplit: true,

    // Minimisation pour la production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
});