import { Module } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { CredentialsController } from './credentials.controller';
import { JwtGuard } from './jwt.guard';

@Module({
  controllers: [OAuthController, CredentialsController],
  providers: [JwtGuard],
  exports: [JwtGuard],
})
export class AuthModule {}
