import { Body, Controller, Get, Param, Put, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EngagementService } from './engagement.service';
import { UpsertEngagementDto } from './engagement.dto';

@Controller('/api/engagements')
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Get()
  async findAll(@Query('entityId') entityId?: string) {
    if (entityId) {
      return this.engagementService.findOne(entityId);
    }
    return this.engagementService.findAll();
  }

  // 仅管理员可写。updatedBy 用 token 里的用户名，忽略前端传值
  @Put(':entityId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async upsert(
    @Param('entityId') entityId: string,
    @Body() data: UpsertEngagementDto,
    @Request() req: any,
  ) {
    return this.engagementService.upsert(entityId, { ...data, updatedBy: req.user?.username });
  }
}
