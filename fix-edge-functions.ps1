# Script de correction des fonctions Edge
Write-Host "Diagnostic et correction des fonctions Edge..." -ForegroundColor Cyan

# Configuration
$projectRef = "csopyblkfyofwkeqqegd"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

Write-Host "Projet: $projectRef" -ForegroundColor Yellow

# Vérifier la structure des dossiers
Write-Host "`nVerification de la structure des dossiers..." -ForegroundColor Blue

$functions = @(
    "resolve-guest-link",
    "issue-guest-link",
    "submit-guest-info",
    "save-contract-signature"
)

foreach ($function in $functions) {
    $functionPath = "supabase/functions/$function"
    $indexPath = "$functionPath/index.ts"
    
    if (Test-Path $functionPath) {
        if (Test-Path $indexPath) {
            $size = (Get-Item $indexPath).Length
            Write-Host "✅ $function : Dossier OK, index.ts ($size bytes)" -ForegroundColor Green
        } else {
            Write-Host "❌ $function : index.ts manquant!" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ $function : Dossier manquant!" -ForegroundColor Red
    }
}

# Vérifier la configuration Supabase
Write-Host "`nVerification de la configuration Supabase..." -ForegroundColor Blue

if (Test-Path "supabase/config.toml") {
    Write-Host "✅ config.toml present" -ForegroundColor Green
    
    # Vérifier la configuration des fonctions
    $config = Get-Content "supabase/config.toml" -Raw
    
    foreach ($function in $functions) {
        if ($config -match "\[functions\.$function\]") {
            Write-Host "✅ $function : Configuree dans config.toml" -ForegroundColor Green
        } else {
            Write-Host "❌ $function : Non configuree dans config.toml" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ config.toml manquant!" -ForegroundColor Red
}

# Test de connexion à l'API Supabase
Write-Host "`nTest de connexion a l'API Supabase..." -ForegroundColor Blue

try {
    $response = Invoke-WebRequest -Uri "https://$projectRef.supabase.co/rest/v1/" -Headers @{"apikey"=$anonKey} -TimeoutSec 10
    Write-Host "✅ API Supabase accessible: Status $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur API Supabase: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Test des fonctions Edge
Write-Host "`nTest des fonctions Edge..." -ForegroundColor Blue

foreach ($function in $functions) {
    $url = "https://$projectRef.supabase.co/functions/v1/$function"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -Headers @{"apikey"=$anonKey} -TimeoutSec 10
        Write-Host "✅ $function : Status $($response.StatusCode)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode
        if ($statusCode -eq 404) {
            Write-Host "❌ $function : Non deployee (404)" -ForegroundColor Red
        } else {
            Write-Host "⚠️ $function : Erreur $statusCode" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nDiagnostic termine!" -ForegroundColor Cyan
Write-Host "`nSolutions:" -ForegroundColor Yellow
Write-Host "1. Verifiez que tous les dossiers de fonctions existent" -ForegroundColor White
Write-Host "2. Verifiez que chaque fonction a un index.ts" -ForegroundColor White
Write-Host "3. Redemarrez le projet Supabase localement" -ForegroundColor White
Write-Host "4. Utilisez le dashboard Supabase pour deployer manuellement" -ForegroundColor White
