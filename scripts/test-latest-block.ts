import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const MCP_SERVER_BASE_URL = process.env.MCP_SERVER_BASE_URL || 'https://arbitrummcpserver-production.up.railway.app';

interface McpResponse {
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}

async function testLatestBlock() {
    console.log('🧪 Testing Latest Block Number Retrieval...');
    console.log(`🔗 MCP Server: ${MCP_SERVER_BASE_URL}`);
    console.log('='.repeat(50));

    try {
        // Test 1: Initialize MCP server first
        console.log('\n1️⃣ Initializing MCP server...');
        const initRequest = {
            jsonrpc: '2.0',
            id: 'init',
            method: 'initialize'
        };

        const initResponse = await axios.post(`${MCP_SERVER_BASE_URL}/api/mcp`, initRequest);

        if (initResponse.data.error) {
            throw new Error(`Init error: ${initResponse.data.error.message}`);
        }

        console.log('✅ MCP server initialized');

        // Test 2: Get available tools
        console.log('\n2️⃣ Getting available tools from MCP server...');
        const toolsRequest = {
            jsonrpc: '2.0',
            id: 'list-tools',
            method: 'tools/list'
        };

        const toolsResponse = await axios.post(`${MCP_SERVER_BASE_URL}/api/mcp`, toolsRequest);

        if (toolsResponse.data.error) {
            throw new Error(`Tools list error: ${toolsResponse.data.error.message}`);
        }

        const tools = toolsResponse.data.result?.tools || [];
        console.log(`✅ Found ${tools.length} available tools`);

        // Display all tools
        console.log('\n📋 Available tools:');
        tools.forEach((tool: any) => {
            console.log(`   • ${tool.name}: ${tool.description}`);
        });

        // Find block-related tools
        const blockTools = tools.filter((tool: any) =>
            tool.name.toLowerCase().includes('block') ||
            tool.description.toLowerCase().includes('block')
        );

        console.log('\n🧱 Block-related tools:');
        blockTools.forEach((tool: any) => {
            console.log(`   • ${tool.name}: ${tool.description}`);
        });

        // Test 3: Try to get latest block using available tools
        console.log('\n3️⃣ Testing block number retrieval...');

        // Try different possible tool names for getting latest block
        const possibleBlockTools = [
            'getLatestBlock',
            'getBlockNumber',
            'getCurrentBlock',
            'getBlock',
            'getLatestBlockNumber',
            'blockNumber',
            'currentBlock'
        ];

        let blockResult = null;
        let successfulTool = null;

        for (const toolName of possibleBlockTools) {
            const tool = tools.find((t: any) => t.name === toolName);
            if (tool) {
                console.log(`   Trying tool: ${toolName}...`);
                try {
                    const callRequest = {
                        jsonrpc: '2.0',
                        id: `tool-${Date.now()}`,
                        method: 'tools/call',
                        params: {
                            name: toolName,
                            arguments: {}
                        }
                    };

                    const callResponse = await axios.post(`${MCP_SERVER_BASE_URL}/api/mcp`, callRequest);

                    if (!callResponse.data.error) {
                        blockResult = callResponse.data.result;
                        successfulTool = toolName;
                        console.log(`   ✅ Success with ${toolName}!`);
                        console.log(`   📦 Result:`, JSON.stringify(blockResult, null, 2));
                        break;
                    } else {
                        console.log(`   ❌ Error with ${toolName}: ${callResponse.data.error.message}`);
                    }
                } catch (error: any) {
                    console.log(`   ❌ Exception with ${toolName}: ${error.message}`);
                }
            }
        }

        // Test 4: Test via chat endpoint (full integration test)
        console.log('\n4️⃣ Testing via chat endpoint...');
        try {
            const chatResponse = await axios.post('http://localhost:3000/api/chat', {
                message: 'What is the latest block number?',
                sessionId: 'test-session-block',
                userId: 'test-user-block'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Chat endpoint response:');
            console.log(`   Message: "${chatResponse.data.response}"`);
            console.log(`   Session: ${chatResponse.data.sessionId}`);

            if (chatResponse.data.toolsUsed && chatResponse.data.toolsUsed.length > 0) {
                console.log(`   Tools used: ${chatResponse.data.toolsUsed.join(', ')}`);
            }
        } catch (error: any) {
            console.log(`❌ Chat endpoint error: ${error.message}`);
            if (error.response?.data) {
                console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }

        // Display results
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS:');

        if (successfulTool && blockResult) {
            console.log(`✅ Successfully retrieved block data using: ${successfulTool}`);
            console.log(`📦 Block result:`, JSON.stringify(blockResult, null, 2));

            // Try to extract block number from result
            let blockNumber = null;
            if (typeof blockResult.content === 'string') {
                const match = blockResult.content.match(/(\d+)/);
                blockNumber = match ? match[1] : null;
            } else if (blockResult.number) {
                blockNumber = blockResult.number;
            } else if (blockResult.blockNumber) {
                blockNumber = blockResult.blockNumber;
            }

            if (blockNumber) {
                console.log(`🔢 Extracted block number: ${blockNumber}`);
            }
        } else {
            console.log('❌ Could not retrieve block data directly from MCP server');
            console.log('💡 This might be normal if block tools require specific parameters');
        }

        console.log('\n✨ Test completed!');
        return true;

    } catch (error: any) {
        console.error('❌ Test failed with error:', error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Additional helper function to test specific queries
async function testBlockQueries() {
    console.log('\n🔍 Testing various block-related queries...');

    const queries = [
        'What is the latest block number?',
        'Get the current block height',
        'Show me the latest block',
        'What is the current block number on Arbitrum?',
        'Get latest block info'
    ];

    for (const query of queries) {
        console.log(`\n🔸 Testing: "${query}"`);
        try {
            const response = await axios.post('http://localhost:3000/api/chat', {
                message: query,
                sessionId: `test-block-${Date.now()}`,
                userId: 'test-user'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log(`   ✅ Response: "${response.data.response}"`);
        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
}

// Run the tests
async function main() {
    console.log('🚀 Starting Latest Block Number Tests...\n');

    const success = await testLatestBlock();

    if (success) {
        await testBlockQueries();
    }

    console.log('\n🏁 All tests completed!');
}

if (require.main === module) {
    main().catch(console.error);
}

export { testLatestBlock, testBlockQueries };
