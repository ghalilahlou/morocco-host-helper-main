#!/bin/bash
# Test de connexion IPv4 forcé
echo "🔗 Test de connexion IPv4 à Supabase"
echo "===================================="

PROJECT_REF="csopyblkfyofwkeqqegd"
DB_PASSWORD="1475963baSE69@"

# Forcer IPv4
export PGCONNECT_TIMEOUT=10
export PGPASSWORD="$DB_PASSWORD"

# Test avec différentes approches
echo "📋 Test 1: Résolution DNS..."
nslookup db.$PROJECT_REF.supabase.co

echo ""
echo "📋 Test 2: Ping IPv4..."
ping -4 -c 3 db.$PROJECT_REF.supabase.co

echo ""
echo "📋 Test 3: Connexion PostgreSQL avec IPv4..."
psql -4 -h db.$PROJECT_REF.supabase.co -p 5432 -U postgres -d postgres -c "SELECT 'Connexion reussie' as status;" 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Connexion directe échouée. Essai avec d'autres méthodes..."
    
    # Test avec curl pour vérifier l'API REST
    echo ""
    echo "📋 Test 4: API REST Supabase..."
    curl -s "https://$PROJECT_REF.supabase.co/rest/v1/" -w "\nStatus: %{http_code}\n" || echo "❌ API REST inaccessible"
    
    echo ""
    echo "💡 Solutions possibles:"
    echo "1. Vérifier la configuration firewall/proxy"
    echo "2. Utiliser l'API REST via scripts"
    echo "3. Utiliser Supabase SQL Editor directement"
    
else
    echo "✅ Connexion PostgreSQL réussie!"
fi
