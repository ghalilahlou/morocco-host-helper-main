# Script pour restaurer l'état exact du commit df49627
Write-Host "🔄 Restauration de l'état du commit df49627..." -ForegroundColor Yellow

# Vérifier que le dossier source existe
if (-not (Test-Path "morocco-host-helper")) {
    Write-Host "❌ Erreur: Le dossier morocco-host-helper n'existe pas" -ForegroundColor Red
    exit 1
}

# Vérifier que le dossier destination existe
if (-not (Test-Path "morocco-host-helper-main-main")) {
    Write-Host "❌ Erreur: Le dossier morocco-host-helper-main-main n'existe pas" -ForegroundColor Red
    exit 1
}

# Aller dans le dossier source et vérifier le commit
Set-Location "morocco-host-helper"
$currentCommit = git rev-parse HEAD
if ($currentCommit -ne "df49627") {
    Write-Host "🔄 Passage au commit df49627..." -ForegroundColor Yellow
    git checkout df49627
}

# Retourner au dossier parent
Set-Location ".."

# Copier tous les fichiers sauf les dossiers à exclure
Write-Host "📁 Copie des fichiers..." -ForegroundColor Yellow

# Créer une liste des dossiers à exclure
$excludeDirs = @("node_modules", ".git", "dist", ".vscode")

# Copier les fichiers
Get-ChildItem "morocco-host-helper" -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring((Get-Location "morocco-host-helper").FullName.Length + 1)
    $destinationPath = Join-Path "morocco-host-helper-main-main" $relativePath
    
    # Vérifier si le chemin contient un dossier exclu
    $shouldExclude = $false
    foreach ($excludeDir in $excludeDirs) {
        if ($relativePath -like "*\$excludeDir\*" -or $relativePath -like "$excludeDir\*") {
            $shouldExclude = $true
            break
        }
    }
    
    if (-not $shouldExclude) {
        if ($_.PSIsContainer) {
            # Créer le dossier s'il n'existe pas
            if (-not (Test-Path $destinationPath)) {
                New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
            }
        } else {
            # Copier le fichier
            $destinationDir = Split-Path $destinationPath -Parent
            if (-not (Test-Path $destinationDir)) {
                New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
            }
            Copy-Item $_.FullName $destinationPath -Force
            Write-Host "✅ Copié: $relativePath" -ForegroundColor Green
        }
    }
}

Write-Host "🎉 Restauration terminée !" -ForegroundColor Green
Write-Host "📝 L'état exact du commit df49627 a été restauré dans morocco-host-helper-main-main" -ForegroundColor Cyan
Write-Host "🚀 Vous pouvez maintenant lancer l'application avec: npm run dev" -ForegroundColor Cyan
