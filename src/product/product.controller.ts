import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @Request() req) {
    return this.productService.create(req.user.businessId, createProductDto, req.user.id, req.user.email);
  }

  @Get()
  findAll(@Request() req) {
    return this.productService.findAll(req.user.businessId);
  }

  @Get('for-sales')
  findForSales(@Request() req) {
    return this.productService.findForSales(req.user.businessId);
  }

  @Get('for-purchases')
  findForPurchases(@Request() req) {
    return this.productService.findForPurchases(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.productService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Request() req) {
    return this.productService.update(id, req.user.businessId, updateProductDto, req.user.id, req.user.email);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.productService.remove(id, req.user.businessId, req.user.id, req.user.email);
  }
}
