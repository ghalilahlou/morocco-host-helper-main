#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration Supabase
const SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM";

console.log('🔧 Application des Migrations Supabase - Morocco Host Helper');
console.log('============================================================');
console.log(`📡 URL: ${SUPABASE_URL}`);
console.log(`🔑 Project ID: csopyblkfyofwkeqqegd`);
console.log('');

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyMigrations() {
  try {
    console.log('📁 Lecture des fichiers de migration...');
    
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier par ordre chronologique
    
    console.log(`📋 ${migrationFiles.length} migrations trouvées`);
    console.log('');
    
    for (const file of migrationFiles) {
      try {
        console.log(`🔄 Application de: ${file}`);
        
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Diviser le contenu SQL en requêtes individuelles
        const queries = sqlContent
          .split(';')
          .map(query => query.trim())
          .filter(query => query.length > 0 && !query.startsWith('--'));
        
        for (const query of queries) {
          if (query.trim()) {
            const { data, error } = await supabase.rpc('exec_sql', { sql: query });
            
            if (error) {
              console.log(`   ⚠️  Erreur dans la requête: ${error.message}`);
            } else {
              console.log(`   ✅ Requête exécutée`);
            }
          }
        }
        
        console.log(`✅ Migration ${file} appliquée`);
        console.log('');
        
      } catch (error) {
        console.log(`❌ Erreur lors de l'application de ${file}: ${error.message}`);
        console.log('');
      }
    }
    
    console.log('🎉 Application des migrations terminée !');
    
    // Vérifier l'état final
    console.log('\n🔍 Vérification de l\'état final...');
    await verifyFinalState();
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'application des migrations:', error.message);
  }
}

async function verifyFinalState() {
  try {
    // Vérifier les tables principales
    const tablesToCheck = [
      'properties',
      'bookings', 
      'users',
      'guest_verifications',
      'contracts',
      'property_verification_tokens',
      'guest_submissions'
    ];

    console.log('📊 Vérification des tables:');
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`   ✅ Table ${table}: Accessible`);
        }
      } catch (err) {
        console.log(`   ❌ Table ${table}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

// Exécuter l'application des migrations
applyMigrations();
