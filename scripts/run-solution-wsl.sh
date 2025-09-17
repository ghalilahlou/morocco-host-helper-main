#!/bin/bash
# Application de la solution via WSL
# Morocco Host Helper Platform

echo "🔧 Application de la solution via WSL"
echo "====================================="

# Variables de connexion
PROJECT_REF="csopyblkfyofwkeqqegd"
DB_PASSWORD="1475963baSE69@"
DB_HOST="db.$PROJECT_REF.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

# Définir le mot de passe
export PGPASSWORD="$DB_PASSWORD"

# Fichier de solution
SOLUTION_FILE="scripts/solution-parfaite-finale.sql"

# Vérifier si le fichier existe
if [ ! -f "$SOLUTION_FILE" ]; then
    echo "❌ Fichier de solution non trouvé: $SOLUTION_FILE"
    exit 1
fi

echo "📂 Fichier de solution: $SOLUTION_FILE"
echo "🔗 Connexion à: $DB_HOST"
echo ""

# Créer un fichier de résultats
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
RESULT_FILE="solution-results-wsl-$TIMESTAMP.txt"

echo "📄 Résultats seront sauvés dans: $RESULT_FILE"
echo ""

# Demander confirmation
echo "⚠️  ATTENTION: Cette opération va modifier votre base de données"
echo "📋 Actions qui seront effectuées:"
echo "   - Création de la vue profiles"
echo "   - Ajout de la colonne total_amount"
echo "   - Création des fonctions SQL nécessaires"
echo "   - Mise à jour des données existantes"
echo ""

read -p "Voulez-vous continuer? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Opération annulée"
    exit 0
fi

# En-tête du rapport
cat > "$RESULT_FILE" << EOF
==========================================
RAPPORT D'APPLICATION DE SOLUTION WSL
Morocco Host Helper Platform
==========================================
Date: $(date)
Host: $DB_HOST
Fichier: $SOLUTION_FILE
==========================================

EOF

echo "🚀 Application de la solution..."

# Exécuter la solution
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SOLUTION_FILE" >> "$RESULT_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Solution appliquée avec succès!"
    echo "📄 Rapport sauvé: $RESULT_FILE"
    
    echo ""
    echo "🔍 Vérification post-application..."
    
    # Test rapide post-solution
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 'Vérification post-solution' as test;
    SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
        THEN '✅ Vue profiles créée'
        ELSE '❌ Vue profiles manquante'
      END as profiles_check;
    SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
        THEN '✅ Fonction get_users_for_admin créée'
        ELSE '❌ Fonction get_users_for_admin manquante'
      END as function_check;
    " >> "$RESULT_FILE" 2>&1
    
    echo ""
    echo "📊 VÉRIFICATION TERMINÉE"
    echo "======================="
    
    # Afficher les résultats de vérification
    tail -n 10 "$RESULT_FILE" | grep -E "(✅|❌)"
    
    echo ""
    echo "🎯 Prochaines étapes recommandées:"
    echo "1. Relancez le diagnostic: ./scripts/run-diagnostic-wsl.sh"
    echo "2. Testez l'interface admin de votre application"
    
else
    echo ""
    echo "❌ Erreur lors de l'application de la solution"
    echo "📄 Vérifiez le fichier: $RESULT_FILE"
    
    # Afficher les erreurs
    echo ""
    echo "🔍 Dernières erreurs:"
    tail -n 15 "$RESULT_FILE"
fi

echo ""
echo "====================================="
echo "Application de solution terminée"
