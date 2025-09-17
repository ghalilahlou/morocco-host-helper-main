# Installation simple de Supabase CLI
Write-Host "🚀 Installation Supabase CLI" -ForegroundColor Green

# Créer le dossier
$supabaseDir = "$env:USERPROFILE\.supabase"
if (!(Test-Path $supabaseDir)) {
    New-Item -ItemType Directory -Path $supabaseDir -Force
    Write-Host "📁 Dossier créé: $supabaseDir" -ForegroundColor Blue
}

# Télécharger si pas déjà fait
$downloadPath = "$supabaseDir\supabase-cli.tar.gz"
if (!(Test-Path $downloadPath)) {
    Write-Host "⬇️ Téléchargement..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath
    Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
}

# Extraire
Write-Host "📦 Extraction..." -ForegroundColor Yellow
Set-Location $supabaseDir
tar -xzf "supabase-cli.tar.gz" 2>$null
Write-Host "✅ Extraction terminée" -ForegroundColor Green

# Tester l'exécutable
$exePath = "$supabaseDir\supabase.exe"
if (Test-Path $exePath) {
    Write-Host "✅ Exécutable trouvé: $exePath" -ForegroundColor Green
    
    # Test de version
    $version = & $exePath --version 2>$null
    if ($version) {
        Write-Host "✅ Version: $version" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Exécutable non trouvé" -ForegroundColor Red
}

Write-Host "🎉 Installation terminée!" -ForegroundColor Green
Write-Host "💡 Utilisez: $exePath pour lancer Supabase CLI" -ForegroundColor Blue

# Retourner au dossier original
Set-Location $PSScriptRoot\..
