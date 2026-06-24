import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { entities, engagements, events, sources } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { LlmClient } from './llm.client';
import { buildEntitySummaryPrompt, buildChatPrompt, buildWeeklyActionsPrompt } from './prompts';

export interface AiSummaryResult {
  scenario: string;
  targetId: string;
  model: string;
  content: string;
  usage: Record<string, number>;
}

export interface AiChatResult {
  scenario: string;
  model: string;
  content: string;
  usage: Record<string, number>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 清洗聊天历史，保证符合 Anthropic Messages 约定：
 * - 必须 user 开头（localStorage 截断可能把开头截成 assistant 开头）
 * - user/assistant 严格交替（丢弃连续同角色或非法角色的项）
 * - 丢弃空内容
 */
function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  const cleaned = (history ?? []).filter(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim(),
  );
  // 丢弃开头非 user 的消息，直到遇到 user
  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }
  // 严格交替：遇到连续同角色则跳过
  const result: ChatMessage[] = [];
  let expect: 'user' | 'assistant' = 'user';
  for (const m of cleaned) {
    if (m.role === expect) {
      result.push(m);
      expect = expect === 'user' ? 'assistant' : 'user';
    }
    // 不符合预期的角色直接丢弃，保持后续交替
  }
  // 末尾若停留在 user（等 assistant 回复但没存上），补一个空 assistant 占位避免末尾 user+新 user 连续
  if (result.length > 0 && result[result.length - 1].role === 'user') {
    result.push({ role: 'assistant', content: '（未收到回复）' });
  }
  return result;
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

  /** 全局聊天助手（带全库快照，可多轮） */
  async chat(message: string, history: ChatMessage[]): Promise<AiChatResult> {
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY）');
    }
    const snapshot = await this.buildDbSnapshot();
    const safeHistory = sanitizeHistory(history);
    const { system, messages } = buildChatPrompt({ snapshot, message, history: safeHistory });
    const result = await this.llm.chat(system, messages);
    return {
      scenario: 'chat',
      model: result.model,
      content: result.content,
      usage: result.usage,
    };
  }

  /** 本周建议动作（AI 动态生成，按 数据判定/规范/AI建议 三类标注） */
  async weeklyActions(): Promise<AiChatResult> {
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY）');
    }
    const snapshot = await this.buildDbSnapshot();
    const { system, messages } = buildWeeklyActionsPrompt(snapshot);
    const result = await this.llm.chat(system, messages);
    return {
      scenario: 'weekly-actions',
      model: result.model,
      content: result.content,
      usage: result.usage,
    };
  }

  /** 全库快照：喂给聊天的上下文（控制字段粒度，避免 token 爆炸） */
  private async buildDbSnapshot(): Promise<Record<string, any>> {
    const allEvents = await this.db
      .select({
        id: events.id,
        name: events.name,
        short: events.short,
        month: events.month,
        city: events.city,
        status: events.status,
      })
      .from(events);

    const activeEntities = await this.db
      .select()
      .from(entities)
      .where(eq(entities.excluded, false))
      .orderBy(desc(entities.score));

    const allEngagements = await this.db.select().from(engagements);
    const engByEntity = new Map(allEngagements.map((e) => [e.entityId, e]));

    const allSources = await this.db.select({
      id: sources.id,
      name: sources.name,
      cadence: sources.cadence,
    }).from(sources);

    // 建联状态分布
    const statusDist: Record<string, number> = {};
    for (const e of allEngagements) {
      const k = e.status || '待评估';
      statusDist[k] = (statusDist[k] || 0) + 1;
    }

    // 对象按优先级分布
    const priorityDist: Record<string, number> = {};
    for (const e of activeEntities) {
      const k = e.priority || '?';
      priorityDist[k] = (priorityDist[k] || 0) + 1;
    }

    const eventShort = (id: string) => allEvents.find((e) => e.id === id)?.short || id;

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        events: allEvents.length,
        activeEntities: activeEntities.length,
        engagements: allEngagements.length,
        sources: allSources.length,
      },
      events: allEvents.map((e) => ({
        id: e.id,
        name: e.name,
        short: e.short,
        month: e.month,
        city: e.city,
        status: e.status,
      })),
      entities: activeEntities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        priority: e.priority,
        score: e.score,
        region: e.region,
        angles: e.angles ?? [],
        events: (e.events ?? []).map(eventShort),
        engagement: engByEntity.get(e.id)
          ? {
              status: engByEntity.get(e.id)!.status,
              owner: engByEntity.get(e.id)!.owner,
            }
          : null,
      })),
      engagementStatusDist: statusDist,
      priorityDist,
      sources: allSources,
    };
  }
}

