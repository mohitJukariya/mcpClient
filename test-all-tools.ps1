# Comprehensive Tool Testing Script
# This script tests all available MCP tools to identify response handling issues

$baseUrl = "http://localhost:3000"

Write-Host "🔧 COMPREHENSIVE TOOL TESTING SUITE" -ForegroundColor Cyan
Write-Host "Testing all MCP tools to identify response handling issues..." -ForegroundColor White

# First, get list of available tools
Write-Host "`n📋 Step 1: Getting available tools..." -ForegroundColor Yellow

try {
    $toolsResponse = Invoke-RestMethod -Uri "$baseUrl/tools" -Method Get -ContentType "application/json"
    $tools = $toolsResponse.tools
    Write-Host "✅ Found $($tools.Count) available tools" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get tools list. Make sure server is running on $baseUrl" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Define test cases for each tool
$testCases = @{
    "getBalance" = @{
        message = "Get ETH balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("ETH", "balance", "0x742d35Cc")
        shouldHaveData = $true
    }
    "getMultiBalance" = @{
        message = "Get balances for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 and 0x8315177aB297bA25A6b3C27A8D3C63d66cFf4F51"
        expectedKeywords = @("balance", "0x742d35Cc", "0x8315177a")
        shouldHaveData = $true
    }
    "getGasPrice" = @{
        message = "What's the current gas price on Arbitrum?"
        expectedKeywords = @("gas", "price", "gwei")
        shouldHaveData = $true
    }
    "getGasOracle" = @{
        message = "Show me gas recommendations"
        expectedKeywords = @("gas", "safe", "standard", "fast")
        shouldHaveData = $true
    }
    "getLatestBlock" = @{
        message = "Get the latest block number"
        expectedKeywords = @("block", "number")
        shouldHaveData = $true
    }
    "getBlock" = @{
        message = "Get block information for block 285000000"
        expectedKeywords = @("block", "285000000", "hash")
        shouldHaveData = $true
    }
    "getTransaction" = @{
        message = "Show transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        expectedKeywords = @("transaction", "hash")
        shouldHaveData = $false # May not exist
    }
    "getTransactionHistory" = @{
        message = "Get transaction history for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("transaction", "history", "hash", "block")
        shouldHaveData = $true
    }
    "getTokenInfo" = @{
        message = "What token is 0xA0b86a33E6441918E634293Df0c9b7b78b147b39?"
        expectedKeywords = @("token", "symbol", "name")
        shouldHaveData = $true
    }
    "getAddressType" = @{
        message = "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a contract or wallet?"
        expectedKeywords = @("contract", "wallet", "EOA")
        shouldHaveData = $true
    }
    "validateAddress" = @{
        message = "Validate address 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("valid", "address")
        shouldHaveData = $true
    }
    "getEthSupply" = @{
        message = "What's the total ETH supply?"
        expectedKeywords = @("supply", "ETH", "total")
        shouldHaveData = $true
    }
    "getERC20Transfers" = @{
        message = "Show ERC20 transfers for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("transfer", "token", "ERC20")
        shouldHaveData = $false # May have no transfers
    }
    "getERC721Transfers" = @{
        message = "Show NFT transfers for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("transfer", "NFT", "ERC721")
        shouldHaveData = $false # May have no transfers
    }
    "getInternalTransactions" = @{
        message = "Show internal transactions for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"
        expectedKeywords = @("internal", "transaction")
        shouldHaveData = $false # May have none
    }
    "getContractSource" = @{
        message = "Get contract source for 0xA0b86a33E6441918E634293Df0c9b7b78b147b39"
        expectedKeywords = @("contract", "source", "verified")
        shouldHaveData = $false # May not be verified
    }
    "getTransactionStatus" = @{
        message = "Get status of transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        expectedKeywords = @("transaction", "status")
        shouldHaveData = $false # May not exist
    }
    "getContractCreation" = @{
        message = "Get contract creation details for 0xA0b86a33E6441918E634293Df0c9b7b78b147b39"
        expectedKeywords = @("contract", "creation", "creator")
        shouldHaveData = $false # May not be available
    }
}

# Results tracking
$results = @{}
$issuesFound = @()

Write-Host "`n🧪 Step 2: Testing each tool..." -ForegroundColor Yellow

foreach ($toolName in $tools.name) {
    if ($testCases.ContainsKey($toolName)) {
        Write-Host "`n┌─ Testing: $toolName" -ForegroundColor Cyan
        
        $testCase = $testCases[$toolName]
        
        # Send test message
        $requestBody = @{
            message = $testCase.message
            personalityId = "alice"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/chat" -Method Post -Body $requestBody -ContentType "application/json"
            
            # Check if tool was called
            $toolWasCalled = $response.toolsUsed -and $response.toolsUsed.Count -gt 0
            
            if ($toolWasCalled) {
                $usedTool = $response.toolsUsed[0]
                Write-Host "├─ ✅ Tool called: $($usedTool.name)" -ForegroundColor Green
                Write-Host "├─ 📝 Response length: $($response.response.Length) chars" -ForegroundColor Gray
                
                # Check response quality
                $responseQuality = @{
                    hasExpectedKeywords = $false
                    hasActualData = $false
                    isGeneric = $false
                }
                
                # Check for expected keywords
                $keywordCount = 0
                foreach ($keyword in $testCase.expectedKeywords) {
                    if ($response.response -match $keyword) {
                        $keywordCount++
                    }
                }
                $responseQuality.hasExpectedKeywords = $keywordCount -gt 0
                
                # Check for actual data vs generic response
                $genericPhrases = @("is provided", "information", "details", "data", "I'll get that", "using")
                $genericCount = 0
                foreach ($phrase in $genericPhrases) {
                    if ($response.response -match $phrase) {
                        $genericCount++
                    }
                }
                $responseQuality.isGeneric = $genericCount -gt 1 -and $response.response.Length -lt 200
                
                # Check for actual blockchain data
                $dataPatterns = @("0x[0-9a-fA-F]+", "\d+\.\d+", "\d+", "ETH", "Gwei")
                foreach ($pattern in $dataPatterns) {
                    if ($response.response -match $pattern) {
                        $responseQuality.hasActualData = $true
                        break
                    }
                }
                
                # Evaluate response
                if ($responseQuality.isGeneric -and -not $responseQuality.hasActualData) {
                    Write-Host "├─ ⚠️  ISSUE: Generic response, no actual data displayed" -ForegroundColor Red
                    $issuesFound += @{
                        tool = $toolName
                        issue = "Generic response - tool result not properly formatted in follow-up"
                        response = $response.response
                        toolResult = $usedTool.result
                    }
                } elseif (-not $responseQuality.hasExpectedKeywords) {
                    Write-Host "├─ ⚠️  ISSUE: Missing expected keywords" -ForegroundColor Yellow
                    $issuesFound += @{
                        tool = $toolName
                        issue = "Missing expected keywords in response"
                        response = $response.response
                        expectedKeywords = $testCase.expectedKeywords
                    }
                } else {
                    Write-Host "├─ ✅ Response quality: GOOD" -ForegroundColor Green
                }
                
                Write-Host "├─ 📄 Response preview: $($response.response.Substring(0, [Math]::Min(80, $response.response.Length)))..." -ForegroundColor Gray
                
            } else {
                Write-Host "├─ ❌ Tool NOT called - LLM failed to detect tool usage" -ForegroundColor Red
                $issuesFound += @{
                    tool = $toolName
                    issue = "Tool not called - LLM detection failure"
                    response = $response.response
                    message = $testCase.message
                }
            }
            
            $results[$toolName] = @{
                success = $toolWasCalled
                response = $response.response
                toolsUsed = $response.toolsUsed
            }
            
        } catch {
            Write-Host "├─ ❌ ERROR: $_" -ForegroundColor Red
            $results[$toolName] = @{
                success = $false
                error = $_.Exception.Message
            }
        }
        
        Write-Host "└─ Done`n" -ForegroundColor Gray
        Start-Sleep -Milliseconds 500
    } else {
        Write-Host "⚠️  No test case defined for: $toolName" -ForegroundColor Yellow
    }
}

# Summary Report
Write-Host "`n📊 COMPREHENSIVE TEST RESULTS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$successCount = ($results.Values | Where-Object { $_.success }).Count
$totalCount = $results.Count

Write-Host "✅ Tools working correctly: $successCount / $totalCount" -ForegroundColor Green
Write-Host "⚠️  Issues found: $($issuesFound.Count)" -ForegroundColor Yellow

if ($issuesFound.Count -gt 0) {
    Write-Host "`n🚨 ISSUES REQUIRING FIXES:" -ForegroundColor Red
    
    for ($i = 0; $i -lt $issuesFound.Count; $i++) {
        $issue = $issuesFound[$i]
        Write-Host "`n$($i + 1). Tool: $($issue.tool)" -ForegroundColor Yellow
        Write-Host "   Issue: $($issue.issue)" -ForegroundColor Red
        Write-Host "   Response: $($issue.response.Substring(0, [Math]::Min(100, $issue.response.Length)))..." -ForegroundColor Gray
        
        if ($issue.toolResult) {
            Write-Host "   Tool had data: YES (length: $($issue.toolResult.ToString().Length))" -ForegroundColor Cyan
        }
    }
    
    Write-Host "`n🔧 RECOMMENDED FIXES:" -ForegroundColor Green
    Write-Host "1. Add specific followUpInstruction cases for tools with generic responses" -ForegroundColor White
    Write-Host "2. Update system prompt with better examples for problematic tools" -ForegroundColor White
    Write-Host "3. Improve tool result formatting in chat.service.ts" -ForegroundColor White
    
} else {
    Write-Host "`n🎉 All tools are working correctly!" -ForegroundColor Green
}

Write-Host "`n📋 DETAILED TOOL STATUS:" -ForegroundColor Cyan
foreach ($toolName in $results.Keys | Sort-Object) {
    $result = $results[$toolName]
    if ($result.success) {
        Write-Host "✅ $toolName" -ForegroundColor Green
    } elseif ($result.error) {
        Write-Host "❌ $toolName - Error: $($result.error)" -ForegroundColor Red
    } else {
        Write-Host "⚠️  $toolName - Tool not called" -ForegroundColor Yellow
    }
}

Write-Host "`n🏁 Testing complete!" -ForegroundColor Cyan
