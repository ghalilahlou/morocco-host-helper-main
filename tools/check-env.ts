#!/usr/bin/env node
/**
 * Script de vérification des variables d'environnement
 * Vérifie la présence des variables essentielles pour le développement local et la production
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Charger les variables d'environnement manuellement
try {
  const { config } = await import('dotenv');
  config({ override: false });
} catch (error) {
  console.warn('⚠️ dotenv not available, using system env only');
}

interface EnvCheck {
  key: string;
  required: boolean;
  context: 'local' | 'vercel' | 'mcp' | 'all';
  description: string;
  example?: string;
}

const ENV_CHECKS: EnvCheck[] = [
  // Variables Frontend/Vercel
  {
    key: 'VITE_SUPABASE_URL',
    required: true,
    context: 'all',
    description: 'URL de base Supabase',
    example: 'https://xxx.supabase.co'
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    context: 'all', 
    description: 'Clé publique Supabase (anon)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  
  // Variables MCP
  {
    key: 'SUPABASE_URL',
    required: true,
    context: 'mcp',
    description: 'URL Supabase pour serveurs MCP',
    example: 'https://xxx.supabase.co'
  },
  {
    key: 'SUPABASE_KEY',
    required: true,
    context: 'mcp',
    description: 'Clé service role Supabase (⚠️ SECRÈTE)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  {
    key: 'CLAUDE_API_KEY',
    required: true,
    context: 'mcp',
    description: 'Clé API Anthropic Claude',
    example: 'sk-ant-api03-xxx'
  },
  {
    key: 'SUPABASE_MCP_PORT',
    required: false,
    context: 'mcp',
    description: 'Port du serveur Supabase MCP',
    example: '3001'
  },
  {
    key: 'CLAUDE_MCP_PORT',
    required: false,
    context: 'mcp',
    description: 'Port du serveur Claude MCP',
    example: '3002'
  },

  // Variables locales Supabase
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    context: 'local',
    description: 'Clé service role pour développement local',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
];

interface CheckResult {
  key: string;
  present: boolean;
  value?: string;
  masked?: string;
  error?: string;
}

function maskSensitiveValue(value: string): string {
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

function checkEnvironmentVariable(check: EnvCheck): CheckResult {
  const value = process.env[check.key];
  
  if (!value) {
    return {
      key: check.key,
      present: false,
      error: check.required ? 'Variable requise manquante' : 'Variable optionnelle absente'
    };
  }

  // Vérifications basiques
  let error: string | undefined;
  
  if (check.key.includes('URL') && !value.startsWith('http')) {
    error = 'URL invalide (doit commencer par http/https)';
  }
  
  if (check.key.includes('KEY') && value.length < 20) {
    error = 'Clé trop courte (probablement invalide)';
  }

  return {
    key: check.key,
    present: true,
    value,
    masked: check.key.includes('KEY') ? maskSensitiveValue(value) : value,
    error
  };
}

function printResults(results: CheckResult[], context: string) {
  console.log(`\n🔍 Vérification des variables d'environnement [${context.toUpperCase()}]`);
  console.log('─'.repeat(60));
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const result of results) {
    const check = ENV_CHECKS.find(c => c.key === result.key)!;
    const icon = result.present ? (result.error ? '⚠️' : '✅') : '❌';
    const displayValue = result.present ? result.masked || result.value : 'NON DÉFINIE';
    
    console.log(`${icon} ${result.key.padEnd(25)} ${displayValue}`);
    
    if (result.error) {
      console.log(`   ↳ ${result.error}`);
      if (check.required) {
        hasErrors = true;
      } else {
        hasWarnings = true;
      }
    }
  }
  
  return { hasErrors, hasWarnings };
}

function printHelp() {
  console.log('\n📚 AIDE - Configuration des variables d\'environnement');
  console.log('═'.repeat(60));
  
  console.log('\n🔧 DÉVELOPPEMENT LOCAL');
  console.log('Créez un fichier .env à la racine :');
  console.log('```');
  console.log('# Copiez env.example vers .env');
  console.log('cp env.example .env');
  console.log('# Puis éditez .env avec vos vraies valeurs');
  console.log('```');
  
  console.log('\n☁️ VERCEL (Production/Preview)');
  console.log('Ajoutez les variables dans l\'interface Vercel :');
  console.log('```');
  console.log('# Via CLI Vercel');
  console.log('vercel env add VITE_SUPABASE_URL');
  console.log('vercel env add VITE_SUPABASE_ANON_KEY');
  console.log('');
  console.log('# Ou via dashboard : https://vercel.com/dashboard');
  console.log('# Settings > Environment Variables');
  console.log('```');
  
  console.log('\n🤖 MCP SERVEURS');
  console.log('Variables supplémentaires pour les serveurs MCP :');
  console.log('```');
  console.log('# Dans votre .env local');
  console.log('SUPABASE_KEY=your_service_role_key  # ⚠️ Secret !');
  console.log('CLAUDE_API_KEY=sk-ant-api03-xxx     # ⚠️ Secret !');
  console.log('```');
  
  console.log('\n🔐 SÉCURITÉ');
  console.log('⚠️  Ne jamais committer les clés service role');
  console.log('⚠️  Utiliser des variables d\'environnement distinctes prod/dev');
  console.log('⚠️  Rotation régulière des clés API');
}

function checkEnvFile() {
  const envPath = resolve('.env');
  const envExamplePath = resolve('env.example');
  
  console.log('\n📁 Fichiers de configuration');
  console.log('─'.repeat(30));
  
  if (existsSync(envPath)) {
    console.log('✅ .env trouvé');
  } else {
    console.log('❌ .env manquant');
  }
  
  if (existsSync(envExamplePath)) {
    console.log('✅ env.example trouvé');
  } else {
    console.log('❌ env.example manquant');
  }
}

function main() {
  const args = process.argv.slice(2);
  const context = args[0] || 'all';
  
  console.log('🔍 Morocco Host Helper - Vérification d\'environnement');
  console.log('═'.repeat(60));
  
  checkEnvFile();
  
  // Filtrer les vérifications selon le contexte
  const relevantChecks = ENV_CHECKS.filter(check => 
    context === 'all' || check.context === context || check.context === 'all'
  );
  
  const results = relevantChecks.map(checkEnvironmentVariable);
  const { hasErrors, hasWarnings } = printResults(results, context);
  
  // Résumé
  console.log('\n📊 RÉSUMÉ');
  console.log('─'.repeat(20));
  
  const total = results.length;
  const present = results.filter(r => r.present).length;
  const errors = results.filter(r => r.error && ENV_CHECKS.find(c => c.key === r.key)?.required).length;
  const warnings = results.filter(r => r.error && !ENV_CHECKS.find(c => c.key === r.key)?.required).length;
  
  console.log(`Variables vérifiées: ${total}`);
  console.log(`Variables présentes: ${present}/${total}`);
  
  if (errors > 0) {
    console.log(`❌ Erreurs: ${errors}`);
  }
  if (warnings > 0) {
    console.log(`⚠️  Avertissements: ${warnings}`);
  }
  
  if (!hasErrors && !hasWarnings) {
    console.log('✅ Configuration OK !');
  }
  
  if (hasErrors || args.includes('--help') || args.includes('-h')) {
    printHelp();
  }
  
  // Code de sortie
  process.exit(hasErrors ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkEnvironmentVariable, ENV_CHECKS };
