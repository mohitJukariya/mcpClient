param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "Testing Arbitrum Analytics Tools" -ForegroundColor Cyan
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
        Name = "Address Validation"
        Message = "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a valid address?"
        ExpectedTool = "validateAddress"
    }
)

$passed = 0
$total = $testCases.Count

foreach ($test in $testCases) {
    Write-Host ""
    Write-Host "Testing: $($test.Name)" -ForegroundColor Yellow
    Write-Host "Query: $($test.Message)"
    
    try {
        $body = @{
            message = $test.Message
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/chat" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
        
        $toolUsed = $false
        $correctTool = $false
        
        if ($response.toolsUsed -and $response.toolsUsed.Count -gt 0) {
            $toolUsed = $true
            $usedToolName = $response.toolsUsed[0].name
            Write-Host "Tool Used: $usedToolName" -ForegroundColor Green
            
            if ($usedToolName -eq $test.ExpectedTool) {
                $correctTool = $true
            } else {
                Write-Host "Expected: $($test.ExpectedTool), Got: $usedToolName" -ForegroundColor Red
            }
        } else {
            Write-Host "No tool was used" -ForegroundColor Red
        }
        
        # Show response preview
        $responseLength = $response.response.Length
        $responsePreview = if ($responseLength -gt 100) { $response.response.Substring(0, 100) + "..." } else { $response.response }
        Write-Host "Response: $responsePreview" -ForegroundColor Gray
        
        if ($toolUsed -and $correctTool) {
            Write-Host "PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAILED" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "FAILED" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
$passPercent = [math]::Round($passed/$total*100, 1)
$failPercent = [math]::Round(($total-$passed)/$total*100, 1)
Write-Host "Passed: $passed/$total ($passPercent%)" -ForegroundColor Green
Write-Host "Failed: $($total-$passed)/$total ($failPercent%)" -ForegroundColor Red

if ($passed -eq $total) {
    Write-Host ""
    Write-Host "All tools are working correctly!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Some tools need attention." -ForegroundColor Yellow
}
