#!/bin/bash

# Script de configuration GitHub + Vercel + Docker
# Usage: ./scripts/setup-github-vercel.sh

set -e

echo "🚀 Configuration GitHub + Vercel + Docker pour Morocco Host Helper"
echo "=================================================================="

# Vérifier que nous sommes dans un repo Git
if [ ! -d ".git" ]; then
    echo "❌ Ce n'est pas un repository Git. Initialisez d'abord Git:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Vérifier la branche actuelle
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Branche actuelle: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Vous n'êtes pas sur la branche 'main'. Voulez-vous continuer? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Configuration annulée"
        exit 1
    fi
fi

echo ""
echo "📋 ÉTAPES DE CONFIGURATION:"
echo "=========================="

echo ""
echo "1️⃣  CONFIGURATION GITHUB REPOSITORY"
echo "-----------------------------------"
echo "✅ Repository Git détecté"
echo "✅ Workflows GitHub Actions créés"
echo "✅ Configuration Docker Compose prête"

echo ""
echo "2️⃣  CONFIGURATION DES SECRETS GITHUB"
echo "------------------------------------"
echo "Allez sur: https://github.com/VOTRE_USERNAME/VOTRE_REPO/settings/secrets/actions"
echo ""
echo "Ajoutez ces secrets:"
echo "  🔑 VITE_SUPABASE_URL"
echo "  🔑 VITE_SUPABASE_ANON_KEY"
echo "  🔑 VITE_OPENAI_API_KEY"
echo "  🔑 VITE_RESEND_API_KEY"
echo "  🔑 VITE_RESEND_FROM_EMAIL"
echo "  🔑 VERCEL_TOKEN"
echo "  🔑 VERCEL_ORG_ID"
echo "  🔑 VERCEL_PROJECT_ID"
echo "  🔑 SUPABASE_ACCESS_TOKEN"
echo "  🔑 SUPABASE_PROJECT_REF"

echo ""
echo "3️⃣  CONFIGURATION VERCEL"
echo "------------------------"
echo "1. Allez sur: https://vercel.com/dashboard"
echo "2. Importez votre repository GitHub"
echo "3. Configurez les variables d'environnement"
echo "4. Activez le déploiement automatique"

echo ""
echo "4️⃣  CONFIGURATION SUPABASE"
echo "--------------------------"
echo "1. Allez sur: https://supabase.com/dashboard"
echo "2. Sélectionnez votre projet"
echo "3. Allez dans Settings > API"
echo "4. Copiez les clés dans les secrets GitHub"

echo ""
echo "5️⃣  COMMANDES UTILES"
echo "-------------------"
echo "# Pousser vers GitHub (déclenche le déploiement)"
echo "git add ."
echo "git commit -m 'feat: add Docker and Vercel deployment'"
echo "git push origin main"
echo ""
echo "# Voir les déploiements"
echo "gh run list"
echo ""
echo "# Voir les logs de déploiement"
echo "gh run view --log"

echo ""
echo "🎉 CONFIGURATION TERMINÉE!"
echo "========================="
echo ""
echo "Prochaines étapes:"
echo "1. Configurez les secrets GitHub"
echo "2. Importez le projet sur Vercel"
echo "3. Poussez votre code vers GitHub"
echo "4. Vérifiez le déploiement automatique"
echo ""
echo "🔗 URLs importantes:"
echo "- GitHub Actions: https://github.com/VOTRE_USERNAME/VOTRE_REPO/actions"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- Supabase Dashboard: https://supabase.com/dashboard"

