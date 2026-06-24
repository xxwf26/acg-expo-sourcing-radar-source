import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { engagements } from '../../database/schema';
import { eq } from 'drizzle-orm';
import type { UpsertEngagementDto } from './engagement.dto';

@Injectable()
export class EngagementService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  /** 全部建联记录，前端可一次拉回做 entityId -> engagement 映射 */
  async findAll() {
    const list = await this.db.select().from(engagements);
    return { list, total: list.length };
  }

  async findOne(entityId: string) {
    const [row] = await this.db.select().from(engagements).where(eq(engagements.entityId, entityId));
    return row ?? null;
  }

  /** upsert：以 entityId 为主键，存在则更新，否则插入 */
  async upsert(entityId: string, data: UpsertEngagementDto) {
    const values = {
      entityId,
      status: data.status ?? '待评估',
      owner: data.owner ?? null,
      note: data.note ?? null,
      updatedBy: data.updatedBy ?? null,
    };

    const setOnUpdate: Record<string, unknown> = {};
    if (data.status !== undefined) setOnUpdate.status = data.status;
    if (data.owner !== undefined) setOnUpdate.owner = data.owner ?? null;
    if (data.note !== undefined) setOnUpdate.note = data.note ?? null;
    if (data.updatedBy !== undefined) setOnUpdate.updatedBy = data.updatedBy ?? null;
    // 防止所有字段都 undefined 时生成空 SET 的非法 SQL：至少刷一下 updatedAt
    if (Object.keys(setOnUpdate).length === 0) {
      setOnUpdate.updatedAt = new Date();
    }

    await this.db
      .insert(engagements)
      .values(values)
      .onDuplicateKeyUpdate({ set: setOnUpdate });

    return this.findOne(entityId);
  }
}
