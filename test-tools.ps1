param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "🧪 Testing Arbitrum Analytics Tools" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Test cases
$testCases = @(
    @{
        Name = "Latest Block"
        Message = "What is the current block number?"
        ExpectedTool = "getLatestBlock"
    },
    @{
        Name = "Gas Price"
        Message = "What is the current gas price?"
        ExpectedTool = "getGasPrice"
    },
    @{
        Name = "Balance Query"
        Message = "What's the ETH balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890?"
        ExpectedTool = "getBalance"
    },
    @{
        Name = "Token Balance"
        Message = "Get token balance for address 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 token 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
        ExpectedTool = "getTokenBalance"
    },
    @{
        Name = "Address Validation"
        Message = "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a valid address?"
        ExpectedTool = "validateAddress"
    },
    @{
        Name = "Transaction Query"
        Message = "Show me transaction 0x2aeae361915b441a32d9aa3e573de1737143f9412600c4d927746577377db5c6"
        ExpectedTool = "getTransaction"
    }
)

$passed = 0
$total = $testCases.Count

foreach ($test in $testCases) {
    Write-Host "`n🧪 Testing: $($test.Name)" -ForegroundColor Yellow
    Write-Host "Query: $($test.Message)"
    
    try {
        $body = @{
            message = $test.Message
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
        
        $toolUsed = $false
        $correctTool = $false
        $cleanResponse = $true
        
        if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
            $toolUsed = $true
            $usedToolName = $response.toolsUsed[0].name
            Write-Host "🔧 Tool Used: $usedToolName" -ForegroundColor Green
            
            if ($usedToolName -eq $test.ExpectedTool) {
                $correctTool = $true
            } else {
                Write-Host "⚠️ Expected: $($test.ExpectedTool), Got: $usedToolName" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ No tool was used" -ForegroundColor Red
        }
        
        # Check for clean response
        if ($response.response -match "TOOL_CALL:" -or $response.response -match "CONVERT TO DECIMAL" -or $response.response -match "formatting guidelines") {
            $cleanResponse = $false
            Write-Host "⚠️ Response contains formatting artifacts" -ForegroundColor Red
        }
        
        # Show response preview
        $responsePreview = $response.response.Substring(0, [Math]::Min(100, $response.response.Length))
        Write-Host "📝 Response: $responsePreview..." -ForegroundColor Gray
        
        if ($toolUsed -and $correctTool -and $cleanResponse) {
            Write-Host "✅ PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "❌ FAILED" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "💥 Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "❌ FAILED" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "📊 Test Results Summary" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $passed/$total ($([math]::Round($passed/$total*100, 1))%)" -ForegroundColor Green
Write-Host "❌ Failed: $($total-$passed)/$total ($([math]::Round(($total-$passed)/$total*100, 1))%)" -ForegroundColor Red

if ($passed -eq $total) {
    Write-Host "`n🎉 All tools are working correctly!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Some tools need attention." -ForegroundColor Yellow
}
