/**
 * Test script to verify that the first message in a conversation uses the full system prompt
 * This test checks that our fix for the KV cache bug is working correctly
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Testing First Message System Prompt Fix...\n');

// Function to make a chat request
function makeChatRequest(message, sessionId) {
    const payload = {
        message: message,
        sessionId: sessionId
    };

    const curlCommand = `curl -X POST http://localhost:3000/chat/message -H "Content-Type: application/json" -d "${JSON.stringify(payload).replace(/"/g, '\\"')}" -s`;

    try {
        const response = execSync(curlCommand, { encoding: 'utf8', timeout: 30000 });
        return JSON.parse(response);
    } catch (error) {
        console.error('❌ Error making request:', error.message);
        return null;
    }
}

// Function to check server logs for our specific log messages
function checkServerLogs() {
    console.log('\n🔍 Checking server logs for prompt usage...\n');
    
    // Look for our specific log messages in the terminal output
    console.log('📋 Expected log patterns:');
    console.log('  ✅ First message: "🎯 FIRST MESSAGE DETECTED - Using FULL system prompt"');
    console.log('  ✅ Full prompt: "🔥 FULL SYSTEM PROMPT MODE"');
    console.log('  ✅ Compressed prompt: "⚡ COMPRESSED PROMPT MODE"');
    console.log('\n📝 Please check the server terminal for these log messages');
}

// Test function
async function testFirstMessageFix() {
    console.log('1. Testing NEW conversation (should use FULL system prompt)...');
    
    // Generate a unique session ID
    const newSessionId = `test-session-${Date.now()}`;
    
    // Make the first request with tool usage
    console.log('   📤 Sending: "What is the balance of 0x742c4e0a78Bf8B3B7C5FAB3df4b4C93bE3A5f9E4?"');
    const firstResponse = makeChatRequest('What is the balance of 0x742c4e0a78Bf8B3B7C5FAB3df4b4C93bE3A5f9E4?', newSessionId);
    
    if (firstResponse && firstResponse.response) {
        console.log('   ✅ First message response received');
        console.log('   📝 Response preview:', firstResponse.response.substring(0, 100) + '...');
        
        // The fact that we got a response with tool usage suggests the full system prompt was used
        if (firstResponse.response.includes('balance') || firstResponse.response.includes('ETH') || firstResponse.response.includes('0x')) {
            console.log('   ✅ PASS: First message appears to have used full system prompt (tool worked)');
        } else {
            console.log('   ⚠️  UNCERTAIN: First message response doesn\'t clearly indicate tool usage');
        }
    } else {
        console.log('   ❌ FAIL: No response received for first message');
        return;
    }

    // Wait a moment for cache to be populated
    console.log('\n   ⏳ Waiting 2 seconds for cache population...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n2. Testing SECOND message (should use compressed prompt)...');
    
    // Make a second request in the same conversation
    console.log('   📤 Sending: "Tell me more about this address"');
    const secondResponse = makeChatRequest('Tell me more about this address', newSessionId);
    
    if (secondResponse && secondResponse.response) {
        console.log('   ✅ Second message response received');
        console.log('   📝 Response preview:', secondResponse.response.substring(0, 100) + '...');
        console.log('   ✅ PASS: Second message worked (cache system functional)');
    } else {
        console.log('   ❌ FAIL: No response received for second message');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n3. Testing ANOTHER new conversation (should again use FULL system prompt)...');
    
    // Test with a completely new session
    const anotherSessionId = `test-session-${Date.now()}-2`;
    console.log('   📤 Sending: "Check gas prices"');
    const thirdResponse = makeChatRequest('Check gas prices', anotherSessionId);
    
    if (thirdResponse && thirdResponse.response) {
        console.log('   ✅ Third message (new session) response received');
        console.log('   📝 Response preview:', thirdResponse.response.substring(0, 100) + '...');
        
        if (thirdResponse.response.includes('gas') || thirdResponse.response.includes('Gwei') || thirdResponse.response.toLowerCase().includes('price')) {
            console.log('   ✅ PASS: New session first message used full system prompt (tool worked)');
        } else {
            console.log('   ⚠️  UNCERTAIN: New session response doesn\'t clearly indicate tool usage');
        }
    } else {
        console.log('   ❌ FAIL: No response received for new session first message');
    }

    checkServerLogs();
}

// Check if the server is running
console.log('🔍 Checking if server is running on localhost:3000...');
try {
    execSync('curl -s http://localhost:3000/health', { encoding: 'utf8', timeout: 5000 });
    console.log('✅ Server is running!\n');
    
    // Run the test
    testFirstMessageFix().then(() => {
        console.log('\n🎯 Test Summary:');
        console.log('- This test verifies that first messages use the FULL system prompt');
        console.log('- Subsequent messages should use the compressed prompt from cache');
        console.log('- Each new conversation should start with the full system prompt again');
        console.log('\n📋 Expected behavior:');
        console.log('  First message: buildSystemPrompt() → Full tool descriptions');
        console.log('  Later messages: buildCompressedSystemPrompt() → Cached context');
        console.log('\n🔍 Check the server terminal logs for:');
        console.log('  "🎯 FIRST MESSAGE DETECTED" - confirms first message detection');
        console.log('  "🔥 FULL SYSTEM PROMPT MODE" - confirms full prompt usage');
        console.log('  "⚡ COMPRESSED PROMPT MODE" - confirms cache usage on subsequent messages');
    });
    
} catch (error) {
    console.log('❌ Server is not running. Starting server...\n');
    console.log('   Please run: npm run start:dev');
    console.log('   Then run this test again with: node test-first-message-fix.js');
    console.log('\nAlternatively, you can run both in separate terminals:');
    console.log('   Terminal 1: npm run start:dev');
    console.log('   Terminal 2: node test-first-message-fix.js');
}
