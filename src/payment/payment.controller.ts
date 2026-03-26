import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFilterDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() createDto: CreatePaymentDto, @Request() req) {
    return this.paymentService.create(req.user.businessId, createDto);
  }

  @Get()
  findAll(@Query() filters: PaymentFilterDto, @Request() req) {
    return this.paymentService.findAll(req.user.businessId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.paymentService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePaymentDto, @Request() req) {
    return this.paymentService.update(id, req.user.businessId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.paymentService.remove(id, req.user.businessId);
  }
}
