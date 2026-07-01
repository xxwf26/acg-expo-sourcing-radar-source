import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  OnModuleDestroy,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { sources, crawlRuns, candidates, entities, events } from '../../database/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { LlmClient } from '../ai/llm.client';
import { fetchSource } from './fetcher';
import { closeBrowser } from './browser';
import { extractCandidates } from './extractor';

/** 名称规范化：用于候选与已有 entities 去重比对 */
function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\-_.|·•,，、@]/g, '')
    .trim();
}

@Injectable()
export class CrawlService implements OnModuleDestroy {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly llm: LlmClient,
  ) {}

  /** 进程/模块销毁时关闭无头浏览器，避免残留 chromium 进程 */
  async onModuleDestroy() {
    await closeBrowser();
  }

  /**
   * 触发单个信息源抓取：抓取 → 存 crawl_runs → LLM 抽取 → 去重 → 写 candidates。
   * 触发抓取：**异步**。立即建 run 记录并返回 runId（status=running），
   * 真正的抓取+抽取在后台跑（长名单可能几分钟），前端轮询 run 状态获取结果。
   * 这样避免 HTTP 长连接超时，也不阻塞请求线程。
   */
  async runSource(sourceId: string) {
    const [src] = await this.db.select().from(sources).where(eq(sources.id, sourceId));
    if (!src) throw new NotFoundException('信息源不存在');
    if (!src.url) throw new BadRequestException('该信息源未配置抓取 URL');
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY），无法抽取候选');
    }

    // 建 run 记录（running）
    const runId = crypto.randomUUID();
    await this.db.insert(crawlRuns).values({ id: runId, sourceId, status: 'running' });

    // 后台执行，不 await；失败已在 pipeline 内落库
    void this.executePipeline(runId, src).catch(() => {});

    return { runId, status: 'running' as const };
  }

  /** 后台抓取管线：抓取 → 抽取 → 去重 → 落候选。结果写回 crawl_runs。 */
  private async executePipeline(runId: string, src: typeof sources.$inferSelect) {
    const sourceId = src.id;
    try {
      // 1. 抓取
      const { text, bytes } = await fetchSource({
        url: src.url!,
        strategy: src.strategy,
        selector: src.selector,
      });
      if (!text || text.trim().length < 20) {
        const hint =
          src.strategy === 'browser'
            ? '渲染后内容仍过少，可能需要配置等待选择器(selector)或该站有反爬'
            : '抓取内容过少，可能是 JS 渲染页——试试把抓取策略改为 browser(无头浏览器)';
        throw new Error(`${hint}（${bytes} 字节）`);
      }

      // 2. LLM 抽取
      let eventShort: string | undefined;
      if (src.eventId) {
        const [ev] = await this.db.select().from(events).where(eq(events.id, src.eventId));
        eventShort = ev?.short;
      }
      const { candidates: extracted, truncated } = await extractCandidates(this.llm, text, {
        sourceName: src.name,
        eventShort,
      });

      // 3. 去重比对 + 落候选
      const existing = await this.db.select({ id: entities.id, name: entities.name }).from(entities);
      const existingByNorm = new Map(existing.map((e) => [normalizeName(e.name), e.id]));
      const seenInBatch = new Set<string>();

      const rows = [];
      for (const c of extracted) {
        const norm = normalizeName(c.name);
        if (!norm || seenInBatch.has(norm)) continue;
        seenInBatch.add(norm);
        rows.push({
          id: crypto.randomUUID(),
          sourceId,
          crawlRunId: runId,
          eventId: src.eventId ?? null,
          name: c.name,
          type: c.type ?? 'creatorKol',
          region: c.region ?? src.eventId ?? null,
          booth: c.booth ?? null,
          followerScale: c.followerScale ?? null,
          reason: c.reason ?? null,
          rawSnippet: c.rawSnippet ?? null,
          dedupEntityId: existingByNorm.get(norm) ?? null,
          status: 'pending' as const,
        });
      }

      if (rows.length) {
        await this.db.insert(candidates).values(rows as any);
      }

      // 4. 收尾：run ok + 更新 source.lastCrawledAt
      const note = truncated ? '（名单过长，本次只抽取了前一部分，可再次抓取继续）' : '';
      await this.db
        .update(crawlRuns)
        .set({
          status: 'ok',
          rawText: text.slice(0, 60000),
          extractedCount: rows.length,
          error: note || null,
          finishedAt: new Date(),
        })
        .where(eq(crawlRuns.id, runId));
      await this.db.update(sources).set({ lastCrawledAt: new Date() }).where(eq(sources.id, sourceId));
    } catch (e: any) {
      await this.db
        .update(crawlRuns)
        .set({ status: 'failed', error: String(e?.message ?? e).slice(0, 1000), finishedAt: new Date() })
        .where(eq(crawlRuns.id, runId));
    }
  }

  /** 查 run 状态（前端轮询用） */
  async getRun(runId: string) {
    const [run] = await this.db
      .select({
        id: crawlRuns.id,
        sourceId: crawlRuns.sourceId,
        status: crawlRuns.status,
        extractedCount: crawlRuns.extractedCount,
        error: crawlRuns.error,
        startedAt: crawlRuns.startedAt,
        finishedAt: crawlRuns.finishedAt,
      })
      .from(crawlRuns)
      .where(eq(crawlRuns.id, runId));
    if (!run) throw new NotFoundException('抓取记录不存在');
    return run;
  }

  /** 触发全部启用源（各自异步后台跑） */
  async runAll() {
    const enabled = await this.db.select().from(sources).where(eq(sources.enabled, true));
    const runIds: string[] = [];
    for (const s of enabled) {
      const { runId } = await this.runSource(s.id);
      runIds.push(runId);
    }
    return { ran: runIds.length, runIds };
  }

  /** 候选列表（默认只看 pending，按创建时间倒序） */
  async listCandidates(status = 'pending') {
    const where = status === 'all' ? undefined : eq(candidates.status, status);
    const list = await this.db
      .select()
      .from(candidates)
      .where(where as any)
      .orderBy(desc(candidates.createdAt));
    return { list, total: list.length };
  }

  /** 各状态计数，供前端 tab 角标 */
  async counts() {
    const rows = await this.db
      .select({ status: candidates.status, n: sql<number>`count(*)` })
      .from(candidates)
      .groupBy(candidates.status);
    const out: Record<string, number> = { pending: 0, promoted: 0, merged: 0, rejected: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }

  private async getCandidate(id: string) {
    const [c] = await this.db.select().from(candidates).where(eq(candidates.id, id));
    if (!c) throw new NotFoundException('候选不存在');
    return c;
  }

  /**
   * 转正：候选 → 新建 entities 记录。
   * patch 允许复核人转正前修正字段（name/type/priority/region/booth/angles/reason 等）。
   */
  async promote(id: string, patch: Record<string, any>, reviewer?: string) {
    const c = await this.getCandidate(id);
    if (c.status !== 'pending') throw new BadRequestException('该候选已处理');

    const entityId = crypto.randomUUID();
    const merged = {
      id: entityId,
      name: patch.name ?? c.name,
      type: patch.type ?? c.type ?? 'creatorKol',
      priority: patch.priority ?? 'B',
      score: patch.score ?? 60,
      events: c.eventId ? [c.eventId] : (patch.events ?? []),
      region: patch.region ?? c.region ?? null,
      booth: patch.booth ?? c.booth ?? null,
      followerScale: patch.followerScale ?? c.followerScale ?? null,
      tags: patch.tags ?? [],
      angles: patch.angles ?? [],
      reason: patch.reason ?? c.reason ?? null,
      links: c.links ?? [],
      excluded: false,
    };
    await this.db.insert(entities).values(merged as any);
    await this.db
      .update(candidates)
      .set({ status: 'promoted', reviewedBy: reviewer ?? null })
      .where(eq(candidates.id, id));
    return { entityId, status: 'promoted' as const };
  }

  /** 合并到已有对象（仅标记候选 merged，不覆盖已有数据，避免误伤复核过的对象） */
  async merge(id: string, targetEntityId: string, reviewer?: string) {
    await this.getCandidate(id);
    const [target] = await this.db.select().from(entities).where(eq(entities.id, targetEntityId));
    if (!target) throw new NotFoundException('目标对象不存在');
    await this.db
      .update(candidates)
      .set({ status: 'merged', dedupEntityId: targetEntityId, reviewedBy: reviewer ?? null })
      .where(eq(candidates.id, id));
    return { mergedInto: targetEntityId, status: 'merged' as const };
  }

  /** 丢弃 */
  async reject(id: string, reviewer?: string) {
    await this.getCandidate(id);
    await this.db
      .update(candidates)
      .set({ status: 'rejected', reviewedBy: reviewer ?? null })
      .where(eq(candidates.id, id));
    return { status: 'rejected' as const };
  }
}
