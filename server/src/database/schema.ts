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
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

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
