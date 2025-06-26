# MCP Client - Arbitrum Analytics

A NestJS-based Model Context Protocol (MCP) client that connects to your Arbitrum MCP server and provides an intelligent chat interface powered by Claude 3.5 Sonnet.

## Features

- 🤖 **AI-Powered Chat**: Uses Claude 3.5 Sonnet to understand user queries and decide which tools to use
- 🔗 **HTTP Transport**: Connects to your MCP server over HTTP (no stdio needed)
- 🛠️ **Dynamic Tool Calling**: Automatically discovers and calls available tools from your Arbitrum MCP server
- 💬 **Session Management**: Maintains conversation context across multiple interactions
- 🌐 **Web Interface**: Includes a simple HTML chat interface for testing
- 📊 **Health Monitoring**: Built-in health check endpoint

## Architecture

```
Client App → NestJS MCP Client → Claude 3.5 → Tool Selection → Arbitrum MCP Server → Response
```

1. Client sends a natural language query
2. MCP Client processes the query using Claude 3.5 Sonnet
3. Claude determines which tools to use and their parameters
4. MCP Client calls the selected tools on your Arbitrum MCP server via HTTP
5. Results are processed by Claude to generate a natural language response
6. Final response is sent back to the client

## Setup

### Prerequisites

- Node.js 18+ and npm
- An Anthropic API key
- Your Arbitrum MCP server running (currently deployed at Railway)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy the `.env` file and update the values:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   PORT=3000
   MCP_SERVER_BASE_URL=https://arbitrummcpserver-production.up.railway.app
   NODE_ENV=development
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
└── mcp/                  # MCP client functionality
    ├── mcp.module.ts
    └── mcp.service.ts
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `PORT` | Server port | `3000` |
| `MCP_SERVER_BASE_URL` | Base URL of your Arbitrum MCP server | `https://arbitrummcpserver-production.up.railway.app` |
| `NODE_ENV` | Environment mode | `development` |

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
- **Claude API**: Proper error handling for API calls
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

1. **"ANTHROPIC_API_KEY is not configured"**
   - Ensure your `.env` file contains a valid Anthropic API key

2. **"Failed to initialize MCP client"**
   - Check that your MCP server is running and accessible
   - Verify the `MCP_SERVER_BASE_URL` is correct

3. **"Tool execution failed"**
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
