# Context API Endpoints Documentation

## 🚨 **CRITICAL: Backend API Issues - Context Graph System**

### **Current Problem**: Frontend showing "(Demo Data)" because backend endpoints are missing/broken

The frontend is making requests to context endpoints that are **NOT IMPLEMENTED** or **NOT WORKING**, causing fallback to static demo data.

### **Missing/Broken Endpoints**:

#### **1. Context Storage Endpoint** ❌ **CRITICAL - NOT WORKING**
```http
POST /api/context/users/{userId}/context
```

**Current Status**: Returns 404/500 errors  
**Frontend Impact**: Context not stored after chat messages  
**Required For**: Real-time graph updates

**Expected Implementation**:
```typescript
// Should store user context and update graph database
async storeUserContext(userId: string, contextData: ContextData) {
  // 1. Store in Neo4j graph database
  // 2. Create/update User node
  // 3. Create Query node with relationships
  // 4. Link to Tools, Insights, Addresses
  // 5. Return success confirmation
}
```

#### **2. User-Specific Graph Visualization** ❌ **CRITICAL - NOT WORKING**  
```http
GET /api/context/graph/visualization?userId={userId}
```

**Current Status**: Returns 404 or wrong data structure  
**Frontend Impact**: All users see same graph  
**Required For**: Personalized user graphs

#### **3. Global Graph Visualization** ⚠️ **PARTIALLY WORKING**
```http
GET /api/context/graph/visualization
```

**Current Status**: Returns some data but wrong structure  
**Frontend Impact**: Shows generic data instead of aggregated user data

#### **4. Graph Insights Endpoint** ❌ **NOT IMPLEMENTED**
```http
GET /api/context/graph/insights/{userId}  
```

**Current Status**: Endpoint missing  
**Frontend Impact**: No user insights displayed

### **Frontend Error Logs**:
```
=== FETCHING GRAPH VISUALIZATION ===
Endpoint: /api/context/graph/visualization?userId=alice  
=== GRAPH API FAILED, USING FALLBACK ===
Error: API request failed: 404 Not Found

=== STORING CONTEXT DATA ===
User ID: alice, Query: What's the current gas price?
=== CONTEXT STORAGE FAILED ===  
Error: API request failed: 404 Not Found
```

### **Required Node/Edge Types for Frontend Compatibility**:

**Node Types** (must match exactly):
```typescript
type NodeType = 'user' | 'query' | 'tool' | 'insight' | 'address' | 'pattern' | 'other';

// Required properties per type:
interface UserNode { id: string; name: string; role: string; lastActivity: string; }
interface QueryNode { id: string; content: string; timestamp: string; confidence: number; }  
interface ToolNode { id: string; name: string; category: string; }
interface InsightNode { id: string; content: string; confidence: number; }
interface AddressNode { id: string; address: string; type: string; }
```

**Edge Types** (must match exactly):
```typescript
type EdgeType = 'QUERIES' | 'USED_TOOL' | 'GENERATED_INSIGHT' | 'INVOLVES_ADDRESS' | 'RELATED_TO' | 'LEARNED_PATTERN';
```

### **Quick Test Commands**:
```bash
# Test context storage (currently fails)
curl -X POST "http://localhost:3000/api/context/users/alice/context" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is gas price?",
    "toolsUsed": ["gas-tracker"], 
    "addressesInvolved": [],
    "insights": [{"content": "Gas query", "confidence": 0.8}],
    "metadata": {"sessionId": "test", "timestamp": "2025-07-02T10:00:00.000Z"}
  }'

# Test user-specific graph (currently fails)  
curl -X GET "http://localhost:3000/api/context/graph/visualization?userId=alice"

# Test global graph (wrong structure)
curl -X GET "http://localhost:3000/api/context/graph/visualization"
```

### **Success Criteria** ✅:
- [ ] Different users show different graphs (Alice ≠ Bob ≠ Charlie)
- [ ] Graph updates in real-time after chat messages  
- [ ] "(Demo Data)" indicator disappears
- [ ] Console shows successful API calls instead of fallback errors
- [ ] Context storage succeeds after each chat message

## 🎯 Overview
This document provides complete API documentation for all context-related endpoints in the MCP Client backend. Use this documentation to update frontend routes, data structures, and visualizations.

## 🔗 Base URL
```
http://localhost:3000/api/context
```

## 📊 Graph Visualization Endpoints

### **1. Get Graph Visualization Data**
**Purpose**: Retrieve complete graph structure for visualization (Users, Queries, Tools, Insights, Addresses)

```http
GET /api/context/graph/visualization
```

**Query Parameters**:
```typescript
interface QueryParams {
  userId?: string;  // Optional - filter for specific user, omit for global view
}
```

**Request Examples**:
```bash
# Global visualization (all users and relationships)
GET /api/context/graph/visualization

# User-specific visualization  
GET /api/context/graph/visualization?userId=user-001
```

**Response Format**:
```typescript
interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'query' | 'tool' | 'insight' | 'address' | 'pattern' | 'other';
  properties: Record<string, any>;
  size: number;
  color: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: 'QUERIES' | 'USED_TOOL' | 'GENERATED_INSIGHT' | 'INVOLVES_ADDRESS' | 'RELATED_TO' | 'LEARNED_PATTERN';
  weight: number;
  color: string;
}

interface GraphMetadata {
  totalNodes: number;
  totalEdges: number;
  userCount: number;
  toolCount: number;
  queryCount: number;
  insightCount: number;
  addressCount: number;
  generatedAt: string;
  userId: string;
}
```

**Sample Response**:
```json
{
  "nodes": [
    {
      "id": "user-001",
      "label": "Alice (Trader)",
      "type": "user",
      "properties": {
        "id": "user-001",
        "name": "Alice (Trader)",
        "role": "trader",
        "lastActivity": "2025-07-01T22:00:00.000Z"
      },
      "size": 40,
      "color": "#2196F3"
    },
    {
      "id": "ctx-user-001-1751023504295",
      "label": "Hello! Can you tell me about A...",
      "type": "query",
      "properties": {
        "id": "ctx-user-001-1751023504295",
        "content": "Hello! Can you tell me about Arbitrum?",
        "timestamp": "2025-06-27T11:25:04.296Z",
        "confidence": 0.9
      },
      "size": 25,
      "color": "#4CAF50"
    },
    {
      "id": "tool-getBalance",
      "label": "getBalance",
      "type": "tool",
      "properties": {
        "id": "tool-getBalance",
        "name": "getBalance",
        "category": "balance"
      },
      "size": 30,
      "color": "#FF5722"
    },
    {
      "id": "insight-123",
      "label": "Insight: Balance analysis for addr...",
      "type": "insight",
      "properties": {
        "id": "insight-123",
        "content": "Balance analysis for address: Shows balance data",
        "confidence": 0.8,
        "type": "analysis"
      },
      "size": 20,
      "color": "#9C27B0"
    },
    {
      "id": "addr-0x64927772d1474fa1ed6944e86735848c253bb007",
      "label": "0x64927772...",
      "type": "address",
      "properties": {
        "id": "addr-0x64927772d1474fa1ed6944e86735848c253bb007",
        "address": "0x64927772d1474fa1ed6944e86735848c253bb007",
        "type": "user_query"
      },
      "size": 15,
      "color": "#607D8B"
    }
  ],
  "edges": [
    {
      "id": "user-001-ctx-user-001-1751023504295",
      "from": "user-001",
      "to": "ctx-user-001-1751023504295",
      "label": "asked",
      "type": "QUERIES",
      "weight": 1.0,
      "color": "#4CAF50"
    },
    {
      "id": "ctx-user-001-1751023504295-tool-getBalance",
      "from": "ctx-user-001-1751023504295",
      "to": "tool-getBalance",
      "label": "used",
      "type": "USED_TOOL",
      "weight": 1.0,
      "color": "#FF5722"
    },
    {
      "id": "ctx-user-001-1751023504295-insight-123",
      "from": "ctx-user-001-1751023504295",
      "to": "insight-123",
      "label": "learned",
      "type": "GENERATED_INSIGHT",
      "weight": 0.8,
      "color": "#9C27B0"
    },
    {
      "id": "ctx-user-001-1751023504295-addr-0x64927772d1474fa1ed6944e86735848c253bb007",
      "from": "ctx-user-001-1751023504295",
      "to": "addr-0x64927772d1474fa1ed6944e86735848c253bb007",
      "label": "involves",
      "type": "INVOLVES_ADDRESS",
      "weight": 1.0,
      "color": "#607D8B"
    }
  ],
  "metadata": {
    "totalNodes": 80,
    "totalEdges": 78,
    "userCount": 1,
    "toolCount": 2,
    "queryCount": 72,
    "insightCount": 4,
    "addressCount": 1,
    "generatedAt": "2025-07-01T22:00:00.000Z",
    "userId": "global"
  }
}
```

### **2. Get Context Insights**
**Purpose**: Get AI-generated insights about user patterns and tool usage

```http
GET /api/context/graph/insights/{userId}
```

**Path Parameters**:
```typescript
interface PathParams {
  userId: string;  // Required - user ID to get insights for
}
```

**Request Example**:
```bash
GET /api/context/graph/insights/user-001
```

**Response Format**:
```typescript
interface ContextInsights {
  userProfile: {
    id: string;
    name: string;
    totalQueries: number;
    toolsUsed: string[];
    addressesInteracted: string[];
    insights: string[];
  };
  topTools: Array<{
    tool: string;
    usage: number;
    recentQueries: string[];
  }>;
  relationshipStrength: Array<{
    target: string;
    strength: number;
    type: string;
  }>;
  recommendations: string[];
}
```

**Sample Response**:
```json
{
  "userProfile": {
    "id": "user-001",
    "name": "Alice (Trader)",
    "totalQueries": 68,
    "toolsUsed": ["getBalance", "getGasPrice"],
    "addressesInteracted": ["0x64927772d1474fa1ed6944e86735848c253bb007"],
    "insights": ["Shows interest in gas optimization", "Frequently checks balances"]
  },
  "topTools": [
    {
      "tool": "getBalance",
      "usage": 15,
      "recentQueries": ["What is the balance of...", "Check balance for..."]
    },
    {
      "tool": "getGasPrice",
      "usage": 8,
      "recentQueries": ["Current gas prices?", "Gas fees on arbitrum"]
    }
  ],
  "relationshipStrength": [
    {
      "target": "gas optimization",
      "strength": 0.8,
      "type": "interest"
    },
    {
      "target": "balance checking",
      "strength": 0.9,
      "type": "behavior"
    }
  ],
  "recommendations": [
    "Consider using gas optimization tools",
    "Set up balance alerts for frequently checked addresses",
    "Explore DeFi yield farming opportunities"
  ]
}
```

### **3. Get Graph Statistics**
**Purpose**: Get overall statistics about the context graph

```http
GET /api/context/graph/stats
```

**No Parameters Required**

**Response Format**:
```typescript
interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  activeUsers: number;
  recentActivity: {
    last24Hours: number;
    lastWeek: number;
    lastMonth: number;
  };
  topTools: Array<{
    name: string;
    usage: number;
  }>;
  topAddresses: Array<{
    address: string;
    interactions: number;
  }>;
}
```

**Sample Response**:
```json
{
  "totalNodes": 89,
  "totalEdges": 174,
  "nodesByType": {
    "User": 4,
    "Query": 75,
    "Tool": 3,
    "Insight": 4,
    "Address": 1,
    "TestNode": 1,
    "TestResult": 1
  },
  "edgesByType": {
    "QUERIES": 136,
    "USED_TOOL": 8,
    "GENERATED_INSIGHT": 8,
    "INVOLVES_ADDRESS": 4,
    "TESTED_BY": 2,
    "ASKS": 2,
    "USES_TOOL": 2,
    "HAS_QUERY": 12
  },
  "activeUsers": 4,
  "recentActivity": {
    "last24Hours": 12,
    "lastWeek": 45,
    "lastMonth": 89
  },
  "topTools": [
    { "name": "getBalance", "usage": 15 },
    { "name": "getGasPrice", "usage": 8 },
    { "name": "getTransactionHistory", "usage": 5 }
  ],
  "topAddresses": [
    {
      "address": "0x64927772d1474fa1ed6944e86735848c253bb007",
      "interactions": 12
    }
  ]
}
```

## 👥 User Management Endpoints

### **4. Get All Users**
**Purpose**: Retrieve list of all users in the system

```http
GET /api/context/users
```

**Response Format**:
```typescript
interface User {
  id: string;
  name: string;
  role?: string;
  lastActivity?: string;
  queryCount?: number;
  toolsUsed?: string[];
}

type UsersResponse = User[];
```

**Sample Response**:
```json
[
  {
    "id": "user-001",
    "name": "Alice (Trader)",
    "role": "trader",
    "lastActivity": "2025-06-28T20:12:53.645Z",
    "queryCount": 68,
    "toolsUsed": ["getBalance", "getGasPrice"]
  },
  {
    "id": "user-002",
    "name": "Bob (Developer)",
    "role": "developer",
    "lastActivity": "2025-06-27T15:30:22.123Z",
    "queryCount": 12,
    "toolsUsed": ["getTransactionHistory"]
  }
]
```

### **5. Get Specific User**
**Purpose**: Get detailed information about a specific user

```http
GET /api/context/users/{userId}
```

**Path Parameters**:
```typescript
interface PathParams {
  userId: string;  // Required - user ID
}
```

**Response Format**:
```typescript
interface UserDetails {
  id: string;
  name: string;
  role?: string;
  lastActivity?: string;
  totalQueries: number;
  recentQueries: Array<{
    id: string;
    content: string;
    timestamp: string;
  }>;
  toolsUsed: Array<{
    name: string;
    usage: number;
    lastUsed: string;
  }>;
  addressesInteracted: Array<{
    address: string;
    interactions: number;
    lastInteraction: string;
  }>;
  insights: Array<{
    content: string;
    confidence: number;
    generated: string;
  }>;
}
```

### **6. Store User Context**
**Purpose**: Store new context data for a user (queries, tool usage, etc.)

```http
POST /api/context/users/{userId}/context
```

**Path Parameters**:
```typescript
interface PathParams {
  userId: string;  // Required - user ID
}
```

**Request Body**:
```typescript
interface ContextData {
  query: string;
  toolsUsed?: Array<{
    name: string;
    parameters?: Record<string, any>;
    result?: any;
  }>;
  addressesInvolved?: string[];
  insights?: Array<{
    content: string;
    confidence: number;
  }>;
  metadata?: Record<string, any>;
}
```

**Request Example**:
```json
{
  "query": "What is the balance of 0x123...456?",
  "toolsUsed": [
    {
      "name": "getBalance",
      "parameters": {
        "address": "0x123...456",
        "network": "arbitrum"
      },
      "result": {
        "balance": "1.234 ETH",
        "usd_value": "$2,468.00"
      }
    }
  ],
  "addressesInvolved": ["0x123...456"],
  "insights": [
    {
      "content": "User frequently checks this address balance",
      "confidence": 0.8
    }
  ],
  "metadata": {
    "session": "session-123",
    "timestamp": "2025-07-01T22:00:00.000Z"
  }
}
```

**Response Format**:
```typescript
interface ContextStoreResponse {
  success: boolean;
  message: string;
  contextId: string;
  stored: {
    query: boolean;
    tools: boolean;
    addresses: boolean;
    insights: boolean;
  };
}
```

## 🔍 Query and Search Endpoints

### **7. Custom Graph Query**
**Purpose**: Execute custom Cypher queries on the graph database

```http
POST /api/context/graph/query
```

**Request Body**:
```typescript
interface CustomQuery {
  query: string;      // Cypher query
  parameters?: Record<string, any>;
  limit?: number;
}
```

**Request Example**:
```json
{
  "query": "MATCH (u:User)-[:QUERIES]->(q:Query)-[:USED_TOOL]->(t:Tool {name: $toolName}) RETURN u, q, t",
  "parameters": {
    "toolName": "getBalance"
  },
  "limit": 10
}
```

**Response Format**:
```typescript
interface QueryResponse {
  records: Array<Record<string, any>>;
  summary: {
    resultAvailableAfter: number;
    resultConsumedAfter: number;
    recordCount: number;
  };
}
```

### **8. Vector Search**
**Purpose**: Search context using vector embeddings

```http
GET /api/context/search/vector
```

**Query Parameters**:
```typescript
interface VectorSearchParams {
  query: string;      // Search query
  limit?: number;     // Default: 10
  threshold?: number; // Similarity threshold (0-1), Default: 0.7
  userId?: string;    // Filter by user
}
```

**Request Example**:
```bash
GET /api/context/search/vector?query=balance%20checking&limit=5&userId=user-001
```

**Response Format**:
```typescript
interface VectorSearchResponse {
  results: Array<{
    content: string;
    similarity: number;
    context: {
      userId: string;
      timestamp: string;
      type: 'query' | 'insight' | 'tool_usage';
    };
    metadata: Record<string, any>;
  }>;
  query: string;
  totalResults: number;
}
```

## 🗄️ Storage and Cache Endpoints

### **9. KV Store Operations**
**Purpose**: Key-value storage for caching and temporary data

```http
# Get value
GET /api/context/kv/{key}

# Set value
POST /api/context/kv/{key}

# Delete value
DELETE /api/context/kv/{key}
```

**Path Parameters**:
```typescript
interface KVPathParams {
  key: string;  // Storage key
}
```

**POST Request Body**:
```typescript
interface KVStoreRequest {
  value: any;           // Value to store
  ttl?: number;         // Time to live in seconds
  metadata?: Record<string, any>;
}
```

**Response Formats**:
```typescript
// GET Response
interface KVGetResponse {
  key: string;
  value: any;
  metadata?: Record<string, any>;
  timestamp: string;
}

// POST Response
interface KVSetResponse {
  success: boolean;
  key: string;
  timestamp: string;
}

// DELETE Response
interface KVDeleteResponse {
  success: boolean;
  key: string;
  existed: boolean;
}
```

### **10. Storage Health Check**
**Purpose**: Check health of all storage systems (Neo4j, Redis, Pinecone)

```http
GET /api/context/storage/health
```

**Response Format**:
```typescript
interface StorageHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    neo4j: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    pinecone: 'healthy' | 'unhealthy';
  };
  details: {
    neo4j?: string;
    redis?: string;
    pinecone?: string;
  };
  timestamp: string;
}
```

**Sample Response**:
```json
{
  "overall": "healthy",
  "services": {
    "neo4j": "healthy",
    "redis": "healthy",
    "pinecone": "healthy"
  },
  "details": {
    "neo4j": "Connected to Neo4j Cloud",
    "redis": "Connected to Redis Cloud",
    "pinecone": "Index ready"
  },
  "timestamp": "2025-07-01T22:00:00.000Z"
}
```

## 🎨 Frontend Integration Guide

### **Color Schemes for Visualization**
```typescript
const nodeColors = {
  'user': '#2196F3',      // Blue
  'query': '#4CAF50',     // Green
  'tool': '#FF5722',      // Red-Orange
  'insight': '#9C27B0',   // Purple
  'address': '#607D8B',   // Blue-Grey
  'pattern': '#FF9800',   // Orange
  'other': '#9E9E9E'      // Grey
};

const edgeColors = {
  'QUERIES': '#4CAF50',           // Green
  'USED_TOOL': '#FF5722',         // Red-Orange
  'GENERATED_INSIGHT': '#9C27B0', // Purple
  'INVOLVES_ADDRESS': '#607D8B',  // Blue-Grey
  'RELATED_TO': '#FFC107',        // Amber
  'LEARNED_PATTERN': '#FF9800'    // Orange
};
```

### **Node Sizes**
```typescript
const nodeSizes = {
  'user': 40,      // Largest - central entities
  'tool': 30,      // Large - important tools
  'query': 25,     // Medium - conversation content
  'insight': 20,   // Small-medium - generated content
  'address': 15,   // Small - specific addresses
  'pattern': 25,   // Medium - learned patterns
  'other': 20      // Default
};
```

### **Error Handling**
All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (user/resource doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable (storage systems down)

### **Rate Limiting**
- **User endpoints**: 60 requests per minute per user
- **Graph endpoints**: 30 requests per minute per user
- **Query endpoints**: 10 requests per minute per user

### **WebSocket Support** (Future)
```typescript
// Connect to real-time updates
const ws = new WebSocket('ws://localhost:3000/api/context/stream');

// Listen for graph updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'graph_update') {
    // Refresh visualization
    updateGraph(update.data);
  }
};
```

## 🚀 Quick Start Integration

1. **Update your API base URL**: `http://localhost:3000/api/context`
2. **Use the visualization endpoint**: `/graph/visualization` for main graph display
3. **Handle the new node/edge types**: Add support for tools, insights, addresses
4. **Implement error handling**: Check storage health before operations
5. **Add user filtering**: Use `userId` parameter for user-specific views

## 🔧 Troubleshooting Common Issues

### **Issue: Tool Returns Null but Frontend Shows Mock Data**

**Problem**: Backend logs show tool returns `null`, but frontend displays fake/hallucinated data.

**Example**:
```
Backend: {"jsonrpc": "2.0", "id": 1, "result": null}
Frontend: Block 18500000: Number: 18500000, Timestamp: 2023-03-23...
```

**Root Cause**: LLM is generating mock data when tool returns null instead of handling the error properly.

**Backend Fix Locations**:
```typescript
// 1. Check MCP Server Connection
GET /api/health  // Verify MCP server is running

// 2. Check Tool Configuration  
// File: src/mcp/mcp.service.ts
// Verify tool is properly registered and functioning

// 3. Check Tool Error Handling
// File: src/llm/llm.service.ts  
// Add null result validation before LLM processing

// 4. Add Failsafe Response
// When tool returns null, return structured error instead of letting LLM hallucinate
```

**Recommended Backend Changes**:
```typescript
// In ChatService or LlmService
if (toolResult.content[0].text.includes('"result": null')) {
  return {
    content: "Sorry, I couldn't retrieve that data. The blockchain service returned no results for your request.",
    error: "TOOL_NULL_RESULT",
    toolUsed: toolName
  };
}
```

**Frontend Handling**:
```typescript
// Check for error responses
if (response.error === 'TOOL_NULL_RESULT') {
  showError(`No data available for ${response.toolUsed}`);
  return;
}
```

### **Issue: Graph Visualization Not Updating**

**Problem**: Frontend still shows old node/edge counts despite backend changes.

**Debugging Steps**:
```bash
# 1. Verify backend is running with latest code
curl http://localhost:3000/api/context/graph/visualization

# 2. Check response structure matches documentation
# Should return 80+ nodes, not 10 nodes

# 3. Verify frontend is calling correct endpoint
# Make sure not cached or using old API calls

# 4. Clear frontend cache/state
localStorage.clear(); // Clear any cached graph data
```

### **Issue: Missing Node Types in Visualization**

**Problem**: Only seeing User/Query nodes, missing Tool/Insight/Address nodes.

**Backend Verification**:
```bash
# Check if data exists in database
node debug-neo4j.js

# Check if visualization query returns all types  
curl http://localhost:3000/api/context/graph/visualization | jq '.metadata'
```

**Expected Response**:
```json
{
  "metadata": {
    "totalNodes": 80,
    "userCount": 1,
    "toolCount": 2,     // Should be > 0
    "insightCount": 4,  // Should be > 0  
    "addressCount": 1   // Should be > 0
  }
}
```

### **Issue: Rate Limiting Errors**

**Problem**: Frontend requests being throttled.

**Solution**:
```typescript
// Add retry logic with exponential backoff
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
};
```

### **Issue: Storage Health Problems**

**Problem**: Context endpoints returning errors.

**Diagnostic**:
```bash
curl http://localhost:3000/api/context/storage/health
```

**Expected Healthy Response**:
```json
{
  "overall": "healthy",
  "services": {
    "neo4j": "healthy",
    "redis": "healthy", 
    "pinecone": "healthy"
  }
}
```

**If Unhealthy**: Check environment variables and network connectivity.

### **Issue: Frontend Showing "(Demo Data)" Instead of Real Graph**

**Problem**: Frontend displays static demo data with "(Demo Data)" label instead of dynamic user context.

**Root Cause**: Backend context endpoints are not implemented or returning wrong data structures.

**Frontend Error Patterns**:
```javascript
// Console logs showing the issue:
"=== FETCHING GRAPH VISUALIZATION ==="
"Endpoint: /api/context/graph/visualization?userId=alice"
"=== GRAPH API FAILED, USING FALLBACK ==="
"Error: API request failed: 404 Not Found"
"=== USING FALLBACK DATA ==="

"=== STORING CONTEXT DATA ==="  
"User ID: alice, Query: What's the current gas price?"
"=== CONTEXT STORAGE FAILED ==="
"Error: API request failed: 404 Not Found"
```

**Required Backend Implementation**:
```typescript
// 1. Fix ContextController endpoints
@Controller('api/context')
export class ContextController {
  
  @Post('users/:userId/context')
  async storeUserContext(
    @Param('userId') userId: string,
    @Body() contextData: ContextData
  ) {
    // Store in Neo4j with proper relationships
    const result = await this.contextGraphService.storeContext(userId, contextData);
    return { success: true, contextId: result.id, message: 'Context stored successfully' };
  }

  @Get('graph/visualization')
  async getGraphVisualization(@Query('userId') userId?: string) {
    // Return proper node/edge structure for frontend
    return this.contextGraphService.generateVisualization(userId);
  }

  @Get('graph/insights/:userId')
  async getGraphInsights(@Param('userId') userId: string) {
    return this.contextGraphService.getContextInsights(userId);
  }
}
```

**Required Response Structure for Visualization**:
```json
{
  "nodes": [
    {
      "id": "alice",
      "label": "Alice (Trader)", 
      "type": "user",
      "properties": { "id": "alice", "name": "Alice (Trader)", "role": "trader" },
      "size": 40,
      "color": "#2196F3"
    },
    {
      "id": "query-123",
      "label": "What's the current gas price?",
      "type": "query", 
      "properties": { "content": "What's the current gas price?", "timestamp": "2025-07-02T10:00:00.000Z" },
      "size": 25,
      "color": "#4CAF50"
    }
  ],
  "edges": [
    {
      "id": "alice-query-123",
      "from": "alice",
      "to": "query-123",
      "label": "asked",
      "type": "QUERIES",
      "weight": 1.0,
      "color": "#4CAF50"
    }
  ],
  "metadata": {
    "totalNodes": 2,
    "totalEdges": 1,
    "userCount": 1,
    "toolCount": 0,
    "queryCount": 1,
    "insightCount": 0,
    "addressCount": 0,
    "generatedAt": "2025-07-02T10:00:00.000Z",
    "userId": "alice"
  }
}
```

**Test Commands**:
```bash
# Test if endpoints exist
curl -I http://localhost:3000/api/context/users/alice/context
curl -I http://localhost:3000/api/context/graph/visualization

# Test actual data flow
curl -X POST "http://localhost:3000/api/context/users/alice/context" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","toolsUsed":[],"addressesInvolved":[],"insights":[]}'

curl "http://localhost:3000/api/context/graph/visualization?userId=alice"
```

**Success Indicators**:
- ✅ API calls return 200 status codes
- ✅ Response structure matches expected format  
- ✅ Different users return different graph data
- ✅ "(Demo Data)" label disappears from frontend
- ✅ Graph updates after sending chat messages

### **Issue: Pinecone Timeout Errors (504 Gateway Time-out)**

**Problem**: Pinecone vector database timing out when storing embeddings.

**Error in Logs**:
```
PineconeUnmappedHttpError: An unexpected error occured while calling the 
https://mcp-chat-embeddings-scrj6kr.svc.aped-4627-b74a.pinecone.io/vectors/upsert endpoint.
<html><head><title>504 Gateway Time-out</title></head></html> Status: 504.
```

**Root Causes**:
1. **Pinecone Service Overload**: High traffic or maintenance
2. **Network Connectivity**: Slow connection to Pinecone cloud
3. **Index Configuration**: Index might be scaling or updating
4. **API Key Issues**: Invalid or expired Pinecone API key

**Immediate Fixes**:
```typescript
// 1. Check Pinecone Status
// Visit: https://status.pinecone.io/

// 2. Verify API Key and Index
// In .env file:
PINECONE_API_KEY=your_valid_key
PINECONE_INDEX_NAME=mcp-chat-embeddings
PINECONE_ENVIRONMENT=us-east-1-aws

// 3. Add Retry Logic in EmbeddingsService
// File: src/embeddings/embeddings.service.ts
const maxRetries = 3;
const retryDelay = 1000; // 1 second

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await this.pinecone.upsert(vectors);
    break; // Success
  } catch (error) {
    if (attempt === maxRetries) throw error;
    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
  }
}

// 4. Add Graceful Degradation
// Allow chat to continue even if embeddings fail
try {
  await this.embeddingsService.storeEmbedding(message);
} catch (error) {
  this.logger.warn('Embeddings storage failed, continuing without context');
}
```

**Backend Fix Implementation**:
```typescript
// In EmbeddingsService
async storeEmbeddingWithRetry(data: any, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.storeEmbedding(data);
      return; // Success
    } catch (error) {
      this.logger.warn(`Embedding storage attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        this.logger.error('All embedding storage attempts failed');
        // Don't throw - allow chat to continue
        return;
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

**Monitor Resolution**:
```bash
# Check if Pinecone is responsive
curl -H "Api-Key: YOUR_API_KEY" \
  "https://api.pinecone.io/indexes/mcp-chat-embeddings/describe"

# Check embedding service health
curl http://localhost:3000/api/embeddings/health
```

**Alternative Solutions**:
1. **Temporary Disable Embeddings**: Set a flag to skip embedding storage during outages
2. **Local Cache**: Store embeddings locally until Pinecone recovers
3. **Switch Index**: Use a backup Pinecone index temporarily

This API now provides complete access to the enhanced context graph system with all Tools, Insights, and Addresses properly connected!
