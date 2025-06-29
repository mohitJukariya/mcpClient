# Manual Test Prompts for New Tools

## Quick Tests to Run

### 1. Multi Balance Test
**Prompt**: "Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a"
**Expected Tool**: getMultiBalance
**Expected Response**: Should use getMultiBalance and return balances for both addresses

### 2. ERC20 Transfers Test
**Prompt**: "Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007"
**Expected Tool**: getERC20Transfers  
**Expected Response**: Should use getERC20Transfers and show token transfer history

### 3. Address Type Test
**Prompt**: "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?"
**Expected Tool**: getAddressType
**Expected Response**: Should use getAddressType and identify if it's a contract or EOA

### 4. Gas Oracle Test
**Prompt**: "What are the current gas price recommendations?"
**Expected Tool**: getGasOracle
**Expected Response**: Should use getGasOracle and show safe/standard/fast gas prices

### 5. NFT Transfers Test
**Prompt**: "Show NFT transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007"
**Expected Tool**: getERC721Transfers
**Expected Response**: Should use getERC721Transfers and show NFT transfer history

### 6. Token Info Test
**Prompt**: "Get information about token contract 0xA0b86a33E6441918E634293Df0c9b7b78b147b39"
**Expected Tool**: getTokenInfo
**Expected Response**: Should use getTokenInfo and show token details (name, symbol, decimals, supply)

### 7. Internal Transactions Test
**Prompt**: "Show internal transactions for 0x6492772d1474ffa1ed6944e86735848c253bb007"
**Expected Tool**: getInternalTransactions
**Expected Response**: Should use getInternalTransactions and show internal tx data

### 8. Transaction Status Test
**Prompt**: "What's the status of transaction 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef?"
**Expected Tool**: getTransactionStatus
**Expected Response**: Should use getTransactionStatus and show transaction status/receipt

### 9. Contract Source Test
**Prompt**: "Is contract 0x6492772d1474ffa1ed6944e86735848c253bb007 verified? Show me the source code"
**Expected Tool**: getContractSource
**Expected Response**: Should use getContractSource and show verification status

### 10. Contract Creation Test
**Prompt**: "When was contract 0x6492772d1474ffa1ed6944e86735848c253bb007 created?"
**Expected Tool**: getContractCreation
**Expected Response**: Should use getContractCreation and show creation details

## Alternative Phrasings to Test

### Natural Language Variations:
- "What are the balances for these addresses: [addr1], [addr2]" → getMultiBalance
- "Show me token transfers for [address]" → getERC20Transfers
- "What type of address is [address]?" → getAddressType
- "Give me gas price options" → getGasOracle
- "What token is [contract_address]?" → getTokenInfo

### Edge Cases:
- Multiple addresses in different formats
- Mixed case addresses
- Partial transaction hashes (should handle gracefully)
- Invalid addresses (should validate first)

## Testing Methodology

1. **Start the server**: `npm run start:dev`
2. **Test each prompt** using curl or Postman:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "YOUR_TEST_PROMPT_HERE"}'
   ```
3. **Verify**:
   - Correct tool is selected
   - Tool arguments are properly formatted
   - Response is clean and relevant
   - No disclaimers or AI warnings

## Success Criteria

- ✅ Tool selection accuracy: >90%
- ✅ Response formatting: Clean, direct answers
- ✅ Error handling: Graceful failures with helpful messages
- ✅ Performance: Response time <10 seconds
- ✅ MCP integration: Successful tool calls to MCP server

## Common Issues to Watch For

- Wrong tool selection (e.g., getBalance instead of getMultiBalance)
- Missing or malformed tool arguments
- LLM adding disclaimers despite instructions
- Tool call extraction failures
- MCP server connectivity issues
