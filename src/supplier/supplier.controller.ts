import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto, @Request() req) {
    return this.supplierService.create(req.user.businessId, createSupplierDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.supplierService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.supplierService.findOne(id, req.user.businessId);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Request() req) {
    return this.supplierService.getProfile(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto, @Request() req) {
    return this.supplierService.update(id, req.user.businessId, updateSupplierDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.supplierService.remove(id, req.user.businessId);
  }
}
