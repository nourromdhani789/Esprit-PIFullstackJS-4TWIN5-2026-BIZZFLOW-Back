import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('balance')
  getBalance(@Request() req) {
    return this.cashService.getBalance(req.user.businessId);
  }

  @Get()
  getCashDetails(@Request() req) {
    return this.cashService.getCashDetails(req.user.businessId);
  }
}
