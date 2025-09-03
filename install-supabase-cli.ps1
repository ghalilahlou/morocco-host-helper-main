# Script d'installation du CLI Supabase
Write-Host "Installation du CLI Supabase..." -ForegroundColor Cyan

# Créer le dossier bin s'il n'existe pas
if (!(Test-Path "bin")) {
    New-Item -ItemType Directory -Name "bin"
}

# URL de téléchargement du CLI Supabase pour Windows
$supabaseUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe"
$supabasePath = "bin\supabase.exe"

Write-Host "Telechargement du CLI Supabase..." -ForegroundColor Yellow

try {
    # Télécharger le CLI
    Invoke-WebRequest -Uri $supabaseUrl -OutFile $supabasePath -UseBasicParsing
    Write-Host "Telechargement reussi!" -ForegroundColor Green
    
    # Rendre le fichier exécutable
    Write-Host "Installation terminee dans bin\supabase.exe" -ForegroundColor Green
    
    # Tester l'installation
    Write-Host "Test de l'installation..." -ForegroundColor Yellow
    $version = & ".\$supabasePath" --version
    Write-Host "Version installee: $version" -ForegroundColor Green
    
} catch {
    Write-Host "Erreur lors de l'installation: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Installation terminee avec succes!" -ForegroundColor Green
