#!/bin/bash

echo "Testing New MCP Tools with curl"
echo "==============================="

# Base URL
BASE_URL="http://localhost:3000/api/chat"

# Test cases
declare -a tests=(
    "Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a|getMultiBalance"
    "Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007|getERC20Transfers"
    "Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?|getAddressType"
    "What are the current gas price recommendations?|getGasOracle"
    "Show NFT transfers for address 0x6492772d1474ffa1ed6944e86735848c253bb007|getERC721Transfers"
    "Get information about token contract 0xA0b86a33E6441918E634293Df0c9b7b78b147b39|getTokenInfo"
)

success=0
total=${#tests[@]}

for test in "${tests[@]}"; do
    IFS='|' read -r prompt expected_tool <<< "$test"
    
    echo ""
    echo "Testing: $expected_tool"
    echo "Prompt: $prompt"
    
    # Make the request
    response=$(curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$prompt\"}" \
        --max-time 20)
    
    if [ $? -eq 0 ]; then
        # Extract tool used from response
        tool_used=$(echo "$response" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ "$tool_used" = "$expected_tool" ]; then
            echo "✅ SUCCESS: Correct tool used ($tool_used)"
            ((success++))
        else
            echo "❌ FAILED: Expected $expected_tool, got $tool_used"
        fi
        
        # Show response preview
        response_text=$(echo "$response" | grep -o '"response":"[^"]*"' | cut -d'"' -f4 | head -c 80)
        echo "Response: $response_text..."
    else
        echo "❌ ERROR: Request failed"
    fi
done

echo ""
echo "Results: $success/$total tests passed"

if [ $success -eq $total ]; then
    echo "🎉 All tests passed!"
else
    echo "⚠️ Some tests failed. Check the system."
fi
