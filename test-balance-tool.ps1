#!/usr/bin/env pwsh
Write-Host "Testing Balance Tool Call" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$BASE_URL = "http://localhost:3000"

function Test-BalanceQuery {
    param(
        [string]$Query,
        [string]$Description
    )
    
    Write-Host "`nTesting: $Description" -ForegroundColor Yellow
    Write-Host "Query: $Query" -ForegroundColor Gray
    
    try {
        $body = @{
            message = $Query
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/chat" -Method POST -Body $body -ContentType "application/json"
        
        # Check if tool was called
        $toolCalled = $response.toolsUsed -and $response.toolsUsed.Count -gt 0
        
        if ($toolCalled) {
            $toolName = $response.toolsUsed[0].name
            Write-Host "✅ Tool Called: $toolName" -ForegroundColor Green
            
            # Show the response
            Write-Host "Response: $($response.response)" -ForegroundColor Cyan
            
            # Check if response mentions formatted balance
            if ($response.response -match "0\.\d+\s*ETH" -or $response.response -match "\d+\.?\d*e-\d+") {
                Write-Host "✅ Formatted balance detected in response" -ForegroundColor Green
            } else {
                Write-Host "⚠️  No formatted balance pattern found" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ NO TOOL CALLED" -ForegroundColor Red
            Write-Host "Response: $($response.response)" -ForegroundColor Gray
        }
        
        return $toolCalled
    }
    catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test balance queries
$queries = @(
    @{ Query = "fetch the eth balance of this address 0x879c2A2F7E4071ebDc971E508885d4a8cDEAF227"; Description = "Address balance query" }
    @{ Query = "ETH balance for 0x6492772d1474ffa1ed6944e86735848c253bb007"; Description = "Simple balance query" }
    @{ Query = "What's the balance of 0x879c2A2F7E4071ebDc971E508885d4a8cDEAF227?"; Description = "Question format balance query" }
)

$passed = 0
$total = $queries.Count

foreach ($test in $queries) {
    $result = Test-BalanceQuery -Query $test.Query -Description $test.Description
    if ($result) { $passed++ }
    Start-Sleep -Seconds 2  # Add delay between requests
}

Write-Host "`n" -NoNewline
Write-Host "Balance Test Results:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

if ($passed -eq $total) {
    Write-Host "🎉 All balance tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Check if tools are being called correctly." -ForegroundColor Yellow
}
