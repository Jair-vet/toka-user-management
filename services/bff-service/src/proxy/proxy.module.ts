import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { AuditController } from './audit.controller';
import { AiController } from './ai.controller';

@Module({
  providers: [ProxyService],
  controllers: [UsersController, RolesController, AuditController, AiController],
  exports: [ProxyService],
})
export class ProxyModule {}
