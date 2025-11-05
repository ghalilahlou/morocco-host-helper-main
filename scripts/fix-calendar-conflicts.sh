#!/bin/bash
# Script pour corriger les problèmes de calendrier et de conflits
# Date: 2025-01-31

echo "🚀 Correction des conflits de calendrier..."
echo "==========================================="

# 1. Appliquer les migrations
echo "📝 Application des migrations..."
npx supabase migration up

# 2. Vérifier les doublons
echo ""
echo "🔍 Vérification des doublons..."
npx supabase db execute --file scripts/check-duplicates.sql

# 3. Redémarrer le serveur local pour recharger les fonctions
echo ""
echo "🔄 Redémarrage du serveur local..."
npx supabase stop
npx supabase start

# 4. Afficher le statut
echo ""
echo "✅ Corrections appliquées avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. Ouvrir http://localhost:3000"
echo "  2. Vérifier que les nouvelles réservations détectent les conflits"
echo "  3. Consulter la documentation: docs/CALENDRIER_GESTION_CONFLITS.md"
echo "  4. Si des doublons existent, exécuter le nettoyage:"
echo "     npx supabase db execute --file scripts/cleanup-duplicates.sql"
echo ""
echo "==========================================="

