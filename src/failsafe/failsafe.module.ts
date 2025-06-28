import { Module } from '@nestjs/common';
import { FailsafeQAService } from './failsafe-qa.service';
import { FailsafeController } from './failsafe.controller';

@Module({
  providers: [FailsafeQAService],
  controllers: [FailsafeController],
  exports: [FailsafeQAService],
})
export class FailsafeModule { }
