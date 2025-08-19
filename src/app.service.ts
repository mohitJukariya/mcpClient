import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): string {
        return 'MCP Client API is running! Visit /api/health for health status.';
    }

    getHealth(): { status: string; timestamp: string } {
        return {
            status: 'OK',
            timestamp: new Date().toISOString(),
        };
    }
}
