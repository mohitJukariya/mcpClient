# New MCP Tools Test Suite

## Test Prompts and Expected Behaviors

### 1. getMultiBalance Tests

#### Test 1.1: Basic Multi-Address
```
Prompt: "Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
Expected Tool: getMultiBalance
Expected Arguments: {"addresses": ["0x6492772d1474ffa1ed6944e86735848c253bb007", "0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"]}
```

#### Test 1.2: Natural Language Multi-Address
```
Prompt: "What are the balances for these addresses: 0x6492772d1474ffa1ed6944e86735848c253bb007, 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a?"
Expected Tool: getMultiBalance
Expected Arguments: {"addresses": ["0x6492772d1474ffa1ed6944e86735848c253bb007", "0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"]}
```

### 2. getERC20Transfers Tests

#### Test 2.1: General ERC20 Transfers
```
Prompt: "Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
Expected Tool: getERC20Transfers
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

#### Test 2.2: Specific Token (USDC)
```
Prompt: "Get USDC transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
Expected Tool: getERC20Transfers
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007", "contractAddress": "USDC_CONTRACT_ADDRESS"}
```

#### Test 2.3: Token History Alternative
```
Prompt: "What token transfers happened for 0x6492772d1474ffa1ed6944e86735848c253bb007?"
Expected Tool: getERC20Transfers
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

### 3. getERC721Transfers Tests

#### Test 3.1: Basic NFT Transfers
```
Prompt: "Show NFT transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
Expected Tool: getERC721Transfers
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

#### Test 3.2: Technical Terminology
```
Prompt: "Get ERC721 transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
Expected Tool: getERC721Transfers
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

### 4. getAddressType Tests

#### Test 4.1: Contract vs Wallet
```
Prompt: "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"
Expected Tool: getAddressType
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

#### Test 4.2: Address Type Query
```
Prompt: "What type of address is 0x6492772d1474ffa1ed6944e86735848c253bb007?"
Expected Tool: getAddressType
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

### 5. getGasOracle Tests

#### Test 5.1: Gas Recommendations
```
Prompt: "What are the current gas price recommendations?"
Expected Tool: getGasOracle
Expected Arguments: {}
```

#### Test 5.2: Gas Options
```
Prompt: "Show me gas price options for transactions"
Expected Tool: getGasOracle
Expected Arguments: {}
```

### 6. getTokenInfo Tests

#### Test 6.1: Token Contract Info
```
Prompt: "Get information about token contract 0xA0b86a33E6441918E634293Df0c9b7b78b147b39"
Expected Tool: getTokenInfo
Expected Arguments: {"contractAddress": "0xA0b86a33E6441918E634293Df0c9b7b78b147b39"}
```

#### Test 6.2: Token Identification
```
Prompt: "What token is 0xA0b86a33E6441918E634293Df0c9b7b78b147b39?"
Expected Tool: getTokenInfo
Expected Arguments: {"contractAddress": "0xA0b86a33E6441918E634293Df0c9b7b78b147b39"}
```

### 7. getInternalTransactions Tests

#### Test 7.1: Internal Transactions by Address
```
Prompt: "Show internal transactions for 0x6492772d1474ffa1ed6944e86735848c253bb007"
Expected Tool: getInternalTransactions
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

### 8. getTransactionStatus Tests

#### Test 8.1: Transaction Status
```
Prompt: "What's the status of transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef?"
Expected Tool: getTransactionStatus
Expected Arguments: {"txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}
```

### 9. getContractSource Tests

#### Test 9.1: Contract Verification
```
Prompt: "Is contract 0x6492772d1474ffa1ed6944e86735848c253bb007 verified? Show me the source code"
Expected Tool: getContractSource
Expected Arguments: {"address": "0x6492772d1474ffa1ed6944e86735848c253bb007"}
```

### 10. getContractCreation Tests

#### Test 10.1: Contract Creation
```
Prompt: "When was contract 0x6492772d1474ffa1ed6944e86735848c253bb007 created?"
Expected Tool: getContractCreation
Expected Arguments: {"contractAddresses": ["0x6492772d1474ffa1ed6944e86735848c253bb007"]}
```

## Validation Checklist

For each test, verify:

1. **✅ Correct Tool Selection**: The LLM selects the expected tool
2. **✅ Proper Arguments**: Tool arguments match expected format
3. **✅ Clean Response**: No disclaimers, AI warnings, or notes
4. **✅ Relevant Content**: Response addresses the user's query appropriately
5. **✅ Error Handling**: Graceful handling of invalid inputs
6. **✅ Performance**: Response time under 10 seconds

## Success Criteria

- **Tool Selection Accuracy**: >95% for clear, unambiguous queries
- **Argument Formatting**: 100% properly formatted JSON arguments
- **Response Quality**: Clean, direct answers without disclaimers
- **MCP Integration**: Successful communication with MCP server
- **Error Recovery**: Graceful handling of edge cases

## Edge Cases to Test

1. **Invalid Addresses**: Malformed or invalid Ethereum addresses
2. **Missing Data**: Queries for non-existent transactions/contracts
3. **Rate Limiting**: Multiple rapid requests
4. **Network Issues**: MCP server connectivity problems
5. **Mixed Case**: Different address case formats
6. **Partial Hashes**: Incomplete transaction hashes

## Automated Testing

Run the test suite with:
```bash
# PowerShell
powershell -ExecutionPolicy Bypass -File ".\test-all-new-tools.ps1"

# Batch
test-tools.bat

# Bash (WSL/Linux)
bash test-tools.sh
```

## Manual Testing

Use curl for individual tests:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "YOUR_TEST_PROMPT"}'
```

## Troubleshooting

### Common Issues:
1. **Server Not Running**: Start with `npm run start:dev`
2. **Wrong Tool Selected**: Check system prompt decision logic
3. **Malformed Arguments**: Verify tool call extraction regex
4. **MCP Server Down**: Check MCP server availability
5. **Rate Limiting**: Wait between requests

### Debug Commands:
```bash
# Check server status
netstat -an | findstr :3000

# Check server logs
npm run start:dev

# Test MCP server directly
curl -X POST http://localhost:4000/api/mcp -H "Content-Type: application/json" -d '{"method": "tools/list"}'
```
