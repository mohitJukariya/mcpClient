// Enhanced test script with better error handling
const http = require('http');

const testData = JSON.stringify({
    message: "what is the current gas price",
    personalityId: "alice"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/chat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
    }
};

console.log('🧪 Enhanced Test - Tool Calling Debug');
console.log('📝 Query: "what is the current gas price"');
console.log('🎭 Personality: alice');
console.log('📡 Sending request to: http://localhost:3000/chat');

const req = http.request(options, (res) => {
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`📦 Raw response length: ${data.length}`);
        console.log(`📄 Raw response: ${data.substring(0, 500)}...`);
        
        try {
            const response = JSON.parse(data);
            
            console.log('\n🔍 RESPONSE ANALYSIS:');
            console.log('Response keys:', Object.keys(response));
            console.log('Tools used:', response.toolsUsed?.length || 0);
            console.log('Response content:', response.response);
            console.log('Error field:', response.error);
            console.log('Success field:', response.success);
            
            if (response.toolsUsed?.length > 0) {
                console.log('✅ SUCCESS: Tool was called!');
                console.log('🛠️  Tool details:', response.toolsUsed[0]);
            } else {
                console.log('❌ PROBLEM: No tools were called!');
                
                // Check if there's an error in the response
                if (response.error) {
                    console.log('� Server Error:', response.error);
                }
                
                // Check if response is undefined vs empty
                if (response.response === undefined) {
                    console.log('🚨 Response is undefined - check server LLM processing');
                } else if (response.response === '') {
                    console.log('🚨 Response is empty string - check content cleaning');
                } else {
                    console.log('📄 Response content:', response.response);
                }
            }
            
        } catch (error) {
            console.log('❌ JSON Parse Error:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
        console.log('❌ Cannot connect to server.');
        console.log('💡 Make sure server is running: npm run start:dev');
        console.log('💡 Check if port 3000 is available');
    } else {
        console.log('❌ Request error:', error.message);
    }
});

req.on('timeout', () => {
    console.log('⏰ Request timeout - server might be slow or stuck');
    req.destroy();
});

req.setTimeout(30000); // 30 second timeout

console.log('📤 Sending request...');
req.write(testData);
req.end();
