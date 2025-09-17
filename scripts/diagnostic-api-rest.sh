#!/bin/bash
# Diagnostic via API REST Supabase
# Morocco Host Helper Platform

echo "🚀 Diagnostic automatique via API REST"
echo "======================================"

# Configuration
PROJECT_REF="csopyblkfyofwkeqqegd"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"
SUPABASE_URL="https://$PROJECT_REF.supabase.co"

echo "🔗 URL: $SUPABASE_URL"
echo "🔑 Clé API: ${ANON_KEY:0:20}..."
echo ""

# Créer fichier de résultats
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
RESULT_FILE="diagnostic-api-$TIMESTAMP.txt"

echo "📄 Résultats dans: $RESULT_FILE"
echo ""

# En-tête du rapport
cat > "$RESULT_FILE" << EOF
==========================================
DIAGNOSTIC API REST - MOROCCO HOST HELPER
==========================================
Date: $(date)
Project: $PROJECT_REF
URL: $SUPABASE_URL
==========================================

EOF

echo "🧪 DÉMARRAGE DES TESTS..." | tee -a "$RESULT_FILE"
echo "=========================" | tee -a "$RESULT_FILE"

# Test 1: Connexion API
echo "" | tee -a "$RESULT_FILE"
echo "📋 Test 1: Connexion API REST..." | tee -a "$RESULT_FILE"

API_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/")

HTTP_CODE=$(echo "$API_TEST" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ API REST accessible" | tee -a "$RESULT_FILE"
else
    echo "❌ API REST inaccessible (Code: $HTTP_CODE)" | tee -a "$RESULT_FILE"
    echo "$API_TEST" >> "$RESULT_FILE"
fi

# Test 2: Tables principales
echo "" | tee -a "$RESULT_FILE"
echo "📋 Test 2: Vérification des tables..." | tee -a "$RESULT_FILE"

TABLES=("properties" "bookings" "host_profiles")

for table in "${TABLES[@]}"; do
    echo "   Test table: $table" | tee -a "$RESULT_FILE"
    
    TABLE_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" \
      "$SUPABASE_URL/rest/v1/$table?limit=1")
    
    TABLE_HTTP_CODE=$(echo "$TABLE_TEST" | grep "HTTP_CODE:" | cut -d: -f2)
    
    if [ "$TABLE_HTTP_CODE" = "200" ]; then
        # Compter les enregistrements
        COUNT_TEST=$(curl -s \
          -H "apikey: $ANON_KEY" \
          -H "Authorization: Bearer $ANON_KEY" \
          -H "Prefer: count=exact" \
          "$SUPABASE_URL/rest/v1/$table?select=id")
        
        if echo "$COUNT_TEST" | grep -q "content-range"; then
            COUNT=$(echo "$COUNT_TEST" | grep -o 'content-range: [0-9]*-[0-9]*/[0-9]*' | cut -d/ -f2)
            echo "   ✅ $table: $COUNT enregistrements" | tee -a "$RESULT_FILE"
        else
            echo "   ✅ $table: accessible" | tee -a "$RESULT_FILE"
        fi
    else
        echo "   ❌ $table: inaccessible (Code: $TABLE_HTTP_CODE)" | tee -a "$RESULT_FILE"
    fi
done

# Test 3: Utilisateurs (auth.users via RPC si possible)
echo "" | tee -a "$RESULT_FILE"
echo "📋 Test 3: Utilisateurs système..." | tee -a "$RESULT_FILE"

# Comme auth.users n'est pas directement accessible, on teste via une fonction RPC
RPC_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$SUPABASE_URL/rest/v1/rpc/get_users_for_admin")

RPC_HTTP_CODE=$(echo "$RPC_TEST" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$RPC_HTTP_CODE" = "200" ]; then
    USER_COUNT=$(echo "$RPC_TEST" | grep -o '\[.*\]' | jq '. | length' 2>/dev/null || echo "N/A")
    echo "✅ Fonction get_users_for_admin: $USER_COUNT utilisateurs" | tee -a "$RESULT_FILE"
elif [ "$RPC_HTTP_CODE" = "404" ]; then
    echo "❌ Fonction get_users_for_admin: MANQUANTE" | tee -a "$RESULT_FILE"
else
    echo "⚠️ Fonction get_users_for_admin: Erreur (Code: $RPC_HTTP_CODE)" | tee -a "$RESULT_FILE"
fi

# Test 4: Vue profiles
echo "" | tee -a "$RESULT_FILE"
echo "📋 Test 4: Vue profiles..." | tee -a "$RESULT_FILE"

PROFILES_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/profiles?limit=1")

PROFILES_HTTP_CODE=$(echo "$PROFILES_TEST" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$PROFILES_HTTP_CODE" = "200" ]; then
    echo "✅ Vue profiles: accessible" | tee -a "$RESULT_FILE"
elif [ "$PROFILES_HTTP_CODE" = "404" ]; then
    echo "❌ Vue profiles: MANQUANTE" | tee -a "$RESULT_FILE"
else
    echo "⚠️ Vue profiles: Erreur (Code: $PROFILES_HTTP_CODE)" | tee -a "$RESULT_FILE"
fi

# Résumé du diagnostic
echo "" | tee -a "$RESULT_FILE"
echo "🏁 RÉSUMÉ DU DIAGNOSTIC" | tee -a "$RESULT_FILE"
echo "======================" | tee -a "$RESULT_FILE"

# Compter les succès et échecs
SUCCESS_COUNT=0
TOTAL_TESTS=0

# Analyser les résultats
if grep -q "✅ API REST accessible" "$RESULT_FILE"; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_TESTS++))

for table in "${TABLES[@]}"; do
    if grep -q "✅ $table:" "$RESULT_FILE"; then
        ((SUCCESS_COUNT++))
    fi
    ((TOTAL_TESTS++))
done

if grep -q "✅ Fonction get_users_for_admin:" "$RESULT_FILE"; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_TESTS++))

if grep -q "✅ Vue profiles:" "$RESULT_FILE"; then
    ((SUCCESS_COUNT++))
fi
((TOTAL_TESTS++))

echo "Score: $SUCCESS_COUNT/$TOTAL_TESTS tests réussis" | tee -a "$RESULT_FILE"

if [ $SUCCESS_COUNT -eq $TOTAL_TESTS ]; then
    echo "✅ SYSTÈME OPÉRATIONNEL" | tee -a "$RESULT_FILE"
    echo "🎯 Interface admin prête à utiliser" | tee -a "$RESULT_FILE"
elif [ $SUCCESS_COUNT -ge 3 ]; then
    echo "⚠️ SYSTÈME PARTIELLEMENT FONCTIONNEL" | tee -a "$RESULT_FILE"
    echo "🔧 Quelques corrections recommandées" | tee -a "$RESULT_FILE"
else
    echo "❌ CORRECTIONS REQUISES" | tee -a "$RESULT_FILE"
    echo "🚨 Appliquez solution-parfaite-finale.sql" | tee -a "$RESULT_FILE"
fi

echo "" | tee -a "$RESULT_FILE"
echo "📄 Rapport complet sauvé dans: $RESULT_FILE" | tee -a "$RESULT_FILE"
echo "🔗 Pour corrections: ./scripts/apply-solution-api.sh" | tee -a "$RESULT_FILE"

echo ""
echo "======================================"
echo "Diagnostic terminé! Consultez le rapport: $RESULT_FILE"
