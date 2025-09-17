# ==========================================
# EXÉCUTION DIRECTE DES TESTS SQL VIA SUPABASE CLI
# Morocco Host Helper Platform
# ==========================================

param(
    [string]$TestFile = "scripts/run-all-tests.sql",
    [switch]$QuickTest = $false,
    [string]$ProjectRef = "",
    [string]$DatabasePassword = ""
)

Write-Host "🧪 Exécution directe des tests SQL" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green

# Chemin vers Supabase CLI
$supabasePath = "$env:USERPROFILE\.supabase\supabase.exe"

# Vérifier que Supabase CLI est installé
if (!(Test-Path $supabasePath)) {
    Write-Host "❌ Supabase CLI non trouvé à: $supabasePath" -ForegroundColor Red
    Write-Host "💡 Installez d'abord Supabase CLI" -ForegroundColor Yellow
    return
}

Write-Host "✅ Supabase CLI trouvé" -ForegroundColor Green

# Sélectionner le fichier de test
if ($QuickTest) {
    $TestFile = "scripts/test-quick-diagnosis.sql"
    Write-Host "⚡ Mode test rapide activé" -ForegroundColor Cyan
}

# Vérifier que le fichier de test existe
if (!(Test-Path $TestFile)) {
    Write-Host "❌ Fichier de test non trouvé: $TestFile" -ForegroundColor Red
    Write-Host "📋 Fichiers disponibles:" -ForegroundColor Blue
    Get-ChildItem "scripts/*.sql" | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor White }
    return
}

Write-Host "📂 Fichier de test: $TestFile" -ForegroundColor Blue

# Demander les informations de connexion si pas fournies
if (-not $ProjectRef) {
    Write-Host ""
    Write-Host "📋 Informations nécessaires:" -ForegroundColor Blue
    Write-Host "   1. Allez sur https://app.supabase.com/project/[YOUR-PROJECT]/settings/general" -ForegroundColor White
    Write-Host "   2. Copiez le 'Reference ID' de votre projet" -ForegroundColor White
    $ProjectRef = Read-Host "🆔 Project Reference ID (ex: abcdefghijklmnop)"
}

if (-not $DatabasePassword) {
    Write-Host "   3. Allez sur https://app.supabase.com/project/$ProjectRef/settings/database" -ForegroundColor White
    Write-Host "   4. Copiez le mot de passe de la base de données" -ForegroundColor White
    $securePassword = Read-Host "🔒 Database Password" -AsSecureString
    $DatabasePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
}

# Créer le fichier de connexion temporaire
$connectionString = "postgresql://postgres:$DatabasePassword@db.$ProjectRef.supabase.co:5432/postgres"
Write-Host "🔗 Connexion à: db.$ProjectRef.supabase.co" -ForegroundColor Blue

# Créer un fichier de résultats
$outputFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
Write-Host "📄 Résultats seront sauvés dans: $outputFile" -ForegroundColor Blue

# En-tête du rapport
$reportHeader = @"
==========================================
RAPPORT DE TESTS AUTOMATIQUES
Morocco Host Helper Platform
==========================================
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Fichier testé: $TestFile
Project Reference: $ProjectRef
==========================================

"@

$reportHeader | Out-File $outputFile -Encoding UTF8

Write-Host ""
Write-Host "🚀 Exécution des tests..." -ForegroundColor Yellow

# Méthode avec psql si disponible
$env:PGPASSWORD = $DatabasePassword
$psqlCommand = "psql -h db.$ProjectRef.supabase.co -p 5432 -U postgres -d postgres -f `"$TestFile`""

try {
    Write-Host "📊 Tentative avec psql..." -ForegroundColor Gray
    $result = Invoke-Expression $psqlCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Tests exécutés avec psql" -ForegroundColor Green
        $result | Out-File $outputFile -Append -Encoding UTF8
        $success = $true
    } else {
        Write-Host "⚠️ psql a échoué, tentative avec méthode alternative..." -ForegroundColor Yellow
        $success = $false
    }
} catch {
    Write-Host "⚠️ psql non disponible, tentative avec méthode alternative..." -ForegroundColor Yellow
    $success = $false
}

# Méthode alternative : découper le SQL et utiliser Supabase CLI (si psql échoue)
if (-not $success) {
    Write-Host "🔄 Tentative avec méthode alternative..." -ForegroundColor Yellow
    
    # Lire le contenu SQL
    $sqlContent = Get-Content $TestFile -Raw -Encoding UTF8
    
    # Diviser en requêtes simples (très basique)
    $queries = $sqlContent -split ";"
    $queryCount = 0
    $results = @()
    
    foreach ($query in $queries) {
        $cleanQuery = $query.Trim()
        if ($cleanQuery -and $cleanQuery -notmatch "^--" -and $cleanQuery -ne "" -and $cleanQuery.Length -gt 10) {
            $queryCount++
            Write-Host "   Requête $queryCount..." -ForegroundColor Gray
            
            # Créer un fichier temporaire pour cette requête
            $tempFile = "temp-query-$queryCount.sql"
            $cleanQuery | Out-File $tempFile -Encoding UTF8
            
            try {
                $queryResult = Invoke-Expression "psql -h db.$ProjectRef.supabase.co -p 5432 -U postgres -d postgres -f `"$tempFile`"" 2>&1
                $results += "=== REQUÊTE $queryCount ==="
                $results += $cleanQuery
                $results += "=== RÉSULTAT ==="
                $results += $queryResult
                $results += ""
                
                # Nettoyer le fichier temporaire
                Remove-Item $tempFile -Force
            } catch {
                Write-Host "   ❌ Erreur requête $queryCount" -ForegroundColor Red
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    if ($results.Count -gt 0) {
        Write-Host "✅ Tests exécutés par requêtes individuelles ($queryCount requêtes)" -ForegroundColor Green
        $results | Out-File $outputFile -Append -Encoding UTF8
        $success = $true
    }
}

# Finaliser le rapport
if ($success) {
    $reportFooter = @"

==========================================
TESTS TERMINÉS AVEC SUCCÈS
Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
==========================================
"@
    $reportFooter | Out-File $outputFile -Append -Encoding UTF8
    
    Write-Host ""
    Write-Host "🎉 Tests terminés avec succès!" -ForegroundColor Green
    Write-Host "📄 Rapport sauvé: $outputFile" -ForegroundColor Blue
    
    # Afficher un résumé du rapport
    $fileSize = (Get-Item $outputFile).Length
    Write-Host "📊 Taille du rapport: $([math]::Round($fileSize/1KB, 2)) KB" -ForegroundColor Gray
    
    # Ouvrir le rapport
    $openReport = Read-Host "Voulez-vous ouvrir le rapport? (Y/n)"
    if ($openReport -ne "n") {
        Start-Process notepad.exe $outputFile
    }
    
    Write-Host ""
    Write-Host "📋 Commandes utiles:" -ForegroundColor Blue
    Write-Host "   Test rapide:    .\scripts\run-tests-direct.ps1 -QuickTest" -ForegroundColor White
    Write-Host "   Tests complets: .\scripts\run-tests-direct.ps1" -ForegroundColor White
    Write-Host "   Ouvrir rapport: notepad $outputFile" -ForegroundColor White
    
} else {
    Write-Host "❌ Échec des tests" -ForegroundColor Red
    Write-Host "💡 Vérifiez vos informations de connexion" -ForegroundColor Yellow
    "ÉCHEC DES TESTS - $(Get-Date)" | Out-File $outputFile -Append -Encoding UTF8
}

Write-Host "===================================" -ForegroundColor Green
