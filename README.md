# MCP Client - Arbitrum Analytics

A NestJS-based Model Context Protocol (MCP) client that connects to your Arbitrum MCP server and provides an intelligent chat interface powered by Hugging Face LLMs.

## Features

- 🤖 **AI-Powered Chat**: Uses Hugging Face LLMs (Mistral-7B-Instruct) to understand user queries and decide which tools to use
- 🔗 **HTTP Transport**: Connects to your MCP server over HTTP (no stdio needed)
- 🛠️ **Dynamic Tool Calling**: Automatically discovers and calls available tools from your Arbitrum MCP server
- 💬 **Session Management**: Maintains conversation context across multiple interactions
- 🌐 **Web Interface**: Includes a simple HTML chat interface for testing
- 📊 **Health Monitoring**: Built-in health check endpoint

## Architecture

```
Client App → NestJS MCP Client → Hugging Face LLM → Tool Selection → Arbitrum MCP Server → Response
```

1. Client sends a natural language query
2. MCP Client processes the query using Hugging Face LLM (Mistral-7B-Instruct)
3. LLM determines which tools to use and their parameters
4. MCP Client calls the selected tools on your Arbitrum MCP server via HTTP
5. Results are processed by the LLM to generate a natural language response
6. Final response is sent back to the client

## Setup

### Prerequisites

- Node.js 18+ and npm
- A Hugging Face API key (get from [Hugging Face Settings](https://huggingface.co/settings/tokens))
- Your Arbitrum MCP server running (currently deployed at Railway)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy the `.env` file and update the values:
   ```env
   # Hugging Face Configuration
   HUGGINGFACE_API_KEY=your_huggingface_api_key_here
   HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.3
   
   # Server Configuration
   PORT=3000
   MCP_SERVER_BASE_URL=https://arbitrummcpserver-production.up.railway.app
   NODE_ENV=development
   
   # Legacy (keeping for reference)
   ANTHROPIC_API_KEY=placeholder
   ```

3. **Build the application:**
   ```bash
   npm run build
   ```

## Usage

### Development Mode

```bash
npm run start:dev
```

The application will start on `http://localhost:3000` with hot reload enabled.

### Production Mode

```bash
npm run start:prod
```

### Available Endpoints

- **Health Check**: `GET /api/health`
- **Chat**: `POST /api/chat`
- **Web Interface**: `GET /` (serves the HTML chat interface)

### API Usage

#### Chat Endpoint

**POST** `/api/chat`

**Request:**
```json
{
  "message": "What's the current TVL on Arbitrum?",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "The current Total Value Locked (TVL) on Arbitrum is approximately $2.1 billion according to the latest data...",
  "sessionId": "session_1640995200000_abc123",
  "toolsUsed": [
    {
      "name": "get_arbitrum_tvl",
      "arguments": {},
      "result": {...}
    }
  ]
}
```

### Web Interface

Visit `http://localhost:3000` to access the built-in chat interface. This provides a simple way to test the MCP client functionality.

## Example Queries

Here are some example queries you can try:

- "What's the current TVL on Arbitrum?"
- "Show me the top DeFi protocols by TVL"
- "What's the latest transaction volume?"
- "Get information about USDC on Arbitrum"
- "Show me recent large transactions"

## Project Structure

```
src/
├── app.module.ts          # Main application module
├── app.controller.ts      # Health check controller
├── app.service.ts         # Basic app service
├── main.ts               # Application bootstrap
├── chat/                 # Chat functionality
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── dto/
│       └── chat.dto.ts
├── llm/                  # Hugging Face LLM integration
│   ├── llm.module.ts
│   └── llm.service.ts
├── mcp/                  # MCP client functionality
│   ├── mcp.module.ts
│   └── mcp.service.ts
└── scripts/              # Test and utility scripts
    ├── test-huggingface.ts
    ├── test-llm-service.ts
    ├── test-mcp-server.ts
    └── find-available-models.ts
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUGGINGFACE_API_KEY` | Your Hugging Face API key | Required |
| `HUGGINGFACE_MODEL` | Hugging Face model to use | `mistralai/Mistral-7B-Instruct-v0.3` |
| `PORT` | Server port | `3000` |
| `MCP_SERVER_BASE_URL` | Base URL of your Arbitrum MCP server | `https://arbitrummcpserver-production.up.railway.app` |
| `NODE_ENV` | Environment mode | `development` |
| `ANTHROPIC_API_KEY` | Legacy Anthropic key (kept for reference) | Optional |

### MCP Server Integration

The client automatically:
1. Initializes connection to your MCP server on startup
2. Discovers available tools via the `tools/list` method
3. Calls tools using the `tools/call` method with appropriate parameters
4. Handles errors and provides meaningful feedback

## Error Handling

The application includes comprehensive error handling:

- **MCP Server Connection**: Retries and meaningful error messages
- **Tool Execution**: Graceful handling of tool failures
- **Hugging Face API**: Proper error handling for API calls and model availability
- **Session Management**: Automatic cleanup of old sessions

## Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY public ./public
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Other Platforms

The application can be deployed to any Node.js hosting platform (Heroku, Vercel, AWS, etc.) by:
1. Setting the required environment variables
2. Running `npm run build` to create the production build
3. Starting the application with `npm run start:prod`

## Development

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# Test Hugging Face integration
npm run test:hf

# Test LLM service
npm run test:llm

# Test MCP server connection
npm run test:mcp

# Find available Hugging Face models
npm run find:models
```

### Linting and Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Troubleshooting

### Common Issues

1. **"HUGGINGFACE_API_KEY is not configured"**
   - Ensure your `.env` file contains a valid Hugging Face API key
   - Get your API key from: https://huggingface.co/settings/tokens

2. **"Model not available" or "No Inference Provider available"**
   - The selected model might not be available with your current Hugging Face account
   - Try a different model or upgrade your Hugging Face account
   - Check supported models at: https://huggingface.co/docs/api-inference/

3. **"Failed to initialize MCP client"**
   - Check that your MCP server is running and accessible
   - Verify the `MCP_SERVER_BASE_URL` is correct

4. **"Tool execution failed"**
   - Check the MCP server logs for errors
   - Ensure the tool parameters are correct

### Debug Mode

Run the application in debug mode to see detailed logs:

```bash
npm run start:debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the UNLICENSED license.
