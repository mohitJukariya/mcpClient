Write-Host "Testing Failed Cases - Focused Fix Validation" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test the 3 specific cases that failed
$failedTests = @(
    @{
        name = "Multi Balance - Basic (FAILED)"
        prompt = "Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
        expectedTool = "getMultiBalance"
    },
    @{
        name = "Multi Balance - Natural Language (FAILED)"
        prompt = "What are the balances for these addresses: 0x6492772d1474ffa1ed6944e86735848c253bb007, 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
        expectedTool = "getMultiBalance"
    },
    @{
        name = "Token Info - What Token (FAILED)"
        prompt = "What token is 0xA0b86a33E6441918E634293Df0c9b7b78b147b39?"
        expectedTool = "getTokenInfo"
    }
)

Write-Host "Testing the 3 previously failed cases..." -ForegroundColor Yellow
Write-Host ""

$fixedCount = 0

foreach ($test in $failedTests) {
    Write-Host "Testing: $($test.name)" -ForegroundColor Yellow
    Write-Host "Prompt: $($test.prompt)" -ForegroundColor Gray
    
    try {
        $body = @{
            message = $test.prompt
        } | ConvertTo-Json -Depth 3
        
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 20
        
        $toolUsed = $null
        if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
            $toolUsed = $response.toolsUsed[0].name
        }
        
        if ($toolUsed -eq $test.expectedTool) {
            Write-Host "✅ FIXED: Correct tool used ($toolUsed)" -ForegroundColor Green
            $fixedCount++
        } elseif ($toolUsed) {
            Write-Host "❌ STILL WRONG: Expected $($test.expectedTool), got $toolUsed" -ForegroundColor Red
        } else {
            Write-Host "❌ STILL NO TOOL: Expected $($test.expectedTool), no tool was used" -ForegroundColor Red
        }
        
        # Show response preview
        $responsePreview = $response.response.Substring(0, [Math]::Min(100, $response.response.Length))
        Write-Host "Response: $responsePreview..." -ForegroundColor White
        
        # Check for weird characters
        if ($response.response -match "[✅❌⚡🚀💰]|0xUSD₮0|\$ARB") {
            Write-Host "⚠️ Contains weird characters - needs cleaning" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Clean response format" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "Fix Results:" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan
Write-Host "Fixed: $fixedCount / 3" -ForegroundColor $(if ($fixedCount -eq 3) { "Green" } elseif ($fixedCount -gt 0) { "Yellow" } else { "Red" })

if ($fixedCount -eq 3) {
    Write-Host "🎉 All failed cases are now fixed!" -ForegroundColor Green
    Write-Host "Ready to run full test suite again." -ForegroundColor Green
} elseif ($fixedCount -gt 0) {
    Write-Host "✅ Some issues fixed. May need further adjustments." -ForegroundColor Yellow
} else {
    Write-Host "⚠️ Issues persist. Check system prompt and tool selection logic." -ForegroundColor Red
}
