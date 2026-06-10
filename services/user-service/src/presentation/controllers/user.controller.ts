import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard, Public, Roles } from '@toka/shared-kernel';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from '../../application/dtos/user.dto';
import { UserApplicationService } from '../../application/use-cases/user.application-service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtGuard)
export class UserController {
  constructor(private readonly userService: UserApplicationService) {}

  @Post()
  @Roles('admin', 'user_manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  @Get()
  @Roles('admin', 'user_manager')
  @ApiOperation({ summary: 'List users with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.userService.findAll({ page: +page, limit: +limit, search, status });
  }

  @Get('health')
  @Public()
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: { user: { sub: string } }): Promise<UserResponseDto> {
    return this.userService.findById(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: { sub: string; realm_access: { roles: string[] } } },
  ): Promise<UserResponseDto> {
    // Users can update their own profile; admins can update anyone
    if (!req.user.realm_access?.roles?.includes('admin') && req.user.sub !== id) {
      const err = new Error('Forbidden');
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.userService.softDelete(id);
  }
}
