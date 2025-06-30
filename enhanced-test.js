// Enhanced test with better error handling
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

console.log('🧪 Enhanced Tool Calling Test');
console.log('📝 Testing query: "what is the current gas price"');
console.log('🌐 Connecting to: http://localhost:3000/chat');

const req = http.request(options, (res) => {
    console.log(`📡 Response status: ${res.statusCode}`);
    console.log(`📡 Response headers:`, res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\n📥 Raw response data:', data);
        
        try {
            const response = JSON.parse(data);
            console.log('\n✅ Parsed response:');
            console.log('   Response content:', response.response);
            console.log('   Tools used:', response.toolsUsed?.length || 0);
            console.log('   Full response object:', JSON.stringify(response, null, 2));
            
            if (response.toolsUsed?.length > 0) {
                console.log('🛠️  Tool details:', response.toolsUsed[0]);
                console.log('✅ SUCCESS: Tool was called!');
            } else {
                console.log('❌ PROBLEM: No tools were called!');
                console.log('\n🔍 This means either:');
                console.log('   1. LLM is not generating TOOL_CALL: format');
                console.log('   2. Tool extraction regex is not working');
                console.log('   3. Response cleaning is removing everything');
                console.log('   4. There\'s an error in the LLM service');
            }
            
        } catch (error) {
            console.log('❌ Error parsing JSON response:', error.message);
            console.log('📄 Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
        console.log('❌ Cannot connect to server on port 3000');
        console.log('💡 Please start server first:');
        console.log('   npm run start:dev');
        console.log('   OR');
        console.log('   npm start');
    } else {
        console.log('❌ Request error:', error.message);
        console.log('❌ Error details:', error);
    }
});

req.write(testData);
req.end();

console.log('📤 Request sent...');
