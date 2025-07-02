import * as dotenv from 'dotenv';
import { InferenceClient } from '@huggingface/inference';

dotenv.config();

async function diagnoseEmbeddingGeneration() {
    console.log('🔍 Diagnosing Embedding Generation Performance');
    console.log('='.repeat(60));

    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
        console.error('❌ HUGGINGFACE_API_KEY not found in environment');
        return;
    }

    console.log(`🔑 API Key: ${hfApiKey.substring(0, 8)}...${hfApiKey.substring(hfApiKey.length - 4)}`);
    console.log('');

    const hf = new InferenceClient(hfApiKey);
    const testText = "This is a test message to generate embeddings for performance testing.";

    // Test models from the current service
    const modelsToTest = [
        'sentence-transformers/multi-qa-MiniLM-L6-cos-v1',  // Primary model
        'sentence-transformers/all-MiniLM-L6-v2',          // Fallback
        'sentence-transformers/all-MiniLM-L12-v2',         // Alternative 384d
        'intfloat/e5-small-v2',                           // Alternative small model
    ];

    console.log(`📝 Test text: "${testText}"\n`);

    for (const model of modelsToTest) {
        console.log(`🧪 Testing model: ${model}`);
        console.log('-'.repeat(50));

        const startTime = Date.now();

        try {
            // Test with timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout after 60s')), 60000)
            );

            const embeddingPromise = hf.featureExtraction({
                model: model,
                inputs: testText
            });

            console.log('   ⏳ Generating embedding...');
            const response = await Promise.race([embeddingPromise, timeoutPromise]);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Process response
            let embedding: number[];
            if (Array.isArray(response)) {
                if (Array.isArray(response[0])) {
                    embedding = response[0] as number[];
                } else {
                    embedding = response as number[];
                }
            } else {
                throw new Error('Unexpected response format');
            }

            console.log(`   ✅ Success! Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
            console.log(`   📏 Embedding dimension: ${embedding.length}`);
            console.log(`   🎯 First few values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

            // Check if fast enough
            if (duration < 10000) {
                console.log(`   🚀 FAST - Under 10 seconds`);
            } else if (duration < 30000) {
                console.log(`   ⚠️  SLOW - Between 10-30 seconds`);
            } else {
                console.log(`   🐌 VERY SLOW - Over 30 seconds`);
            }

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`   ❌ Failed after ${duration}ms: ${error.message}`);
        }

        console.log('');
    }

    // Test a different approach - using OpenAI-compatible embeddings
    console.log('\n🔄 Testing alternative embedding approaches...');
    console.log('='.repeat(60));

    // Test if we can use a local model or different service
    try {
        console.log('🧪 Testing alternative HuggingFace models...');

        const alternativeModels = [
            'mixedbread-ai/mxbai-embed-large-v1',
            'BAAI/bge-small-en-v1.5',
            'nomic-ai/nomic-embed-text-v1'
        ];

        for (const model of alternativeModels) {
            console.log(`\n   Testing: ${model}`);
            const startTime = Date.now();

            try {
                const response = await Promise.race([
                    hf.featureExtraction({
                        model: model,
                        inputs: testText
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                ]);

                const duration = Date.now() - startTime;
                console.log(`   ✅ Success in ${duration}ms`);

                // Check dimensions
                let embedding: number[];
                if (Array.isArray(response)) {
                    embedding = Array.isArray(response[0]) ? response[0] : response;
                } else {
                    embedding = response as number[];
                }
                console.log(`   📏 Dimension: ${embedding.length}`);

            } catch (error) {
                const duration = Date.now() - startTime;
                console.log(`   ❌ Failed after ${duration}ms: ${error.message}`);
            }
        }

    } catch (error) {
        console.log(`❌ Alternative testing failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Diagnosis complete!');
    console.log('📋 Recommendations will be provided based on results.');
}

// Run the diagnosis
diagnoseEmbeddingGeneration().catch(console.error);
