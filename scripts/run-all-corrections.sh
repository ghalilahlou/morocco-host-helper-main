#!/bin/bash
# Script pour exécuter toutes les corrections
# Usage: ./scripts/run-all-corrections.sh [connection_string]

set -e

echo "=========================================="
echo "🔧 CORRECTION COMPLÈTE - BASE DE DONNÉES"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: $0 [connection_string]"
    echo "Exemple: $0 'postgresql://postgres:password@localhost:5432/postgres'"
    echo ""
    echo "⚠️  ATTENTION : Ce script modifie la base de données !"
    echo "    Assure-toi d'avoir fait une sauvegarde !"
    echo ""
    read -p "Continuer ? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Annulé."
        exit 1
    fi
fi

CONNECTION_STRING="$1"

echo "🔧 Étape 1 : Supprimer la vue profiles..."
psql "$CONNECTION_STRING" -f scripts/correction-01-drop-profiles-view.sql
echo ""

echo "🔧 Étape 2 : Activer RLS sur les tables..."
psql "$CONNECTION_STRING" -f scripts/correction-02-enable-rls.sql
echo ""

echo "🔧 Étape 3 : Ajouter policy pour generated_documents..."
psql "$CONNECTION_STRING" -f scripts/correction-03-add-policy-generated-documents.sql
echo ""

echo "🔧 Étape 4 : Recréer les vues sans SECURITY DEFINER..."
psql "$CONNECTION_STRING" -f scripts/correction-04-recreate-views.sql
echo ""

echo "✅ Corrections terminées !"
echo ""
echo "📋 Exécuter maintenant la vérification finale :"
echo "   ./scripts/run-verification.sh [connection_string]"

