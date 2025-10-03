#!/bin/bash

# Script pour extraire les Edge Functions de Supabase via Docker
# Ce script se connecte à votre base de données Supabase et extrait les fonctions existantes

set -e

echo "🚀 Démarrage de l'extraction des Edge Functions de Supabase..."

# Configuration
PROJECT_ID="csopyblkfyofwkeqqegd"
SUPABASE_URL="https://hboawihrwtwxmmnzawph.supabase.co"
BACKUP_DIR="./supabase/functions_backup_$(date +%Y%m%d_%H%M%S)"

# Créer le dossier de sauvegarde
mkdir -p "$BACKUP_DIR"

echo "📁 Création du dossier de sauvegarde: $BACKUP_DIR"

# Vérifier si Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

echo "✅ Docker est en cours d'exécution"

# Créer un script SQL pour extraire les fonctions
cat > extract_functions.sql << 'EOF'
-- Script pour extraire les Edge Functions de Supabase
-- Ce script récupère toutes les fonctions stockées dans la base de données

-- Lister toutes les fonctions existantes
SELECT 
    schemaname,
    functionname,
    definition
FROM pg_functions 
WHERE schemaname IN ('public', 'supabase_functions')
ORDER BY schemaname, functionname;

-- Extraire les fonctions spécifiques aux Edge Functions
SELECT 
    'edge_function' as type,
    name,
    code,
    created_at,
    updated_at
FROM supabase_functions.functions
ORDER BY name;
EOF

echo "📝 Script SQL créé pour l'extraction"

# Créer un conteneur temporaire pour se connecter à Supabase
echo "🐳 Création du conteneur de connexion..."

# Utiliser le CLI Supabase pour extraire les fonctions
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI trouvé"
    
    # Se connecter au projet
    echo "🔗 Connexion au projet Supabase..."
    supabase link --project-ref $PROJECT_ID
    
    # Extraire les fonctions
    echo "📤 Extraction des Edge Functions..."
    supabase functions list > "$BACKUP_DIR/functions_list.txt"
    
    # Pour chaque fonction, extraire le code
    while IFS= read -r function_name; do
        if [[ "$function_name" != "Name" && "$function_name" != "" ]]; then
            echo "📥 Extraction de la fonction: $function_name"
            supabase functions download "$function_name" --output-dir "$BACKUP_DIR/extracted_functions"
        fi
    done < "$BACKUP_DIR/functions_list.txt"
    
else
    echo "⚠️  Supabase CLI non trouvé. Installation..."
    
    # Installer Supabase CLI via Docker
    docker run --rm -v "$(pwd):/workspace" -w /workspace supabase/cli:latest functions list > "$BACKUP_DIR/functions_list.txt"
    
    # Extraire chaque fonction
    while IFS= read -r function_name; do
        if [[ "$function_name" != "Name" && "$function_name" != "" ]]; then
            echo "📥 Extraction de la fonction: $function_name"
            docker run --rm -v "$(pwd):/workspace" -w /workspace supabase/cli:latest functions download "$function_name" --output-dir "$BACKUP_DIR/extracted_functions"
        fi
    done < "$BACKUP_DIR/functions_list.txt"
fi

echo "✅ Extraction terminée!"
echo "📁 Fonctions extraites dans: $BACKUP_DIR"
echo "📋 Liste des fonctions: $BACKUP_DIR/functions_list.txt"

# Nettoyer les fichiers temporaires
rm -f extract_functions.sql

echo "🎉 Processus d'extraction terminé avec succès!"
