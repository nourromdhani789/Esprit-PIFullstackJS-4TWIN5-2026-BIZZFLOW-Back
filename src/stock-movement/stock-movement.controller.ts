import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import { CreateStockMovementDto, StockMovementFilterDto } from './dto/stock-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard)
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @Post()
  create(@Body() createDto: CreateStockMovementDto, @Request() req) {
    return this.stockMovementService.create(req.user.businessId, createDto);
  }

  @Get()
  findAll(@Query() filters: StockMovementFilterDto, @Request() req) {
    return this.stockMovementService.findAll(req.user.businessId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.stockMovementService.findOne(id, req.user.businessId);
  }

  @Get('product/:productId/history')
  getProductStockHistory(@Param('productId') productId: string, @Request() req) {
    return this.stockMovementService.getProductStockHistory(productId, req.user.businessId);
  }

  @Get('products/low-stock')
  getLowStockProducts(@Request() req) {
    return this.stockMovementService.getLowStockProducts(req.user.businessId);
  }
}
