import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto/purchase-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  create(@Body() createDto: CreatePurchaseOrderDto, @Request() req) {
    return this.purchaseOrderService.create(req.user.businessId, createDto, req.user.id, req.user.email);
  }

  @Get()
  findAll(@Query('status') status: string, @Request() req) {
    return this.purchaseOrderService.findAll(req.user.businessId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.purchaseOrderService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePurchaseOrderDto, @Request() req) {
    return this.purchaseOrderService.update(id, req.user.businessId, updateDto, req.user.id, req.user.email);
  }

  @Patch(':id/receive')
  markAsReceived(@Param('id') id: string, @Body() receiveDto: ReceivePurchaseOrderDto, @Request() req) {
    return this.purchaseOrderService.markAsReceived(id, req.user.businessId, receiveDto, req.user.id, req.user.email);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.purchaseOrderService.cancel(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.purchaseOrderService.remove(id, req.user.businessId, req.user.id, req.user.email);
  }
}
