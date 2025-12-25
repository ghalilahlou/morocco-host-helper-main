#!/usr/bin/env tsx

/**
 * Script pour rafraîchir la vue matérialisée mv_bookings_enriched
 * Usage: npm run refresh:mv ou tsx scripts/refresh-materialized-view.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   VITE_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function refreshMaterializedView() {
  console.log('🔄 Rafraîchissement de la vue matérialisée mv_bookings_enriched...\n');

  try {
    // Option 1 : Utiliser la fonction RPC si elle existe
    console.log('📋 Tentative via fonction RPC refresh_bookings_enriched()...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('refresh_bookings_enriched');

    if (!rpcError) {
      console.log('✅ Vue matérialisée rafraîchie avec succès via RPC');
      return;
    }

    console.log('⚠️  Fonction RPC non disponible, tentative directe...');

    // Option 2 : Exécuter directement la commande SQL
    const { data: sqlData, error: sqlError } = await supabase
      .from('mv_bookings_enriched')
      .select('id')
      .limit(1);

    if (sqlError) {
      // Si la vue n'existe pas, on ne peut pas la rafraîchir
      if (sqlError.code === '42P01' || sqlError.message?.includes('does not exist')) {
        console.error('❌ La vue matérialisée mv_bookings_enriched n\'existe pas');
        console.error('   Exécutez la migration: supabase/migrations/20250131_000001_create_mv_bookings_enriched.sql');
        process.exit(1);
      }
      throw sqlError;
    }

    // Si on arrive ici, la vue existe mais on ne peut pas la rafraîchir directement
    // via Supabase JS client. Il faut utiliser SQL Editor dans le dashboard.
    console.log('ℹ️  La vue matérialisée existe mais ne peut pas être rafraîchie via le client JS');
    console.log('📝 Instructions pour rafraîchir manuellement:');
    console.log('   1. Allez sur Supabase Dashboard → SQL Editor');
    console.log('   2. Exécutez: REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bookings_enriched;');
    console.log('   3. Ou créez un Edge Function pour exécuter cette commande');

  } catch (error) {
    const err = error as Error;
    console.error('❌ Erreur lors du rafraîchissement:', err.message);
    console.error('\n💡 Solutions alternatives:');
    console.error('   1. Rafraîchir via Supabase Dashboard → SQL Editor');
    console.error('   2. Créer une Edge Function pour rafraîchir automatiquement');
    console.error('   3. Désactiver temporairement la vue matérialisée dans useBookings.ts');
    process.exit(1);
  }
}

// Fonction pour vérifier l'état de la vue
async function checkMaterializedViewStatus() {
  console.log('🔍 Vérification de l\'état de la vue matérialisée...\n');

  try {
    // Vérifier si la vue existe et obtenir des statistiques
    const { data, error, count } = await supabase
      .from('mv_bookings_enriched')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('❌ La vue matérialisée n\'existe pas');
        return false;
      }
      throw error;
    }

    console.log(`✅ Vue matérialisée existe`);
    console.log(`📊 Nombre approximatif de lignes: ${count || 'N/A'}`);

    // Tester une requête simple pour mesurer la performance
    console.log('\n⏱️  Test de performance...');
    const startTime = Date.now();
    
    const { data: testData, error: testError } = await supabase
      .from('mv_bookings_enriched')
      .select('id, property_id, check_in_date')
      .limit(10);

    const duration = Date.now() - startTime;

    if (testError) {
      console.error('❌ Erreur lors du test:', testError.message);
      return false;
    }

    console.log(`✅ Requête test exécutée en ${duration}ms`);
    
    if (duration > 2000) {
      console.warn('⚠️  La vue est lente (> 2s), un rafraîchissement est recommandé');
    } else if (duration > 1000) {
      console.warn('⚠️  La vue est modérément lente (> 1s), considérer un rafraîchissement');
    } else {
      console.log('✅ La vue est performante');
    }

    return true;
  } catch (error) {
    const err = error as Error;
    console.error('❌ Erreur lors de la vérification:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Diagnostic et Rafraîchissement - Vue Matérialisée\n');
  console.log('═'.repeat(60));

  // Vérifier l'état
  const exists = await checkMaterializedViewStatus();

  if (!exists) {
    console.log('\n❌ La vue matérialisée n\'existe pas ou n\'est pas accessible');
    console.log('💡 Exécutez la migration pour créer la vue');
    process.exit(1);
  }

  // Demander confirmation pour rafraîchir
  console.log('\n🔄 Voulez-vous rafraîchir la vue matérialisée ?');
  console.log('   Note: Le rafraîchissement peut prendre plusieurs secondes');
  
  // Pour l'instant, on rafraîchit automatiquement
  // Dans un script interactif, on pourrait demander confirmation
  await refreshMaterializedView();

  // Vérifier à nouveau après rafraîchissement
  console.log('\n🔍 Vérification après rafraîchissement...');
  await checkMaterializedViewStatus();

  console.log('\n✅ Opération terminée');
}

main().catch(console.error);

