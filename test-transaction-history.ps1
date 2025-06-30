# Test transaction history display

$baseUrl = "http://localhost:3000"

Write-Host "🧪 Testing Transaction History Display" -ForegroundColor Cyan

# Test case: Get transaction history
Write-Host "`n📋 Testing transaction history for address" -ForegroundColor Yellow

$testMessage = @{
    message = "get transaction history of 0xa2aAe2C88942af777681A8C084427b50565bDa55"
    personalityId = "alice"
} | ConvertTo-Json

Write-Host "Sending transaction history request..." -ForegroundColor Green
$response = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $testMessage -ContentType "application/json"

Write-Host "Response: $($response.response)" -ForegroundColor White
Write-Host "Tools Used: $($response.toolsUsed.Count)" -ForegroundColor Magenta

if ($response.toolsUsed.Count -gt 0) {
    Write-Host "✅ SUCCESS: Transaction history tool was called!" -ForegroundColor Green
    foreach ($tool in $response.toolsUsed) {
        Write-Host "  Tool: $($tool.name)" -ForegroundColor Cyan
        Write-Host "  Args: $($tool.arguments | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    }
    
    # Check if response contains transaction details
    if ($response.response -like "*transaction*" -and $response.response -like "*hash*") {
        Write-Host "✅ SUCCESS: Response contains transaction details!" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: Response doesn't contain transaction details" -ForegroundColor Red
        Write-Host "Response was: $($response.response)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ FAILED: No tools were called" -ForegroundColor Red
}

Write-Host "`n🏁 Transaction History Test Complete!" -ForegroundColor Cyan
