import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { UpsertEngagementDto } from './engagement.dto';

@Controller('/api/engagements')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Get()
  async findAll(@Query('entityId') entityId?: string) {
    if (entityId) {
      return this.engagementService.findOne(entityId);
    }
    return this.engagementService.findAll();
  }

  @Put(':entityId')
  async upsert(@Param('entityId') entityId: string, @Body() data: UpsertEngagementDto) {
    return this.engagementService.upsert(entityId, data);
  }
}
