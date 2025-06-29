Write-Host "Testing New MCP Tools Integration" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Test cases for the new tools
$testCases = @(
    @{
        name = "Multi Balance Check"
        query = "check balances for addresses 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
        expectedTool = "getMultiBalance"
    },
    @{
        name = "ERC20 Transfers"
        query = "show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC20Transfers"
    },
    @{
        name = "NFT Transfers"
        query = "get NFT transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC721Transfers"
    },
    @{
        name = "Address Type Check"
        query = "is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"
        expectedTool = "getAddressType"
    },
    @{
        name = "Gas Oracle"
        query = "what are the current gas price recommendations?"
        expectedTool = "getGasOracle"
    },
    @{
        name = "Token Info"
        query = "get information about token contract 0xA0b86a33E6441918E634e93DF0c9D7D7B2799dAB"
        expectedTool = "getTokenInfo"
    }
)

$successCount = 0
$totalTests = $testCases.Count

foreach ($test in $testCases) {
    Write-Host "Testing: $($test.name)" -ForegroundColor Yellow
    Write-Host "Query: $($test.query)" -ForegroundColor Gray
    
    try {
        $body = @{
            message = $test.query
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 20
        
        if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0 -and $response.toolsUsed[0].name -eq $test.expectedTool) {
            Write-Host "✅ SUCCESS: Correct tool used ($($response.toolsUsed[0].name))" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ FAILED: Expected $($test.expectedTool), got $($response.toolsUsed[0].name)" -ForegroundColor Red
        }
        
        Write-Host "Response: $($response.response.Substring(0, [Math]::Min(100, $response.response.Length)))..." -ForegroundColor White
        
    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "Test Summary:" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host "Passed: $successCount / $totalTests" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Yellow" })

if ($successCount -eq $totalTests) {
    Write-Host "🎉 All new tools are working correctly!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Some tests failed. Check the MCP server and tool integration." -ForegroundColor Yellow
}
