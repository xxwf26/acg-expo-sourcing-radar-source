import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { events } from '../../database/schema';
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
}
