import { Controller, Get, Logger } from '@nestjs/common';

interface HealthResponse {
    status: string;
    timestamp: string;
    uptime: number;
    [key: string]: any;
}

@Controller('health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    @Get()
    getHealth(): HealthResponse {
        this.logger.log('Health check requested');
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3000,
            message: 'MCP Client is running successfully'
        };
    }

    @Get('ready')
    getReadiness() {
        return {
            status: 'ready',
            timestamp: new Date().toISOString(),
            services: {
                pinecone: process.env.PINECONE_API_KEY ? 'configured' : 'missing',
                huggingface: process.env.HUGGINGFACE_API_KEY ? 'configured' : 'missing',
                redis: process.env.REDIS_URL ? 'configured' : 'disabled',
                neo4j: process.env.NEO4J_URL ? 'configured' : 'disabled',
                mcp: process.env.MCP_SERVER_URL ? 'configured' : 'disabled'
            }
        };
    }

    @Get('live')
    getLiveness() {
        return {
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        };
    }

    @Get('ping')
    ping() {
        return {
            status: 'pong',
            timestamp: new Date().toISOString()
        };
    }
}
