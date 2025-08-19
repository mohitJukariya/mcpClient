import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as cors from 'cors';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    try {
        const app = await NestFactory.create(AppModule, {
            logger: process.env.NODE_ENV === 'production'
                ? ['error', 'warn', 'log']
                : ['log', 'error', 'warn', 'debug'],
            abortOnError: false
        });

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
            forbidNonWhitelisted: true,
            disableErrorMessages: process.env.NODE_ENV === 'production',
        }));

        // Global prefix for API routes
        app.setGlobalPrefix('api');

        // Render requires binding to 0.0.0.0 and specific port handling
        const port = parseInt(process.env.PORT || '3000', 10);
        const host = '0.0.0.0'; // Always bind to 0.0.0.0 for Render compatibility

        // Add graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            logger.log(`${signal} received, shutting down gracefully`);
            try {
                await app.close();
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Bind to host and port for Render
        await app.listen(port, host);

        logger.log(`🚀 Application is running on ${host}:${port}`);
        logger.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.log(`🌐 Health check: http://${host}:${port}/api/health`);
        logger.log(`🤖 Chat endpoint: http://${host}:${port}/api/chat`);
        logger.log(`✅ Server ready - listening on port ${port}`);

        // Log port binding for Render debugging
        if (process.env.NODE_ENV === 'production') {
            logger.log(`🔌 Render deployment: Bound to ${host}:${port}`);
            logger.log(`📡 Health endpoint accessible at /api/health`);
        }

    } catch (error) {
        logger.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    const logger = new Logger('UnhandledRejection');
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in production, just log
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    const logger = new Logger('UncaughtException');
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

bootstrap();
