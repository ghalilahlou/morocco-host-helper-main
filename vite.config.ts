import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
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
    },
  },
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu'],
  },
}));
