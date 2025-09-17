#!/bin/bash
# Diagnostic complet via WSL
# Morocco Host Helper Platform

echo "🧪 Diagnostic complet via WSL"
echo "=============================="

# Variables de connexion
PROJECT_REF="csopyblkfyofwkeqqegd"
DB_PASSWORD="1475963baSE69@"
DB_HOST="db.$PROJECT_REF.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

# Définir le mot de passe
export PGPASSWORD="$DB_PASSWORD"

# Fichier de diagnostic SQL
DIAGNOSTIC_FILE="scripts/test-quick-diagnosis.sql"

# Vérifier si le fichier existe (convertir le chemin Windows vers WSL)
if [ ! -f "$DIAGNOSTIC_FILE" ]; then
    echo "❌ Fichier de diagnostic non trouvé: $DIAGNOSTIC_FILE"
    echo "📁 Contenu du dossier scripts:"
    ls -la scripts/*.sql 2>/dev/null || echo "Aucun fichier SQL trouvé"
    exit 1
fi

echo "📂 Fichier de diagnostic: $DIAGNOSTIC_FILE"
echo "🔗 Connexion à: $DB_HOST"
echo ""

# Créer un fichier de résultats avec timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
RESULT_FILE="test-results-wsl-$TIMESTAMP.txt"

echo "📄 Résultats seront sauvés dans: $RESULT_FILE"
echo ""

# En-tête du rapport
cat > "$RESULT_FILE" << EOF
==========================================
RAPPORT DE DIAGNOSTIC WSL
Morocco Host Helper Platform
==========================================
Date: $(date)
Host: $DB_HOST
Fichier: $DIAGNOSTIC_FILE
==========================================

EOF

echo "🚀 Exécution du diagnostic..."

# Exécuter le diagnostic
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DIAGNOSTIC_FILE" >> "$RESULT_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Diagnostic exécuté avec succès!"
    echo "📄 Rapport sauvé: $RESULT_FILE"
    
    # Afficher un aperçu des résultats
    echo ""
    echo "📊 APERÇU DES RÉSULTATS:"
    echo "======================="
    
    # Extraire les résultats importants
    grep -E "(✅|❌|🚨|⚠️)" "$RESULT_FILE" 2>/dev/null || echo "Résultats disponibles dans le fichier"
    
    echo ""
    echo "📋 Pour voir le rapport complet:"
    echo "cat $RESULT_FILE"
    
    echo ""
    echo "🔍 Actions recommandées basées sur les résultats:"
    
    # Analyser les résultats pour donner des recommandations
    if grep -q "❌" "$RESULT_FILE"; then
        echo "⚠️  Des problèmes détectés - Corrections nécessaires"
        echo "🔧 Exécutez: ./scripts/run-solution-wsl.sh"
    elif grep -q "✅.*OK" "$RESULT_FILE"; then
        echo "✅ Système opérationnel - Interface admin prête"
    else
        echo "🔍 Vérifiez le rapport pour plus de détails"
    fi
    
else
    echo ""
    echo "❌ Erreur lors du diagnostic"
    echo "📄 Vérifiez le fichier: $RESULT_FILE"
    
    # Afficher les dernières lignes pour debug
    echo ""
    echo "🔍 Dernières lignes du log:"
    tail -n 10 "$RESULT_FILE"
fi

echo ""
echo "=============================="
echo "Diagnostic terminé"
