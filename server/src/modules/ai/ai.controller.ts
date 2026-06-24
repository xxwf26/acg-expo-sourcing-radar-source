import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService, type ChatMessage } from './ai.service';
import { ChatDto } from './ai.dto';

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

  /** 全局聊天助手（带全库快照，可多轮） */
  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    const history: ChatMessage[] = (dto.history ?? []).map((h) => ({ role: h.role, content: h.content }));
    return this.aiService.chat(dto.message, history);
  }

  /** 本周建议动作（AI 动态生成，按三类标注） */
  @Post('weekly-actions')
  async weeklyActions() {
    return this.aiService.weeklyActions();
  }
}

