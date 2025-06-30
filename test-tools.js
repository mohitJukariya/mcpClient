// Tool testing script in Node.js
const axios = require('axios');

const baseUrl = 'http://localhost:3000';

// Test cases for each tool
const testCases = {
    getBalance: {
        message: "Get ETH balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890",
        expectedKeywords: ["ETH", "balance", "0x742d35Cc"],
        shouldHaveData: true
    },
    getMultiBalance: {
        message: "Get balances for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 and 0x8315177aB297bA25A6b3C27A8D3C63d66cFf4F51",
        expectedKeywords: ["balance", "0x742d35Cc", "0x8315177a"],
        shouldHaveData: true
    },
    getGasPrice: {
        message: "What's the current gas price on Arbitrum?",
        expectedKeywords: ["gas", "price", "gwei"],
        shouldHaveData: true
    },
    getGasOracle: {
        message: "Show me gas recommendations",
        expectedKeywords: ["gas", "safe", "standard", "fast"],
        shouldHaveData: true
    },
    getTransactionHistory: {
        message: "Get transaction history for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890",
        expectedKeywords: ["transaction", "history", "hash", "block"],
        shouldHaveData: true
    },
    getTokenInfo: {
        message: "What token is 0xA0b86a33E6441918E634293Df0c9b7b78b147b39?",
        expectedKeywords: ["token", "symbol", "name"],
        shouldHaveData: true
    },
    getAddressType: {
        message: "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a contract or wallet?",
        expectedKeywords: ["contract", "wallet", "EOA"],
        shouldHaveData: true
    }
};

async function testTool(toolName, testCase) {
    console.log(`\n🧪 Testing: ${toolName}`);
    
    try {
        const response = await axios.post(`${baseUrl}/chat`, {
            message: testCase.message,
            personalityId: "alice"
        });
        
        const toolWasCalled = response.data.toolsUsed && response.data.toolsUsed.length > 0;
        
        if (toolWasCalled) {
            const usedTool = response.data.toolsUsed[0];
            console.log(`✅ Tool called: ${usedTool.name}`);
            console.log(`📝 Response length: ${response.data.response.length} chars`);
            
            // Check response quality
            const responseText = response.data.response.toLowerCase();
            const hasKeywords = testCase.expectedKeywords.some(keyword => 
                responseText.includes(keyword.toLowerCase())
            );
            
            const isGeneric = (responseText.includes('is provided') || 
                              responseText.includes('information') ||
                              responseText.includes('details')) && 
                              response.data.response.length < 200;
            
            const hasActualData = /0x[0-9a-fA-F]+|\d+\.\d+|\d+|ETH|Gwei/i.test(response.data.response);
            
            if (isGeneric && !hasActualData) {
                console.log(`⚠️  ISSUE: Generic response, no actual data displayed`);
                console.log(`📄 Response: ${response.data.response.substring(0, 100)}...`);
                return { tool: toolName, issue: 'Generic response - needs follow-up instruction fix' };
            } else if (!hasKeywords) {
                console.log(`⚠️  ISSUE: Missing expected keywords`);
                return { tool: toolName, issue: 'Missing expected keywords' };
            } else {
                console.log(`✅ Response quality: GOOD`);
            }
            
        } else {
            console.log(`❌ Tool NOT called - LLM failed to detect tool usage`);
            return { tool: toolName, issue: 'Tool not called - LLM detection failure' };
        }
        
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return { tool: toolName, issue: `Error: ${error.message}` };
    }
    
    return null;
}

async function runAllTests() {
    console.log('🔧 COMPREHENSIVE TOOL TESTING SUITE');
    console.log('Testing tools to identify response handling issues...\n');
    
    const issues = [];
    
    for (const [toolName, testCase] of Object.entries(testCases)) {
        const result = await testTool(toolName, testCase);
        if (result) {
            issues.push(result);
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(50));
    
    if (issues.length > 0) {
        console.log(`\n🚨 ISSUES FOUND: ${issues.length}`);
        issues.forEach((issue, i) => {
            console.log(`${i + 1}. Tool: ${issue.tool}`);
            console.log(`   Issue: ${issue.issue}\n`);
        });
        
        console.log('🔧 RECOMMENDED FIXES:');
        console.log('1. Add specific followUpInstruction cases for tools with generic responses');
        console.log('2. Update system prompt with better examples for problematic tools');
        console.log('3. Improve tool result formatting in chat.service.ts');
        
    } else {
        console.log('\n🎉 All tools are working correctly!');
    }
}

// Check if server is running first
async function checkServer() {
    try {
        await axios.get(`${baseUrl}`);
        console.log('✅ Server is running');
        return true;
    } catch (error) {
        console.log('❌ Server not running. Please start with: npm run start:dev');
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runAllTests();
    }
}

main().catch(console.error);
