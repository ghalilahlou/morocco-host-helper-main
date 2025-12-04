#!/bin/bash
# Script de déploiement de l'Edge Function issue-guest-link

echo "🚀 Déploiement de l'Edge Function issue-guest-link..."

# Vérifier si Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé."
    echo "Installez-le avec: npm install -g supabase"
    exit 1
fi

# Se connecter (si pas déjà fait)
echo "📝 Connexion à Supabase..."
supabase login

# Lier le projet (si pas déjà fait)
echo "🔗 Liaison du projet..."
echo "Entrez votre Project Reference (trouvable dans Settings > General > Reference ID):"
read PROJECT_REF
supabase link --project-ref $PROJECT_REF

# Déployer la fonction
echo "📦 Déploiement de la fonction..."
supabase functions deploy issue-guest-link

echo "✅ Déploiement terminé !"
echo ""
echo "⚠️ IMPORTANT : Configurez maintenant la variable d'environnement :"
echo "1. Allez sur Supabase Dashboard > Settings > Edge Functions > Secrets"
echo "2. Ajoutez: PUBLIC_APP_URL = https://checky.ma"
echo "3. Cliquez sur Save"

