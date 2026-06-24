// 编程式 seed：读 database/radar-db.json 灌入 events / entities / sources，
// 并把 excludedEntityIds 里的对象标 excluded=true。可重复执行（先清空再插）。
import 'reflect-metadata';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '..', '.env') });

const dbPath = join(__dirname, '..', '..', '..', 'database', 'radar-db.json');
const db = JSON.parse(readFileSync(dbPath, 'utf-8'));

const excluded: Set<string> = new Set(db.excludedEntityIds || []);

async function main() {
  const connection = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sourcing_radar',
  });
  const orm = drizzle(connection, { schema, mode: 'default' });

  // 清空 + 插入包进同一事务，中途失败可回滚，避免清空后没灌满
  await orm.transaction(async (tx) => {
    // 清空（保留建联状态 engagements，避免覆盖人工录入）
    await tx.delete(schema.entities);
    await tx.delete(schema.events);
    await tx.delete(schema.sources);

    // events
    const eventRows = (db.events || []).map((e: any, i: number) => ({
      id: e.id,
      name: e.name,
      short: e.short,
      date: e.date ?? null,
      month: e.month ?? null,
      city: e.city ?? null,
      region: e.region ?? null,
      venue: e.venue ?? null,
      status: e.status ?? null,
      tags: e.tags ?? [],
      note: e.note ?? null,
      links: e.links ?? [],
      sortOrder: i,
    }));
    if (eventRows.length) await tx.insert(schema.events).values(eventRows);

    // entities
    const entityRows = (db.entities || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      priority: e.priority,
      score: e.score ?? 0,
      events: e.events ?? [],
      region: e.region ?? null,
      booth: e.booth ?? null,
      followerScale: e.followerScale ?? null,
      followerTier: e.followerTier ?? null,
      followerNote: e.followerNote ?? null,
      tags: e.tags ?? [],
      angles: e.angles ?? [],
      reason: e.reason ?? null,
      cases: e.cases ?? [],
      visuals: e.visuals ?? [],
      links: e.links ?? [],
      excluded: excluded.has(e.id),
    }));
    if (entityRows.length) await tx.insert(schema.entities).values(entityRows);

    // sources（原数据无 id，用 name 派生稳定 id，便于重复 seed）
    const sourceRows = (db.sources || []).map((s: any, i: number) => ({
      id: `src-${i + 1}`,
      name: s.name,
      cadence: s.cadence ?? null,
      fields: s.fields ?? null,
      links: s.links ?? [],
      sortOrder: i,
    }));
    if (sourceRows.length) await tx.insert(schema.sources).values(sourceRows);

    const excludedCount = entityRows.filter((r: any) => r.excluded).length;
    console.log(
      `✓ seed 完成：events=${eventRows.length}, entities=${entityRows.length}（excluded=${excludedCount}）, sources=${sourceRows.length}`,
    );
  });
  await connection.end();
}

main().catch((err) => {
  console.error('seed 失败：', err);
  process.exit(1);
});
