# ==========================================
# CONFIGURATION CONNEXION SUPABASE
# Morocco Host Helper Platform
# ==========================================

param(
    [string]$ProjectUrl = "",
    [string]$AnonKey = "",
    [string]$ServiceRoleKey = "",
    [string]$DatabasePassword = ""
)

Write-Host "🔧 Configuration de la connexion Supabase" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Fonction pour demander une valeur de façon sécurisée
function Get-SecureInput {
    param([string]$Prompt, [bool]$IsSecret = $false)
    
    if ($IsSecret) {
        $secure = Read-Host $Prompt -AsSecureString
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    } else {
        return Read-Host $Prompt
    }
}

# Récupérer les informations de connexion si pas fournies
if (-not $ProjectUrl) {
    Write-Host "📋 Informations nécessaires depuis Supabase Dashboard:" -ForegroundColor Blue
    Write-Host "   1. Allez sur https://app.supabase.com/project/[YOUR-PROJECT]/settings/api" -ForegroundColor White
    Write-Host "   2. Copiez les informations demandées ci-dessous" -ForegroundColor White
    Write-Host ""
    
    $ProjectUrl = Get-SecureInput "🌐 Project URL (ex: https://xxxxx.supabase.co)"
}

if (-not $AnonKey) {
    $AnonKey = Get-SecureInput "🔑 Anon/Public Key"
}

if (-not $ServiceRoleKey) {
    $ServiceRoleKey = Get-SecureInput "🔐 Service Role Key (secret)" -IsSecret $true
}

if (-not $DatabasePassword) {
    $DatabasePassword = Get-SecureInput "🔒 Database Password" -IsSecret $true
}

# Validation des URLs
if ($ProjectUrl -notmatch "^https://.*\.supabase\.co$") {
    Write-Host "⚠️ L'URL du projet semble incorrecte. Format attendu: https://xxxxx.supabase.co" -ForegroundColor Yellow
}

# Créer le fichier .env local s'il n'existe pas
$envPath = ".env.local"
if (!(Test-Path $envPath)) {
    Write-Host "📝 Création du fichier .env.local..." -ForegroundColor Yellow
    New-Item -ItemType File -Path $envPath | Out-Null
}

# Ajouter/Mettre à jour les variables d'environnement
$envContent = @"
# Morocco Host Helper - Configuration Supabase
# Généré automatiquement le $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

VITE_SUPABASE_URL=$ProjectUrl
VITE_SUPABASE_ANON_KEY=$AnonKey
SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey
DATABASE_URL=postgresql://postgres:$DatabasePassword@$(($ProjectUrl -replace 'https://', '') -replace '\.supabase\.co', '.pooler.supabase.com'):5432/postgres

# Configuration CLI
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=$DatabasePassword
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "✅ Fichier .env.local mis à jour" -ForegroundColor Green

# Créer le fichier de configuration Supabase CLI
$configDir = ".supabase"
if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
    Write-Host "📁 Dossier .supabase créé" -ForegroundColor Blue
}

$configContent = @"
[api]
enabled = true
port = 54321

[db]
port = 54322
shadow_port = 54320

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true

[auth]
enabled = true

[edge_functions]
enabled = true

[project_id]
# Votre Project ID ici
"@

Set-Content -Path "$configDir\config.toml" -Value $configContent -Encoding UTF8
Write-Host "✅ Configuration Supabase CLI mise à jour" -ForegroundColor Green

# Créer un script de test de connexion
$testScript = @"
# Test de connexion à Supabase
Write-Host "🔍 Test de connexion à Supabase..." -ForegroundColor Yellow

# Charger les variables d'environnement
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if (`$_ -match "^([^#][^=]*?)=(.*)$") {
            [Environment]::SetEnvironmentVariable(`$matches[1], `$matches[2], "Process")
        }
    }
    Write-Host "✅ Variables d'environnement chargées" -ForegroundColor Green
} else {
    Write-Host "❌ Fichier .env.local non trouvé" -ForegroundColor Red
    exit 1
}

# Test de l'URL Supabase
try {
    `$response = Invoke-WebRequest -Uri "`$env:VITE_SUPABASE_URL/rest/v1/" -Headers @{
        "apikey" = "`$env:VITE_SUPABASE_ANON_KEY"
        "Authorization" = "Bearer `$env:VITE_SUPABASE_ANON_KEY"
    } -Method GET -TimeoutSec 10
    
    if (`$response.StatusCode -eq 200) {
        Write-Host "✅ Connexion Supabase réussie!" -ForegroundColor Green
        return `$true
    }
} catch {
    Write-Host "❌ Erreur de connexion Supabase: `$(`$_.Exception.Message)" -ForegroundColor Red
    return `$false
}
"@

Set-Content -Path "scripts\test-supabase-connection.ps1" -Value $testScript -Encoding UTF8
Write-Host "✅ Script de test créé: scripts\test-supabase-connection.ps1" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Configuration terminée!" -ForegroundColor Green
Write-Host "📝 Fichiers créés/mis à jour:" -ForegroundColor Blue
Write-Host "   - .env.local (variables d'environnement)" -ForegroundColor White
Write-Host "   - .supabase/config.toml (configuration CLI)" -ForegroundColor White
Write-Host "   - scripts/test-supabase-connection.ps1 (test)" -ForegroundColor White
Write-Host ""
Write-Host "🔑 Prochaines étapes:" -ForegroundColor Blue
Write-Host "   1. Testez la connexion: .\scripts\test-supabase-connection.ps1" -ForegroundColor White
Write-Host "   2. Authentifiez-vous: supabase login" -ForegroundColor White
Write-Host "   3. Liez le projet: supabase link --project-ref [PROJECT-ID]" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
