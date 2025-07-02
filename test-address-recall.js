const axios = require('axios');

async function testAddressRecall() {
    const baseUrl = 'http://localhost:3000/api/chat';
    const sessionId = 'test-session-' + Date.now();
    const personalityId = 'alice';
    
    console.log('🧪 Testing Address Recall Fix...\n');
    
    try {
        // First message: Ask for balance of a specific address
        console.log('1️⃣ First message: Asking for balance of a specific address');
        const message1 = 'What is the ETH balance of 0x64927772d1474fa1ed6944e86735848c253bb007?';
        const response1 = await axios.post(baseUrl, {
            message: message1,
            sessionId: sessionId,
            personalityId: personalityId
        });
        
        console.log('User:', message1);
        console.log('Assistant:', response1.data.response);
        console.log('Tools used:', response1.data.toolsUsed.map(t => t.name));
        console.log('---\n');
        
        // Wait a moment to ensure caching
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Second message: Ask about gas prices (different topic)
        console.log('2️⃣ Second message: Asking about gas prices');
        const message2 = 'What are the current gas prices?';
        const response2 = await axios.post(baseUrl, {
            message: message2,
            sessionId: sessionId,
            personalityId: personalityId
        });
        
        console.log('User:', message2);
        console.log('Assistant:', response2.data.response);
        console.log('Tools used:', response2.data.toolsUsed.map(t => t.name));
        console.log('---\n');
        
        // Wait a moment to ensure caching
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Third message: Ask about the same address from message 1
        console.log('3️⃣ Third message: Asking about the same address from message 1');
        const message3 = 'What was the full address I asked about in the first message?';
        const response3 = await axios.post(baseUrl, {
            message: message3,
            sessionId: sessionId,
            personalityId: personalityId
        });
        
        console.log('User:', message3);
        console.log('Assistant:', response3.data.response);
        console.log('Tools used:', response3.data.toolsUsed ? response3.data.toolsUsed.map(t => t.name) : 'None');
        console.log('---\n');
        
        // Check if the response includes the full address
        const fullAddress = '0x64927772d1474fa1ed6944e86735848c253bb007';
        const hasFullAddress = response3.data.response.includes(fullAddress);
        
        console.log('✅ RESULT:');
        console.log(`Full address recall: ${hasFullAddress ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Expected: ${fullAddress}`);
        console.log(`Response contains full address: ${hasFullAddress}`);
        
        if (!hasFullAddress) {
            console.log('🔍 Checking if response contains any part of the address...');
            const addressParts = [
                '0x649277', // First part
                '253bb007', // Last part
                'addr1',    // Short reference
                'addr2'     // Short reference
            ];
            
            addressParts.forEach(part => {
                if (response3.data.response.includes(part)) {
                    console.log(`   Found: ${part}`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testAddressRecall();
