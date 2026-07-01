import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  OnModuleDestroy,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { sources, crawlRuns, candidates, entities, events, sourcingConfig } from '../../database/schema';
import { and, desc, eq, sql, isNull } from 'drizzle-orm';
import { LlmClient } from '../ai/llm.client';
import { fetchSource } from './fetcher';
import { closeBrowser } from './browser';
import { extractCandidates } from './extractor';
import { scoreCandidates } from './scorer';

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
      const { candidates: extracted, truncated, nextOffset, totalChunks } = await extractCandidates(this.llm, text, {
        sourceName: src.name,
        eventShort,
        startChunk: src.crawlOffset ?? 0,
      });

      // 3. 去重比对 + 落候选
      //   - 对已有正式对象：命中则标 dedupEntityId（复核时提示合并）
      //   - 对本源已有候选（任何状态）：直接跳过，避免续抓/重抓产生重复候选
      const existing = await this.db.select({ id: entities.id, name: entities.name }).from(entities);
      const existingByNorm = new Map(existing.map((e) => [normalizeName(e.name), e.id]));
      const priorCands = await this.db
        .select({ name: candidates.name })
        .from(candidates)
        .where(eq(candidates.sourceId, sourceId));
      const priorCandNorms = new Set(priorCands.map((c) => normalizeName(c.name)));
      const seenInBatch = new Set<string>();

      const rows = [];
      for (const c of extracted) {
        const norm = normalizeName(c.name);
        if (!norm || seenInBatch.has(norm) || priorCandNorms.has(norm)) continue;
        seenInBatch.add(norm);
        rows.push({
          id: crypto.randomUUID(),
          sourceId,
          crawlRunId: runId,
          eventId: src.eventId ?? null,
          name: c.name,
          type: c.type ?? 'creatorKol',
          region: c.region ?? null,
          booth: c.booth ?? null,
          activityTime: c.activityTime ?? null,
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

      // 4. 收尾：run ok + 推进 source.crawlOffset（断点续抓）
      const coveredTo = truncated ? nextOffset : totalChunks;
      const note = truncated
        ? `名单共 ${totalChunks} 段，本次抽到第 ${coveredTo} 段，再次抓取可继续后续`
        : totalChunks > 1
          ? `已覆盖全部 ${totalChunks} 段名单`
          : '';
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
      await this.db
        .update(sources)
        .set({ lastCrawledAt: new Date(), crawlOffset: nextOffset })
        .where(eq(sources.id, sourceId));
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

  /** 近期抓取批次列表（历史/进度视图用），带信息源名称 */
  async listRuns(limit = 30) {
    const runs = await this.db
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
      .orderBy(desc(crawlRuns.startedAt))
      .limit(limit);
    const srcMap = new Map((await this.db.select({ id: sources.id, name: sources.name }).from(sources)).map((s) => [s.id, s.name]));
    const list = runs.map((r) => ({ ...r, sourceName: srcMap.get(r.sourceId) ?? '(已删除的源)' }));
    return { list, total: list.length };
  }

  /**
   * 触发全部启用源。串行执行：建好所有 run 记录(running)并立即返回 runId，
   * 后台**一个抓完再抓下一个**，避免多源并发把 LLM 中转打爆(upstream 超时)。
   */
  async runAll() {
    const enabled = await this.db.select().from(sources).where(eq(sources.enabled, true));
    const jobs: { runId: string; src: typeof sources.$inferSelect }[] = [];
    for (const s of enabled) {
      if (!s.url) continue; // 未配 URL 的源跳过
      const runId = crypto.randomUUID();
      await this.db.insert(crawlRuns).values({ id: runId, sourceId: s.id, status: 'running' });
      jobs.push({ runId, src: s });
    }
    // 后台串行跑，不阻塞请求
    void (async () => {
      for (const j of jobs) {
        await this.executePipeline(j.runId, j.src).catch(() => {});
      }
    })();
    return { ran: jobs.length, runIds: jobs.map((j) => j.runId) };
  }

  /** 候选列表（默认只看 pending，按创建时间倒序） */
  async listCandidates(status = 'pending') {
    const where = status === 'all' ? undefined : eq(candidates.status, status);
    const list = await this.db
      .select()
      .from(candidates)
      .where(where as any)
      .orderBy(sql`${candidates.aiScore} IS NULL`, desc(candidates.aiScore), desc(candidates.createdAt));
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

  /**
   * 恢复到待复核。用于误丢弃/误合并的找回（软删除的反操作）。
   * 已转正(promoted)的不允许恢复——它已创建了正式对象，恢复语义不清，
   * 需先自行处理那个对象。
   */
  async restore(id: string, reviewer?: string) {
    const c = await this.getCandidate(id);
    if (c.status === 'promoted') {
      throw new BadRequestException('已转正的候选不能恢复（它已生成正式对象）；如需重做请先处理该对象');
    }
    if (c.status === 'pending') return { status: 'pending' as const };
    await this.db
      .update(candidates)
      .set({ status: 'pending', dedupEntityId: c.status === 'merged' ? null : c.dedupEntityId, reviewedBy: reviewer ?? null })
      .where(eq(candidates.id, id));
    return { status: 'pending' as const };
  }

  // ─────────────── P3-A：采购配置 + AI 匹配打分 ───────────────

  /** 读采购配置（单行 default，无则返回空配置） */
  async getConfig() {
    const [cfg] = await this.db.select().from(sourcingConfig).where(eq(sourcingConfig.id, 'default'));
    return cfg ?? { id: 'default', modules: [], benchmarks: [], scoringRubric: null };
  }

  /** 写采购配置（upsert 单行） */
  async updateConfig(data: { modules?: string[]; benchmarks?: string[]; scoringRubric?: string }, updatedBy?: string) {
    const existing = await this.db.select().from(sourcingConfig).where(eq(sourcingConfig.id, 'default'));
    const values = {
      modules: data.modules ?? [],
      benchmarks: data.benchmarks ?? [],
      scoringRubric: data.scoringRubric ?? null,
      updatedBy: updatedBy ?? null,
    };
    if (existing.length) {
      await this.db.update(sourcingConfig).set(values).where(eq(sourcingConfig.id, 'default'));
    } else {
      await this.db.insert(sourcingConfig).values({ id: 'default', ...values });
    }
    return this.getConfig();
  }

  /**
   * 给候选打匹配分。scope='pending-unscored' 只打待复核且未打分的；'all-pending' 重打所有待复核。
   * 用采购配置驱动；配置为空也能跑（按通用 ACG 判断）。
   */
  async scorePending(scope: 'pending-unscored' | 'all-pending' = 'pending-unscored') {
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY），无法打分');
    }
    const cfg = await this.getConfig();
    const conds = [eq(candidates.status, 'pending')];
    if (scope === 'pending-unscored') conds.push(isNull(candidates.aiScore));
    const rows = await this.db
      .select({ id: candidates.id, name: candidates.name, type: candidates.type, region: candidates.region, booth: candidates.booth, reason: candidates.reason, rawSnippet: candidates.rawSnippet })
      .from(candidates)
      .where(and(...conds));

    if (!rows.length) return { scored: 0, total: 0 };

    const results = await scoreCandidates(this.llm, cfg, rows);
    for (const r of results) {
      await this.db.update(candidates).set({ aiScore: r.score, aiReason: r.reason || null }).where(eq(candidates.id, r.id));
    }
    return { scored: results.length, total: rows.length };
  }
}
