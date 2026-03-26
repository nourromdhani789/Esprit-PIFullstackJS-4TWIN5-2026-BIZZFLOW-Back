import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { CreditNoteService } from './credit-note.service';
import { CreateCreditNoteDto, UpdateCreditNoteDto } from './dto/credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
export class CreditNoteController {
  constructor(private readonly creditNoteService: CreditNoteService) {}

  @Post()
  create(@Body() createDto: CreateCreditNoteDto, @Request() req) {
    return this.creditNoteService.create(req.user.businessId, createDto);
  }

  @Get()
  findAll(@Query('status') status: string, @Request() req) {
    return this.creditNoteService.findAll(req.user.businessId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.creditNoteService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateCreditNoteDto, @Request() req) {
    return this.creditNoteService.update(id, req.user.businessId, updateDto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.creditNoteService.cancel(id, req.user.businessId);
  }

  @Post(':id/apply')
  apply(@Param('id') id: string, @Request() req) {
    return this.creditNoteService.apply(id, req.user.businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.creditNoteService.remove(id, req.user.businessId);
  }
}
