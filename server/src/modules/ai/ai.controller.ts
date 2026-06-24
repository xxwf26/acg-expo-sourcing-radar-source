import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService, type ChatMessage } from './ai.service';
import { ChatDto } from './ai.dto';
import { RateLimiter } from '../../common/rate-limiter';

/**
 * AI 增强接口。
 * 复用 JwtAuthGuard（登录即可用，含 viewer）。
 * 调用走服务端，API Key 不暴露给前端；带每用户限流控成本。
 */
@Controller('/api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly limiter: RateLimiter,
  ) {}

  /** 每用户限流：超限抛 429 */
  private ensureLimit(req: any, max: number, windowMs: number) {
    const key = `ai:${req.user?.userId ?? 'anon'}`;
    if (!this.limiter.consume(key, max, windowMs)) {
      throw new HttpException(
        `AI 调用过于频繁，请稍后再试（限 ${max} 次/${windowMs / 1000}秒）`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 单对象采购总结 + 建议 */
  @Post('summary/entity/:id')
  async summarizeEntity(@Param('id') id: string, @Req() req: any) {
    this.ensureLimit(req, 20, 60_000); // 每用户 20 次/分钟
    return this.aiService.summarizeEntity(id);
  }

  /** 全局聊天助手（带全库快照，可多轮） */
  @Post('chat')
  async chat(@Body() dto: ChatDto, @Req() req: any) {
    this.ensureLimit(req, 20, 60_000);
    const history: ChatMessage[] = (dto.history ?? []).map((h) => ({ role: h.role, content: h.content }));
    return this.aiService.chat(dto.message, history);
  }

  /** 本周建议动作（AI 动态生成，按三类标注；后端 10 分钟 TTL 缓存） */
  @Post('weekly-actions')
  async weeklyActions(@Req() req: any) {
    this.ensureLimit(req, 10, 60_000);
    return this.aiService.weeklyActions();
  }
}
