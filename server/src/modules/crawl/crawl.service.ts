import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { sources, crawlRuns, candidates, entities, events, sourcingConfig } from '../../database/schema';
import { and, desc, eq, sql, isNull, inArray, gte, lte } from 'drizzle-orm';
import { LlmClient } from '../ai/llm.client';
import { fetchSource } from './fetcher';
import { closeBrowser } from './browser';
import { extractCandidates } from './extractor';
import { scoreCandidates } from './scorer';
import { normalizeName } from './normalize';

/** 按字节截断（MySQL TEXT 列上限 64KB，中文 UTF-8 3 字节/字，按字符截断会溢出） */
function truncateBytes(s: string, maxBytes: number): string {
  const buf = Buffer.from(s || '', 'utf8');
  if (buf.length <= maxBytes) return s || '';
  // subarray 可能切断多字节字符 → toString 会补 �，去掉尾部残缺
  return buf.subarray(0, maxBytes).toString('utf8').replace(/�+$/, '');
}

@Injectable()
export class CrawlService implements OnModuleDestroy {
  private readonly logger = new Logger('CrawlService');

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly llm: LlmClient,
    private readonly config: ConfigService,
  ) {}

  /** 进程/模块销毁时关闭无头浏览器，避免残留 chromium 进程 */
  async onModuleDestroy() {
    await closeBrowser();
  }

  /**
   * 每周定时自动重爬所有启用源（会议纪要「数据每周重新爬取」）。
   * 默认关闭，需在 .env 设 CRAWL_WEEKLY_ENABLED=true 才启用——避免无人值守时
   * 突然产生大量抓取/LLM 调用。每周一凌晨 3 点跑，复用 runAll 的串行逻辑。
   */
  @Cron('0 3 * * 1')
  async weeklyAutoCrawl() {
    if (this.config.get<string>('CRAWL_WEEKLY_ENABLED') !== 'true') return;
    if (!this.llm.available) {
      this.logger.warn('每周自动抓取跳过：AI 未配置');
      return;
    }
    this.logger.log('每周自动抓取开始…');
    try {
      const res = await this.runAll();
      this.logger.log(`每周自动抓取已触发 ${res.ran} 个源`);
    } catch (e: any) {
      this.logger.error(`每周自动抓取失败：${e?.message ?? e}`);
    }
  }

  /**
   * 触发单个信息源抓取：抓取 → 存 crawl_runs → LLM 抽取 → 去重 → 写 candidates。
   * 触发抓取：**异步**。立即建 run 记录并返回 runId（status=running），
   * 真正的抓取+抽取在后台跑（长名单可能几分钟），前端轮询 run 状态获取结果。
   * 这样避免 HTTP 长连接超时，也不阻塞请求线程。
   */
  /** 同源是否已有进行中的抓取（防并发重复触发，避免重复候选 + 烧 LLM/浏览器） */
  private async hasRunningRun(sourceId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: crawlRuns.id })
      .from(crawlRuns)
      .where(and(eq(crawlRuns.sourceId, sourceId), eq(crawlRuns.status, 'running')))
      .limit(1);
    return rows.length > 0;
  }

  async runSource(sourceId: string) {
    const [src] = await this.db.select().from(sources).where(eq(sources.id, sourceId));
    if (!src) throw new NotFoundException('信息源不存在');
    if (!src.url) throw new BadRequestException('该信息源未配置抓取 URL');
    if (!this.llm.available) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY），无法抽取候选');
    }
    if (await this.hasRunningRun(sourceId)) {
      throw new BadRequestException('该信息源正在抓取中，请等当前批次完成后再触发');
    }

    // 建 run 记录（running）
    const runId = crypto.randomUUID();
    await this.db.insert(crawlRuns).values({ id: runId, sourceId, status: 'running' });

    // 后台执行，不 await；异常落日志（pipeline 内已把失败写回 run，此处兜底）
    void this.executePipeline(runId, src).catch((e) => {
      this.logger.error(`抓取管线异常(run=${runId})：${e?.message ?? e}`);
    });

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

      const rows: any[] = [];
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
          // 抽到作品主页则存为可点链接（与 entities.links 同结构 [label,url][]）
          links: c.website ? [['作品主页', c.website] as [string, string]] : null,
          reason: c.reason ?? null,
          rawSnippet: c.rawSnippet ?? null,
          dedupEntityId: existingByNorm.get(norm) ?? null,
          status: 'pending' as const,
        });
      }

      // 4. 收尾：候选入库 + run ok + 推进 source.crawlOffset，同一事务保证一致性
      const coveredTo = truncated ? nextOffset : totalChunks;
      const note = truncated
        ? `名单共 ${totalChunks} 段，本次抽到第 ${coveredTo} 段，再次抓取可继续后续`
        : totalChunks > 1
          ? `已覆盖全部 ${totalChunks} 段名单`
          : '';
      await this.db.transaction(async (tx) => {
        if (rows.length) {
          await tx.insert(candidates).values(rows as any);
        }
        await tx
          .update(crawlRuns)
          .set({
            status: 'ok',
            rawText: truncateBytes(text, 60000),
            extractedCount: rows.length,
            error: note || null,
            finishedAt: new Date(),
          })
          .where(eq(crawlRuns.id, runId));
        await tx
          .update(sources)
          .set({ lastCrawledAt: new Date(), crawlOffset: nextOffset })
          .where(eq(sources.id, sourceId));
      });
    } catch (e: any) {
      this.logger.error(`抓取失败(run=${runId}, source=${sourceId})：${e?.message ?? e}`);
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
    // 只查本批 runs 涉及的 source，避免全表扫描
    const sourceIds = [...new Set(runs.map((r) => r.sourceId))];
    const srcRows = sourceIds.length
      ? await this.db.select({ id: sources.id, name: sources.name }).from(sources).where(inArray(sources.id, sourceIds))
      : [];
    const srcMap = new Map(srcRows.map((s) => [s.id, s.name]));
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
      if (await this.hasRunningRun(s.id)) continue; // 已在抓取中的源跳过，防并发
      const runId = crypto.randomUUID();
      await this.db.insert(crawlRuns).values({ id: runId, sourceId: s.id, status: 'running' });
      jobs.push({ runId, src: s });
    }
    // 后台串行跑，不阻塞请求
    void (async () => {
      for (const j of jobs) {
        await this.executePipeline(j.runId, j.src).catch((e) => {
          this.logger.error(`抓取管线异常(run=${j.runId})：${e?.message ?? e}`);
        });
      }
    })();
    return { ran: jobs.length, runIds: jobs.map((j) => j.runId) };
  }

  /** 候选列表（默认只看 pending，已打分优先、按分降序，未打分按时间） */
  async listCandidates(status = 'pending', limit = 500, offset = 0) {
    // 校验 status，非法值回退 pending，避免静默返回空列表
    const VALID = ['pending', 'promoted', 'merged', 'rejected', 'all'];
    const st = VALID.includes(status) ? status : 'pending';
    const where = st === 'all' ? undefined : eq(candidates.status, st);
    const list = await this.db
      .select()
      .from(candidates)
      .where(where as any)
      .orderBy(sql`${candidates.aiScore} IS NULL`, desc(candidates.aiScore), desc(candidates.createdAt))
      .limit(limit)
      .offset(offset);
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
      score: patch.score ?? c.aiScore ?? 60,
      // 复核人显式传的 events 优先；否则用候选归属的展会
      events: patch.events ?? (c.eventId ? [c.eventId] : []),
      region: patch.region ?? c.region ?? null,
      booth: patch.booth ?? c.booth ?? null,
      followerScale: patch.followerScale ?? c.followerScale ?? null,
      tags: patch.tags ?? [],
      angles: patch.angles ?? [],
      reason: patch.reason ?? c.reason ?? null,
      links: c.links ?? [],
      excluded: false,
    };
    await this.db.transaction(async (tx) => {
      await tx.insert(entities).values(merged as any);
      await tx
        .update(candidates)
        .set({ status: 'promoted', reviewedBy: reviewer ?? null })
        .where(eq(candidates.id, id));
    });
    return { entityId, status: 'promoted' as const };
  }

  /**
   * 合并到已有对象：标记候选 merged，并把候选的**缺失字段补充**进目标对象
   * （只填目标为空的字段，不覆盖已复核过的非空值）。links 做并集去重。
   */
  async merge(id: string, targetEntityId: string, reviewer?: string) {
    const c = await this.getCandidate(id);
    const [target] = await this.db.select().from(entities).where(eq(entities.id, targetEntityId));
    if (!target) throw new NotFoundException('目标对象不存在');

    // 补充：仅当目标该字段为空时才用候选值填入
    const patch: Record<string, any> = {};
    if (!target.region && c.region) patch.region = c.region;
    if (!target.booth && c.booth) patch.booth = c.booth;
    if (!target.followerScale && c.followerScale) patch.followerScale = c.followerScale;

    // links 并集去重（按 url）
    const candLinks = (c.links ?? []) as [string, string][];
    if (candLinks.length) {
      const existLinks = (target.links ?? []) as [string, string][];
      const seenUrls = new Set(existLinks.map(([, u]) => u));
      const add = candLinks.filter(([, u]) => u && !seenUrls.has(u));
      if (add.length) patch.links = [...existLinks, ...add];
    }
    // 候选归属展会若目标未包含则补入
    if (c.eventId) {
      const evs = (target.events ?? []) as string[];
      if (!evs.includes(c.eventId)) patch.events = [...evs, c.eventId];
    }

    const enriched = Object.keys(patch).length;
    await this.db.transaction(async (tx) => {
      if (enriched) {
        await tx.update(entities).set(patch).where(eq(entities.id, targetEntityId));
      }
      await tx
        .update(candidates)
        .set({ status: 'merged', dedupEntityId: targetEntityId, reviewedBy: reviewer ?? null })
        .where(eq(candidates.id, id));
    });
    return { mergedInto: targetEntityId, status: 'merged' as const, enrichedFields: Object.keys(patch) };
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
   * 批量处理待复核候选。
   * - action='promote'：逐条转正（各自建 entity）
   * - action='reject'：批量丢弃
   * 目标可为显式 ids，或按分数阈值（minScore/maxScore，含边界）筛选 pending。
   * 转正串行（每条要 insert entity），丢弃可一次 update。
   */
  async batch(
    action: 'promote' | 'reject',
    opts: { ids?: string[]; minScore?: number; maxScore?: number },
    reviewer?: string,
  ) {
    // 解析目标候选（限 pending）
    let targets: { id: string }[];
    if (opts.ids && opts.ids.length) {
      targets = await this.db
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(eq(candidates.status, 'pending'), inArray(candidates.id, opts.ids)));
    } else {
      const conds = [eq(candidates.status, 'pending')];
      if (typeof opts.minScore === 'number') conds.push(gte(candidates.aiScore, opts.minScore));
      if (typeof opts.maxScore === 'number') conds.push(lte(candidates.aiScore, opts.maxScore));
      targets = await this.db.select({ id: candidates.id }).from(candidates).where(and(...conds));
    }
    if (!targets.length) return { action, affected: 0 };

    if (action === 'reject') {
      await this.db
        .update(candidates)
        .set({ status: 'rejected', reviewedBy: reviewer ?? null })
        .where(inArray(candidates.id, targets.map((t) => t.id)));
      return { action, affected: targets.length };
    }
    // promote：逐条走 promote（无 patch，用候选原值 + aiScore）
    let ok = 0;
    for (const t of targets) {
      try {
        await this.promote(t.id, {}, reviewer);
        ok += 1;
      } catch {
        // 单条失败跳过，不中断整批
      }
    }
    return { action, affected: ok };
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

  /** 写采购配置（upsert 单行，原子） */
  async updateConfig(data: { modules?: string[]; benchmarks?: string[]; scoringRubric?: string }, updatedBy?: string) {
    const values = {
      modules: data.modules ?? [],
      benchmarks: data.benchmarks ?? [],
      scoringRubric: data.scoringRubric ?? null,
      updatedBy: updatedBy ?? null,
    };
    await this.db
      .insert(sourcingConfig)
      .values({ id: 'default', ...values })
      .onDuplicateKeyUpdate({ set: values });
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
    // 并发批量回写（每批 5 条），避免逐条 N 次 DB 往返
    const WRITE_BATCH = 5;
    for (let i = 0; i < results.length; i += WRITE_BATCH) {
      await Promise.all(
        results.slice(i, i + WRITE_BATCH).map((r) =>
          this.db
            .update(candidates)
            .set({ aiScore: r.score, aiReason: r.reason || null })
            .where(eq(candidates.id, r.id)),
        ),
      );
    }
    if (results.length < rows.length) {
      this.logger.warn(`打分部分失败：共 ${rows.length} 条，成功 ${results.length} 条`);
    }
    return { scored: results.length, total: rows.length };
  }
}
