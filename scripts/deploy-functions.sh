#!/bin/bash

# Script de déploiement des Edge Functions via Docker
# Usage: ./scripts/deploy-functions.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_NAME="morocco-host-helper"
FUNCTIONS_IMAGE="${PROJECT_NAME}-functions:${ENVIRONMENT}"

echo "🚀 Déploiement des Edge Functions - Environment: $ENVIRONMENT"

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution"
    exit 1
fi

# Vérifier que les variables d'environnement sont définies
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Variables d'environnement Supabase manquantes"
    echo "Veuillez définir: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Charger les variables d'environnement depuis .env si disponible
if [ -f ".env" ]; then
    echo "📋 Chargement des variables d'environnement depuis .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Construire l'image Docker pour les Edge Functions
echo "🔨 Construction de l'image Docker pour les Edge Functions..."
docker build -f Dockerfile.functions -t "$FUNCTIONS_IMAGE" .

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
docker-compose -f docker-compose.functions.yml down || true

# Démarrer les services
echo "🚀 Démarrage des Edge Functions..."
docker-compose -f docker-compose.functions.yml up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier la santé des services
echo "🔍 Vérification de la santé des services..."
if docker-compose -f docker-compose.functions.yml ps | grep -q "Up"; then
    echo "✅ Edge Functions déployées avec succès!"
    
    # Afficher les logs
    echo "📋 Logs des Edge Functions:"
    docker-compose -f docker-compose.functions.yml logs --tail=20 supabase-functions
    
    # Tester une fonction
    echo "🧪 Test de la fonction sync-documents..."
    curl -f http://localhost:54321/functions/v1/sync-documents \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"bookingId":"test"}' || echo "⚠️ Test de fonction échoué (normal si pas de booking test)"
    
else
    echo "❌ Échec du déploiement des Edge Functions"
    docker-compose -f docker-compose.functions.yml logs
    exit 1
fi

echo "🎉 Déploiement terminé avec succès!"
echo "📡 Edge Functions disponibles sur: http://localhost:54321"
echo "🔗 URL des fonctions: http://localhost:54321/functions/v1/"
