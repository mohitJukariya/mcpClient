import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InputValidator {
    private readonly logger = new Logger(InputValidator.name);

    // Ethereum address validation
    validateEthereumAddress(address: string): boolean {
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        return ethAddressRegex.test(address);
    }

    // Transaction hash validation
    validateTransactionHash(hash: string): boolean {
        const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
        return txHashRegex.test(hash);
    }

    // Block number validation
    validateBlockNumber(blockNumber: string | number): boolean {
        if (typeof blockNumber === 'string') {
            return /^\d+$/.test(blockNumber) || blockNumber === 'latest' || blockNumber === 'pending';
        }
        return Number.isInteger(blockNumber) && blockNumber >= 0;
    }

    // Sanitize user input to prevent injection attacks
    sanitizeInput(input: string): string {
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim()
            .substring(0, 1000); // Limit length
    }

    // Validate tool parameters before calling
    validateToolParameters(toolName: string, params: any): { valid: boolean; error?: string } {
        try {
            switch (toolName) {
                case 'getBalance':
                case 'getTransactionHistory':
                case 'validateAddress':
                case 'getContractAbi':
                    if (!params.address || !this.validateEthereumAddress(params.address)) {
                        return { valid: false, error: 'Invalid Ethereum address format' };
                    }
                    break;

                case 'getTokenBalance':
                    if (!params.address || !this.validateEthereumAddress(params.address)) {
                        return { valid: false, error: 'Invalid address format' };
                    }
                    if (!params.contractAddress || !this.validateEthereumAddress(params.contractAddress)) {
                        return { valid: false, error: 'Invalid contract address format' };
                    }
                    break;

                case 'getTransaction':
                case 'getTransactionReceipt':
                    if (!params.txHash || !this.validateTransactionHash(params.txHash)) {
                        return { valid: false, error: 'Invalid transaction hash format' };
                    }
                    break;

                case 'getBlock':
                    if (params.blockNumber && !this.validateBlockNumber(params.blockNumber)) {
                        return { valid: false, error: 'Invalid block number format' };
                    }
                    break;

                case 'getLatestBlock':
                case 'getGasPrice':
                case 'getEthSupply':
                    // No parameters needed
                    break;

                default:
                    return { valid: false, error: `Unknown tool: ${toolName}` };
            }

            return { valid: true };
        } catch (error) {
            this.logger.error(`Parameter validation error for ${toolName}:`, error);
            return { valid: false, error: 'Parameter validation failed' };
        }
    }
}
