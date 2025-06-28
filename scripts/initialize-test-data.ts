import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

async function initializeTestData() {
    console.log('🔧 Initializing Test Data for Three Users');
    console.log('='.repeat(50));

    try {
        // Get all users first
        const usersResponse = await axios.get(`${BASE_URL}/api/context/users`);
        const users = usersResponse.data;

        console.log(`✅ Found ${users.length} test users`);

        // Initialize context for each user
        for (const user of users) {
            console.log(`\n📝 Initializing context for ${user.name} (${user.role})...`);

            // Add context entries based on user role
            const contextEntries = generateContextForUser(user);

            for (const entry of contextEntries) {
                try {
                    const response = await axios.post(`${BASE_URL}/api/context/users/${user.id}/context`, entry);
                    console.log(`   ✅ Added context: ${entry.content.substring(0, 50)}...`);
                } catch (error) {
                    console.log(`   ❌ Failed to add context: ${error.message}`);
                }
            }

            // Simulate some chat interactions to build context
            const chatQueries = generateChatQueriesForUser(user);

            for (const query of chatQueries) {
                try {
                    const chatResponse = await axios.post(`${BASE_URL}/api/chat`, {
                        message: query,
                        sessionId: `init-session-${user.id}`,
                        userId: user.id
                    });
                    console.log(`   💬 Chat: "${query}" -> ${chatResponse.data.response.substring(0, 50)}...`);
                } catch (error) {
                    console.log(`   ❌ Chat failed: ${error.message}`);
                }

                // Wait a bit between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Test cross-user context
        console.log('\n🔄 Testing Cross-User Context...');

        const crossContextResponse = await axios.post(`${BASE_URL}/api/chat`, {
            message: "What have other users been asking about recently?",
            sessionId: "cross-context-test",
            userId: "user-001"
        });

        console.log(`✅ Cross-context response: ${crossContextResponse.data.response.substring(0, 100)}...`);

        console.log('\n🎉 Test data initialization completed!');
        return true;

    } catch (error) {
        console.error('❌ Initialization failed:', error.response?.data || error.message);
        return false;
    }
}

function generateContextForUser(user: any): any[] {
    const baseContext = {
        metadata: {
            timestamp: new Date().toISOString(),
            toolsUsed: [],
            confidence: 0.9,
            relatedEntries: []
        }
    };

    switch (user.role) {
        case 'trader':
            return [
                {
                    id: `ctx-${user.id}-${Date.now()}-1`,
                    userId: user.id,
                    type: 'preference',
                    content: 'Prefers to trade during low gas periods, typically 2-6 AM UTC',
                    metadata: { ...baseContext.metadata, confidence: 0.95 }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-2`,
                    userId: user.id,
                    type: 'insight',
                    content: 'Has observed that gas prices correlate with European/US market hours',
                    metadata: { ...baseContext.metadata, confidence: 0.85, toolsUsed: ['getGasPrice'] }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-3`,
                    userId: user.id,
                    type: 'preference',
                    content: 'Focuses on ETH, USDC, and ARB tokens for arbitrage opportunities',
                    metadata: { ...baseContext.metadata, confidence: 0.9 }
                }
            ];

        case 'developer':
            return [
                {
                    id: `ctx-${user.id}-${Date.now()}-1`,
                    userId: user.id,
                    type: 'insight',
                    content: 'Often needs to debug smart contract interactions and analyze failed transactions',
                    metadata: { ...baseContext.metadata, confidence: 0.92, toolsUsed: ['getTransaction', 'getContractAbi'] }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-2`,
                    userId: user.id,
                    type: 'preference',
                    content: 'Prefers detailed technical information and raw blockchain data',
                    metadata: { ...baseContext.metadata, confidence: 0.88 }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-3`,
                    userId: user.id,
                    type: 'insight',
                    content: 'Has expertise in gas optimization and contract deployment strategies',
                    metadata: { ...baseContext.metadata, confidence: 0.9, toolsUsed: ['getBlock', 'getGasPrice'] }
                }
            ];

        case 'analyst':
            return [
                {
                    id: `ctx-${user.id}-${Date.now()}-1`,
                    userId: user.id,
                    type: 'insight',
                    content: 'Specializes in tracking large wallet movements and whale behavior',
                    metadata: { ...baseContext.metadata, confidence: 0.94, toolsUsed: ['getBalance', 'getTransactionHistory'] }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-2`,
                    userId: user.id,
                    type: 'preference',
                    content: 'Interested in statistical analysis and market trend correlations',
                    metadata: { ...baseContext.metadata, confidence: 0.87 }
                },
                {
                    id: `ctx-${user.id}-${Date.now()}-3`,
                    userId: user.id,
                    type: 'insight',
                    content: 'Has identified patterns between large transactions and price movements',
                    metadata: { ...baseContext.metadata, confidence: 0.91, toolsUsed: ['getTokenBalance', 'getTransactionHistory'] }
                }
            ];

        default:
            return [];
    }
}

function generateChatQueriesForUser(user: any): string[] {
    switch (user.role) {
        case 'trader':
            return [
                "What's the current gas price on Arbitrum?",
                "Check the balance of my favorite address: 0x722E8BdD2ce80A4422E880164f2079488e115365",
                "Is this a good time to make a large transaction?",
                "What's the USDC balance for the Arbitrum multisig?"
            ];

        case 'developer':
            return [
                "Can you get the ABI for the UNI token contract?",
                "Show me the latest block information",
                "Analyze this transaction hash for any issues",
                "What are the current gas optimization strategies?"
            ];

        case 'analyst':
            return [
                "Show me the transaction history for this whale address",
                "What tokens does this large holder have?",
                "Are there any unusual transaction patterns recently?",
                "Track the balance changes for major holders"
            ];

        default:
            return ["What can you help me with?"];
    }
}

async function main() {
    console.log('🚀 Starting Test Data Initialization');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('\n');

    const success = await initializeTestData();
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Initialization failed:', error);
        process.exit(1);
    });
}
