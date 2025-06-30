# Test contextual tool extraction for follow-up queries

$baseUrl = "http://localhost:3000"

Write-Host "🧪 Testing Contextual Tool Extraction" -ForegroundColor Cyan

# Test case: User provides addresses first, then asks to use tool
Write-Host "`n📋 Test 1: Multi-address context extraction" -ForegroundColor Yellow

# First message: User provides addresses
$firstMessage = @{
    message = "I have these Arbitrum addresses: 0x8315177aB297bA25A6b3C27A8D3C63d66cFf4F51, 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
    personalityId = "alice"
} | ConvertTo-Json

Write-Host "Sending first message with addresses..." -ForegroundColor Green
$firstResponse = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $firstMessage -ContentType "application/json"
Write-Host "First Response: $($firstResponse.response)" -ForegroundColor White
$sessionId = $firstResponse.sessionId
Write-Host "Session ID: $sessionId" -ForegroundColor Gray

# Second message: User asks to use tool for above query
$secondMessage = @{
    message = "use tool to get multi address balance for the above query"
    sessionId = $sessionId
    personalityId = "alice"
} | ConvertTo-Json

Write-Host "`nSending follow-up message to use tool..." -ForegroundColor Green
$secondResponse = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $secondMessage -ContentType "application/json"
Write-Host "Second Response: $($secondResponse.response)" -ForegroundColor White
Write-Host "Tools Used: $($secondResponse.toolsUsed.Count)" -ForegroundColor Magenta

if ($secondResponse.toolsUsed.Count -gt 0) {
    Write-Host "✅ SUCCESS: Tool was called contextually!" -ForegroundColor Green
    foreach ($tool in $secondResponse.toolsUsed) {
        Write-Host "  Tool: $($tool.name)" -ForegroundColor Cyan
        Write-Host "  Args: $($tool.arguments | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ FAILED: No tools were called" -ForegroundColor Red
}

Write-Host "`n" + "="*50

# Test case 2: Gas price context
Write-Host "`n📋 Test 2: Gas price context extraction" -ForegroundColor Yellow

$gasMessage1 = @{
    message = "I need to know about current gas fees on Arbitrum"
    personalityId = "bob"
} | ConvertTo-Json

Write-Host "Sending gas inquiry message..." -ForegroundColor Green
$gasResponse1 = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $gasMessage1 -ContentType "application/json"
Write-Host "First Response: $($gasResponse1.response)" -ForegroundColor White
$gasSessionId = $gasResponse1.sessionId

$gasMessage2 = @{
    message = "use tool for the above query"
    sessionId = $gasSessionId
    personalityId = "bob"
} | ConvertTo-Json

Write-Host "`nSending follow-up to use tool..." -ForegroundColor Green
$gasResponse2 = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $gasMessage2 -ContentType "application/json"
Write-Host "Second Response: $($gasResponse2.response)" -ForegroundColor White
Write-Host "Tools Used: $($gasResponse2.toolsUsed.Count)" -ForegroundColor Magenta

if ($gasResponse2.toolsUsed.Count -gt 0) {
    Write-Host "✅ SUCCESS: Gas tool was called contextually!" -ForegroundColor Green
    foreach ($tool in $gasResponse2.toolsUsed) {
        Write-Host "  Tool: $($tool.name)" -ForegroundColor Cyan
        Write-Host "  Args: $($tool.arguments | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ FAILED: No gas tools were called" -ForegroundColor Red
}

Write-Host "`n" + "="*50

# Test case 3: Single address with different operations
Write-Host "`n📋 Test 3: Single address balance context" -ForegroundColor Yellow

$singleMessage1 = @{
    message = "Here's my wallet: 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
    personalityId = "charlie"
} | ConvertTo-Json

Write-Host "Sending single address message..." -ForegroundColor Green
$singleResponse1 = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $singleMessage1 -ContentType "application/json"
Write-Host "First Response: $($singleResponse1.response)" -ForegroundColor White
$singleSessionId = $singleResponse1.sessionId

$singleMessage2 = @{
    message = "use tool to check balance for that address"
    sessionId = $singleSessionId
    personalityId = "charlie"
} | ConvertTo-Json

Write-Host "`nSending follow-up to check balance..." -ForegroundColor Green
$singleResponse2 = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $singleMessage2 -ContentType "application/json"
Write-Host "Second Response: $($singleResponse2.response)" -ForegroundColor White
Write-Host "Tools Used: $($singleResponse2.toolsUsed.Count)" -ForegroundColor Magenta

if ($singleResponse2.toolsUsed.Count -gt 0) {
    Write-Host "✅ SUCCESS: Balance tool was called contextually!" -ForegroundColor Green
    foreach ($tool in $singleResponse2.toolsUsed) {
        Write-Host "  Tool: $($tool.name)" -ForegroundColor Cyan
        Write-Host "  Args: $($tool.arguments | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ FAILED: No balance tools were called" -ForegroundColor Red
}

Write-Host "`n🏁 Contextual Tool Extraction Tests Complete!" -ForegroundColor Cyan
