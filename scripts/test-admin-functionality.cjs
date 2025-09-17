#!/usr/bin/env node

/**
 * Script de test pour la fonctionnalité administrateur
 * Vérifie que toutes les tables et composants sont en place
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminFunctionality() {
  console.log('🔍 Test de la fonctionnalité administrateur...\n');

  try {
    // 1. Vérifier les tables admin
    console.log('1. Vérification des tables administrateur...');
    
    const tables = ['admin_users', 'token_allocations', 'admin_activity_logs', 'admin_statistics'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`   ✅ Table ${table}: OK`);
        }
      } catch (err) {
        console.log(`   ❌ Table ${table}: ${err.message}`);
      }
    }

    // 2. Vérifier les utilisateurs admin
    console.log('\n2. Vérification des utilisateurs administrateur...');
    
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*');
    
    if (adminError) {
      console.log(`   ❌ Erreur lors de la récupération des admins: ${adminError.message}`);
    } else {
      console.log(`   ✅ ${adminUsers.length} utilisateur(s) administrateur trouvé(s)`);
      
      for (const admin of adminUsers) {
        console.log(`      - ${admin.user_id} (${admin.role})`);
      }
    }

    // 3. Vérifier les allocations de tokens
    console.log('\n3. Vérification des allocations de tokens...');
    
    const { data: tokenAllocations, error: tokenError } = await supabase
      .from('token_allocations')
      .select('*');
    
    if (tokenError) {
      console.log(`   ❌ Erreur lors de la récupération des tokens: ${tokenError.message}`);
    } else {
      console.log(`   ✅ ${tokenAllocations.length} allocation(s) de tokens trouvée(s)`);
      
      const totalTokens = tokenAllocations.reduce((sum, allocation) => sum + allocation.tokens_remaining, 0);
      console.log(`      - Total tokens actifs: ${totalTokens}`);
    }

    // 4. Vérifier les utilisateurs auth
    console.log('\n4. Vérification des utilisateurs auth...');
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log(`   ❌ Erreur lors de la récupération des utilisateurs auth: ${authError.message}`);
    } else {
      console.log(`   ✅ ${authUsers.users.length} utilisateur(s) auth trouvé(s)`);
      
      // Vérifier les emails spécifiques
      const targetEmails = ['ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com'];
      
      for (const email of targetEmails) {
        const user = authUsers.users.find(u => u.email === email);
        if (user) {
          console.log(`      ✅ ${email}: Utilisateur trouvé (${user.id})`);
          
          // Vérifier si admin
          const adminUser = adminUsers?.find(admin => admin.user_id === user.id);
          if (adminUser) {
            console.log(`         - Rôle: ${adminUser.role}`);
            console.log(`         - Actif: ${adminUser.is_active}`);
          } else {
            console.log(`         - ⚠️  Pas d'admin_users trouvé`);
          }
        } else {
          console.log(`      ❌ ${email}: Utilisateur non trouvé`);
        }
      }
    }

    // 5. Test des requêtes de statistiques
    console.log('\n5. Test des requêtes de statistiques...');
    
    try {
      const [
        { count: totalUsers },
        { count: totalProperties },
        { count: totalBookings }
      ] = await Promise.all([
        supabase.from('auth.users').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true })
      ]);
      
      console.log(`   ✅ Statistiques récupérées:`);
      console.log(`      - Utilisateurs: ${totalUsers || 0}`);
      console.log(`      - Propriétés: ${totalProperties || 0}`);
      console.log(`      - Réservations: ${totalBookings || 0}`);
    } catch (error) {
      console.log(`   ❌ Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    // 6. Test des politiques RLS
    console.log('\n6. Vérification des politiques RLS...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_info');
    
    if (policiesError) {
      console.log(`   ⚠️  Impossible de récupérer les politiques RLS: ${policiesError.message}`);
    } else {
      console.log(`   ✅ Politiques RLS récupérées`);
    }

    console.log('\n✅ Test de la fonctionnalité administrateur terminé !');
    
    // Résumé
    console.log('\n📊 Résumé:');
    console.log(`   - Tables admin: ${tables.length} vérifiées`);
    console.log(`   - Utilisateurs admin: ${adminUsers?.length || 0}`);
    console.log(`   - Allocations de tokens: ${tokenAllocations?.length || 0}`);
    console.log(`   - Utilisateurs auth: ${authUsers?.users.length || 0}`);

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    process.exit(1);
  }
}

// Fonction pour créer une fonction RPC pour récupérer les politiques
async function createPoliciesInfoFunction() {
  console.log('\n🔧 Création de la fonction RPC pour les politiques...');
  
  const sql = `
    CREATE OR REPLACE FUNCTION get_policies_info()
    RETURNS TABLE (
      table_name text,
      policy_name text,
      roles text[],
      cmd text,
      permissive boolean
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        p.tablename::text,
        p.policyname::text,
        p.roles,
        p.cmd::text,
        p.permissive
      FROM pg_policies p
      WHERE p.schemaname = 'public'
      ORDER BY p.tablename, p.policyname;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log(`   ⚠️  Impossible de créer la fonction: ${error.message}`);
    } else {
      console.log('   ✅ Fonction RPC créée');
    }
  } catch (err) {
    console.log(`   ⚠️  Erreur lors de la création de la fonction: ${err.message}`);
  }
}

// Exécution
async function main() {
  await createPoliciesInfoFunction();
  await testAdminFunctionality();
}

main().catch(console.error);
