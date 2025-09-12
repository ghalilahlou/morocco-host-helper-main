#!/bin/bash

# Script de déploiement automatique sur GitHub et Vercel
# Bash script pour Linux/macOS

echo "🚀 Déploiement automatique sur GitHub et Vercel"
echo "==============================================="

# Vérifier si Git est installé
if command -v git &> /dev/null; then
    echo "✅ Git détecté: $(git --version)"
else
    echo "❌ Git n'est pas installé. Veuillez installer Git d'abord."
    exit 1
fi

# Vérifier si Node.js est installé
if command -v node &> /dev/null; then
    echo "✅ Node.js détecté: $(node --version)"
else
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord."
    exit 1
fi

# Vérifier les variables d'environnement
echo ""
echo "🔍 Vérification des variables d'environnement..."

if [ ! -f ".env" ]; then
    echo "⚠️ Fichier .env non trouvé. Création d'un exemple..."
    cp env.example .env
    echo "📝 Veuillez configurer le fichier .env avec vos clés Supabase"
fi

# Nettoyer le projet
echo ""
echo "🧹 Nettoyage du projet..."
node scripts/cleanup-for-deployment.js

# Vérifier le statut Git
echo ""
echo "📋 Statut Git actuel:"
git status --short

# Demander confirmation
echo ""
read -p "❓ Voulez-vous continuer avec le déploiement ? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ Déploiement annulé par l'utilisateur."
    exit 0
fi

# Ajouter tous les fichiers modifiés
echo ""
echo "📤 Ajout des fichiers au commit..."
git add .

# Créer le commit
commitMessage="feat: Déploiement complet - 4 types de documents + corrections"
echo "💾 Création du commit: $commitMessage"
git commit -m "$commitMessage"

# Vérifier si un remote existe
if ! git remote get-url origin &> /dev/null; then
    echo ""
    echo "🔗 Configuration du remote GitHub..."
    read -p "Entrez l'URL de votre repository GitHub (ex: https://github.com/username/repo.git): " githubUrl
    git remote add origin "$githubUrl"
fi

# Pousser vers GitHub
echo ""
echo "📤 Push vers GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Code poussé vers GitHub avec succès !"
else
    echo "❌ Erreur lors du push vers GitHub."
    exit 1
fi

# Instructions pour Vercel
echo ""
echo "🌐 Instructions pour Vercel:"
echo "1. Allez sur https://vercel.com"
echo "2. Connectez-vous avec votre compte GitHub"
echo "3. Cliquez sur 'New Project'"
echo "4. Importez votre repository"
echo "5. Configuration recommandée:"
echo "   - Framework: Vite"
echo "   - Build Command: npm run vercel-build"
echo "   - Output Directory: dist"
echo "   - Install Command: npm install --legacy-peer-deps"

# Variables d'environnement pour Vercel
echo ""
echo "🔑 Variables d'environnement à configurer dans Vercel:"
echo "VITE_SUPABASE_URL=https://votre-projet.supabase.co"
echo "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Instructions pour Supabase
echo ""
echo "🔧 Instructions pour Supabase Edge Functions:"
echo "1. Allez sur https://supabase.com/dashboard"
echo "2. Sélectionnez votre projet"
echo "3. Edge Functions > Deploy"
echo "4. Déployez ces fonctions:"
echo "   - submit-guest-info"
echo "   - generate-contract"
echo "   - generate-police-forms"
echo "   - generate-id-documents"
echo "   - save-contract-signature"
echo "   - storage-sign-url"

echo ""
echo "🎉 Déploiement GitHub terminé !"
echo "📋 Prochaines étapes:"
echo "1. Configurer Vercel avec les instructions ci-dessus"
echo "2. Déployer les Edge Functions sur Supabase"
echo "3. Tester l'application déployée"

echo ""
echo "📚 Documentation complète disponible dans:"
echo "   - GUIDE-DEPLOIEMENT-COMPLET.md"
echo "   - GUIDE-CORRECTION-FICHE-ID.md"
