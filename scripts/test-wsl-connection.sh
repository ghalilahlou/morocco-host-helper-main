#!/bin/bash
# Test de connexion via WSL
# Morocco Host Helper Platform

echo "🚀 Test de connexion via WSL"
echo "============================="

# Variables de connexion
PROJECT_REF="csopyblkfyofwkeqqegd"
DB_PASSWORD="1475963baSE69@"
DB_HOST="db.$PROJECT_REF.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

echo "📋 Informations de connexion:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo "Database: $DB_NAME"
echo ""

# Définir le mot de passe
export PGPASSWORD="$DB_PASSWORD"

echo "🔍 Test de connexion..."

# Vérifier si psql est disponible dans WSL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client non installé dans WSL"
    echo "📦 Installation de PostgreSQL client..."
    sudo apt update && sudo apt install -y postgresql-client
fi

# Test de connexion simple
echo "🔗 Tentative de connexion..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 'Connexion réussie!' as status, version() as postgres_version;"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CONNEXION RÉUSSIE!"
    echo "🎯 Prêt pour les tests automatiques"
else
    echo ""
    echo "❌ Échec de connexion"
    echo "💡 Vérifiez les informations de connexion"
fi
