import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const CHAT_API_ENDPOINT = process.env.CHAT_API_ENDPOINT || 'http://localhost:3000/api/chat';

interface ChatResponse {
    response: string;
    sessionId: string;
    toolsUsed?: Array<{
        name: string;
        arguments: any;
        result: any;
    }>;
    metadata?: any;
}

// Test cases to verify tool selection and response formatting
const testCases = [
    {
        name: "Balance Query",
        query: "What's the ETH balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890?",
        expectedTool: "getBalance",
        expectsToolCall: true
    },
    {
        name: "Token Balance Query",
        query: "Get token balance for address 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 token 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        expectedTool: "getTokenBalance",
        expectsToolCall: true
    },
    {
        name: "Latest Block Query",
        query: "What's the current block number?",
        expectedTool: "getLatestBlock",
        expectsToolCall: true
    },
    {
        name: "Gas Price Query",
        query: "How much is gas right now?",
        expectedTool: "getGasPrice",
        expectsToolCall: true
    },
    {
        name: "Transaction Query",
        query: "Show me transaction 0x2aeae361915b441a32d9aa3e573de1737143f9412600c4d927746577377db5c6",
        expectedTool: "getTransaction",
        expectsToolCall: true
    },
    {
        name: "Address Validation",
        query: "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a valid address?",
        expectedTool: "validateAddress",
        expectsToolCall: true
    },
    {
        name: "General Question",
        query: "What is Arbitrum?",
        expectedTool: null,
        expectsToolCall: false
    },
    {
        name: "How-to Question",
        query: "How do I send ETH on Arbitrum?",
        expectedTool: null,
        expectsToolCall: false
    }
];

async function testChatEndpoint(query: string): Promise<ChatResponse> {
    try {
        console.log(`📤 Sending query: "${query}"`);

        const response = await axios.post(CHAT_API_ENDPOINT, {
            message: query
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log(`✅ Response status: ${response.status}`);
        return response.data;

    } catch (error) {
        console.log(`❌ Request failed:`, error.response?.data || error.message);
        throw error;
    }
}

function analyzeResponse(testCase: any, response: ChatResponse): {
    passed: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    let passed = true;

    console.log(`\n📊 ANALYZING: ${testCase.name}`);
    console.log(`📝 Response: ${response.response.substring(0, 100)}...`);
    console.log(`🔧 Tools Used: ${response.toolsUsed?.length || 0}`);

    if (response.toolsUsed && response.toolsUsed.length > 0) {
        console.log(`🛠️ Tool Details:`, response.toolsUsed.map(t => `${t.name}(${Object.keys(t.arguments).join(',')})`).join(', '));
    }

    // Check if tool was used when expected
    if (testCase.expectsToolCall && (!response.toolsUsed || response.toolsUsed.length === 0)) {
        issues.push(`Expected tool call but none found`);
        passed = false;
    }

    // Check if no tool was used when not expected
    if (!testCase.expectsToolCall && response.toolsUsed && response.toolsUsed.length > 0) {
        issues.push(`Unexpected tool call: ${response.toolsUsed.map(t => t.name).join(', ')}`);
        passed = false;
    }

    // Check if correct tool was used
    if (testCase.expectsToolCall && testCase.expectedTool && response.toolsUsed && response.toolsUsed.length > 0) {
        const usedTool = response.toolsUsed[0].name;
        if (usedTool !== testCase.expectedTool) {
            issues.push(`Expected tool '${testCase.expectedTool}' but got '${usedTool}'`);
            passed = false;
        }
    }

    // Check for tool call syntax in response (should be cleaned)
    if (response.response.includes('TOOL_CALL:')) {
        issues.push(`Response contains uncleaned tool call syntax`);
        passed = false;
    }

    // Check for formatting instructions in response
    const formatInstructions = [
        'CONVERT TO DECIMAL', 'KEEP AS HEX', 'formatting guidelines',
        'decision logic', 'tool mode', 'chat mode', 'guidelines'
    ];

    for (const instruction of formatInstructions) {
        if (response.response.toLowerCase().includes(instruction.toLowerCase())) {
            issues.push(`Response contains formatting instruction: "${instruction}"`);
            passed = false;
        }
    }

    // Check response length (should be reasonable)
    if (testCase.expectsToolCall && response.response.length > 200) {
        issues.push(`Tool response too long (${response.response.length} chars)`);
        passed = false;
    }

    // Check if response makes sense
    if (response.response.length < 10 || response.response.trim() === '') {
        issues.push(`Response too short or empty`);
        passed = false;
    }

    console.log(`${passed ? '✅' : '❌'} Result: ${passed ? 'PASSED' : 'FAILED'}`);
    if (issues.length > 0) {
        console.log(`⚠️ Issues: ${issues.join(', ')}`);
    }

    return { passed, issues };
}

async function runToolSelectionTests() {
    console.log('🚀 Starting Tool Selection and Response Formatting Test Suite');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log(`🎯 Endpoint: ${CHAT_API_ENDPOINT}`);
    console.log('='.repeat(80));

    const results: { [key: string]: { passed: boolean; issues: string[] } } = {};

    for (const testCase of testCases) {
        console.log(`\n🧪 TEST: ${testCase.name}`);
        console.log('-'.repeat(50));

        try {
            const response = await testChatEndpoint(testCase.query);
            results[testCase.name] = analyzeResponse(testCase, response);

            // Add small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.log(`💥 Test failed with error: ${error.message}`);
            results[testCase.name] = {
                passed: false,
                issues: [`Test execution failed: ${error.message}`]
            };
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = Object.values(results).filter(r => r.passed).length;
    const total = Object.keys(results).length;
    const failed = total - passed;

    Object.entries(results).forEach(([testName, result]) => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
        if (!result.passed && result.issues.length > 0) {
            result.issues.forEach(issue => {
                console.log(`    ⚠️ ${issue}`);
            });
        }
    });

    console.log('\n' + '-'.repeat(40));
    console.log(`✅ Passed: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}/${total} (${((failed / total) * 100).toFixed(1)}%)`);

    if (passed === total) {
        console.log('\n🎉 All tests passed! Tool selection and formatting are working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Check the issues above for areas that need improvement.');
    }

    return results;
}

// Main execution
async function main() {
    try {
        await runToolSelectionTests();
        process.exit(0);
    } catch (error) {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    }
}

main();
