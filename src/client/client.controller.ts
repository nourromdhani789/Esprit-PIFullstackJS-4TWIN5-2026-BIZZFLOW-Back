import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    return this.clientService.create(req.user.businessId, createClientDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.clientService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientService.findOne(id, req.user.businessId);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Request() req) {
    return this.clientService.getProfile(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @Request() req) {
    return this.clientService.update(id, req.user.businessId, updateClientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.clientService.remove(id, req.user.businessId);
  }
}
