import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    // https: true, // Désactivé - cause des problèmes avec IP locale
    // ✅ CRITIQUE : Configuration pour le routing SPA (évite les 404 après refresh)
    // Vite gère automatiquement le historyApiFallback en dev, mais on le configure explicitement
    historyApiFallback: true,
    proxy: {
      '/functions': {
        target: process.env.VITE_SUPABASE_URL,
        changeOrigin: true,
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ['@rollup/rollup-linux-x64-gnu'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          utils: ['date-fns', 'lucide-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu'],
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'lucide-react',
      'date-fns'
    ],
  },
}));
