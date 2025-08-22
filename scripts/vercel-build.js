#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Build Vercel - Morocco Host Helper');
console.log('=====================================');

async function vercelBuild() {
  try {
    // Vérifier que nous sommes dans le bon répertoire
    if (!fs.existsSync('package.json')) {
      console.error('❌ Erreur: package.json non trouvé');
      process.exit(1);
    }

    // Vérifier si terser est installé
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const hasTerser = packageJson.devDependencies && packageJson.devDependencies.terser;
    
    console.log(`📦 Terser installé: ${hasTerser ? '✅ Oui' : '❌ Non'}`);

    // Si terser n'est pas installé, l'installer
    if (!hasTerser) {
      console.log('📦 Installation de terser...');
      try {
        execSync('npm install --save-dev terser', { stdio: 'inherit' });
        console.log('✅ Terser installé');
      } catch (error) {
        console.log('⚠️  Impossible d\'installer terser, utilisation d\'esbuild');
      }
    }

    // Vérifier la configuration Vite
    console.log('🔍 Vérification de la configuration Vite...');
    const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
    
    if (fs.existsSync(viteConfigPath)) {
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      
      // Si terser est disponible, utiliser terser, sinon esbuild
      if (hasTerser && viteConfig.includes("minify: 'esbuild'")) {
        console.log('🔄 Modification de la configuration pour utiliser terser...');
        const updatedConfig = viteConfig.replace("minify: 'esbuild'", "minify: 'terser'");
        fs.writeFileSync(viteConfigPath, updatedConfig);
        console.log('✅ Configuration mise à jour pour terser');
      } else if (!hasTerser && viteConfig.includes("minify: 'terser'")) {
        console.log('🔄 Modification de la configuration pour utiliser esbuild...');
        const updatedConfig = viteConfig.replace("minify: 'terser'", "minify: 'esbuild'");
        fs.writeFileSync(viteConfigPath, updatedConfig);
        console.log('✅ Configuration mise à jour pour esbuild');
      }
    }

    // Build de production
    console.log('🔨 Build de production...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build réussi');

    // Vérifier que le dossier dist existe
    if (!fs.existsSync('dist')) {
      console.error('❌ Erreur: dossier dist non trouvé après le build');
      process.exit(1);
    }

    console.log('🎉 Build Vercel terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors du build:', error.message);
    process.exit(1);
  }
}

// Exécuter le build
vercelBuild();
