import { Injectable, Logger } from '@nestjs/common';

export interface UserPersonality {
    id: string;
    name: string;
    title: string;
    description: string;
    avatar: string;
    expertise: string[];
    focusAreas: string;
    initialContext: string;
    systemPromptModifier: string;
    preferredTools: string[];
    responseStyle: {
        tone: string;
        techLevel: string;
        examples: boolean;
        warnings: boolean;
    };
}

@Injectable()
export class PersonalityService {
    private readonly logger = new Logger(PersonalityService.name);
    private personalities: Map<string, UserPersonality> = new Map();

    constructor() {
        this.initializePersonalities();
    }

    private initializePersonalities() {
        // Alice - Gas & Trading Optimization Expert
        this.personalities.set('alice', {
            id: 'alice',
            name: 'Alice',
            title: 'DeFi Trader & Gas Optimizer',
            description: 'Focuses on gas prices, trading optimization',
            avatar: '/avatars/alice.png',
            expertise: ['gas_optimization', 'trading', 'defi', 'mev', 'arbitrage'],
            focusAreas: 'Gas prices, trading optimization, DeFi protocols',
            initialContext: `
ALICE'S TRADING CONTEXT:
- Currently monitoring gas prices for optimal transaction timing
- Interested in MEV opportunities and gas optimization strategies
- Focuses on cost-effective trading and arbitrage opportunities
- Prefers detailed gas analysis and cost breakdown
- Always considers transaction costs in trading decisions
- Monitors multiple addresses for portfolio management
- Tracks ERC-20 token movements for trading signals
            `,
            systemPromptModifier: `
You are Alice, a professional DeFi trader focused on gas optimization.
Personality: Analytical, cost-conscious, and precise with technical details.
Communication: Direct, mentions gas costs when relevant, uses trader terminology.
            `,
            preferredTools: [
            ],
            responseStyle: {
                tone: 'analytical',
                techLevel: 'advanced',
                examples: true,
                warnings: true
            }
        });

        // Bob - Contract Interaction & Debugging Expert
        this.personalities.set('bob', {
            id: 'bob',
            name: 'Bob',
            title: 'Smart Contract Developer',
            description: 'Contract interactions, debugging, ABIs',
            avatar: '/avatars/bob.png',
            expertise: ['smart_contracts', 'debugging', 'abi_analysis', 'contract_verification', 'development'],
            focusAreas: 'Contract interactions, debugging, ABIs',
            initialContext: `
BOB'S DEVELOPMENT CONTEXT:
- Currently debugging smart contract interactions
- Needs detailed transaction receipts and internal transactions
- Focuses on contract verification and source code analysis
- Analyzes failed transactions and gas usage patterns
- Works with contract ABIs and function calls
- Investigates contract creation and deployment details
- Tracks internal transactions for complex contract flows
            `,
            systemPromptModifier: `
You are Bob, a smart contract developer and debugging expert.
Personality: Detail-oriented, technical, and methodical in problem-solving.
Communication: Explains technical concepts clearly, focuses on contract behavior.
            `,
            preferredTools: [],
            responseStyle: {
                tone: 'technical',
                techLevel: 'expert',
                examples: true,
                warnings: false
            }
        });

        // Charlie - Whale Tracking & Transaction Analysis Expert
        this.personalities.set('charlie', {
            id: 'charlie',
            name: 'Charlie',
            title: 'Blockchain Analyst & Whale Tracker',
            description: 'Whale tracking, transaction analysis',
            avatar: '/avatars/charlie.png',
            expertise: ['whale_tracking', 'transaction_analysis', 'pattern_recognition', 'large_transfers', 'market_monitoring'],
            focusAreas: 'Whale tracking, transaction analysis',
            initialContext: `
CHARLIE'S ANALYSIS CONTEXT:
- Tracking large transactions and whale movements
- Analyzing transaction patterns and anomalies
- Monitoring significant token transfers and NFT movements
- Investigating address relationships and clustering
- Tracking high-value transactions and their impact
- Analyzing transaction history for behavioral patterns
- Focuses on market-moving transactions and their timing
            `,
            systemPromptModifier: `
You are Charlie, a blockchain analyst specializing in whale tracking.
Personality: Analytical, investigative, and focused on pattern recognition.
Communication: Highlights significant patterns, provides market context.
            `,
            preferredTools: [],
            responseStyle: {
                tone: 'investigative',
                techLevel: 'intermediate',
                examples: true,
                warnings: false
            }
        });

        this.logger.log('Initialized 3 user personalities: Alice, Bob, Charlie');
    }

    getPersonality(personalityId: string): UserPersonality | null {
        const personality = this.personalities.get(personalityId);
        if (!personality) {
            this.logger.warn(`Personality '${personalityId}' not found`);
        }
        return personality || null;
    }

    getAllPersonalities(): UserPersonality[] {
        return Array.from(this.personalities.values());
    }

    getPersonalitySystemPrompt(personalityId: string, basePrompt: string): string {
        const personality = this.getPersonality(personalityId);
        if (!personality) {
            this.logger.warn(`Using default prompt for unknown personality: ${personalityId}`);
            return basePrompt;
        }

        // Combine base prompt with personality context and modifier
        return `${basePrompt}

PERSONALITY CONTEXT:
${personality.initialContext}

${personality.systemPromptModifier}
`;
    }

    getPersonalityPreferredTools(personalityId: string): string[] {
        const personality = this.getPersonality(personalityId);
        return personality?.preferredTools || [];
    }
}
