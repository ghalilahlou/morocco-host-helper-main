import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Configuration spéciale pour Vercel qui force l'utilisation de la version JavaScript de Rollup
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@rollup/rollup-linux-x64-gnu',
        '@rollup/rollup-win32-x64-msvc',
        '@rollup/rollup-darwin-x64',
        '@rollup/rollup-darwin-arm64'
      ]
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    exclude: [
      '@rollup/rollup-linux-x64-gnu',
      '@rollup/rollup-win32-x64-msvc',
      '@rollup/rollup-darwin-x64',
      '@rollup/rollup-darwin-arm64'
    ]
  },
  define: {
    'process.env.ROLLUP_SKIP_NATIVE': 'true',
    'process.env.ROLLUP_PREFER_NATIVE': 'false',
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
    'process.env.ESLINT_NO_DEV_ERRORS': 'true',
    'process.env.ESLINT_NO_DEV_WARNINGS': 'true'
  },
  esbuild: {
    target: 'es2020'
  },
  // Force l'utilisation de la version JavaScript de Rollup
  server: {
    fs: {
      strict: false
    }
  }
})
