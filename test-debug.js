// Quick test script for tool calling
const axios = require('axios');

const baseUrl = 'http://localhost:3000';

async function testToolCalling() {
    console.log('🧪 Testing Tool Calling with Debug Info');
    
    const testCases = [
        {
            name: 'Gas Price Query',
            message: 'what is the current gas price'
        },
        {
            name: 'Balance Query',
            message: 'balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890'
        },
        {
            name: 'Simple Gas Query',
            message: 'gas fees'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.name}`);
        console.log(`📝 Query: "${testCase.message}"`);
        
        try {
            const response = await axios.post(`${baseUrl}/chat`, {
                message: testCase.message,
                personalityId: 'alice'
            });
            
            console.log('✅ Response received');
            console.log('🔧 Tools used:', response.data.toolsUsed?.length || 0);
            if (response.data.toolsUsed?.length > 0) {
                console.log('🛠️  Tool details:', response.data.toolsUsed[0]);
            }
            console.log('📄 Response:', response.data.response.substring(0, 100) + '...');
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log('❌ Server not running. Please start with: npm run start:dev');
                break;
            } else {
                console.log('❌ Error:', error.message);
            }
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

testToolCalling().catch(console.error);
