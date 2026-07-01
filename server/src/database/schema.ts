import { mysqlTable, varchar, text, int, boolean, timestamp, json, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/** [label, url] 链接对 */
export type LinkPair = [string, string];

/** 视觉预览入口 */
export type Visual = { title: string; caption: string; url: string };

/** 展会主表 */
export const events = mysqlTable(
  'events',
  {
    // 用原始业务 id（如 ax2026）作主键
    id: varchar('id', { length: 64 }).notNull().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    short: varchar('short', { length: 32 }).notNull(),
    date: varchar('date', { length: 128 }),
    month: varchar('month', { length: 32 }),
    city: varchar('city', { length: 128 }),
    region: varchar('region', { length: 64 }),
    venue: varchar('venue', { length: 255 }),
    status: varchar('status', { length: 64 }),
    tags: json('tags').$type<string[]>(),
    note: text('note'),
    links: json('links').$type<LinkPair[]>(),
    sortOrder: int('sort_order').default(0),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    idxRegion: index('idx_event_region').on(table.region),
  }),
);

/** 建联对象主表 */
export const entities = mysqlTable(
  'entities',
  {
    id: varchar('id', { length: 64 }).notNull().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    // master | creatorKol | supplier | platform
    type: varchar('type', { length: 32 }).notNull(),
    // S | A | B
    priority: varchar('priority', { length: 8 }).notNull(),
    score: int('score').default(0),
    /** 关联展会 id 列表 */
    events: json('events').$type<string[]>(),
    region: varchar('region', { length: 128 }),
    booth: varchar('booth', { length: 255 }),
    followerScale: varchar('follower_scale', { length: 255 }),
    followerTier: varchar('follower_tier', { length: 255 }),
    followerNote: text('follower_note'),
    tags: json('tags').$type<string[]>(),
    /** 采购视角：女性向 / 服饰 / 周边 / 现场 / 美术 */
    angles: json('angles').$type<string[]>(),
    reason: text('reason'),
    cases: json('cases').$type<string[]>(),
    visuals: json('visuals').$type<Visual[]>(),
    links: json('links').$type<LinkPair[]>(),
    /** 取代原 excludedEntityIds：true 表示非营销采购窗口，默认列表不展示 */
    excluded: boolean('excluded').default(false).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    idxType: index('idx_entity_type').on(table.type),
    idxPriority: index('idx_entity_priority').on(table.priority),
    idxExcluded: index('idx_entity_excluded').on(table.excluded),
  }),
);

/** 信息源监控入口 */
export const sources = mysqlTable('sources', {
  id: varchar('id', { length: 64 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  cadence: varchar('cadence', { length: 255 }),
  fields: varchar('fields', { length: 255 }),
  links: json('links').$type<LinkPair[]>(),
  sortOrder: int('sort_order').default(0),
  // ── 以下为「自动采集」扩展字段（P1）：让信息源从展示入口升级为可执行抓取配置 ──
  /** 抓取入口 URL（名单页，非展会首页） */
  url: varchar('url', { length: 1024 }),
  /** 抓取策略：static(纯HTML/cheerio) | browser(无头浏览器,P2) | pdf(P2) */
  strategy: varchar('strategy', { length: 32 }).default('static'),
  /** 可选：CSS 选择器，缩小喂给 LLM 的正文范围，控 token */
  selector: text('selector'),
  /** 归属展会 id（抽出的候选默认挂到该展会） */
  eventId: varchar('event_id', { length: 64 }),
  /** 是否纳入抓取（false 则仅作展示，不抓） */
  enabled: boolean('enabled').default(false).notNull(),
  /** 断点续抓：已覆盖到名单第几段（chunk），下次从这里继续；抽完回绕到 0 */
  crawlOffset: int('crawl_offset').default(0).notNull(),
  lastCrawledAt: timestamp('last_crawled_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/** 抓取批次：每次抓取一条，存原始产物，可追溯/重跑（抓取层与抽取层解耦） */
export const crawlRuns = mysqlTable(
  'crawl_runs',
  {
    id: varchar('id', { length: 64 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    // running | ok | failed
    status: varchar('status', { length: 16 }).default('running').notNull(),
    /** 抓回并清洗后的文本（喂给 LLM 的原料） */
    rawText: text('raw_text'),
    /** 本次抽出多少候选 */
    extractedCount: int('extracted_count').default(0),
    error: text('error'),
    startedAt: timestamp('started_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    finishedAt: timestamp('finished_at'),
  },
  (table) => ({
    idxSource: index('idx_crawlrun_source').on(table.sourceId),
  }),
);

/** 候选复核队列（核心中间层）：抓取+抽取产物，人工复核后才转正为 entities */
export const candidates = mysqlTable(
  'candidates',
  {
    id: varchar('id', { length: 64 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: varchar('source_id', { length: 64 }),
    crawlRunId: varchar('crawl_run_id', { length: 64 }),
    eventId: varchar('event_id', { length: 64 }),
    name: varchar('name', { length: 255 }).notNull(),
    // master | creatorKol | supplier | platform（与 entities.type 一致；抽不准时默认 creatorKol）
    type: varchar('type', { length: 32 }).default('creatorKol').notNull(),
    region: varchar('region', { length: 128 }),
    booth: varchar('booth', { length: 255 }),
    /** 活动/到场时段（如签售场次、现场时间），名单有则抽，无则空 */
    activityTime: varchar('activity_time', { length: 255 }),
    followerScale: varchar('follower_scale', { length: 255 }),
    links: json('links').$type<LinkPair[]>(),
    reason: text('reason'),
    /** 来源原文片段，复核时给人看依据（防 LLM 幻觉） */
    rawSnippet: text('raw_snippet'),
    /** AI 匹配分占位（P1 不打分，留空；P3-A 由 sourcing_config 驱动打分填入） */
    aiScore: int('ai_score'),
    /** AI 打分理由（一句话，说明为何这个分/推荐度） */
    aiReason: text('ai_reason'),
    /** 疑似已存在对象 id；命中则复核时提示合并 */
    dedupEntityId: varchar('dedup_entity_id', { length: 64 }),
    // pending | promoted | merged | rejected
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    reviewedBy: varchar('reviewed_by', { length: 128 }),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    idxStatus: index('idx_candidate_status').on(table.status),
    idxSource: index('idx_candidate_source').on(table.sourceId),
  }),
);

/** 建联状态（取代原 localStorage acgRadarWorkflow.v1），每个对象一条 */
export const engagements = mysqlTable(
  'engagements',
  {
    // 与 entities.id 一对一，直接用 entityId 作主键，天然 upsert
    entityId: varchar('entity_id', { length: 64 }).notNull().primaryKey(),
    // 待评估 | 业务想聊 | 现场拜访 | 已建联 | 搁置
    status: varchar('status', { length: 32 }).default('待评估').notNull(),
    owner: varchar('owner', { length: 128 }),
    note: text('note'),
    updatedBy: varchar('updated_by', { length: 128 }),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    idxStatus: index('idx_engagement_status').on(table.status),
  }),
);

/** 系统用户（登录鉴权用）。密码存 bcrypt hash，不存明文 */
export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  // admin | viewer
  role: varchar('role', { length: 16 }).default('viewer').notNull(),
  displayName: varchar('display_name', { length: 128 }),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow()
    .notNull(),
});

/**
 * 采购匹配配置（P3-A）：驱动 AI 给候选打匹配分的"训练数据"。
 * 单行表，id 固定 'default'。对应会议纪要「告诉 AI 采购模块、对标公司」。
 */
export const sourcingConfig = mysqlTable('sourcing_config', {
  id: varchar('id', { length: 32 }).notNull().primaryKey().default('default'),
  /** 采购模块，如 ['画师','KOL','美术供应商'] */
  modules: json('modules').$type<string[]>(),
  /** 对标公司/IP，如 ['漫威','迪士尼'] */
  benchmarks: json('benchmarks').$type<string[]>(),
  /** 打分口径说明，注入打分 prompt */
  scoringRubric: text('scoring_rubric'),
  updatedBy: varchar('updated_by', { length: 128 }),
  updatedAt: timestamp('updated_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow()
    .notNull(),
});
