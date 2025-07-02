const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(responseData)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testKVCache() {
  console.log('🚀 Testing KV Cache Implementation\n');

  try {
    // 1. Check cache health
    console.log('1. 🔍 Checking cache health...');
    const healthResponse = await makeRequest('/api/cache/health');
    console.log('Cache health:', JSON.stringify(healthResponse.data, null, 2));
    console.log('');

    // 2. Test conversation without cache (first message)
    console.log('2. 📤 Sending first message (no cache)...');
    const firstMessage = {
      message: "What's the current gas price?",
      personalityId: "alice"
    };
    
    const startTime1 = Date.now();
    const response1 = await makeRequest('/api/chat', 'POST', firstMessage);
    const duration1 = Date.now() - startTime1;
    
    console.log(`Response time: ${duration1}ms`);
    console.log('Session ID:', response1.data.sessionId);
    console.log('Tools used:', response1.data.toolsUsed?.map(t => t.name) || []);
    console.log('');

    // Get session ID for subsequent requests
    const sessionId = response1.data.sessionId;

    // 3. Check cache stats after first message
    console.log('3. 📊 Cache stats after first message...');
    const statsResponse1 = await makeRequest('/api/cache/stats');
    console.log('Cache stats:', JSON.stringify(statsResponse1.data, null, 2));
    console.log('');

    // 4. Test conversation with cache (second message)
    console.log('4. 📤 Sending second message (with cache)...');
    const secondMessage = {
      message: "Is this good for a transaction?",
      personalityId: "alice",
      sessionId: sessionId
    };
    
    const startTime2 = Date.now();
    const response2 = await makeRequest('/api/chat', 'POST', secondMessage);
    const duration2 = Date.now() - startTime2;
    
    console.log(`Response time: ${duration2}ms (vs ${duration1}ms first message)`);
    console.log('Speed improvement:', Math.round(((duration1 - duration2) / duration1) * 100) + '%');
    console.log('Tools used:', response2.data.toolsUsed?.map(t => t.name) || []);
    console.log('');

    // 5. Test third message (further cache optimization)
    console.log('5. 📤 Sending third message (optimized cache)...');
    const thirdMessage = {
      message: "Check balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890",
      personalityId: "alice", 
      sessionId: sessionId
    };
    
    const startTime3 = Date.now();
    const response3 = await makeRequest('/api/chat', 'POST', thirdMessage);
    const duration3 = Date.now() - startTime3;
    
    console.log(`Response time: ${duration3}ms`);
    console.log('Tools used:', response3.data.toolsUsed?.map(t => t.name) || []);
    console.log('');

    // 6. Check conversation cache details
    console.log('6. 🔍 Checking conversation cache...');
    const cacheResponse = await makeRequest(`/api/cache/conversation/${sessionId}`);
    console.log('Conversation cache summary:');
    if (cacheResponse.data.cache) {
      const cache = cacheResponse.data.cache;
      console.log(`- Intent: ${cache.currentIntent}`);
      console.log(`- Turn count: ${cache.turnCount}`);
      console.log(`- Active addresses: ${cache.activeAddresses?.length || 0}`);
      console.log(`- Tools used: ${cache.lastToolsUsed?.length || 0}`);
      console.log(`- Token optimization: ${cache.tokenOptimization?.estimatedTokens || 'N/A'} estimated tokens`);
    }
    console.log('');

    // 7. Final cache stats
    console.log('7. 📊 Final cache stats...');
    const finalStats = await makeRequest('/api/cache/stats');
    console.log('Final cache stats:', JSON.stringify(finalStats.data, null, 2));
    console.log('');

    // 8. Performance summary
    console.log('📈 PERFORMANCE SUMMARY:');
    console.log(`First message (no cache): ${duration1}ms`);
    console.log(`Second message (cached): ${duration2}ms`);
    console.log(`Third message (optimized): ${duration3}ms`);
    console.log(`Average cached response: ${Math.round((duration2 + duration3) / 2)}ms`);
    console.log(`Speed improvement: ${Math.round(((duration1 - duration2) / duration1) * 100)}%`);
    console.log('');

    console.log('✅ KV Cache test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testKVCache();
