import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EntityService, type EntityFilter } from './entity.service';
import { CreateEntityDto, UpdateEntityDto } from './entity.dto';

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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateEntityDto) {
    return this.entityService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateEntityDto) {
    return this.entityService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.entityService.remove(id);
  }
}
