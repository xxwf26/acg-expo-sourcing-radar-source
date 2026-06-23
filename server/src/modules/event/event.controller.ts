import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventService } from './event.service';

@Controller('/api/events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async findAll() {
    return this.eventService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }
}
