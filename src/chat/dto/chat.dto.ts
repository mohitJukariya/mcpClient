import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatRequestDto {
    @IsString()
    @IsNotEmpty()
    message: string;

    @IsString()
    @IsOptional()
    sessionId?: string;

    @IsString()
    @IsOptional()
    userId?: string;

    @IsString()
    @IsOptional()
    personalityId?: string;
}

export class ChatResponseDto {
    response: string;
    sessionId: string;
    personalityId?: string;
    toolsUsed?: Array<{
        name: string;
        arguments: any;
        result: any;
    }>;
    metadata?: {
        fallback?: boolean;
        fallbackLevel?: 'none' | 'cached' | 'template' | 'emergency';
        confidence?: number;
        contextUsed?: boolean;
        contextCount?: number;
    };
}
