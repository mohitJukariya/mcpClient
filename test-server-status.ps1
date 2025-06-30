# Simple check to see available tools via MCP service
$baseUrl = "http://localhost:3000"

Write-Host "🔍 Checking available MCP tools..." -ForegroundColor Cyan

try {
    # Try to get tools from a chat request first to see what's available
    $testMessage = @{
        message = "list available tools"
        personalityId = "alice"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $testMessage -ContentType "application/json"
    Write-Host "✅ Server is running" -ForegroundColor Green
    Write-Host "Response: $($response.response)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Server not responding: $_" -ForegroundColor Red
    Write-Host "Please start the server with: npm run start:dev" -ForegroundColor Yellow
}
