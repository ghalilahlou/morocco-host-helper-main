import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 🚀 OPTIMISATIONS PRODUCTION
    rollupOptions: {
      external: [
        '@rollup/rollup-linux-x64-gnu',
        '@rollup/rollup-win32-x64-msvc',
        '@rollup/rollup-darwin-x64',
        '@rollup/rollup-darwin-arm64'
      ],
      output: {
        // Code splitting optimisé - fonction pour éviter les erreurs de résolution
        manualChunks(id) {
          // Vendors React
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          
          // UI Components (Radix + shadcn)
          if (id.includes('node_modules/@radix-ui') || 
              id.includes('node_modules/cmdk') ||
              id.includes('node_modules/vaul')) {
            return 'ui-vendor';
          }
          
          // Query et état
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'state-vendor';
          }
          
          // Utilitaires
          if (id.includes('node_modules/date-fns') || 
              id.includes('node_modules/clsx') || 
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/class-variance-authority')) {
            return 'utils-vendor';
          }
          
          // PDF et documents (lourds)
          if (id.includes('node_modules/pdf-lib') || 
              id.includes('node_modules/jspdf') || 
              id.includes('node_modules/html2pdf')) {
            return 'pdf-vendor';
          }
          
          // OCR et AI (très lourds)
          if (id.includes('node_modules/tesseract.js') || 
              id.includes('node_modules/@huggingface')) {
            return 'ai-vendor';
          }
          
          // Admin (lazy loaded)
          if (id.includes('src/components/admin/')) {
            return 'admin-chunk';
          }
          
          // Calendar (lourd)
          if (id.includes('src/components/calendar/') || 
              id.includes('src/components/CalendarView')) {
            return 'calendar-chunk';
          }
          
          // Autres node_modules
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
        // Noms de fichiers optimisés pour le cache
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name.includes('vendor')) {
            return 'assets/vendor/[name]-[hash].js';
          }
          return 'assets/chunks/[name]-[hash].js';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    
    // Limites et optimisations
    chunkSizeWarningLimit: 1000,
    sourcemap: false, // Désactivé en production pour réduire la taille
    minify: 'esbuild', // Plus rapide que terser
    
    // Optimisations CommonJS
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    
    // Target moderne pour moins de polyfills
    target: ['es2020', 'chrome80', 'firefox78', 'safari14']
  },
  
  optimizeDeps: {
    // Inclure les dépendances critiques
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query'
    ],
    exclude: [
      '@rollup/rollup-linux-x64-gnu',
      '@rollup/rollup-win32-x64-msvc',
      '@rollup/rollup-darwin-x64',
      '@rollup/rollup-darwin-arm64'
    ]
  },
  
  define: {
    'process.env.ROLLUP_SKIP_NATIVE': 'true',
    'process.env.ROLLUP_PREFER_NATIVE': 'false'
  },
  
  esbuild: {
    target: 'es2020',
    // Supprimer les console.logs en production (backup au logger conditionnel)
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})
