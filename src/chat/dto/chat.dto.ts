import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatRequestDto {
    @IsString()
    @IsNotEmpty()
    message: string;

    @IsString()
    @IsOptional()
    sessionId?: string;
}

export class ChatResponseDto {
    response: string;
    sessionId: string;
    toolsUsed?: Array<{
        name: string;
        arguments: any;
        result: any;
    }>;
}
