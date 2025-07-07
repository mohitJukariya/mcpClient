/**
 * Comprehensive Memory and Storage Diagnostic Script
 * Tests both Neo4j and Pinecone issues
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContextStorageService } from '../src/context/context-storage.service';
import { EmbeddingsService } from '../src/embeddings/embeddings.service';
import { ContextController } from '../src/context/context.controller';
import { Logger } from '@nestjs/common';
import axios from 'axios';

const logger = new Logger('MemoryDiagnostic');

async function runComprehensiveDiagnostic() {
    console.log('🔍 Starting Comprehensive Memory & Storage Diagnostic...\n');

    try {
        // Initialize the NestJS application
        const app = await NestFactory.createApplicationContext(AppModule);
        const contextStorage = app.get(ContextStorageService);
        const embeddingsService = app.get(EmbeddingsService);
        const contextController = app.get(ContextController);

        // Wait for services to initialize
        console.log('⏳ Waiting for services to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 1: Check Pinecone Connection
        console.log('📝 Test 1: Checking Pinecone Connection...');
        try {
            const healthResult = await embeddingsService.checkEmbeddingModelsHealth();
            console.log('✅ Pinecone Health:', healthResult);
        } catch (error) {
            console.log('❌ Pinecone Health Failed:', error.message);
        }

        // Test 2: Test Embedding Generation and Storage
        console.log('\n📝 Test 2: Testing Embedding Generation and Storage...');
        const testContent = 'Test message about Arbitrum balance checking';
        try {
            const embeddingResult = await embeddingsService.generateEmbedding(testContent);
            console.log('✅ Embedding Generated:', {
                dimensions: embeddingResult?.length || 0,
                firstValues: embeddingResult?.slice(0, 3) || []
            });

            // Store embedding
            const vectorId = await embeddingsService.storeMessageEmbedding(
                'test-session-diagnostic',
                'user',
                testContent,
                0,
                ['test']
            );
            console.log('✅ Embedding Stored with ID:', vectorId);

        } catch (error) {
            console.log('❌ Embedding Test Failed:', error.message);
        }

        // Test 3: Test Embedding Search (Memory Retrieval)
        console.log('\n📝 Test 3: Testing Embedding Search (Memory Retrieval)...');
        try {
            const searchResults = await embeddingsService.searchSimilarMessages(
                'balance check Arbitrum',
                'test-session-diagnostic',
                3,
                0.7
            );
            console.log('✅ Search Results:', {
                count: searchResults?.length || 0,
                results: searchResults?.map(r => ({
                    score: r.score,
                    content: r.content?.substring(0, 50) + '...'
                })) || []
            });
        } catch (error) {
            console.log('❌ Embedding Search Failed:', error.message);
        }

        // Test 4: Test Context Storage with Proper Tool Data
        console.log('\n📝 Test 4: Testing Context Storage with Proper Tool Data...');

        const validContextData = {
            query: 'Check balance for address',
            toolsUsed: ['getBalance'], // Simple string array
            addressesInvolved: ['0x1234567890123456789012345678901234567890'],
            insights: [],
            metadata: {
                sessionId: 'diagnostic-session',
                timestamp: new Date().toISOString(),
                confidence: 0.8,
                personality: 'alice'
            }
        };

        try {
            const contextResult = await contextController.addUserContext('diagnostic-user', validContextData);
            console.log('✅ Valid Context Storage:', contextResult);
        } catch (error) {
            console.log('❌ Valid Context Storage Failed:', error.message);
        }

        // Test 5: Test Context Storage with Invalid Tool Data (What might be causing the error)
        console.log('\n📝 Test 5: Testing Context Storage with Invalid Tool Data...');

        const invalidContextData = {
            query: 'Check balance with complex tool data',
            toolsUsed: [
                // This simulates what might be causing the error
                {
                    name: 'getBalance',
                    arguments: { address: 'addr4' },
                    result: {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                address: 'addr4',
                                balance: {
                                    wei: 'Error! Invalid address format',
                                    eth: 'NaN',
                                    ethFullPrecision: 'NaN',
                                    formatted: 'NaN ETH'
                                },
                                network: 'Arbitrum',
                                status: '0',
                                message: 'NOTOK'
                            })
                        }]
                    }
                }
            ] as any,
            addressesInvolved: [],
            insights: [],
            metadata: {
                sessionId: 'diagnostic-session-invalid',
                timestamp: new Date().toISOString(),
                confidence: 0.8
            }
        };

        try {
            const invalidResult = await contextController.addUserContext('diagnostic-user', invalidContextData);
            console.log('⚠️  Invalid Context Storage (should fail):', invalidResult);
        } catch (error) {
            console.log('✅ Invalid Context Storage Failed as Expected:', error.message);
        }

        // Test 6: Check Neo4j Data After Storage
        console.log('\n📝 Test 6: Checking Neo4j Data After Storage...');
        try {
            // Clear first to get a clean state
            const clearResult = await contextStorage.clearDatabase();
            console.log('Database cleared:', clearResult.success);

            // Store simple valid context
            await contextController.addUserContext('test-user', {
                query: 'simple test query',
                toolsUsed: ['getBalance'],
                addressesInvolved: [],
                insights: [],
                metadata: {
                    sessionId: 'test-session',
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Simple context stored successfully');
        } catch (error) {
            console.log('❌ Neo4j Storage Test Failed:', error.message);
        }

        console.log('\n🎉 Diagnostic Complete!');
        await app.close();

    } catch (error) {
        console.error('\n❌ Diagnostic Failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the diagnostic
runComprehensiveDiagnostic().catch(console.error);
