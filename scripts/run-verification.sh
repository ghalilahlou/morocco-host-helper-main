#!/bin/bash
# Script pour exécuter la vérification finale
# Usage: ./scripts/run-verification.sh [connection_string]

set -e

echo "=========================================="
echo "✅ VÉRIFICATION FINALE"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: $0 [connection_string]"
    echo "Exemple: $0 'postgresql://postgres:password@localhost:5432/postgres'"
    exit 1
fi

CONNECTION_STRING="$1"

psql "$CONNECTION_STRING" -f scripts/verification-finale.sql

echo ""
echo "✅ Vérification terminée !"
echo ""
echo "📊 Si tous les statuts sont ✅, tous les problèmes sont résolus !"

