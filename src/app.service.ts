import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHealth(): { status: string; timestamp: string } {
        return {
            status: 'OK',
            timestamp: new Date().toISOString(),
        };
    }
}
