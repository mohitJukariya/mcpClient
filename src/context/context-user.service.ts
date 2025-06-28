import { Injectable, Logger } from '@nestjs/common';

export interface TestUser {
  id: string;
  name: string;
  role: 'trader' | 'developer' | 'analyst';
  preferences: {
    defaultTokens: string[];
    favoriteAddresses: string[];
    alertThresholds: {
      gasPrice: number;
      balanceChange: number;
    };
  };
  contextHistory: UserContextEntry[];
}

export interface UserContextEntry {
  id: string;
  userId: string;
  type: 'query' | 'insight' | 'preference' | 'error';
  content: string;
  metadata: {
    timestamp: string;
    toolsUsed: string[];
    confidence: number;
    relatedEntries: string[];
  };
}

@Injectable()
export class ContextUserService {
  private readonly logger = new Logger(ContextUserService.name);

  async initializeTestUsers(): Promise<TestUser[]> {
    const testUsers: TestUser[] = [
      {
        id: 'user-001',
        name: 'Alice (Trader)',
        role: 'trader',
        preferences: {
          defaultTokens: ['ETH', 'USDC', 'ARB'],
          favoriteAddresses: [
            '0x722E8BdD2ce80A4422E880164f2079488e115365', // Arbitrum multisig
            '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'  // USDC
          ],
          alertThresholds: {
            gasPrice: 0.1, // Alert if gas > 0.1 Gwei
            balanceChange: 1000 // Alert if balance changes > 1000 USD
          }
        },
        contextHistory: [
          {
            id: 'ctx-001-001',
            userId: 'user-001',
            type: 'query',
            content: 'Frequently checks gas prices for optimal trading times',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getGasPrice'],
              confidence: 0.9,
              relatedEntries: []
            }
          },
          {
            id: 'ctx-001-002',
            userId: 'user-001',
            type: 'preference',
            content: 'Prefers low gas times for large transactions',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: [],
              confidence: 0.95,
              relatedEntries: ['ctx-001-001']
            }
          },
          {
            id: 'ctx-001-003',
            userId: 'user-001',
            type: 'insight',
            content: 'Usually trades between 2-6 AM UTC when gas is lowest',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getGasPrice'],
              confidence: 0.8,
              relatedEntries: ['ctx-001-001', 'ctx-001-002']
            }
          }
        ]
      },
      {
        id: 'user-002',
        name: 'Bob (Developer)',
        role: 'developer',
        preferences: {
          defaultTokens: ['ETH', 'ARB'],
          favoriteAddresses: [
            '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token
            '0xA0b86a33E6417c6A4e2b8D1B3B4D7e1E8C9b5c8d'  // Sample contract
          ],
          alertThresholds: {
            gasPrice: 0.05,
            balanceChange: 500
          }
        },
        contextHistory: [
          {
            id: 'ctx-002-001',
            userId: 'user-002',
            type: 'query',
            content: 'Regularly queries contract ABIs and transaction details for debugging',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getContractAbi', 'getTransaction'],
              confidence: 0.95,
              relatedEntries: []
            }
          },
          {
            id: 'ctx-002-002',
            userId: 'user-002',
            type: 'preference',
            content: 'Focuses on smart contract interactions and gas optimization',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: [],
              confidence: 0.9,
              relatedEntries: ['ctx-002-001']
            }
          },
          {
            id: 'ctx-002-003',
            userId: 'user-002',
            type: 'insight',
            content: 'Often needs block-level data for contract deployment analysis',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getBlock', 'getLatestBlock'],
              confidence: 0.85,
              relatedEntries: ['ctx-002-001']
            }
          }
        ]
      },
      {
        id: 'user-003',
        name: 'Charlie (Analyst)',
        role: 'analyst',
        preferences: {
          defaultTokens: ['ETH', 'USDC', 'USDT', 'ARB'],
          favoriteAddresses: [
            '0x489ee077994B6658eAfA855C308275EAd8097C4A', // Large holder
            '0x40aa958dd87fc8305b97f2ba922cddca374bcd7f'  // Another whale
          ],
          alertThresholds: {
            gasPrice: 0.2,
            balanceChange: 10000
          }
        },
        contextHistory: [
          {
            id: 'ctx-003-001',
            userId: 'user-003',
            type: 'query',
            content: 'Analyzes large wallet movements and transaction patterns',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getBalance', 'getTransactionHistory', 'getTokenBalance'],
              confidence: 0.92,
              relatedEntries: []
            }
          },
          {
            id: 'ctx-003-002',
            userId: 'user-003',
            type: 'preference',
            content: 'Interested in whale wallet analysis and market movements',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: [],
              confidence: 0.88,
              relatedEntries: ['ctx-003-001']
            }
          },
          {
            id: 'ctx-003-003',
            userId: 'user-003',
            type: 'insight',
            content: 'Tracks correlation between large transactions and price movements',
            metadata: {
              timestamp: new Date().toISOString(),
              toolsUsed: ['getTransactionHistory', 'getBalance'],
              confidence: 0.9,
              relatedEntries: ['ctx-003-001', 'ctx-003-002']
            }
          }
        ]
      }
    ];

    this.logger.log(`Initialized ${testUsers.length} test users`);
    return testUsers;
  }

  async getUserById(userId: string): Promise<TestUser | null> {
    const users = await this.initializeTestUsers();
    return users.find(user => user.id === userId) || null;
  }

  async getAllUsers(): Promise<TestUser[]> {
    return this.initializeTestUsers();
  }

  async addContextEntry(userId: string, entry: UserContextEntry): Promise<void> {
    // This would typically update the database
    // For now, we'll just log it
    this.logger.log(`Added context entry for user ${userId}: ${entry.id}`);
  }
}
