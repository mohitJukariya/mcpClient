Write-Host "Comprehensive New Tools Testing" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test prompts for all new tools
$testPrompts = @(
    @{
        name = "Multi Balance - Basic"
        prompt = "Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
        expectedTool = "getMultiBalance"
        description = "Should detect multiple addresses and use getMultiBalance"
    },
    @{
        name = "Multi Balance - Natural Language"
        prompt = "What are the balances for these addresses: 0x6492772d1474ffa1ed6944e86735848c253bb007, 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
        expectedTool = "getMultiBalance"
        description = "Natural language multi-address query"
    },
    @{
        name = "ERC20 Transfers - General"
        prompt = "Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC20Transfers"
        description = "General ERC20 transfers without specific token"
    },
    @{
        name = "ERC20 Transfers - USDC Specific"
        prompt = "Get USDC transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC20Transfers"
        description = "Should detect USDC token context"
    },
    @{
        name = "ERC20 Transfers - Token History"
        prompt = "What token transfers happened for 0x6492772d1474ffa1ed6944e86735848c253bb007?"
        expectedTool = "getERC20Transfers"
        description = "Token transfer history query"
    },
    @{
        name = "NFT Transfers - Basic"
        prompt = "Show NFT transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC721Transfers"
        description = "Basic NFT transfer query"
    },
    @{
        name = "NFT Transfers - Alternative Phrasing"
        prompt = "Get ERC721 transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getERC721Transfers"
        description = "Technical NFT terminology"
    },
    @{
        name = "Address Type - Contract Check"
        prompt = "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"
        expectedTool = "getAddressType"
        description = "Direct contract vs wallet question"
    },
    @{
        name = "Address Type - Alternative"
        prompt = "What type of address is 0x6492772d1474ffa1ed6944e86735848c253bb007?"
        expectedTool = "getAddressType"
        description = "Alternative address type query"
    },
    @{
        name = "Gas Oracle - Recommendations"
        prompt = "What are the current gas price recommendations?"
        expectedTool = "getGasOracle"
        description = "Gas price recommendation query"
    },
    @{
        name = "Gas Oracle - Alternative"
        prompt = "Show me gas price options for transactions"
        expectedTool = "getGasOracle"
        description = "Alternative gas oracle query"
    },
    @{
        name = "Token Info - Contract Details"
        prompt = "Get information about token contract 0xA0b86a33E6441918E634293Df0c9b7b78b147b39"
        expectedTool = "getTokenInfo"
        description = "Token contract information query"
    },
    @{
        name = "Token Info - What Token"
        prompt = "What token is 0xA0b86a33E6441918E634293Df0c9b7b78b147b39?"
        expectedTool = "getTokenInfo"
        description = "Token identification query"
    },
    @{
        name = "Internal Transactions - Address"
        prompt = "Show internal transactions for 0x6492772d1474ffa1ed6944e86735848c253bb007"
        expectedTool = "getInternalTransactions"
        description = "Internal transactions by address"
    },
    @{
        name = "Transaction Status - Hash"
        prompt = "What's the status of transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef?"
        expectedTool = "getTransactionStatus"
        description = "Transaction status query"
    },
    @{
        name = "Contract Source - Verification"
        prompt = "Is contract 0x6492772d1474ffa1ed6944e86735848c253bb007 verified? Show me the source code"
        expectedTool = "getContractSource"
        description = "Contract verification and source query"
    },
    @{
        name = "Contract Creation - When Created"
        prompt = "When was contract 0x6492772d1474ffa1ed6944e86735848c253bb007 created?"
        expectedTool = "getContractCreation"
        description = "Contract creation query"
    }
)

$successCount = 0
$totalTests = $testPrompts.Count

Write-Host "Running $totalTests test prompts..." -ForegroundColor Yellow
Write-Host ""

foreach ($test in $testPrompts) {
    Write-Host "Test: $($test.name)" -ForegroundColor Cyan
    Write-Host "Description: $($test.description)" -ForegroundColor Gray
    Write-Host "Prompt: $($test.prompt)" -ForegroundColor White
    
    try {
        $body = @{
            message = $test.prompt
        } | ConvertTo-Json -Depth 3
        
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 25
        
        $toolUsed = $null
        if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
            $toolUsed = $response.toolsUsed[0].name
        }
        
        if ($toolUsed -eq $test.expectedTool) {
            Write-Host "✅ SUCCESS: Correct tool used ($toolUsed)" -ForegroundColor Green
            $successCount++
        } elseif ($toolUsed) {
            Write-Host "❌ WRONG TOOL: Expected $($test.expectedTool), got $toolUsed" -ForegroundColor Red
        } else {
            Write-Host "❌ NO TOOL: Expected $($test.expectedTool), no tool was used" -ForegroundColor Red
        }
        
        # Show response preview
        $responsePreview = $response.response.Substring(0, [Math]::Min(80, $response.response.Length))
        Write-Host "Response: $responsePreview..." -ForegroundColor White
        
    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Summary
Write-Host "Test Results Summary:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "Passed: $successCount / $totalTests" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } elseif ($successCount -gt ($totalTests * 0.7)) { "Yellow" } else { "Red" })

$passRate = [Math]::Round(($successCount / $totalTests) * 100, 1)
Write-Host "Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

if ($successCount -eq $totalTests) {
    Write-Host "🎉 All new tools are working perfectly!" -ForegroundColor Green
} elseif ($successCount -gt ($totalTests * 0.8)) {
    Write-Host "✅ Most tools working well. Minor adjustments may be needed." -ForegroundColor Yellow
} else {
    Write-Host "⚠️ Several tests failed. Review tool selection logic." -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: Some tools may require specific data (valid addresses, tx hashes) to work properly." -ForegroundColor Gray
