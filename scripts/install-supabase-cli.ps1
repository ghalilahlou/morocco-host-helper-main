# ==========================================
# INSTALLATION ET CONFIGURATION SUPABASE CLI
# Morocco Host Helper Platform
# ==========================================

Write-Host "🚀 Installation de Supabase CLI" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Vérifier si supabase est déjà installé
try {
    $version = supabase --version 2>$null
    if ($version) {
        Write-Host "✅ Supabase CLI déjà installé: $version" -ForegroundColor Green
        return
    }
} catch {
    Write-Host "ℹ️ Supabase CLI non trouvé, installation en cours..." -ForegroundColor Yellow
}

# Créer le dossier pour Supabase CLI
$supabaseDir = "$env:USERPROFILE\.supabase"
if (!(Test-Path $supabaseDir)) {
    New-Item -ItemType Directory -Path $supabaseDir -Force | Out-Null
    Write-Host "📁 Dossier créé: $supabaseDir" -ForegroundColor Blue
}

# Télécharger la dernière version
Write-Host "⬇️ Téléchargement de Supabase CLI..." -ForegroundColor Yellow
$downloadUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz"
$downloadPath = "$supabaseDir\supabase-cli.tar.gz"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du téléchargement: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Extraire l'archive (nécessite tar sur Windows 10+)
Write-Host "📦 Extraction de l'archive..." -ForegroundColor Yellow
try {
    Set-Location $supabaseDir
    tar -xzf "supabase-cli.tar.gz"
    Write-Host "✅ Extraction terminée" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'extraction. Veuillez extraire manuellement: $downloadPath" -ForegroundColor Red
    Write-Host "💡 Ou utilisez 7-Zip pour extraire l'archive" -ForegroundColor Yellow
    return
}

# Ajouter au PATH si pas déjà présent
$currentPath = $env:PATH
if ($currentPath -notlike "*$supabaseDir*") {
    Write-Host "🔧 Ajout de Supabase CLI au PATH..." -ForegroundColor Yellow
    
    # Ajouter au PATH utilisateur
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$supabaseDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;$supabaseDir", "User")
        Write-Host "✅ PATH utilisateur mis à jour" -ForegroundColor Green
    }
    
    # Ajouter au PATH de la session actuelle
    $env:PATH = "$env:PATH;$supabaseDir"
    Write-Host "✅ PATH session mis à jour" -ForegroundColor Green
}

# Vérifier l'installation
Write-Host "🔍 Vérification de l'installation..." -ForegroundColor Yellow
try {
    $version = & "$supabaseDir\supabase.exe" --version 2>$null
    if ($version) {
        Write-Host "✅ Supabase CLI installé avec succès!" -ForegroundColor Green
        Write-Host "📋 Version: $version" -ForegroundColor Blue
    } else {
        Write-Host "⚠️ Installation peut être réussie mais vérification échouée" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Installation terminée mais vérification échouée" -ForegroundColor Yellow
    Write-Host "💡 Redémarrez PowerShell et testez: supabase --version" -ForegroundColor Blue
}

Write-Host ""
Write-Host "🎉 Installation terminée!" -ForegroundColor Green
Write-Host "📝 Prochaines étapes:" -ForegroundColor Blue
Write-Host "   1. Redémarrez PowerShell" -ForegroundColor White
Write-Host "   2. Testez: supabase --version" -ForegroundColor White
Write-Host "   3. Configurez: supabase login" -ForegroundColor White
Write-Host "=================================" -ForegroundColor Green
