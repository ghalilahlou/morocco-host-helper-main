#!/bin/bash

# Script pour mettre à jour la structure des Edge Functions après extraction
# Ce script organise et met à jour les fonctions extraites

set -e

echo "🔄 Mise à jour de la structure des Edge Functions..."

# Configuration
EXTRACTED_DIR="./extracted_functions"
FUNCTIONS_DIR="./supabase/functions"
BACKUP_DIR="./supabase/functions_backup_$(date +%Y%m%d_%H%M%S)"

# Créer une sauvegarde des fonctions actuelles
if [ -d "$FUNCTIONS_DIR" ]; then
    echo "📁 Création d'une sauvegarde des fonctions actuelles..."
    cp -r "$FUNCTIONS_DIR" "$BACKUP_DIR"
    echo "✅ Sauvegarde créée: $BACKUP_DIR"
fi

# Vérifier si le dossier d'extraction existe
if [ ! -d "$EXTRACTED_DIR" ]; then
    echo "❌ Dossier d'extraction non trouvé: $EXTRACTED_DIR"
    echo "Veuillez d'abord exécuter le script d'extraction."
    exit 1
fi

echo "📥 Fonctions extraites trouvées dans: $EXTRACTED_DIR"

# Créer le dossier des fonctions s'il n'existe pas
mkdir -p "$FUNCTIONS_DIR"

# Fonction pour mettre à jour une fonction spécifique
update_function() {
    local func_name=$1
    local source_dir="$EXTRACTED_DIR/$func_name"
    local target_dir="$FUNCTIONS_DIR/$func_name"
    
    if [ -d "$source_dir" ]; then
        echo "🔄 Mise à jour de la fonction: $func_name"
        
        # Créer le dossier de destination
        mkdir -p "$target_dir"
        
        # Copier les fichiers
        cp -r "$source_dir"/* "$target_dir/"
        
        # Vérifier et créer index.ts si nécessaire
        if [ ! -f "$target_dir/index.ts" ]; then
            echo "⚠️  index.ts manquant pour $func_name, création d'un template..."
            cat > "$target_dir/index.ts" << EOF
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // TODO: Implémenter la logique de la fonction $func_name
    return new Response(
      JSON.stringify({ message: 'Fonction $func_name mise à jour' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Erreur dans $func_name:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
EOF
        fi
        
        echo "✅ Fonction $func_name mise à jour"
    else
        echo "⚠️  Fonction $func_name non trouvée dans l'extraction"
    fi
}

# Lister et mettre à jour toutes les fonctions extraites
if [ -d "$EXTRACTED_DIR" ]; then
    for func_dir in "$EXTRACTED_DIR"/*; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            update_function "$func_name"
        fi
    done
fi

# Mettre à jour les fichiers partagés
echo "🔄 Mise à jour des fichiers partagés..."
mkdir -p "$FUNCTIONS_DIR/_shared"

# Créer les fichiers partagés s'ils n'existent pas
if [ ! -f "$FUNCTIONS_DIR/_shared/cors.ts" ]; then
    cat > "$FUNCTIONS_DIR/_shared/cors.ts" << 'EOF'
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}
EOF
fi

if [ ! -f "$FUNCTIONS_DIR/_shared/errors.ts" ]; then
    cat > "$FUNCTIONS_DIR/_shared/errors.ts" << 'EOF'
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const handleError = (error: unknown) => {
  console.error('Erreur:', error)
  
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: error.statusCode 
      }
    )
  }
  
  return new Response(
    JSON.stringify({ error: 'Erreur interne du serveur' }),
    { 
      headers: { 'Content-Type': 'application/json' },
      status: 500 
    }
  )
}
EOF
fi

if [ ! -f "$FUNCTIONS_DIR/_shared/responseHelpers.ts" ]; then
    cat > "$FUNCTIONS_DIR/_shared/responseHelpers.ts" << 'EOF'
import { corsHeaders } from './cors.ts'

export const createResponse = (data: any, status: number = 200) => {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status 
    }
  )
}

export const createErrorResponse = (message: string, status: number = 400) => {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status 
    }
  )
}
EOF
fi

echo "✅ Structure des Edge Functions mise à jour!"
echo "📁 Fonctions mises à jour dans: $FUNCTIONS_DIR"
echo "📁 Sauvegarde des anciennes fonctions: $BACKUP_DIR"

# Afficher un résumé
echo ""
echo "📊 Résumé des fonctions mises à jour:"
ls -la "$FUNCTIONS_DIR" | grep "^d" | awk '{print "  - " $9}' | grep -v "^  - \.$" | grep -v "^  - \.\.$"

echo ""
echo "🎉 Mise à jour terminée avec succès!"
