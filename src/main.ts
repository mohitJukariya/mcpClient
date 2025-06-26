import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cors from 'cors';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS for cross-origin requests
    app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
    }));

    // Global prefix for API routes
    app.setGlobalPrefix('api');

    const port = process.env.PORT || 3000;
    await app.listen(port);

    console.log(`🚀 MCP Client is running on: http://localhost:${port}`);
    console.log(`📊 Health check available at: http://localhost:${port}/api/health`);
    console.log(`🤖 Chat endpoint available at: http://localhost:${port}/api/chat`);
}

bootstrap();
