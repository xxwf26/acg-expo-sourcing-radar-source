import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { sources } from '../../database/schema';
import { asc } from 'drizzle-orm';

@Injectable()
export class SourceService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async findAll() {
    const list = await this.db.select().from(sources).orderBy(asc(sources.sortOrder));
    return { list, total: list.length };
  }
}
