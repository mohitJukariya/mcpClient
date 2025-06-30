# Simple PowerShell test for tool calling
$baseUrl = "http://localhost:3000"

Write-Host "Testing Tool Calling Debug" -ForegroundColor Cyan

$testMessage = @{
    message = "what is the current gas price"
    personalityId = "alice"
} | ConvertTo-Json

try {
    Write-Host "Sending test request..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $testMessage -ContentType "application/json"
    
    Write-Host "Response received!" -ForegroundColor Green
    Write-Host "Tools used: $($response.toolsUsed.Count)" -ForegroundColor Cyan
    Write-Host "Response: $($response.response)" -ForegroundColor White
    
    if ($response.toolsUsed.Count -gt 0) {
        Write-Host "Tool details: $($response.toolsUsed[0] | ConvertTo-Json)" -ForegroundColor Magenta
    } else {
        Write-Host "NO TOOLS WERE CALLED - This is the problem!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Message -like "*ConnectFailure*") {
        Write-Host "Server not running. Please start with: npm run start:dev" -ForegroundColor Yellow
    }
}
