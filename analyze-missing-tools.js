// Script to identify tools that might be missing followUpInstruction cases

// Tools that have specific followUpInstruction cases (from the code)
const toolsWithInstructions = [
    'getBalance',
    'getMultiBalance', 
    'getTransactionHistory',
    'getERC20Transfers',
    'getERC721Transfers',
    'getInternalTransactions',
    'getTokenInfo',
    'getGasOracle',
    'getAddressType',
    'getContractSource',
    'getTransaction',
    'getTransactionReceipt',
    'getGasPrice',
    'getBlock',
    'getLatestBlock'
];

// All available tools (from the system prompt)
const allTools = [
    'getBalance',
    'getTokenBalance',
    'getTransaction',
    'getTransactionReceipt',
    'getBlock',
    'getLatestBlock',
    'getTransactionHistory',
    'getContractAbi',
    'getGasPrice',
    'getEthSupply',
    'validateAddress',
    'getMultiBalance',
    'getERC20Transfers',
    'getERC721Transfers',
    'getInternalTransactions',
    'getContractSource',
    'getTokenInfo',
    'getGasOracle',
    'getTransactionStatus',
    'getContractCreation',
    'getAddressType'
];

console.log('🔍 MISSING FOLLOWUP INSTRUCTION ANALYSIS');
console.log('=' * 50);

const missingInstructions = allTools.filter(tool => !toolsWithInstructions.includes(tool));

if (missingInstructions.length > 0) {
    console.log('\n⚠️  Tools missing specific followUpInstruction cases:');
    missingInstructions.forEach((tool, i) => {
        console.log(`${i + 1}. ${tool}`);
    });
    
    console.log('\n🔧 These tools will use the generic followUpInstruction:');
    console.log('   "Tool result: {...}. Give me only a clean, direct answer in under 30 words..."');
    console.log('\n📝 This might cause the "generic response" issue we saw in the logs.');
    
} else {
    console.log('\n✅ All tools have specific followUpInstruction cases!');
}

console.log('\n📋 RECOMMENDED ADDITIONS TO chat.service.ts:');
missingInstructions.forEach(tool => {
    console.log(`
} else if (toolCall.name === '${tool}') {
    followUpInstruction = \`${tool} data: \${JSON.stringify(toolResult)}. [SPECIFIC INSTRUCTION NEEDED]. Be concise. NO disclaimers.\`;`);
});

console.log('\n🎯 SPECIFIC INSTRUCTION SUGGESTIONS:');
const suggestions = {
    'getTokenBalance': 'Show the token balance with proper symbol and decimals. Use formatted balance if available.',
    'getContractAbi': 'Show if ABI is available and list the main functions/events. Do not show full ABI.',
    'getEthSupply': 'Show the total ETH supply in a readable format with proper units.',
    'validateAddress': 'Clearly state if the address is valid or invalid with the reason.',
    'getTransactionStatus': 'Show transaction status (success/failed), gas used, and confirmation details.',
    'getContractCreation': 'Show contract creator address, creation transaction hash, and block number.'
};

Object.entries(suggestions).forEach(([tool, suggestion]) => {
    if (missingInstructions.includes(tool)) {
        console.log(`\n${tool}: ${suggestion}`);
    }
});
