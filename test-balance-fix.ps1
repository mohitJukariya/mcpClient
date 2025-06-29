$testAddress = "0x6492772d1474FFa1Ed6944e86735848c253bB007"

Write-Host "Testing Balance Query Fix" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host "Address: $testAddress" -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{
        message = "What is the ETH balance of $testAddress?"
    } | ConvertTo-Json
    
    Write-Host "Sending request..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    
    Write-Host "Response received!" -ForegroundColor Green
    Write-Host ""
    Write-Host "RESULT:" -ForegroundColor Cyan
    Write-Host "=======" -ForegroundColor Cyan
    Write-Host $response.response -ForegroundColor White
    Write-Host ""
    
    if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
        Write-Host "Tool Used: $($response.toolsUsed[0].name)" -ForegroundColor Green
        Write-Host "Tool Arguments: $($response.toolsUsed[0].arguments | ConvertTo-Json -Compress)" -ForegroundColor Gray
        
        # Check if the response mentions tokens incorrectly
        if ($response.response -match "Arbitrum One tokens?" -or $response.response -match "ARB tokens?") {
            Write-Host ""
            Write-Host "❌ ISSUE: Response still mentions tokens instead of ETH" -ForegroundColor Red
        } else {
            Write-Host ""
            Write-Host "✅ SUCCESS: Response correctly shows ETH balance" -ForegroundColor Green
        }
        
        # Check if it shows the correct decimal value
        if ($response.response -match "0\.0000003863") {
            Write-Host "✅ SUCCESS: Correct decimal conversion" -ForegroundColor Green
        } else {
            Write-Host "⚠️ WARNING: Decimal conversion may need checking" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ No tool was used" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Expected: ~0.00000038635 ETH (not 386,350,000 tokens)" -ForegroundColor Cyan
