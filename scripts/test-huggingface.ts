import { InferenceClient } from '@huggingface/inference';
import * as dotenv from 'dotenv';

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta';

async function testHuggingFace() {
    console.log('🤗 Testing Hugging Face Integration...');
    console.log(`📍 Model: ${HUGGINGFACE_MODEL}`);
    console.log(`🔑 API Key: ${HUGGINGFACE_API_KEY ? 'Set ✅' : 'Missing ❌'}`);

    if (!HUGGINGFACE_API_KEY) {
        console.error('❌ HUGGINGFACE_API_KEY is not set in .env file');
        console.log('📝 Please update your .env file with a valid Hugging Face API key');
        console.log('🔗 Get your API key from: https://huggingface.co/settings/tokens');
        return false;
    }

    try {
        const hf = new InferenceClient(HUGGINGFACE_API_KEY);

        console.log('\n1️⃣ Testing chat completion (for instruct models like Mistral)...');

        try {
            const chatResponse = await hf.chatCompletion({
                model: HUGGINGFACE_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant for blockchain analytics.'
                    },
                    {
                        role: 'user',
                        content: 'What is Arbitrum? Please give a brief explanation.'
                    }
                ],
                max_tokens: 200,
                temperature: 0.7,
            });

            console.log('✅ Chat completion successful!');
            console.log('📝 Response:', chatResponse.choices[0].message.content);
            return true;
        } catch (chatError) {
            console.log('⚠️ Chat completion failed, trying text generation...');
            console.log('Error:', chatError.message);

            // Fallback to text generation
            const testPrompt = 'What is Arbitrum? Please give a brief explanation.\n\nAnswer:';

            const response = await hf.textGeneration({
                model: HUGGINGFACE_MODEL,
                inputs: testPrompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.7,
                    do_sample: true,
                    return_full_text: false,
                    top_p: 0.9,
                },
            });

            console.log('✅ Text generation successful!');
            console.log('📝 Response:', response.generated_text);
            return true;
        }

        console.log('\n🎉 Hugging Face integration is working!');
        return true;

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('📄 Response data:', error.response.data);
        }
        return false;
    }
}

// Run the test
testHuggingFace()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
