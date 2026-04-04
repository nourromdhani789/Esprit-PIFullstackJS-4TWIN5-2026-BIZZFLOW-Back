import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StockTakeService } from './stock-take.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStockTakeDto, UpdateStockTakeDto, AddStockTakeItemDto, UpdateStockTakeItemDto, CompleteStockTakeDto } from './dto/stock-take.dto';

@Controller('stock-takes')
@UseGuards(JwtAuthGuard)
export class StockTakeController {
  constructor(private readonly stockTakeService: StockTakeService) {}

  @Post()
  create(@Body() dto: CreateStockTakeDto, @Request() req) {
    return this.stockTakeService.create(req.user.businessId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.stockTakeService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.stockTakeService.findWithItems(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockTakeDto, @Request() req) {
    return this.stockTakeService.update(id, req.user.businessId, dto);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Request() req) {
    return this.stockTakeService.startStockTake(id, req.user.businessId);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: AddStockTakeItemDto, @Request() req) {
    return this.stockTakeService.addOrUpdateItem(id, req.user.businessId, dto, req.user.id, req.user.email);
  }

  @Patch('items/:itemId')
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateStockTakeItemDto, @Request() req) {
    return this.stockTakeService.updateItem(itemId, req.user.businessId, dto, req.user.id, req.user.email);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteStockTakeDto, @Request() req) {
    return this.stockTakeService.completeStockTake(id, req.user.businessId, dto, req.user.id, req.user.email);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.stockTakeService.cancel(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.stockTakeService.delete(id, req.user.businessId, req.user.id, req.user.email);
  }
}
