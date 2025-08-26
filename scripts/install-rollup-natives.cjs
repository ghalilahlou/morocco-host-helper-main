#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Installing missing Rollup native modules...');

const nativeModules = [
  '@rollup/rollup-linux-x64-gnu',
  '@rollup/rollup-darwin-x64',
  '@rollup/rollup-darwin-arm64'
];

try {
  // Installer les modules natifs manquants
  for (const module of nativeModules) {
    console.log(`📦 Installing ${module}...`);
    try {
      execSync(`npm install ${module} --no-save`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ ${module} installed successfully`);
    } catch (error) {
      console.log(`⚠️ Failed to install ${module}, continuing...`);
    }
  }
  
  console.log('✅ Rollup native modules installation completed');
} catch (error) {
  console.error('❌ Error installing Rollup native modules:', error.message);
  process.exit(1);
}
