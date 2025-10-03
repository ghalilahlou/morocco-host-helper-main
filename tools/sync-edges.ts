#!/usr/bin/env node
/**
 * Utilitaire pour lister, tester et aligner les URLs d'Edge Functions
 * Teste en local (supabase serve) et en production
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// Charger les variables d'environnement
config();

interface EdgeFunction {
  name: string;
  path: string;
  methods: string[];
  description?: string;
  hasIndex: boolean;
  hasTests: boolean;
}

interface TestResult {
  name: string;
  environment: 'local' | 'production';
  url: string;
  method: string;
  status: 'ok' | 'error' | 'timeout';
  statusCode?: number;
  responseTime: number;
  corsOk: boolean;
  error?: string;
  headers?: Record<string, string>;
}

async function discoverEdgeFunctions(): Promise<EdgeFunction[]> {
  const functionsDir = 'supabase/functions';
  const functions: EdgeFunction[] = [];
  
  try {
    const entries = await readdir(functionsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const functionPath = join(functionsDir, entry.name);
        const indexPath = join(functionPath, 'index.ts');
        const testPath = join(functionPath, 'index.test.ts');
        
        try {
          // Vérifier la présence de fichiers
          let hasIndex = false;
          let hasTests = false;
          let description = '';
          let methods = ['POST', 'OPTIONS']; // Défaut pour Edge Functions
          
          try {
            await readFile(indexPath, 'utf-8');
            hasIndex = true;
            
            // Tenter d'extraire des infos du fichier
            const content = await readFile(indexPath, 'utf-8');
            
            // Extraire la description depuis les commentaires
            const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
            if (descMatch) {
              description = descMatch[1];
            }
            
            // Détecter les méthodes supportées
            if (content.includes('req.method === \'GET\'')) {
              methods.push('GET');
            }
            if (content.includes('req.method === \'PUT\'')) {
              methods.push('PUT');
            }
            if (content.includes('req.method === \'DELETE\'')) {
              methods.push('DELETE');
            }
            
          } catch {
            // index.ts n'existe pas
          }
          
          try {
            await readFile(testPath, 'utf-8');
            hasTests = true;
          } catch {
            // test file n'existe pas
          }
          
          functions.push({
            name: entry.name,
            path: functionPath,
            methods: [...new Set(methods)], // Déduplique
            description,
            hasIndex,
            hasTests
          });
        } catch (error) {
          console.warn(`⚠️  Erreur lors de l'analyse de ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors de la découverte des Edge Functions:', error);
  }
  
  return functions.sort((a, b) => a.name.localeCompare(b.name));
}

async function testEdgeFunction(
  func: EdgeFunction,
  environment: 'local' | 'production',
  method: string = 'OPTIONS'
): Promise<TestResult> {
  const startTime = Date.now();
  
  const baseUrl = environment === 'local' 
    ? 'http://localhost:54321/functions/v1'
    : `${process.env.VITE_SUPABASE_URL}/functions/v1`;
    
  const url = `${baseUrl}/${func.name}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000' // Tester CORS
  };
  
  // Ajouter l'auth pour la production
  if (environment === 'production' && process.env.VITE_SUPABASE_ANON_KEY) {
    headers['apikey'] = process.env.VITE_SUPABASE_ANON_KEY;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify({}) : undefined,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // Vérifier les headers CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    
    const corsOk = !!(corsHeaders['Access-Control-Allow-Origin'] && 
                      corsHeaders['Access-Control-Allow-Methods']);
    
    // Status codes acceptables
    const acceptableStatus = [200, 201, 400, 405, 404]; // 405 pour OPTIONS, 404 si pas déployé
    const isOk = acceptableStatus.includes(response.status);
    
    return {
      name: func.name,
      environment,
      url,
      method,
      status: isOk ? 'ok' : 'error',
      statusCode: response.status,
      responseTime,
      corsOk,
      headers: corsHeaders,
      error: isOk ? undefined : `Status inattendu: ${response.status}`
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      return {
        name: func.name,
        environment,
        url,
        method,
        status: 'timeout',
        responseTime,
        corsOk: false,
        error: 'Timeout après 10s'
      };
    }
    
    let errorMessage = error.message;
    if (error.code === 'ECONNREFUSED') {
      errorMessage = environment === 'local' 
        ? 'Service local non démarré (supabase start?)'
        : 'Service production inaccessible';
    }
    
    return {
      name: func.name,
      environment,
      url,
      method,
      status: 'error',
      responseTime,
      corsOk: false,
      error: errorMessage
    };
  }
}

function printFunctionsList(functions: EdgeFunction[]) {
  console.log('\n📋 EDGE FUNCTIONS DÉCOUVERTES');
  console.log('═'.repeat(70));
  
  for (const func of functions) {
    const indexIcon = func.hasIndex ? '✅' : '❌';
    const testIcon = func.hasTests ? '🧪' : '⚪';
    const methodsStr = func.methods.join(', ');
    
    console.log(`${indexIcon} ${testIcon} ${func.name.padEnd(25)} [${methodsStr}]`);
    
    if (func.description) {
      console.log(`       ${func.description}`);
    }
    
    if (!func.hasIndex) {
      console.log(`       ❌ Fichier index.ts manquant`);
    }
  }
  
  console.log(`\nTotal: ${functions.length} fonctions`);
  console.log(`Avec index.ts: ${functions.filter(f => f.hasIndex).length}`);
  console.log(`Avec tests: ${functions.filter(f => f.hasTests).length}`);
}

function printTestResults(results: TestResult[]) {
  console.log('\n🧪 RÉSULTATS DES TESTS');
  console.log('═'.repeat(80));
  
  const environments = ['local', 'production'] as const;
  
  for (const env of environments) {
    const envResults = results.filter(r => r.environment === env);
    if (envResults.length === 0) continue;
    
    console.log(`\n${env.toUpperCase()} (${env === 'local' ? 'localhost:54321' : 'production'})`);
    console.log('─'.repeat(50));
    
    for (const result of envResults) {
      const statusIcon = result.status === 'ok' ? '✅' : 
                        result.status === 'timeout' ? '⏱️' : '❌';
      const corsIcon = result.corsOk ? '🌐' : '🚫';
      const time = `${result.responseTime}ms`.padStart(8);
      
      console.log(`${statusIcon} ${corsIcon} ${result.name.padEnd(25)} ${time} [${result.statusCode || 'N/A'}]`);
      
      if (result.error) {
        console.log(`        ❌ ${result.error}`);
      }
      
      if (result.status === 'ok' && !result.corsOk) {
        console.log(`        🚫 CORS non configuré correctement`);
      }
    }
  }
}

function printSummary(results: TestResult[]) {
  const local = results.filter(r => r.environment === 'local');
  const prod = results.filter(r => r.environment === 'production');
  
  console.log('\n📊 RÉSUMÉ');
  console.log('═'.repeat(40));
  
  if (local.length > 0) {
    const localOk = local.filter(r => r.status === 'ok').length;
    const localCors = local.filter(r => r.corsOk).length;
    console.log(`Local: ${localOk}/${local.length} OK, ${localCors}/${local.length} CORS OK`);
  }
  
  if (prod.length > 0) {
    const prodOk = prod.filter(r => r.status === 'ok').length;
    const prodCors = prod.filter(r => r.corsOk).length;
    console.log(`Prod:  ${prodOk}/${prod.length} OK, ${prodCors}/${prod.length} CORS OK`);
  }
  
  const avgTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
  );
  console.log(`Temps moyen: ${avgTime}ms`);
}

function printRecommendations(functions: EdgeFunction[], results: TestResult[]) {
  console.log('\n💡 RECOMMANDATIONS');
  console.log('═'.repeat(50));
  
  // Fonctions sans index.ts
  const missingIndex = functions.filter(f => !f.hasIndex);
  if (missingIndex.length > 0) {
    console.log('\n❌ Fonctions sans index.ts :');
    missingIndex.forEach(f => console.log(`   - ${f.name}`));
  }
  
  // Fonctions sans tests
  const missingTests = functions.filter(f => !f.hasTests);
  if (missingTests.length > 0) {
    console.log('\n🧪 Fonctions sans tests :');
    missingTests.forEach(f => console.log(`   - ${f.name}`));
  }
  
  // Problèmes CORS
  const corsIssues = results.filter(r => r.status === 'ok' && !r.corsOk);
  if (corsIssues.length > 0) {
    console.log('\n🚫 Problèmes CORS détectés :');
    corsIssues.forEach(r => console.log(`   - ${r.name} (${r.environment})`));
    console.log('\n   💡 Vérifiez supabase/functions/_shared/cors.ts');
  }
  
  // Services non démarrés
  const connectionErrors = results.filter(r => r.error?.includes('ECONNREFUSED'));
  if (connectionErrors.length > 0) {
    console.log('\n🔧 Services à démarrer :');
    if (connectionErrors.some(r => r.environment === 'local')) {
      console.log('   - Local: supabase start && supabase functions serve');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testLocal = !args.includes('--prod-only');
  const testProd = !args.includes('--local-only');
  const listOnly = args.includes('--list');
  
  console.log('⚡ Morocco Host Helper - Edge Functions Sync');
  console.log('═'.repeat(60));
  
  // Découvrir les fonctions
  console.log('🔍 Découverte des Edge Functions...');
  const functions = await discoverEdgeFunctions();
  
  printFunctionsList(functions);
  
  if (listOnly) {
    process.exit(0);
  }
  
  // Tester les fonctions
  const validFunctions = functions.filter(f => f.hasIndex);
  const results: TestResult[] = [];
  
  if (testLocal) {
    console.log('\n🧪 Test des fonctions en LOCAL...');
    for (const func of validFunctions) {
      const result = await testEdgeFunction(func, 'local');
      results.push(result);
    }
  }
  
  if (testProd && process.env.VITE_SUPABASE_URL) {
    console.log('\n🧪 Test des fonctions en PRODUCTION...');
    for (const func of validFunctions) {
      const result = await testEdgeFunction(func, 'production');
      results.push(result);
    }
  } else if (testProd) {
    console.log('\n⚠️  VITE_SUPABASE_URL manquante, skip tests production');
  }
  
  if (results.length > 0) {
    printTestResults(results);
    printSummary(results);
  }
  
  printRecommendations(functions, results);
  
  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { discoverEdgeFunctions, testEdgeFunction };
