import { Controller, Get, Param, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PersonalityService, UserPersonality } from './personality.service';

@Controller('personalities')
export class PersonalityController {
    private readonly logger = new Logger(PersonalityController.name);

    constructor(private readonly personalityService: PersonalityService) { }

    @Get()
    async getAllPersonalities(): Promise<{
        success: boolean;
        personalities: UserPersonality[];
        count: number;
    }> {
        try {
            const personalities = this.personalityService.getAllPersonalities();

            this.logger.log(`Retrieved ${personalities.length} personalities`);

            return {
                success: true,
                personalities,
                count: personalities.length
            };
        } catch (error) {
            this.logger.error('Error retrieving personalities:', error);
            throw new HttpException(
                'Failed to retrieve personalities',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':id')
    async getPersonality(@Param('id') id: string): Promise<{
        success: boolean;
        personality: UserPersonality | null;
    }> {
        try {
            const personality = this.personalityService.getPersonality(id);

            if (!personality) {
                this.logger.warn(`Personality '${id}' not found`);
                throw new HttpException(
                    `Personality '${id}' not found`,
                    HttpStatus.NOT_FOUND
                );
            }

            this.logger.log(`Retrieved personality: ${personality.name}`);

            return {
                success: true,
                personality
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(`Error retrieving personality '${id}':`, error);
            throw new HttpException(
                'Failed to retrieve personality',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':id/context')
    async getPersonalityContext(@Param('id') id: string): Promise<{
        success: boolean;
        context: string;
        preferredTools: string[];
    }> {
        try {
            const personality = this.personalityService.getPersonality(id);

            if (!personality) {
                this.logger.warn(`Personality '${id}' not found for context request`);
                throw new HttpException(
                    `Personality '${id}' not found`,
                    HttpStatus.NOT_FOUND
                );
            }

            return {
                success: true,
                context: personality.initialContext,
                preferredTools: personality.preferredTools
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(`Error retrieving context for personality '${id}':`, error);
            throw new HttpException(
                'Failed to retrieve personality context',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
