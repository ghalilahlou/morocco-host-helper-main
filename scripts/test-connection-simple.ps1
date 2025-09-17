# Test de connexion simple à Supabase
$projectRef = "csopyblkfyofwkeqqegd"
$password = "1475963baSE69@"

Write-Host "🔗 Test de connexion à votre base de données..." -ForegroundColor Green
Write-Host "Project: $projectRef" -ForegroundColor Blue

# Définir le mot de passe pour psql
$env:PGPASSWORD = $password

# Test de connexion
$host = "db.$projectRef.supabase.co"
$port = "5432"
$user = "postgres"
$database = "postgres"

Write-Host "🚀 Connexion à $host..." -ForegroundColor Yellow

try {
    # Test avec une requête simple
    $testQuery = "SELECT 'Connexion réussie!' as status, version() as pg_version;"
    $result = psql -h $host -p $port -U $user -d $database -c $testQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CONNEXION RÉUSSIE!" -ForegroundColor Green
        Write-Host $result
    } else {
        Write-Host "❌ Erreur de connexion:" -ForegroundColor Red
        Write-Host $result
    }
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}
