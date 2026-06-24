import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

/**
 * AI 增强接口。
 * 复用 JwtAuthGuard（登录即可用，含 viewer）。
 * 调用走服务端，API Key 不暴露给前端。
 */
@Controller('/api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** 单对象采购总结 + 建议 */
  @Post('summary/entity/:id')
  async summarizeEntity(@Param('id') id: string) {
    return this.aiService.summarizeEntity(id);
  }
}
