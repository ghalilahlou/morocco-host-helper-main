# Script de gestion Docker Desktop pour Morocco Host Helper
# Usage: .\scripts\docker-desktop-manager.ps1 [action]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "build", "clean", "health")]
    [string]$Action,
    
    [string]$Service = "all"
)

$ProjectName = "morocco-host-helper"
$ComposeFile = "docker-compose.desktop.yml"

Write-Host "🐳 Docker Desktop Manager - Morocco Host Helper" -ForegroundColor Cyan
Write-Host "Action: $Action | Service: $Service" -ForegroundColor Yellow

# Vérifier que Docker Desktop est en cours d'exécution
function Test-DockerDesktop {
    try {
        docker info | Out-Null
        return $true
    } catch {
        Write-Host "❌ Docker Desktop n'est pas en cours d'exécution" -ForegroundColor Red
        Write-Host "Veuillez démarrer Docker Desktop et réessayer" -ForegroundColor Yellow
        return $false
    }
}

# Charger les variables d'environnement
function Load-Environment {
    if (Test-Path ".env") {
        Write-Host "📋 Chargement des variables d'environnement..." -ForegroundColor Blue
        Get-Content ".env" | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
            $key, $value = $_ -split '=', 2
            if ($key -and $value) {
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    } else {
        Write-Host "⚠️ Fichier .env non trouvé, utilisation des variables système" -ForegroundColor Yellow
    }
}

# Démarrer les services
function Start-Services {
    Write-Host "🚀 Démarrage des services..." -ForegroundColor Green
    
    if ($Service -eq "all") {
        docker-compose -f $ComposeFile up -d
    } else {
        docker-compose -f $ComposeFile up -d $Service
    }
    
    Write-Host "✅ Services démarrés avec succès!" -ForegroundColor Green
    Show-Status
}

# Arrêter les services
function Stop-Services {
    Write-Host "🛑 Arrêt des services..." -ForegroundColor Yellow
    
    if ($Service -eq "all") {
        docker-compose -f $ComposeFile down
    } else {
        docker-compose -f $ComposeFile stop $Service
    }
    
    Write-Host "✅ Services arrêtés!" -ForegroundColor Green
}

# Redémarrer les services
function Restart-Services {
    Write-Host "🔄 Redémarrage des services..." -ForegroundColor Blue
    Stop-Services
    Start-Sleep -Seconds 2
    Start-Services
}

# Afficher le statut des services
function Show-Status {
    Write-Host "📊 Statut des services:" -ForegroundColor Blue
    docker-compose -f $ComposeFile ps
    
    Write-Host "`n🔗 URLs des services:" -ForegroundColor Cyan
    Write-Host "  Application: http://localhost:3000" -ForegroundColor White
    Write-Host "  Edge Functions: http://localhost:54321" -ForegroundColor White
    Write-Host "  Base de données: localhost:5432" -ForegroundColor White
}

# Afficher les logs
function Show-Logs {
    Write-Host "📋 Logs des services:" -ForegroundColor Blue
    
    if ($Service -eq "all") {
        docker-compose -f $ComposeFile logs --tail=50 -f
    } else {
        docker-compose -f $ComposeFile logs --tail=50 -f $Service
    }
}

# Construire les images
function Build-Images {
    Write-Host "🔨 Construction des images Docker..." -ForegroundColor Blue
    
    if ($Service -eq "all") {
        docker-compose -f $ComposeFile build --no-cache
    } else {
        docker-compose -f $ComposeFile build --no-cache $Service
    }
    
    Write-Host "✅ Images construites avec succès!" -ForegroundColor Green
}

# Nettoyer les ressources
function Clean-Resources {
    Write-Host "🧹 Nettoyage des ressources Docker..." -ForegroundColor Yellow
    
    # Arrêter et supprimer les conteneurs
    docker-compose -f $ComposeFile down -v
    
    # Supprimer les images non utilisées
    docker image prune -f
    
    # Supprimer les volumes non utilisés
    docker volume prune -f
    
    Write-Host "✅ Nettoyage terminé!" -ForegroundColor Green
}

# Vérifier la santé des services
function Test-Health {
    Write-Host "🔍 Vérification de la santé des services..." -ForegroundColor Blue
    
    $services = @("morocco-host-helper", "supabase-functions")
    
    foreach ($service in $services) {
        $container = docker ps --filter "name=$service" --format "{{.Names}}"
        if ($container) {
            Write-Host "✅ $service est en cours d'exécution" -ForegroundColor Green
        } else {
            Write-Host "❌ $service n'est pas en cours d'exécution" -ForegroundColor Red
        }
    }
    
    # Test des endpoints
    Write-Host "`n🧪 Test des endpoints:" -ForegroundColor Blue
    
    try {
        $appResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5
        Write-Host "✅ Application: HTTP $($appResponse.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Application: Non accessible" -ForegroundColor Red
    }
    
    try {
        $functionsResponse = Invoke-WebRequest -Uri "http://localhost:54321/health" -TimeoutSec 5
        Write-Host "✅ Edge Functions: HTTP $($functionsResponse.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Edge Functions: Non accessible" -ForegroundColor Red
    }
}

# Script principal
if (-not (Test-DockerDesktop)) {
    exit 1
}

Load-Environment

switch ($Action) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "status" { Show-Status }
    "logs" { Show-Logs }
    "build" { Build-Images }
    "clean" { Clean-Resources }
    "health" { Test-Health }
}

Write-Host "`n🎉 Opération terminée!" -ForegroundColor Green
