import { Module } from '@nestjs/common';
import { CrawlController } from './crawl.controller';
import { CrawlService } from './crawl.service';
import { AiModule } from '../ai/ai.module';

/**
 * 自动采集模块（P1）：抓取 → LLM 抽取 → 候选复核队列。
 * 依赖 AiModule 导出的 LlmClient 做信息抽取。
 */
@Module({
  imports: [AiModule],
  controllers: [CrawlController],
  providers: [CrawlService],
})
export class CrawlModule {}
