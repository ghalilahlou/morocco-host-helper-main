#!/bin/bash

# Script de vérification de la santé des Edge Functions
# Usage: ./scripts/health-check.sh

set -e

echo "🔍 Vérification de la santé des Edge Functions..."

# Vérifier que les services Docker sont en cours d'exécution
if ! docker-compose -f docker-compose.functions.yml ps | grep -q "Up"; then
    echo "❌ Les services Docker ne sont pas en cours d'exécution"
    exit 1
fi

# Liste des fonctions à tester
FUNCTIONS=(
    "sync-documents"
    "submit-guest-info"
    "generate-documents"
    "issue-guest-link"
    "resolve-guest-link"
)

BASE_URL="http://localhost:54321/functions/v1"

echo "🧪 Test des Edge Functions..."

for func in "${FUNCTIONS[@]}"; do
    echo "Testing $func..."
    
    # Test avec une requête OPTIONS (CORS)
    if curl -s -X OPTIONS "$BASE_URL/$func" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: authorization,content-type" \
        -H "Origin: http://localhost:3000" > /dev/null; then
        echo "✅ $func - CORS OK"
    else
        echo "❌ $func - CORS FAILED"
    fi
    
    # Test avec une requête POST (avec gestion d'erreur attendue)
    response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/$func" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -d '{"test": true}' || echo "000")
    
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "400" ] || [ "$http_code" = "401" ]; then
        echo "✅ $func - HTTP $http_code (OK)"
    else
        echo "❌ $func - HTTP $http_code (FAILED)"
    fi
done

echo "📊 Résumé des tests terminé"
echo "🔗 URL des fonctions: $BASE_URL"
