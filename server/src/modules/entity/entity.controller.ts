import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntityService, type EntityFilter } from './entity.service';

@Controller('/api/entities')
@UseGuards(JwtAuthGuard)
export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('event') event?: string,
    @Query('angle') angle?: string,
    @Query('keyword') keyword?: string,
    @Query('includeExcluded') includeExcluded?: string,
  ) {
    const filter: EntityFilter = {};
    if (type) filter.type = type.split(',');
    if (priority) filter.priority = priority.split(',');
    if (event) filter.event = event;
    if (angle) filter.angle = angle;
    if (keyword) filter.keyword = keyword;
    if (includeExcluded === 'true') filter.includeExcluded = true;
    return this.entityService.findAll(filter);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.entityService.findOne(id);
  }
}
