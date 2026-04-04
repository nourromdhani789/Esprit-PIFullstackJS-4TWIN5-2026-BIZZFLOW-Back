import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dtos/create-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../shared/enums/role.enum';

@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
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

  @Post('upload-logo')
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    const logoUrl = `/uploads/logos/${file.filename}`;
    
    // Update the business with the new logo URL
    const business = await this.businessService.findByTenant(req.user.tenantId);
    if (!business) {
      throw new Error('Business not found');
    }
    
    await this.businessService.update(business.id, { logoUrl });
    
    return {
      logoUrl,
      message: 'Logo uploaded successfully',
    };
  }

  @Delete(':id')
  @Roles(Role.PLATFORM_ADMIN)
  async remove(@Param('id') id: string) {
    return this.businessService.remove(id);
  }
}
