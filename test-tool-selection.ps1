#!/usr/bin/env pwsh
Write-Host "Testing Tool Selection - Gas Price Focus" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$BASE_URL = "http://localhost:3000"

function Test-ChatQuery {
    param(
        [string]$Query,
        [string]$ExpectedTool,
        [string]$PersonalityId = $null,
        [string]$Description
    )
    
    Write-Host "`nTesting: $Description" -ForegroundColor Yellow
    Write-Host "Query: $Query" -ForegroundColor Gray
    Write-Host "Expected Tool: $ExpectedTool" -ForegroundColor Gray
    
    try {
        $body = @{
            message = $Query
        }
        
        if ($PersonalityId) {
            $body.personalityId = $PersonalityId
        }
        
        $jsonBody = $body | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method POST -Body $jsonBody -ContentType "application/json"
        
        # Check if tool was called (toolCalls array should have entries)
        $toolCalled = $response.toolsUsed -and $response.toolsUsed.Count -gt 0
        
        if ($toolCalled) {
            $actualTool = $response.toolsUsed[0].name
            if ($actualTool -eq $ExpectedTool) {
                Write-Host "✅ SUCCESS: Correct tool used ($actualTool)" -ForegroundColor Green
            } else {
                Write-Host "❌ WRONG TOOL: Expected $ExpectedTool, got $actualTool" -ForegroundColor Red
            }
        } else {
            if ($ExpectedTool -eq "none") {
                Write-Host "✅ SUCCESS: No tool used (as expected)" -ForegroundColor Green
            } else {
                Write-Host "❌ NO TOOL: Expected $ExpectedTool, no tool was used" -ForegroundColor Red
            }
        }
        
        Write-Host "Response: $($response.response.Substring(0, [Math]::Min(100, $response.response.Length)))..." -ForegroundColor Gray
        return $toolCalled -and ($actualTool -eq $ExpectedTool)
    }
    catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test gas price queries
Write-Host "`nTesting Gas Price Tool Selection:" -ForegroundColor Cyan

$tests = @(
    @{ Query = "What's the current gas price?"; ExpectedTool = "getGasPrice"; Description = "Direct gas price question" }
    @{ Query = "Current gas price"; ExpectedTool = "getGasPrice"; Description = "Short gas price query" }
    @{ Query = "Show me gas fees"; ExpectedTool = "getGasPrice"; Description = "Gas fees query" }
    @{ Query = "What are gas costs right now?"; ExpectedTool = "getGasPrice"; Description = "Gas costs query" }
    @{ Query = "Gas price recommendations"; ExpectedTool = "getGasOracle"; Description = "Gas recommendations" }
    @{ Query = "Optimal gas fees"; ExpectedTool = "getGasOracle"; Description = "Optimal gas query" }
    @{ Query = "Get gas oracle"; ExpectedTool = "getGasOracle"; Description = "Direct gas oracle" }
    @{ Query = "Latest block"; ExpectedTool = "getLatestBlock"; Description = "Latest block query" }
    @{ Query = "ETH balance for 0x6492772d1474ffa1ed6944e86735848c253bb007"; ExpectedTool = "getBalance"; Description = "Balance query" }
    @{ Query = "What is Arbitrum?"; ExpectedTool = "none"; Description = "Educational question (no tool)" }
)

$passed = 0
$total = $tests.Count

foreach ($test in $tests) {
    $result = Test-ChatQuery -Query $test.Query -ExpectedTool $test.ExpectedTool -Description $test.Description
    if ($result) { $passed++ }
}

Write-Host "`n" -NoNewline
Write-Host "Gas Price Tool Test Results:" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

if ($passed -eq $total) {
    Write-Host "🎉 All gas price tool tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. The LLM may need further prompt adjustments." -ForegroundColor Yellow
}

# Test with Alice personality
Write-Host "`nTesting with Alice personality:" -ForegroundColor Cyan
$aliceResult = Test-ChatQuery -Query "Current gas price" -ExpectedTool "getGasPrice" -PersonalityId "alice" -Description "Alice gas price query"

Write-Host "`nNote: Tool selection should work the same regardless of personality." -ForegroundColor Gray
