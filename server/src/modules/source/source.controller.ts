import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SourceService } from './source.service';

@Controller('/api/sources')
@UseGuards(JwtAuthGuard)
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Get()
  async findAll() {
    return this.sourceService.findAll();
  }
}
