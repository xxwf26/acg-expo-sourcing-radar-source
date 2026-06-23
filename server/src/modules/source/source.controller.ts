import { Controller, Get } from '@nestjs/common';
import { SourceService } from './source.service';

@Controller('/api/sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Get()
  async findAll() {
    return this.sourceService.findAll();
  }
}
