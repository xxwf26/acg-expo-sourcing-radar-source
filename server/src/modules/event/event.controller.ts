import { Controller, Get, Param } from '@nestjs/common';
import { EventService } from './event.service';

@Controller('/api/events')
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
