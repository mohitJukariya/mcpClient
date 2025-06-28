# Complete Setup Guide for Multi-Storage Context System

This guide will help you set up the complete multi-storage context system with Redis, Neo4j, and Pinecone.

## 📋 Prerequisites

1. **Node.js 18+** and npm
2. **Redis** (for KV store)
3. **Neo4j** (for graph database)
4. **Pinecone account** (for vector embeddings)
5. **Hugging Face API key**

## 🚀 Quick Setup (Local Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up External Services

#### Option A: Docker (Recommended for Development)

```bash
# Start Redis and Neo4j with Docker
docker run -d --name redis-mcp -p 6379:6379 redis:alpine
docker run -d --name neo4j-mcp -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

#### Option B: Local Installation

**Redis:**
- Windows: Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases)
- macOS: `brew install redis && brew services start redis`
- Linux: `sudo apt-get install redis-server`

**Neo4j:**
- Download Neo4j Desktop from [neo4j.com](https://neo4j.com/download/)
- Or use Neo4j Community Edition

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update:

```env
# Required: Get from Hugging Face
HUGGINGFACE_API_KEY=hf_your_api_key_here

# Required: Get from Pinecone
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=mcp-chat-embeddings

# Local Redis (if using Docker defaults)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Local Neo4j (if using Docker defaults)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

### 4. Set Up Pinecone Index

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Create a new index with:
   - **Name**: `mcp-chat-embeddings` (or your chosen name)
   - **Dimension**: `384`
   - **Metric**: `cosine`
   - **Environment**: Choose your preferred region

### 5. Build and Start

```bash
npm run build
npm run start:dev
```

## 🧪 Testing the System

### 1. Test Individual Components

```bash
# Test basic MCP connectivity
npm run test:arbitrum

# Test embeddings integration
npm run test:embeddings
```

### 2. Initialize Test Data

```bash
# Create initial context for 3 test users
npm run init:testdata
```

### 3. Test Complete System

```bash
# Run comprehensive system test
npm run test:complete
```

## 🔍 Available API Endpoints

### Chat with Context
```bash
POST /api/chat
{
  "message": "What's the gas price?",
  "sessionId": "optional-session-id",
  "userId": "user-001"  # Use one of: user-001, user-002, user-003
}
```

### Context Management
```bash
GET /api/context/users                           # Get all test users
GET /api/context/users/:userId                   # Get specific user
POST /api/context/users/:userId/context         # Add context entry
GET /api/context/graph/visualization             # Get graph visualization
GET /api/context/graph/insights/:userId         # Get user insights
GET /api/context/storage/health                 # Check storage health
```

### Analytics Dashboard
```bash
GET /api/analytics/overview?timeRange=week       # Complete analytics
GET /api/analytics/stats?timeRange=week          # Embedding statistics
GET /api/analytics/usage-patterns               # Usage patterns
GET /api/analytics/health                       # System health
```

### Failsafe System
```bash
POST /api/failsafe/handle-failure               # Test failsafe responses
GET /api/failsafe/stats                         # Failsafe statistics
GET /api/failsafe/cache/stats                   # Cache statistics
```

### Vector & Graph Operations
```bash
GET /api/context/search/vector?query=gas        # Search embeddings
POST /api/context/graph/query                   # Custom graph queries
GET /api/context/kv/:key                        # KV store operations
```

## 👥 Test Users

The system comes with 3 pre-configured test users:

### Alice (user-001) - Trader
- **Focus**: Gas optimization, trading times
- **Favorite tokens**: ETH, USDC, ARB
- **Behavior**: Checks gas prices frequently, prefers low-gas periods

### Bob (user-002) - Developer  
- **Focus**: Smart contracts, debugging
- **Favorite tokens**: ETH, ARB
- **Behavior**: Analyzes contracts, needs technical details

### Charlie (user-003) - Analyst
- **Focus**: Whale watching, market analysis
- **Favorite tokens**: ETH, USDC, USDT, ARB
- **Behavior**: Tracks large wallets, analyzes patterns

## 🔧 Configuration Options

### Storage Graceful Degradation

The system is designed to work even if some storage systems are unavailable:

- **Redis down**: KV caching disabled, but system continues
- **Neo4j down**: Graph features disabled, but embeddings work
- **Pinecone down**: Vector search disabled, but basic chat works

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HUGGINGFACE_API_KEY` | Yes | - | Your HF API key |
| `PINECONE_API_KEY` | Yes | - | Your Pinecone API key |
| `PINECONE_INDEX_NAME` | No | `mcp-chat-embeddings` | Pinecone index name |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `NEO4J_URI` | No | `bolt://localhost:7687` | Neo4j connection |
| `NEO4J_USER` | No | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | No | `password` | Neo4j password |

## 🐛 Troubleshooting

### Common Issues

1. **"Redis connection failed"**
   - Check if Redis is running: `redis-cli ping`
   - Verify connection details in `.env`

2. **"Neo4j connection failed"**
   - Check if Neo4j is running: visit `http://localhost:7474`
   - Verify credentials in `.env`

3. **"Pinecone index not found"**
   - Create the index in Pinecone console
   - Check index name matches `.env`

4. **"Embedding dimension mismatch"**
   - Ensure Pinecone index dimension is 384
   - Recreate index if necessary

### Health Check

```bash
curl http://localhost:3000/api/context/storage/health
```

Should return:
```json
{
  "redis": "healthy",
  "neo4j": "healthy", 
  "pinecone": "healthy"
}
```

## 📊 Monitoring

### Check System Status
```bash
curl http://localhost:3000/api/analytics/health
```

### View Analytics
Open your browser to see analytics (when you build the frontend):
- Graph visualization
- Usage patterns
- Storage statistics
- Failsafe metrics

## 🔄 Development Workflow

1. **Start development server**: `npm run start:dev`
2. **Initialize test data**: `npm run init:testdata`
3. **Test with different users**: Use `userId` in chat requests
4. **Monitor logs**: Watch console for storage operations
5. **Check analytics**: Use analytics endpoints to see patterns

## 🚀 Production Deployment

For production, consider:

1. **Managed Redis**: AWS ElastiCache, Redis Cloud
2. **Managed Neo4j**: Neo4j Aura, Cloud providers
3. **Pinecone**: Production tier for higher limits
4. **Environment**: Set `NODE_ENV=production`
5. **Security**: Use proper authentication and HTTPS

## 📈 Scaling Considerations

- **Redis**: Can scale with clustering
- **Neo4j**: Consider sharding for large graphs
- **Pinecone**: Auto-scales, but watch quota limits
- **Context Storage**: Implement cleanup strategies for old data

This setup provides a complete multi-storage context system that learns from user interactions and provides intelligent, contextual responses!
