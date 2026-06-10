import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard, Public, Roles } from '@toka/shared-kernel';
import {
  AssignRoleDto,
  CreateRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
  UserRoleResponseDto,
} from '../../application/dtos/role.dto';
import { RoleApplicationService } from '../../application/use-cases/role.application-service';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtGuard)
export class RoleController {
  constructor(private readonly roleService: RoleApplicationService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  async findAll(): Promise<RoleResponseDto[]> {
    return this.roleService.findAll();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions' })
  async getPermissions(): Promise<PermissionResponseDto[]> {
    return this.roleService.getPermissions();
  }

  @Get('health')
  @Public()
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get roles assigned to a user' })
  async getUserRoles(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserRoleResponseDto[]> {
    return this.roleService.getUserRoles(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleResponseDto> {
    return this.roleService.findById(id);
  }

  @Post()
  @Roles('admin', 'user_manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  async create(
    @Body() dto: CreateRoleDto,
    @Req() req: { user: { sub: string } },
  ): Promise<RoleResponseDto> {
    return this.roleService.create(dto, req.user.sub);
  }

  @Post(':id/assign')
  @Roles('admin', 'user_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRoleDto,
    @Req() req: { user: { sub: string } },
  ): Promise<UserRoleResponseDto> {
    return this.roleService.assignRole(roleId, dto, req.user.sub);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a non-system role' })
  async deleteRole(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Req() req: { user: { sub: string } },
  ): Promise<void> {
    await this.roleService.deleteRole(roleId, req.user.sub);
  }

  @Delete(':roleId/users/:userId')
  @Roles('admin', 'user_manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke role from user' })
  async revokeRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: { user: { sub: string } },
  ): Promise<void> {
    await this.roleService.revokeRole(roleId, userId, req.user.sub);
  }
}
