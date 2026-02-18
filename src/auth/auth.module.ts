import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { Invitation } from './entities/invitation.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { jwtConfig } from '../config/jwt.config';
import { EmailService } from '../shared/services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, Business, Invitation]),
    PassportModule,
    ConfigModule,
    JwtModule.register({
      secret: jwtConfig.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService],
  exports: [AuthService],
})
export class AuthModule {}
