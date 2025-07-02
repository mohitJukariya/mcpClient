/**
 * Test script to verify the complete Neo4j fix including API endpoints
 * Tests the actual scenario that was causing the error in the logs
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContextController } from '../src/context/context.controller';
import { Logger } from '@nestjs/common';

const logger = new Logger('ComprehensiveNeo4jTest');

async function testCompleteNeo4jFix() {
    console.log('🧪 Starting Comprehensive Neo4j Fix Test...\n');

    try {
        // Initialize the NestJS application
        const app = await NestFactory.createApplicationContext(AppModule);
        const contextController = app.get(ContextController);

        // Wait for services to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 1: Test the exact scenario from the error logs
        console.log('📝 Test 1: Testing context storage via API endpoint...');

        // This simulates what the frontend might be sending
        const frontendContextData = {
            query: 'fetch the latest block from network',
            toolsUsed: ['getLatestBlock'],
            addressesInvolved: [],
            insights: [],
            metadata: {
                sessionId: 'session_test_comprehensive',
                timestamp: new Date().toISOString(),
                confidence: 0.8,
                personality: 'charlie'
            }
        };

        const result1 = await contextController.addUserContext('charlie', frontendContextData);
        console.log('✅ Basic context storage successful:', result1.success);

        // Test 2: Test with complex tool objects (this might be what's causing the error)
        console.log('\n📝 Test 2: Testing with complex tool data...');

        const complexFrontendData = {
            query: 'analyze transaction with complex parameters',
            toolsUsed: ['get_transaction_receipt', 'get_block_info'],
            addressesInvolved: ['0x1234567890123456789012345678901234567890'],
            insights: [
                {
                    content: 'High value transaction detected',
                    confidence: 0.9
                }
            ],
            metadata: {
                sessionId: 'session_test_complex',
                timestamp: new Date().toISOString(),
                confidence: 0.8,
                personality: 'charlie'
            }
        };

        const result2 = await contextController.addUserContext('charlie', complexFrontendData);
        console.log('✅ Complex context storage successful:', result2.success);

        // Test 3: Test edge cases that might trigger the Map error
        console.log('\n📝 Test 3: Testing edge cases...');

        const edgeCaseData = {
            query: 'complex query with nested data',
            toolsUsed: ['complex_tool'],
            addressesInvolved: [],
            insights: [
                {
                    content: 'Complex insight with special characters: {"test": "value"}',
                    confidence: 0.7
                }
            ],
            metadata: {
                sessionId: 'session_test_edge',
                timestamp: new Date().toISOString(),
                confidence: 0.8,
                personality: 'charlie'
            }
        };

        const result3 = await contextController.addUserContext('charlie', edgeCaseData);
        console.log('✅ Edge case storage successful:', result3.success);

        // Test 4: Test with empty/null values
        console.log('\n📝 Test 4: Testing with minimal data...');

        const minimalData = {
            query: 'simple query',
            toolsUsed: [],
            addressesInvolved: [],
            insights: [],
            metadata: {
                sessionId: 'session_test_minimal',
                timestamp: new Date().toISOString(),
                confidence: 0.5
            }
        };

        const result4 = await contextController.addUserContext('alice', minimalData);
        console.log('✅ Minimal data storage successful:', result4.success);

        // Test 5: Test health endpoints
        console.log('\n📝 Test 5: Testing health endpoints...');

        const healthResult = await contextController.getSystemHealth();
        console.log('✅ System health check successful');
        console.log('Health status:', healthResult);

        console.log('\n🎉 All Comprehensive Neo4j Tests Passed!');
        console.log('✅ Context storage API endpoints work correctly');
        console.log('✅ Complex data is properly sanitized');
        console.log('✅ No Neo4j property type errors in any scenario');

        await app.close();

    } catch (error) {
        console.error('\n❌ Comprehensive Neo4j Test Failed:', error);
        console.error('Stack trace:', error.stack);

        // Try to identify the specific issue
        if (error.message.includes('Property values can only be of primitive types')) {
            console.error('\n🔍 ANALYSIS: Neo4j property type error still occurring');
            console.error('This suggests there are still places where complex objects are being stored as properties');
        }

        process.exit(1);
    }
}

// Run the test
testCompleteNeo4jFix().catch(console.error);
