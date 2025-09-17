# Test base de données Morocco Host Helper
$projectRef = "csopyblkfyofwkeqqegd"
$dbPassword = "1475963baSE69@"

Write-Host "Test de connexion..." -ForegroundColor Green
Write-Host "Project: $projectRef" -ForegroundColor Blue

# Variables de connexion
$dbHost = "db.$projectRef.supabase.co"
$dbPort = "5432"
$dbUser = "postgres"
$dbName = "postgres"

# Définir le mot de passe
$env:PGPASSWORD = $dbPassword

Write-Host "Connexion à $dbHost..." -ForegroundColor Yellow

# Test connexion
psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT 'Connexion reussie' as status;"
