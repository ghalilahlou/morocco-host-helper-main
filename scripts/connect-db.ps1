# Connexion simple à Supabase
$projectRef = "csopyblkfyofwkeqqegd"
$password = "1475963baSE69@"

Write-Host "Test de connexion à votre base de données..." -ForegroundColor Green
Write-Host "Project: $projectRef" -ForegroundColor Blue

# Définir le mot de passe
$env:PGPASSWORD = $password

# Paramètres de connexion
$host = "db.$projectRef.supabase.co"
$port = "5432"
$user = "postgres" 
$database = "postgres"

Write-Host "Connexion à $host..." -ForegroundColor Yellow

# Test simple
$testQuery = "SELECT 'Connexion OK' as status;"
psql -h $host -p $port -U $user -d $database -c $testQuery
