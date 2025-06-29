Write-Host "Quick New Tools Test" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Quick test of key new tools
$quickTests = @(
    @{ query = "Check balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"; tool = "getMultiBalance" },
    @{ query = "Show ERC20 transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"; tool = "getERC20Transfers" },
    @{ query = "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"; tool = "getAddressType" },
    @{ query = "Get gas price recommendations"; tool = "getGasOracle" }
)

foreach ($test in $quickTests) {
    Write-Host "Testing: $($test.tool)" -ForegroundColor Yellow
    try {
        $body = @{ message = $test.query } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 15
        
        $toolUsed = if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) { $response.toolsUsed[0].name } else { "none" }
        
        if ($toolUsed -eq $test.tool) {
            Write-Host "✅ $($test.tool) - SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "❌ $($test.tool) - Expected $($test.tool), got $toolUsed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $($test.tool) - ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}
