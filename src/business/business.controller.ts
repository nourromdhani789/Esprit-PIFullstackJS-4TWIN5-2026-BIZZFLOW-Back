import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../shared/enums/role.enum';

@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER)
  async create(@Request() req, @Body() createBusinessDto: CreateBusinessDto) {
    return this.businessService.create(createBusinessDto, req.user.tenantId);
  }

  @Get()
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async findAll() {
    return this.businessService.findAll();
  }

  @Get('tenant/:tenantId')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async findByTenant(@Param('tenantId') tenantId: string) {
    return this.businessService.findByTenant(tenantId);
  }

  @Get('my-business')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async getMyBusiness(@Request() req) {
    return this.businessService.findByTenant(req.user.tenantId);
  }

  @Get(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async update(@Param('id') id: string, @Body() updateBusinessDto: Partial<CreateBusinessDto>) {
    return this.businessService.update(id, updateBusinessDto);
  }

  @Delete(':id')
  @Roles(Role.PLATFORM_ADMIN)
  async remove(@Param('id') id: string) {
    return this.businessService.remove(id);
  }
}
