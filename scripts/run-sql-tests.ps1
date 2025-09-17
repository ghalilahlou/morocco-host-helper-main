# ==========================================
# EXÉCUTION AUTOMATIQUE DES TESTS SQL
# Morocco Host Helper Platform
# ==========================================

param(
    [string]$TestFile = "scripts/run-all-tests.sql",
    [string]$OutputFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt",
    [switch]$OpenResults = $false,
    [switch]$QuickTest = $false
)

Write-Host "🧪 Exécution automatique des tests SQL" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Charger les variables d'environnement
function Load-Environment {
    if (Test-Path ".env.local") {
        Get-Content ".env.local" | ForEach-Object {
            if ($_ -match "^([^#][^=]*?)=(.*)$") {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
        }
        Write-Host "✅ Variables d'environnement chargées" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Fichier .env.local non trouvé. Exécutez d'abord configure-supabase-connection.ps1" -ForegroundColor Red
        return $false
    }
}

# Fonction pour exécuter SQL via l'API REST
function Invoke-SupabaseSQL {
    param([string]$SqlQuery)
    
    try {
        $headers = @{
            "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
            "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            query = $SqlQuery
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$env:VITE_SUPABASE_URL/rest/v1/rpc/exec_sql" -Method POST -Headers $headers -Body $body -TimeoutSec 30
        return $response
    } catch {
        Write-Host "❌ Erreur SQL: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Fonction pour exécuter SQL via psql (si disponible)
function Invoke-PostgreSQL {
    param([string]$SqlFile)
    
    try {
        # Extraire les informations de connexion depuis DATABASE_URL
        if ($env:DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $user = $matches[1]
            $password = $matches[2]
            $host = $matches[3]
            $port = $matches[4]
            $database = $matches[5]
            
            # Définir la variable d'environnement pour le mot de passe
            $env:PGPASSWORD = $password
            
            $psqlCmd = "psql -h $host -p $port -U $user -d $database -f `"$SqlFile`""
            Write-Host "🔍 Tentative de connexion avec psql..." -ForegroundColor Yellow
            
            $result = Invoke-Expression $psqlCmd 2>&1
            return $result
        } else {
            Write-Host "⚠️ Format DATABASE_URL non reconnu" -ForegroundColor Yellow
            return $null
        }
    } catch {
        Write-Host "⚠️ psql non disponible, utilisation de l'API REST..." -ForegroundColor Yellow
        return $null
    }
}

# Fonction principale
function Run-SQLTests {
    # Charger l'environnement
    if (-not (Load-Environment)) {
        return
    }
    
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
    Write-Host "📝 Résultats seront sauvés dans: $OutputFile" -ForegroundColor Blue
    Write-Host ""
    
    # Lire le contenu SQL
    $sqlContent = Get-Content $TestFile -Raw -Encoding UTF8
    Write-Host "📊 Contenu SQL chargé ($(($sqlContent.Length)) caractères)" -ForegroundColor Blue
    
    # Créer l'en-tête du rapport
    $reportHeader = @"
==========================================
RAPPORT DE TESTS AUTOMATIQUES
Morocco Host Helper Platform
==========================================
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Fichier testé: $TestFile
URL Supabase: $env:VITE_SUPABASE_URL
==========================================

"@
    
    $reportHeader | Out-File $OutputFile -Encoding UTF8
    
    Write-Host "🚀 Exécution des tests..." -ForegroundColor Yellow
    
    # Méthode 1: Essayer psql en premier
    $psqlResult = Invoke-PostgreSQL -SqlFile $TestFile
    
    if ($psqlResult) {
        Write-Host "✅ Tests exécutés via psql" -ForegroundColor Green
        $psqlResult | Out-File $OutputFile -Append -Encoding UTF8
        $success = $true
    } else {
        # Méthode 2: Utiliser l'API REST comme fallback
        Write-Host "🔄 Tentative via API REST..." -ForegroundColor Yellow
        
        # Diviser le SQL en requêtes individuelles
        $queries = $sqlContent -split ";"
        $results = @()
        $queryCount = 0
        
        foreach ($query in $queries) {
            $cleanQuery = $query.Trim()
            if ($cleanQuery -and $cleanQuery -notmatch "^--" -and $cleanQuery -ne "") {
                $queryCount++
                Write-Host "   Requête $queryCount..." -ForegroundColor Gray
                
                $result = Invoke-SupabaseSQL -SqlQuery $cleanQuery
                if ($result) {
                    $results += "=== REQUÊTE $queryCount ==="
                    $results += $cleanQuery
                    $results += "=== RÉSULTAT ==="
                    $results += ($result | ConvertTo-Json -Depth 10)
                    $results += ""
                }
            }
        }
        
        if ($results.Count -gt 0) {
            Write-Host "✅ Tests exécutés via API REST ($queryCount requêtes)" -ForegroundColor Green
            $results | Out-File $OutputFile -Append -Encoding UTF8
            $success = $true
        } else {
            Write-Host "❌ Aucun résultat obtenu" -ForegroundColor Red
            $success = $false
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
        $reportFooter | Out-File $OutputFile -Append -Encoding UTF8
        
        Write-Host ""
        Write-Host "🎉 Tests terminés avec succès!" -ForegroundColor Green
        Write-Host "📄 Rapport sauvé: $OutputFile" -ForegroundColor Blue
        
        # Afficher un résumé
        $fileSize = (Get-Item $OutputFile).Length
        Write-Host "📊 Taille du rapport: $([math]::Round($fileSize/1KB, 2)) KB" -ForegroundColor Gray
        
        # Ouvrir les résultats si demandé
        if ($OpenResults) {
            Write-Host "📖 Ouverture du rapport..." -ForegroundColor Cyan
            Start-Process notepad.exe $OutputFile
        }
        
        # Proposer des actions
        Write-Host ""
        Write-Host "📋 Actions disponibles:" -ForegroundColor Blue
        Write-Host "   - Voir le rapport: notepad $OutputFile" -ForegroundColor White
        Write-Host "   - Test rapide: .\scripts\run-sql-tests.ps1 -QuickTest" -ForegroundColor White
        Write-Host "   - Tous les tests: .\scripts\run-sql-tests.ps1" -ForegroundColor White
        
    } else {
        Write-Host "❌ Échec des tests" -ForegroundColor Red
        "ÉCHEC DES TESTS - $(Get-Date)" | Out-File $OutputFile -Append -Encoding UTF8
    }
}

# Point d'entrée principal
try {
    Run-SQLTests
} catch {
    Write-Host "❌ Erreur critique: $($_.Exception.Message)" -ForegroundColor Red
    "ERREUR CRITIQUE: $($_.Exception.Message)" | Out-File $OutputFile -Append -Encoding UTF8
}

Write-Host "=======================================" -ForegroundColor Green
