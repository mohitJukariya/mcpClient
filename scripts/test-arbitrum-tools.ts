import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const MCP_SERVER_URL = process.env.MCP_SERVER_BASE_URL || 'https://arbitrummcpserver-production.up.railway.app';
const MCP_API_ENDPOINT = `${MCP_SERVER_URL}/api/mcp`;

interface McpRequest {
    jsonrpc: string;
    id: string | number;
    method: string;
    params?: any;
}

interface McpResponse {
    jsonrpc: string;
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// Test data
const TEST_ADDRESS = '0x722E8BdD2ce80A4422E880164f2079488e115365'; // Arbitrum multisig
const TEST_TX_HASH = '0x7b1e2c6d8e5a3f4b9d8c7e6f5a4b3c2d1e0f9e8d7c6b5a4'; // Valid-looking hash for testing
const TEST_CONTRACT_ADDRESS = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'; // USDC on Arbitrum
const TEST_BLOCK_NUMBER = 'latest';

async function callMcpTool(toolName: string, args: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        console.log(`🔧 Testing tool: ${toolName}`);
        console.log(`📝 Arguments:`, JSON.stringify(args, null, 2));

        const requestBody: McpRequest = {
            jsonrpc: '2.0',
            id: `test-${Date.now()}`,
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: args,
            },
        };

        const response = await axios.post(MCP_API_ENDPOINT, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        });

        console.log(`✅ Response status: ${response.status}`);

        if (response.data.error) {
            console.log(`❌ Tool error:`, response.data.error);
            return { success: false, error: response.data.error.message };
        }

        console.log(`📊 Result:`, JSON.stringify(response.data.result, null, 2));
        return { success: true, data: response.data.result };

    } catch (error) {
        console.log(`💥 Request failed:`, error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

async function testArbitrumTools() {
    console.log('🧪 Testing All Arbitrum MCP Tools');
    console.log('='.repeat(50));
    console.log(`🔗 MCP Server: ${MCP_SERVER_URL}`);
    console.log('='.repeat(50));

    const results: { [key: string]: 'success' | 'error' } = {};

    // Test 1: Get Balance
    console.log('\n1️⃣ Testing getBalance');
    console.log('-'.repeat(30));
    const balanceResult = await callMcpTool('getBalance', {
        address: TEST_ADDRESS
    });
    results['getBalance'] = balanceResult.success ? 'success' : 'error';

    // Test 2: Get Transaction
    console.log('\n2️⃣ Testing getTransaction');
    console.log('-'.repeat(30));
    const transactionResult = await callMcpTool('getTransaction', {
        txHash: TEST_TX_HASH
    });
    results['getTransaction'] = transactionResult.success ? 'success' : 'error';

    // Test 3: Get Transaction Receipt
    console.log('\n3️⃣ Testing getTransactionReceipt');
    console.log('-'.repeat(30));
    const receiptResult = await callMcpTool('getTransactionReceipt', {
        txHash: TEST_TX_HASH
    });
    results['getTransactionReceipt'] = receiptResult.success ? 'success' : 'error';

    // Test 4: Get Block
    console.log('\n4️⃣ Testing getBlock');
    console.log('-'.repeat(30));
    const blockResult = await callMcpTool('getBlock', {
        blockNumber: TEST_BLOCK_NUMBER
    });
    results['getBlock'] = blockResult.success ? 'success' : 'error';

    // Test 5: Get Latest Block
    console.log('\n5️⃣ Testing getLatestBlock');
    console.log('-'.repeat(30));
    const latestBlockResult = await callMcpTool('getLatestBlock', {});
    results['getLatestBlock'] = latestBlockResult.success ? 'success' : 'error';

    // Test 6: Get Transaction History
    console.log('\n6️⃣ Testing getTransactionHistory');
    console.log('-'.repeat(30));
    const historyResult = await callMcpTool('getTransactionHistory', {
        address: TEST_ADDRESS,
        page: '1',
        offset: '5'
    });
    results['getTransactionHistory'] = historyResult.success ? 'success' : 'error';

    // Test 7: Get Contract ABI
    console.log('\n7️⃣ Testing getContractAbi');
    console.log('-'.repeat(30));
    const abiResult = await callMcpTool('getContractAbi', {
        address: TEST_CONTRACT_ADDRESS
    });
    results['getContractAbi'] = abiResult.success ? 'success' : 'error';

    // Test 8: Get Token Balance
    console.log('\n8️⃣ Testing getTokenBalance');
    console.log('-'.repeat(30));
    const tokenBalanceResult = await callMcpTool('getTokenBalance', {
        contractAddress: TEST_CONTRACT_ADDRESS,
        address: TEST_ADDRESS
    });
    results['getTokenBalance'] = tokenBalanceResult.success ? 'success' : 'error';

    // Test 9: Get Gas Price
    console.log('\n9️⃣ Testing getGasPrice');
    console.log('-'.repeat(30));
    const gasPriceResult = await callMcpTool('getGasPrice', {});
    results['getGasPrice'] = gasPriceResult.success ? 'success' : 'error';

    // Test 10: Get ETH Supply
    console.log('\n🔟 Testing getEthSupply');
    console.log('-'.repeat(30));
    const ethSupplyResult = await callMcpTool('getEthSupply', {});
    results['getEthSupply'] = ethSupplyResult.success ? 'success' : 'error';

    // Test 11: Validate Address
    console.log('\n1️⃣1️⃣ Testing validateAddress');
    console.log('-'.repeat(30));
    const validateResult = await callMcpTool('validateAddress', {
        address: TEST_ADDRESS
    });
    results['validateAddress'] = validateResult.success ? 'success' : 'error';

    // Test with invalid address
    console.log('\n1️⃣2️⃣ Testing validateAddress (invalid)');
    console.log('-'.repeat(30));
    const validateInvalidResult = await callMcpTool('validateAddress', {
        address: 'invalid_address'
    });
    results['validateAddress_invalid'] = validateInvalidResult.success ? 'success' : 'error';

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));

    const successCount = Object.values(results).filter(r => r === 'success').length;
    const errorCount = Object.values(results).filter(r => r === 'error').length;

    Object.entries(results).forEach(([tool, status]) => {
        const icon = status === 'success' ? '✅' : '❌';
        console.log(`${icon} ${tool}: ${status.toUpperCase()}`);
    });

    console.log('\n' + '-'.repeat(30));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Success Rate: ${((successCount / (successCount + errorCount)) * 100).toFixed(1)}%`);

    if (errorCount === 0) {
        console.log('\n🎉 All tools are working perfectly!');
    } else {
        console.log('\n⚠️ Some tools need attention. Check the errors above.');
    }

    return results;
}

// Test server connectivity and list available tools
async function testServerConnectivity() {
    console.log('🔍 Testing MCP server connectivity...');
    try {
        const initRequest: McpRequest = {
            jsonrpc: '2.0',
            id: 'connectivity-test',
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'test-client',
                    version: '1.0.0'
                }
            }
        };

        const response = await axios.post(MCP_API_ENDPOINT, initRequest, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if ((response.status === 200 || response.status === 201) && response.data.jsonrpc === '2.0' && response.data.result) {
            console.log('✅ MCP server is accessible');
            console.log(`📋 Server info:`, JSON.stringify(response.data.result.serverInfo, null, 2));

            // Now list available tools
            console.log('\n🔧 Listing available tools...');
            const toolsRequest: McpRequest = {
                jsonrpc: '2.0',
                id: 'tools-list',
                method: 'tools/list',
                params: {}
            };

            const toolsResponse = await axios.post(MCP_API_ENDPOINT, toolsRequest, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (toolsResponse.data.result && toolsResponse.data.result.tools) {
                console.log(`📊 Found ${toolsResponse.data.result.tools.length} tools:`);
                toolsResponse.data.result.tools.forEach((tool: any) => {
                    console.log(`  - ${tool.name}: ${tool.description}`);
                });
            }

            return true;
        } else {
            console.log('❌ MCP server responded but initialization failed');
            console.log('Status:', response.status);
            console.log('Data:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ MCP server connectivity failed:', error.response?.data || error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Arbitrum Tools Test Suite');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('\n');

    // Test connectivity first
    const isConnected = await testServerConnectivity();
    if (!isConnected) {
        console.log('💥 Cannot proceed without server connectivity');
        process.exit(1);
    }

    console.log('\n');

    // Run all tool tests
    const results = await testArbitrumTools();

    // Exit with appropriate code
    const hasErrors = Object.values(results).some(r => r === 'error');
    process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
});
