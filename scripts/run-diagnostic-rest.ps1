# Diagnostic via API REST Supabase
$projectRef = "csopyblkfyofwkeqqegd"
$password = "1475963baSE69@"

# URL de base Supabase
$supabaseUrl = "https://$projectRef.supabase.co"

Write-Host "Diagnostic via API REST Supabase..." -ForegroundColor Green
Write-Host "URL: $supabaseUrl" -ForegroundColor Blue

# Test 1: Connexion API
Write-Host "Test 1: Connexion API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 401) {
        Write-Host "OK - API accessible (401 attendu sans clé)" -ForegroundColor Green
    } else {
        Write-Host "Réponse inattendue: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Erreur API: $($_.Exception.Message)" -ForegroundColor Red
}

# Récupérer les clés depuis votre projet (vous devrez les ajouter)
Write-Host ""
Write-Host "Pour continuer le diagnostic, nous avons besoin des clés API:" -ForegroundColor Blue
Write-Host "1. Allez sur: https://app.supabase.com/project/$projectRef/settings/api" -ForegroundColor White
Write-Host "2. Copiez la 'anon public' key et la 'service_role' key" -ForegroundColor White

$anonKey = Read-Host "Collez la clé 'anon public'"
$serviceKey = Read-Host "Collez la clé 'service_role'"

if ($anonKey -and $serviceKey) {
    Write-Host ""
    Write-Host "Test 2: Requête avec clé anon..." -ForegroundColor Yellow
    
    try {
        $headers = @{
            "apikey" = $anonKey
            "Authorization" = "Bearer $anonKey"
        }
        
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/auth/users?select=count" -Headers $headers -Method GET -TimeoutSec 10
        Write-Host "OK - Requête auth réussie" -ForegroundColor Green
    } catch {
        Write-Host "Erreur auth: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Test 3: Test diagnostic rapide..." -ForegroundColor Yellow
    
    # Test des tables critiques
    $tables = @("auth.users", "properties", "bookings", "admin_users")
    
    foreach ($table in $tables) {
        try {
            $headers = @{
                "apikey" = $serviceKey
                "Authorization" = "Bearer $serviceKey"
            }
            
            if ($table -eq "auth.users") {
                # Requête spéciale pour auth.users
                continue
            } else {
                $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/$table?select=count" -Headers $headers -Method GET -TimeoutSec 10
                Write-Host "✓ Table $table accessible" -ForegroundColor Green
            }
        } catch {
            Write-Host "✗ Table $table: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Test 4: Exécution du diagnostic SQL..." -ForegroundColor Yellow
    
    # Requête SQL de diagnostic
    $diagnosticSQL = @"
SELECT 
    'Test structure' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') 
        THEN 'OK properties' 
        ELSE 'MANQUE properties' 
    END as properties_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') 
        THEN 'OK bookings' 
        ELSE 'MANQUE bookings' 
    END as bookings_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
        THEN 'OK profiles' 
        ELSE 'MANQUE profiles' 
    END as profiles_status;
"@
    
    try {
        $body = @{
            query = $diagnosticSQL
        } | ConvertTo-Json
        
        $headers = @{
            "apikey" = $serviceKey
            "Authorization" = "Bearer $serviceKey"
            "Content-Type" = "application/json"
        }
        
        # Note: Supabase n'a pas d'endpoint direct pour SQL custom
        # Utilisons une approche alternative
        Write-Host "Utilisation d'une méthode alternative pour le diagnostic..." -ForegroundColor Cyan
        
        # Test des tables une par une
        $tables = @("properties", "bookings")
        $results = @()
        
        foreach ($table in $tables) {
            try {
                $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/$table?limit=1" -Headers $headers -Method GET
                $results += "$table : OK ($($response.Count) enregistrements visibles)"
            } catch {
                $results += "$table : ERREUR - $($_.Exception.Message)"
            }
        }
        
        Write-Host ""
        Write-Host "RÉSULTATS DU DIAGNOSTIC:" -ForegroundColor Green
        Write-Host "========================" -ForegroundColor Green
        foreach ($result in $results) {
            Write-Host $result -ForegroundColor White
        }
        
    } catch {
        Write-Host "Erreur diagnostic SQL: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Diagnostic terminé." -ForegroundColor Green
Write-Host "Pour un diagnostic complet, utilisez Supabase SQL Editor avec le fichier test-quick-diagnosis.sql" -ForegroundColor Blue
