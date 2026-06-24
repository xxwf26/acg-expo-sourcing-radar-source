import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { entities, engagements } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { LlmClient } from './llm.client';
import { buildEntitySummaryPrompt } from './prompts';

export interface AiSummaryResult {
  scenario: string;
  targetId: string;
  model: string;
  content: string;
  usage: Record<string, number>;
}

/**
 * AI 编排层：取数 → 组 prompt → 调用 LlmClient → 统一返回结构。
 * 取数直接查 Drizzle（EntityModule 未导出 EntityService，避免跨模块耦合）。
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly llm: LlmClient,
  ) {}

  /** 单对象采购总结 + 建议 */
  async summarizeEntity(id: string): Promise<AiSummaryResult> {
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY）');
    }
    const [entity] = await this.db.select().from(entities).where(eq(entities.id, id));
    if (!entity) throw new NotFoundException('对象不存在');

    const [engagement] = await this.db.select().from(engagements).where(eq(engagements.entityId, id));

    const { system, messages } = buildEntitySummaryPrompt({ entity, engagement: engagement ?? null });
    const result = await this.llm.chat(system, messages);

    return {
      scenario: 'entity-summary',
      targetId: id,
      model: result.model,
      content: result.content,
      usage: result.usage,
    };
  }
}
