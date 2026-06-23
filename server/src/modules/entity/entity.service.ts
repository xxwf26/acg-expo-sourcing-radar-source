import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { entities, engagements } from '../../database/schema';
import { and, eq, inArray, like, or, desc, type SQL } from 'drizzle-orm';

export interface EntityFilter {
  type?: string[];
  priority?: string[];
  event?: string;
  angle?: string;
  keyword?: string;
  includeExcluded?: boolean;
}

@Injectable()
export class EntityService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async findAll(filter: EntityFilter = {}) {
    const conditions: SQL[] = [];

    if (!filter.includeExcluded) {
      conditions.push(eq(entities.excluded, false));
    }
    if (filter.type?.length) {
      conditions.push(inArray(entities.type, filter.type));
    }
    if (filter.priority?.length) {
      conditions.push(inArray(entities.priority, filter.priority));
    }
    if (filter.keyword) {
      const kw = `%${filter.keyword}%`;
      conditions.push(
        or(
          like(entities.name, kw),
          like(entities.reason, kw),
          like(entities.region, kw),
          like(entities.booth, kw),
        ) as SQL,
      );
    }

    let list = await this.db
      .select()
      .from(entities)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(entities.score));

    // event / angle 存在 JSON 数组列里，DB 层不便过滤，这里做内存过滤
    if (filter.event) {
      list = list.filter((e) => (e.events || []).includes(filter.event!));
    }
    if (filter.angle) {
      list = list.filter((e) => (e.angles || []).includes(filter.angle!));
    }

    return { list, total: list.length };
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(entities).where(eq(entities.id, id));
    return row ?? null;
  }

  async create(data: Record<string, any>) {
    const id = crypto.randomUUID();
    await this.db.insert(entities).values({ ...data, id } as any);
    return this.findOne(id);
  }

  async update(id: string, data: Record<string, any>) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('对象不存在');
    // 只更新传入的字段（DTO 已剥离 undefined）
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      await this.db.update(entities).set(patch).where(eq(entities.id, id));
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('对象不存在');
    // 引用保护：有建联记录则拒绝删除
    const [eng] = await this.db
      .select()
      .from(engagements)
      .where(eq(engagements.entityId, id));
    if (eng) {
      throw new BadRequestException('该对象已有建联记录，请先清除建联状态后再删除');
    }
    await this.db.delete(entities).where(eq(entities.id, id));
    return { success: true };
  }
}
