# Personality System Integration Guide

## Overview
The system now supports 3 distinct user personalities for blockchain analytics:

- **Alice** - DeFi Trader & Gas Optimizer
- **Bob** - Smart Contract Developer  
- **Charlie** - Blockchain Analyst & Whale Tracker

## API Endpoints

### Get All Personalities
```
GET /personalities
```

**Response:**
```json
{
  "success": true,
  "personalities": [
    {
      "id": "alice",
      "name": "Alice", 
      "title": "DeFi Trader & Gas Optimizer",
      "description": "Focuses on gas prices, trading optimization",
      "avatar": "/avatars/alice.png",
      "expertise": ["gas_optimization", "trading", "defi", "mev", "arbitrage"],
      "focusAreas": "Gas prices, trading optimization, DeFi protocols"
    }
    // ... bob and charlie
  ],
  "count": 3
}
```

### Get Specific Personality
```
GET /personalities/{id}
```

### Get Personality Context
```
GET /personalities/{id}/context
```

### Chat with Personality
```
POST /chat
```

**Request:**
```json
{
  "message": "Check ETH balance for 0x...",  
  "personalityId": "alice",
  "sessionId": "optional",
  "userId": "optional"
}
```

**Response:**
```json
{
  "response": "The balance is 1.25 ETH. Alice's tip: Consider current gas prices for optimal transaction timing.",
  "sessionId": "session_123",
  "personalityId": "alice",
  "toolsUsed": [...]
}
```

## Frontend Flow

1. **User Selection**: Show personality profiles with avatars
2. **Personality Loading**: Load selected personality context
3. **Chat Interface**: Include personalityId in all chat requests
4. **Responses**: Display personality-specific insights and tips
5. **Neo4j Integration**: Context relationships still work as before

## Personality Characteristics

### Alice (Trading Expert)
- **Focus**: Gas optimization, trading costs, DeFi
- **Tools**: getGasOracle, getMultiBalance, getERC20Transfers
- **Response Style**: Analytical, cost-focused, trading insights
- **Tips**: Always includes gas/cost optimization advice

### Bob (Developer)
- **Focus**: Smart contracts, debugging, technical details
- **Tools**: getContractSource, getContractAbi, getInternalTransactions
- **Response Style**: Technical explanations, developer-friendly
- **Tips**: Contract verification and security insights

### Charlie (Analyst) 
- **Focus**: Whale tracking, transaction patterns, large transfers
- **Tools**: getERC20Transfers, getTransactionHistory, getMultiBalance
- **Response Style**: Investigative, pattern recognition
- **Tips**: Market implications and whale behavior analysis

## Testing

Run the personality test suite:
```bash
.\test-personalities.ps1
```

This tests all endpoints and chat functionality with each personality.

## Neo4j Integration

The existing Neo4j context system remains unchanged:
- Context relationships are still stored and retrieved
- Graph data is still shown in the frontend
- Personality adds an additional layer of response customization
- All existing analytics and relationship features continue to work

## Frontend Implementation Notes

1. **Avatar Assets**: Place avatar images in `/public/avatars/`
2. **Personality Selection**: Use the `/personalities` endpoint to populate the selection UI
3. **State Management**: Store selected personalityId in frontend state
4. **Chat Requests**: Always include personalityId in chat API calls
5. **Response Handling**: Display personality-specific tips and insights
6. **Fallback**: System works without personalityId (uses default behavior)
