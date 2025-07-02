import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KVCacheService } from './kv-cache.service';
import { CacheController } from './cache.controller';

@Module({
    imports: [ConfigModule],
    controllers: [CacheController],
    providers: [KVCacheService],
    exports: [KVCacheService],
})
export class CacheModule { }
