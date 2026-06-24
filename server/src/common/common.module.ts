import { Global, Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter';

/** 全局共享 provider（RateLimiter 等跨模块通用能力） */
@Global()
@Module({
  providers: [RateLimiter],
  exports: [RateLimiter],
})
export class CommonModule {}
