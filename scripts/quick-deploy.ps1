# Script de déploiement rapide avec Docker Desktop
# Usage: .\scripts\quick-deploy.ps1

Write-Host "Deploiement rapide - Morocco Host Helper" -ForegroundColor Green

# Vérifier Docker Desktop
if (-not (docker info 2>$null)) {
    Write-Host "Docker Desktop n'est pas en cours d'execution" -ForegroundColor Red
    Write-Host "Veuillez demarrer Docker Desktop et reessayer" -ForegroundColor Yellow
    exit 1
}

# Charger les variables d'environnement
if (Test-Path ".env") {
    Write-Host "📋 Chargement des variables d'environnement..." -ForegroundColor Blue
    Get-Content ".env" | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        if ($key -and $value) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Host "⚠️ Fichier .env non trouvé, copiez env.example vers .env et configurez vos variables" -ForegroundColor Yellow
    Write-Host "cp env.example .env" -ForegroundColor Cyan
    exit 1
}

# Vérifier les variables critiques
$requiredVars = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not (Get-Item "env:$var" -ErrorAction SilentlyContinue)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Variables d'environnement manquantes:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "Veuillez les configurer dans votre fichier .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "Variables d'environnement configurees" -ForegroundColor Green

# Construire et démarrer les services
Write-Host "🔨 Construction des images..." -ForegroundColor Blue
docker-compose -f docker-compose.desktop.yml build

Write-Host "🚀 Démarrage des services..." -ForegroundColor Blue
docker-compose -f docker-compose.desktop.yml up -d

# Attendre que les services soient prêts
Write-Host "⏳ Attente du démarrage des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Vérifier le statut
Write-Host "📊 Statut des services:" -ForegroundColor Blue
docker-compose -f docker-compose.desktop.yml ps

# Test de santé
Write-Host "`n🔍 Test de santé des services..." -ForegroundColor Blue

$services = @(
    @{Name="Application"; Url="http://localhost:3000"},
    @{Name="Edge Functions"; Url="http://localhost:54321/health"}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 10
        Write-Host "✅ $($service.Name): HTTP $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($service.Name): Non accessible" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Déploiement terminé!" -ForegroundColor Green
Write-Host "🔗 URLs des services:" -ForegroundColor Cyan
Write-Host "  Application: http://localhost:3000" -ForegroundColor White
Write-Host "  Edge Functions: http://localhost:54321" -ForegroundColor White
Write-Host "  Base de données: localhost:5432" -ForegroundColor White

Write-Host "`n📋 Commandes utiles:" -ForegroundColor Yellow
Write-Host "  Voir les logs: docker-compose -f docker-compose.desktop.yml logs -f" -ForegroundColor White
Write-Host "  Arrêter: docker-compose -f docker-compose.desktop.yml down" -ForegroundColor White
Write-Host "  Redémarrer: docker-compose -f docker-compose.desktop.yml restart" -ForegroundColor White
