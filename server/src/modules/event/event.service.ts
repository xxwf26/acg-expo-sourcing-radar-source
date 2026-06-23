import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { events, entities } from '../../database/schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class EventService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async findAll() {
    const list = await this.db.select().from(events).orderBy(asc(events.sortOrder));
    return { list, total: list.length };
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(events).where(eq(events.id, id));
    return row ?? null;
  }

  async create(data: Record<string, any>) {
    const id = crypto.randomUUID();
    await this.db.insert(events).values({ ...data, id } as any);
    return this.findOne(id);
  }

  async update(id: string, data: Record<string, any>) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('展会不存在');
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      await this.db.update(events).set(patch).where(eq(events.id, id));
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('展会不存在');
    // 引用保护：扫描 entities.events（JSON 数组）是否关联该展会
    const allEntities = await this.db.select().from(entities);
    const used = allEntities.filter((e) => (e.events || []).includes(id));
    if (used.length > 0) {
      const names = used.slice(0, 5).map((e) => e.name).join('、');
      const more = used.length > 5 ? ` 等 ${used.length} 个` : '';
      throw new BadRequestException(
        `该展会正被 ${used.length} 个对象关联（${names}${more}），请先解除关联后再删除`,
      );
    }
    await this.db.delete(events).where(eq(events.id, id));
    return { success: true };
  }
}
