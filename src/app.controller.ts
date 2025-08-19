import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) { }

    @Get()
    getHello(): string {
        this.logger.log('Root endpoint accessed');
        return this.appService.getHello();
    }

    @Get('status')
    getStatus() {
        return {
            message: 'MCP Client API is running',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            endpoints: {
                health: '/api/health',
                chat: '/api/chat',
                analytics: '/api/analytics',
                embeddings: '/api/embeddings'
            }
        };
    }

    @Get('health')
    getHealth(): { status: string; timestamp: string } {
        return this.appService.getHealth();
    }
}
