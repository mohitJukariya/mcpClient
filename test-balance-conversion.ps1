Write-Host "Testing Balance Conversion Fix" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

$testAddress = "0x6492772d1474ffa1ed6944e86735848c253bb007"
$expectedBalance = "0.00000038635"

Write-Host "Address: $testAddress" -ForegroundColor Yellow
Write-Host "Expected: $expectedBalance ETH" -ForegroundColor Green
Write-Host ""

try {
    $body = @{
        message = "get me the eth balance of $testAddress on arbitrum."
    } | ConvertTo-Json
    
    Write-Host "Sending request..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    
    Write-Host "Response received!" -ForegroundColor Green
    Write-Host ""
    Write-Host "ACTUAL RESPONSE:" -ForegroundColor Cyan
    Write-Host "===============" -ForegroundColor Cyan
    Write-Host $response.response -ForegroundColor White
    Write-Host ""
    
    if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
        Write-Host "✅ Tool Used: $($response.toolsUsed[0].name)" -ForegroundColor Green
    } else {
        Write-Host "❌ No tool was used" -ForegroundColor Red
    }
    
    # Check if the response contains the correct balance
    if ($response.response -match "0\.00000038635") {
        Write-Host "✅ SUCCESS: Correct balance conversion!" -ForegroundColor Green
    } elseif ($response.response -match "0\.00038635") {
        Write-Host "❌ FAILED: Still showing wrong calculation (missing 3 decimal places)" -ForegroundColor Red
    } elseif ($response.response -match "0\.0003863") {
        Write-Host "❌ FAILED: Wrong calculation detected" -ForegroundColor Red
    } else {
        Write-Host "⚠️ WARNING: Balance not found in expected format" -ForegroundColor Yellow
        Write-Host "Response: $($response.response)" -ForegroundColor Gray
    }
    
    # Check for unwanted patterns
    $unwantedPatterns = @("tokens", "Note:", "AI", "simulated")
    $foundUnwanted = @()
    foreach ($pattern in $unwantedPatterns) {
        if ($response.response -match $pattern) {
            $foundUnwanted += $pattern
        }
    }
    
    if ($foundUnwanted.Count -eq 0) {
        Write-Host "✅ No unwanted patterns found" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Found unwanted patterns: $($foundUnwanted -join ', ')" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: Server may need restart to pick up changes" -ForegroundColor Gray
