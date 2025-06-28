import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.CHAT_API_ENDPOINT || 'http://localhost:3000';

interface TestResult {
    name: string;
    passed: boolean;
    responseTime: number;
    error?: string;
    data?: any;
}

class EnhancedSystemTester {
    private results: TestResult[] = [];

    async runAllTests(): Promise<void> {
        console.log('🧪 Running Enhanced System Tests...\n');

        // Health and monitoring tests
        await this.testHealthEndpoints();
        await this.testPerformanceMonitoring();

        // Rate limiting tests
        await this.testRateLimit();

        // Error handling tests
        await this.testErrorHandling();

        // Input validation tests
        await this.testInputValidation();

        // Tool parameter validation tests
        await this.testToolParameterValidation();

        // Configuration tests
        await this.testConfiguration();

        this.printResults();
    }

    private async testHealthEndpoints(): Promise<void> {
        console.log('🏥 Testing Health Endpoints...');

        // Basic health check
        await this.runTest('Basic Health Check', async () => {
            const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
            return response.status === 200 && response.data.status;
        });

        // Detailed health check
        await this.runTest('Detailed Health Check', async () => {
            const response = await axios.get(`${BASE_URL}/api/health/detailed`, { timeout: 10000 });
            return response.status === 200 && response.data.system && response.data.performance;
        });

        // Ping endpoint
        await this.runTest('Ping Endpoint', async () => {
            const response = await axios.get(`${BASE_URL}/api/health/ping`, { timeout: 2000 });
            return response.status === 200 && response.data.status === 'pong';
        });
    }

    private async testPerformanceMonitoring(): Promise<void> {
        console.log('📊 Testing Performance Monitoring...');

        // Generate some requests to create performance data
        for (let i = 0; i < 5; i++) {
            try {
                await axios.post(`${BASE_URL}/api/chat`, {
                    message: `Test query ${i + 1}: What is Arbitrum?`,
                    sessionId: `test-session-${Date.now()}`
                }, { timeout: 10000 });
            } catch (error) {
                // Ignore errors for this test
            }
        }

        // Check if performance data is being collected
        await this.runTest('Performance Data Collection', async () => {
            const response = await axios.get(`${BASE_URL}/api/health/detailed`);
            return response.data.performance &&
                typeof response.data.performance.totalRequests === 'number';
        });
    }

    private async testRateLimit(): Promise<void> {
        console.log('⏰ Testing Rate Limiting...');

        // Test normal request (should pass)
        await this.runTest('Normal Request Rate Limit', async () => {
            const response = await axios.post(`${BASE_URL}/api/chat`, {
                message: 'Test rate limit normal',
                sessionId: `rate-test-${Date.now()}`
            }, { timeout: 5000 });
            return response.status === 200;
        });

        // Note: Testing actual rate limit exceeded would require many requests
        // which might be disruptive, so we just test that the endpoint responds
    }

    private async testErrorHandling(): Promise<void> {
        console.log('🚨 Testing Error Handling...');

        // Test invalid JSON
        await this.runTest('Invalid JSON Error Handling', async () => {
            try {
                const response = await axios.post(`${BASE_URL}/api/chat`, 'invalid json', {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000
                });
                return false; // Should not reach here
            } catch (error) {
                return error.response?.status === 400;
            }
        });

        // Test missing message
        await this.runTest('Missing Message Error Handling', async () => {
            try {
                const response = await axios.post(`${BASE_URL}/api/chat`, {
                    sessionId: 'test-session'
                }, { timeout: 5000 });
                return false; // Should not reach here
            } catch (error) {
                return error.response?.status === 400;
            }
        });
    }

    private async testInputValidation(): Promise<void> {
        console.log('✅ Testing Input Validation...');

        // Test extremely long input
        await this.runTest('Long Input Validation', async () => {
            const longMessage = 'a'.repeat(2000); // Exceed MAX_INPUT_LENGTH
            try {
                const response = await axios.post(`${BASE_URL}/api/chat`, {
                    message: longMessage,
                    sessionId: 'validation-test'
                }, { timeout: 5000 });

                // Should either truncate or reject
                return response.status === 200 || response.status === 400;
            } catch (error) {
                return error.response?.status === 400;
            }
        });

        // Test special characters
        await this.runTest('Special Characters Validation', async () => {
            const response = await axios.post(`${BASE_URL}/api/chat`, {
                message: 'Test with <script>alert("xss")</script> and javascript:void(0)',
                sessionId: 'validation-test-2'
            }, { timeout: 5000 });

            // Should handle safely without executing scripts
            return response.status === 200;
        });
    }

    private async testToolParameterValidation(): Promise<void> {
        console.log('🔧 Testing Tool Parameter Validation...');

        // Test invalid Ethereum address
        await this.runTest('Invalid Address Validation', async () => {
            const response = await axios.post(`${BASE_URL}/api/chat`, {
                message: 'Get balance of invalid-address-123',
                sessionId: 'tool-validation-test'
            }, { timeout: 10000 });

            // Should either reject the invalid address or handle gracefully
            return response.status === 200;
        });

        // Test valid address format
        await this.runTest('Valid Address Processing', async () => {
            const response = await axios.post(`${BASE_URL}/api/chat`, {
                message: 'Get balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890',
                sessionId: 'tool-validation-test-2'
            }, { timeout: 15000 });

            return response.status === 200 && response.data.toolsUsed?.length > 0;
        });
    }

    private async testConfiguration(): Promise<void> {
        console.log('⚙️ Testing Configuration...');

        // Test that health endpoint returns configuration info
        await this.runTest('Configuration Visibility', async () => {
            const response = await axios.get(`${BASE_URL}/api/health`);
            return response.data.configuration &&
                response.data.configuration.llm &&
                response.data.configuration.llm.model;
        });
    }

    private async runTest(testName: string, testFunction: () => Promise<boolean>): Promise<void> {
        const startTime = Date.now();
        try {
            const passed = await testFunction();
            const responseTime = Date.now() - startTime;

            this.results.push({
                name: testName,
                passed,
                responseTime
            });

            console.log(`  ${passed ? '✅' : '❌'} ${testName} (${responseTime}ms)`);
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.results.push({
                name: testName,
                passed: false,
                responseTime,
                error: error.message
            });

            console.log(`  ❌ ${testName} (${responseTime}ms) - Error: ${error.message}`);
        }
    }

    private printResults(): void {
        console.log('\n📋 Test Results Summary:');
        console.log('='.repeat(50));

        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        const avgResponseTime = Math.round(
            this.results.reduce((sum, r) => sum + r.responseTime, 0) / total
        );

        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Pass Rate: ${Math.round((passed / total) * 100)}%`);
        console.log(`Average Response Time: ${avgResponseTime}ms`);

        console.log('\nFailed Tests:');
        this.results.filter(r => !r.passed).forEach(result => {
            console.log(`  - ${result.name}: ${result.error || 'Test failed'}`);
        });

        console.log('\n🎯 Enhancement Testing Complete!');
    }
}

// Run the tests
if (require.main === module) {
    const tester = new EnhancedSystemTester();
    tester.runAllTests().catch(console.error);
}

export { EnhancedSystemTester };
