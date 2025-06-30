import { Module } from '@nestjs/common';
import { PersonalityService } from './personality.service';
import { PersonalityController } from './personality.controller';

@Module({
    controllers: [PersonalityController],
    providers: [PersonalityService],
    exports: [PersonalityService],
})
export class PersonalityModule { }
