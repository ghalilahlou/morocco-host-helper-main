# ==========================================
# INSTALLATION COMPLÈTE SUPABASE CLI + TESTS
# Morocco Host Helper Platform
# ==========================================

param(
    [switch]$SkipInstall = $false,
    [switch]$RunTests = $false,
    [string]$ProjectUrl = "",
    [string]$AnonKey = "",
    [string]$ServiceRoleKey = "",
    [string]$DatabasePassword = ""
)

Write-Host ""
Write-Host "🚀 INSTALLATION COMPLÈTE SUPABASE CLI" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Morocco Host Helper Platform" -ForegroundColor Blue
Write-Host ""

# Étape 1: Installation de Supabase CLI
if (-not $SkipInstall) {
    Write-Host "📦 ÉTAPE 1: Installation de Supabase CLI" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    # Exécuter le script d'installation
    if (Test-Path "scripts\install-supabase-cli.ps1") {
        & "scripts\install-supabase-cli.ps1"
    } else {
        Write-Host "❌ Script d'installation non trouvé" -ForegroundColor Red
        return
    }
    
    Write-Host ""
    Write-Host "⏳ Veuillez redémarrer PowerShell après cette installation" -ForegroundColor Yellow
    Write-Host "📝 Puis relancez ce script avec: .\scripts\setup-complete.ps1 -SkipInstall" -ForegroundColor Yellow
    Write-Host ""
    return
}

# Étape 2: Vérification de l'installation
Write-Host "🔍 ÉTAPE 2: Vérification de l'installation" -ForegroundColor Cyan
Write-Host "-------------------------------------------" -ForegroundColor Gray

try {
    $version = supabase --version 2>$null
    if ($version) {
        Write-Host "✅ Supabase CLI installé: $version" -ForegroundColor Green
    } else {
        Write-Host "❌ Supabase CLI non détecté dans le PATH" -ForegroundColor Red
        Write-Host "💡 Essayez de redémarrer PowerShell ou d'installer manuellement" -ForegroundColor Yellow
        return
    }
} catch {
    Write-Host "❌ Supabase CLI non accessible" -ForegroundColor Red
    Write-Host "💡 Redémarrez PowerShell et réessayez" -ForegroundColor Yellow
    return
}

# Étape 3: Configuration de la connexion
Write-Host ""
Write-Host "🔧 ÉTAPE 3: Configuration de la connexion" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Gray

# Vérifier si déjà configuré
if (Test-Path ".env.local") {
    Write-Host "ℹ️ Configuration existante détectée" -ForegroundColor Blue
    $reconfigure = Read-Host "Voulez-vous reconfigurer? (y/N)"
    if ($reconfigure -ne "y") {
        Write-Host "✅ Utilisation de la configuration existante" -ForegroundColor Green
    } else {
        # Reconfigurer
        & "scripts\configure-supabase-connection.ps1" -ProjectUrl $ProjectUrl -AnonKey $AnonKey -ServiceRoleKey $ServiceRoleKey -DatabasePassword $DatabasePassword
    }
} else {
    # Première configuration
    & "scripts\configure-supabase-connection.ps1" -ProjectUrl $ProjectUrl -AnonKey $AnonKey -ServiceRoleKey $ServiceRoleKey -DatabasePassword $DatabasePassword
}

# Étape 4: Test de connexion
Write-Host ""
Write-Host "🔗 ÉTAPE 4: Test de connexion" -ForegroundColor Cyan
Write-Host "------------------------------" -ForegroundColor Gray

if (Test-Path "scripts\test-supabase-connection.ps1") {
    $connectionTest = & "scripts\test-supabase-connection.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion Supabase validée" -ForegroundColor Green
    } else {
        Write-Host "❌ Problème de connexion détecté" -ForegroundColor Red
        Write-Host "💡 Vérifiez vos informations de connexion" -ForegroundColor Yellow
        return
    }
} else {
    Write-Host "⚠️ Script de test de connexion non trouvé" -ForegroundColor Yellow
}

# Étape 5: Exécution des tests (optionnel)
if ($RunTests) {
    Write-Host ""
    Write-Host "🧪 ÉTAPE 5: Exécution des tests automatiques" -ForegroundColor Cyan
    Write-Host "---------------------------------------------" -ForegroundColor Gray
    
    & "scripts\run-sql-tests.ps1" -QuickTest
}

# Résumé final
Write-Host ""
Write-Host "🎉 INSTALLATION TERMINÉE!" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

Write-Host ""
Write-Host "📋 COMMANDES DISPONIBLES:" -ForegroundColor Blue
Write-Host "-------------------------" -ForegroundColor Gray
Write-Host "🔍 Test rapide:           .\scripts\run-sql-tests.ps1 -QuickTest" -ForegroundColor White
Write-Host "📊 Tests complets:        .\scripts\run-sql-tests.ps1" -ForegroundColor White
Write-Host "🔧 Reconfiguration:       .\scripts\configure-supabase-connection.ps1" -ForegroundColor White
Write-Host "🔗 Test connexion:        .\scripts\test-supabase-connection.ps1" -ForegroundColor White

Write-Host ""
Write-Host "📖 GUIDE D'UTILISATION:" -ForegroundColor Blue
Write-Host "-----------------------" -ForegroundColor Gray
Write-Host "1. 🚀 Tests rapides (2 min):    .\scripts\run-sql-tests.ps1 -QuickTest -OpenResults" -ForegroundColor Cyan
Write-Host "2. 📊 Tests complets (5 min):   .\scripts\run-sql-tests.ps1 -OpenResults" -ForegroundColor Cyan
Write-Host "3. 🔍 Analyse spécifique:       .\scripts\run-sql-tests.ps1 -TestFile 'scripts\test-coherence-complete.sql'" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎯 PROCHAINES ÉTAPES RECOMMANDÉES:" -ForegroundColor Blue
Write-Host "----------------------------------" -ForegroundColor Gray
Write-Host "1. Exécutez un test rapide pour vérifier le système" -ForegroundColor White
Write-Host "2. Si des ❌ apparaissent, appliquez solution-parfaite-finale.sql" -ForegroundColor White
Write-Host "3. Relancez les tests pour confirmer les corrections" -ForegroundColor White

Write-Host ""
Write-Host "✨ Système prêt pour l'analyse automatique!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
