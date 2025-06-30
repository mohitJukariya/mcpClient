#!/usr/bin/env pwsh
Write-Host "Testing Personality System" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$BASE_URL = "http://localhost:3000"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "`nTesting: $Description" -ForegroundColor Yellow
    Write-Host "Endpoint: $Method $Url" -ForegroundColor Gray
    
    try {
        $headers = @{
            'Content-Type' = 'application/json'
        }
        
        if ($Body) {
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Body $Body -Headers $headers
        } else {
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers
        }
        
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 10 | Write-Host
        return $true
    }
    catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test 1: Get All Personalities
$success1 = Test-Endpoint -Method "GET" -Url "$BASE_URL/personalities" -Description "Get all personalities"

# Test 2: Get Specific Personalities
$personalities = @("alice", "bob", "charlie")
$success2 = $true
foreach ($personality in $personalities) {
    $result = Test-Endpoint -Method "GET" -Url "$BASE_URL/personalities/$personality" -Description "Get personality: $personality"
    $success2 = $success2 -and $result
}

# Test 3: Get Personality Contexts
$success3 = $true
foreach ($personality in $personalities) {
    $result = Test-Endpoint -Method "GET" -Url "$BASE_URL/personalities/$personality/context" -Description "Get context for: $personality"
    $success3 = $success3 -and $result
}

# Test 4: Chat with Alice (Gas & Trading Expert)
$aliceBody = @{
    message = "Check ETH balance for 0x6492772d1474ffa1ed6944e86735848c253bb007"
    personalityId = "alice"
} | ConvertTo-Json

$success4 = Test-Endpoint -Method "POST" -Url "$BASE_URL/chat" -Body $aliceBody -Description "Chat with Alice about ETH balance"

# Test 5: Chat with Bob (Contract Developer)
$bobBody = @{
    message = "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"
    personalityId = "bob"
} | ConvertTo-Json

$success5 = Test-Endpoint -Method "POST" -Url "$BASE_URL/chat" -Body $bobBody -Description "Chat with Bob about address type"

# Test 6: Chat with Charlie (Whale Tracker)
$charlieBody = @{
    message = "Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
    personalityId = "charlie"
} | ConvertTo-Json

$success6 = Test-Endpoint -Method "POST" -Url "$BASE_URL/chat" -Body $charlieBody -Description "Chat with Charlie about token transfers"

# Test 7: Chat without personality (default)
$defaultBody = @{
    message = "What is Arbitrum?"
} | ConvertTo-Json

$success7 = Test-Endpoint -Method "POST" -Url "$BASE_URL/chat" -Body $defaultBody -Description "Chat without personality (default)"

# Results Summary
Write-Host "`n" -NoNewline
Write-Host "Test Results Summary:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

$tests = @(
    @{ Name = "Get All Personalities"; Success = $success1 }
    @{ Name = "Get Individual Personalities"; Success = $success2 }
    @{ Name = "Get Personality Contexts"; Success = $success3 }
    @{ Name = "Chat with Alice"; Success = $success4 }
    @{ Name = "Chat with Bob"; Success = $success5 }
    @{ Name = "Chat with Charlie"; Success = $success6 }
    @{ Name = "Default Chat"; Success = $success7 }
)

$passed = 0
$total = $tests.Count

foreach ($test in $tests) {
    $status = if ($test.Success) { "✅ PASS" } else { "❌ FAIL" }
    Write-Host "$($test.Name): $status"
    if ($test.Success) { $passed++ }
}

Write-Host "`nOverall: $passed/$total tests passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

if ($passed -eq $total) {
    Write-Host "🎉 All personality system tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Check the application logs for details." -ForegroundColor Yellow
}
