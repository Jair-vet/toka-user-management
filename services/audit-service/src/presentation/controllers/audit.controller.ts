import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard, Public, Roles } from '@toka/shared-kernel';
import { AuditApplicationService } from '../../application/use-cases/audit.application-service';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtGuard)
export class AuditController {
  constructor(private readonly auditService: AuditApplicationService) {}

  @Get('events')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Query audit events' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'actor', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async queryEvents(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.queryEvents({ page: +page, limit: +limit, actor, action, resource, resourceId, from, to });
  }

  @Get('health')
  @Public()
  health(): { status: string } {
    return { status: 'ok' };
  }
}
