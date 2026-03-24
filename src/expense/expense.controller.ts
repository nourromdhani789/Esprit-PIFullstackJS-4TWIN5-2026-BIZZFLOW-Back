import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiScannerService } from './services/ai-scanner.service';

const storage = diskStorage({
  destination: './uploads/receipts',
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    callback(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly aiScannerService: AiScannerService,
  ) {}

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto, @Request() req) {
    return this.expenseService.create(req.user.businessId, createExpenseDto);
  }

  @Get()
  findAll(@Request() req, @Query('status') status?: string) {
    return this.expenseService.findAll(req.user.businessId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.expenseService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto, @Request() req) {
    return this.expenseService.update(id, req.user.businessId, updateExpenseDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.expenseService.remove(id, req.user.businessId);
  }

  @Post('upload-receipt')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const ext = extname(file.originalname).toLowerCase();
        const mimetype = allowedTypes.test(file.mimetype);
        const extnameValid = allowedTypes.test(ext.replace('.', ''));
        
        if (mimetype && extnameValid) {
          return callback(null, true);
        }
        callback(new BadRequestException('Only image and PDF files are allowed'), false);
      },
    }),
  )
  async uploadReceipt(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Get mock AI scan results
    const aiResult = await this.aiScannerService.scanReceipt(file);

    return {
      receiptUrl: `/uploads/receipts/${file.filename}`,
      aiExtracted: aiResult,
    };
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string, 
    @Body() approveDto: ApproveExpenseDto, 
    @Request() req
  ) {
    // Get user role from JWT payload
    const userRole = req.user.role || 'user';
    return this.expenseService.approve(id, req.user.businessId, approveDto, userRole);
  }
}
