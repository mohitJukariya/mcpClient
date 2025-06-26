import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface McpTool {
    name: string;
    description: string;
    inputSchema: any;
}

export interface McpRequest {
    jsonrpc: string;
    id: string | number;
    method: string;
    params?: any;
}

export interface McpResponse {
    jsonrpc: string;
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

@Injectable()
export class McpService {
    private readonly logger = new Logger(McpService.name);
    private readonly httpClient: AxiosInstance;
    private readonly mcpServerUrl: string;
    private tools: McpTool[] = [];
    private initialized = false;

    constructor(private configService: ConfigService) {
        this.mcpServerUrl = this.configService.get<string>('MCP_SERVER_BASE_URL', 'https://arbitrummcpserver-production.up.railway.app');

        this.httpClient = axios.create({
            baseURL: `${this.mcpServerUrl}/api`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Initialize MCP server
            const initRequest: McpRequest = {
                jsonrpc: '2.0',
                id: 'init',
                method: 'initialize',
            };

            const initResponse = await this.httpClient.post<McpResponse>('/mcp', initRequest);
            this.logger.log('MCP Server initialized:', initResponse.data.result);

            // List available tools
            await this.listTools();
            this.initialized = true;
            this.logger.log(`MCP Client initialized with ${this.tools.length} tools`);
        } catch (error) {
            this.logger.error('Failed to initialize MCP client:', error.message);
            throw error;
        }
    }

    async listTools(): Promise<McpTool[]> {
        try {
            const request: McpRequest = {
                jsonrpc: '2.0',
                id: 'list-tools',
                method: 'tools/list',
            };

            const response = await this.httpClient.post<McpResponse>('/mcp', request);

            if (response.data.error) {
                throw new Error(`MCP Error: ${response.data.error.message}`);
            }

            this.tools = response.data.result.tools || [];
            return this.tools;
        } catch (error) {
            this.logger.error('Failed to list tools:', error.message);
            throw error;
        }
    }

    async callTool(name: string, args: any): Promise<any> {
        try {
            const request: McpRequest = {
                jsonrpc: '2.0',
                id: `tool-${Date.now()}`,
                method: 'tools/call',
                params: {
                    name,
                    arguments: args,
                },
            };

            this.logger.log(`Calling tool: ${name} with args:`, args);
            const response = await this.httpClient.post<McpResponse>('/mcp', request);

            if (response.data.error) {
                throw new Error(`MCP Tool Error: ${response.data.error.message}`);
            }

            return response.data.result;
        } catch (error) {
            this.logger.error(`Failed to call tool ${name}:`, error.message);
            throw error;
        }
    }

    async getAvailableTools(): Promise<McpTool[]> {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.tools;
    }

    getTools(): McpTool[] {
        return this.tools;
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}
