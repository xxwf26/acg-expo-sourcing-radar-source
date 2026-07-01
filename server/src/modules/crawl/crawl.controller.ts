import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CrawlService } from './crawl.service';
import { MergeCandidateDto, PromoteCandidateDto } from './crawl.dto';

/**
 * 自动采集接口。
 * - 抓取/转正/合并/丢弃为写操作，限 admin。
 * - 候选查询登录即可（含 viewer）。
 */
@Controller('/api')
@UseGuards(JwtAuthGuard)
export class CrawlController {
  constructor(private readonly crawl: CrawlService) {}

  /** 触发单源抓取 */
  @Post('crawl/run/:sourceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async run(@Param('sourceId') sourceId: string) {
    return this.crawl.runSource(sourceId);
  }

  /** 触发全部启用源 */
  @Post('crawl/run-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async runAll() {
    return this.crawl.runAll();
  }

  /** 查抓取 run 状态（前端轮询） */
  @Get('crawl/run/:runId')
  async getRun(@Param('runId') runId: string) {
    return this.crawl.getRun(runId);
  }

  /** 候选列表（?status=pending|promoted|merged|rejected|all） */
  @Get('candidates')
  async list(@Query('status') status?: string) {
    return this.crawl.listCandidates(status || 'pending');
  }

  /** 各状态计数 */
  @Get('candidates/counts')
  async counts() {
    return this.crawl.counts();
  }

  /** 转正为正式建联对象 */
  @Post('candidates/:id/promote')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async promote(@Param('id') id: string, @Body() dto: PromoteCandidateDto, @Request() req: any) {
    return this.crawl.promote(id, dto, req.user?.username);
  }

  /** 合并到已有对象 */
  @Post('candidates/:id/merge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async merge(@Param('id') id: string, @Body() dto: MergeCandidateDto, @Request() req: any) {
    return this.crawl.merge(id, dto.targetEntityId, req.user?.username);
  }

  /** 丢弃 */
  @Post('candidates/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async reject(@Param('id') id: string, @Request() req: any) {
    return this.crawl.reject(id, req.user?.username);
  }
}
