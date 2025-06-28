import { InferenceClient } from '@huggingface/inference';
import * as dotenv from 'dotenv';

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Popular models to test
const MODELS_TO_TEST = [
    'gpt2',
    'microsoft/DialoGPT-small',
    'facebook/blenderbot-400M-distill',
    'bigscience/bloom-560m',
    'google/flan-t5-base',
    'google/flan-t5-small',
    'EleutherAI/gpt-j-6B',
    'bigscience/bloomz-560m',
];

async function findAvailableModels() {
    console.log('🔍 Finding available Hugging Face models for your account...');
    console.log(`🔑 API Key: ${HUGGINGFACE_API_KEY ? 'Set ✅' : 'Missing ❌'}`);

    if (!HUGGINGFACE_API_KEY) {
        console.error('❌ HUGGINGFACE_API_KEY is not set');
        return;
    }

    const hf = new InferenceClient(HUGGINGFACE_API_KEY);
    const availableModels = [];

    for (const model of MODELS_TO_TEST) {
        try {
            console.log(`\n🧪 Testing model: ${model}`);

            const response = await hf.textGeneration({
                model: model,
                inputs: 'Hello, how are you?',
                parameters: {
                    max_new_tokens: 10,
                    temperature: 0.7,
                    return_full_text: false,
                },
            });

            console.log(`✅ ${model} - WORKS!`);
            console.log(`   Response: ${response.generated_text.substring(0, 50)}...`);
            availableModels.push(model);

        } catch (error: any) {
            console.log(`❌ ${model} - Failed: ${error.message.substring(0, 80)}...`);
        }
    }

    console.log('\n🎉 Summary of Available Models:');
    if (availableModels.length > 0) {
        availableModels.forEach((model, index) => {
            console.log(`   ${index + 1}. ${model} ✅`);
        });

        console.log(`\n📝 Recommended: Use "${availableModels[0]}" in your .env file`);
        console.log(`   HUGGINGFACE_MODEL=${availableModels[0]}`);
    } else {
        console.log('   No models are currently available with your API key 😞');
        console.log('   You might need to upgrade your Hugging Face account or try different models');
    }
}

findAvailableModels()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
