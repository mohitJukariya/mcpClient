import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatResponse {
  response: string;
  sessionId: string;
  toolsUsed?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
}

async function testEmbeddingsIntegration() {
  console.log('🧪 Testing Embeddings Integration');
  console.log('='.repeat(50));
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log('='.repeat(50));

  const sessionId = `test-session-${Date.now()}`;

  try {
    // Test 1: First message (no context should be found)
    console.log('\n1️⃣ Testing first message (no context expected)');
    console.log('-'.repeat(40));

    const firstMessage: ChatRequest = {
      message: "What is the current ETH balance of address 0x722E8BdD2ce80A4422E880164f2079488e115365?",
      sessionId
    };

    const firstResponse = await axios.post<ChatResponse>(`${BASE_URL}/api/chat`, firstMessage, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('✅ First response received');
    console.log(`📝 Response: ${firstResponse.data.response.substring(0, 200)}...`);
    console.log(`🔧 Tools used: ${firstResponse.data.toolsUsed?.length || 0}`);

    // Wait a moment for embeddings to be stored
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Related message (should find context from first message)
    console.log('\n2️⃣ Testing related message (context expected)');
    console.log('-'.repeat(40));

    const secondMessage: ChatRequest = {
      message: "Can you also check the token balance for that same address?",
      sessionId
    };

    const secondResponse = await axios.post<ChatResponse>(`${BASE_URL}/api/chat`, secondMessage, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('✅ Second response received');
    console.log(`📝 Response: ${secondResponse.data.response.substring(0, 200)}...`);
    console.log(`🔧 Tools used: ${secondResponse.data.toolsUsed?.length || 0}`);

    // Test 3: Check embeddings endpoints
    console.log('\n3️⃣ Testing embeddings endpoints');
    console.log('-'.repeat(40));

    // Test embeddings health
    const healthResponse = await axios.get(`${BASE_URL}/api/embeddings/health`);
    console.log(`✅ Embeddings health: ${JSON.stringify(healthResponse.data)}`);

    // Test session history
    const historyResponse = await axios.get(`${BASE_URL}/api/embeddings/history/${sessionId}`);
    console.log(`✅ Session history: ${historyResponse.data.length} messages`);

    // Test search similar
    const searchRequest = {
      query: "ETH balance check",
      topK: 3
    };

    const searchResponse = await axios.post(`${BASE_URL}/api/embeddings/search`, searchRequest, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Similar messages found: ${searchResponse.data.length}`);

    // Test index stats
    const statsResponse = await axios.get(`${BASE_URL}/api/embeddings/stats`);
    console.log(`✅ Index stats: ${JSON.stringify(statsResponse.data, null, 2)}`);

    console.log('\n🎉 All embeddings integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Embeddings Integration Test');
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log('\n');

  const success = await testEmbeddingsIntegration();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}
