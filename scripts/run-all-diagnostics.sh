#!/bin/bash
# Script pour exécuter tous les diagnostics
# Usage: ./scripts/run-all-diagnostics.sh [connection_string]

set -e

echo "=========================================="
echo "🔍 DIAGNOSTIC COMPLET - BASE DE DONNÉES"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: $0 [connection_string]"
    echo "Exemple: $0 'postgresql://postgres:password@localhost:5432/postgres'"
    echo ""
    echo "Ou configure les variables d'environnement:"
    echo "  export PGHOST=localhost"
    echo "  export PGPORT=5432"
    echo "  export PGDATABASE=postgres"
    echo "  export PGUSER=postgres"
    echo "  export PGPASSWORD=password"
    exit 1
fi

CONNECTION_STRING="$1"

echo "📋 Étape 1 : Diagnostic des vues..."
psql "$CONNECTION_STRING" -f scripts/diagnostic-01-check-views.sql
echo ""

echo "📋 Étape 2 : Diagnostic RLS des tables..."
psql "$CONNECTION_STRING" -f scripts/diagnostic-02-check-rls-tables.sql
echo ""

echo "📋 Étape 3 : Diagnostic SECURITY DEFINER..."
psql "$CONNECTION_STRING" -f scripts/diagnostic-03-check-security-definer.sql
echo ""

echo "✅ Diagnostic terminé !"
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Examiner les résultats ci-dessus"
echo "   2. Exécuter les scripts de correction si nécessaire"
echo "   3. Exécuter la vérification finale"

