import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { sources } from '../../database/schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class SourceService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async findAll() {
    const list = await this.db.select().from(sources).orderBy(asc(sources.sortOrder));
    return { list, total: list.length };
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(sources).where(eq(sources.id, id));
    return row ?? null;
  }

  async create(data: Record<string, any>) {
    const id = crypto.randomUUID();
    await this.db.insert(sources).values({ ...data, id } as any);
    return this.findOne(id);
  }

  async update(id: string, data: Record<string, any>) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('信息源不存在');
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      await this.db.update(sources).set(patch).where(eq(sources.id, id));
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException('信息源不存在');
    await this.db.delete(sources).where(eq(sources.id, id));
    return { success: true };
  }
}
