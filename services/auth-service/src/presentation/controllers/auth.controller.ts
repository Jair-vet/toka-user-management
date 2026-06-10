import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard, Public, Roles } from '@toka/shared-kernel';
import { LoginDto, RefreshTokenDto, RegisterDto, TokenResponseDto } from '../../application/dtos/login.dto';
import { AuthApplicationService } from '../../application/use-cases/auth.application-service';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtGuard)
export class AuthController {
  constructor(private readonly authService: AuthApplicationService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: { ip: string; headers: Record<string, string> }): Promise<TokenResponseDto> {
    return this.authService.login(dto, req.ip, req.headers['user-agent'] ?? '');
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    await this.authService.register(dto);
    return { message: 'User registered successfully. Please login.' };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate tokens' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: { user: { sub: string; jti?: string }; correlationId: string },
  ): Promise<void> {
    await this.authService.logout(dto.refreshToken, req.user.jti, req.correlationId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user info' })
  getCurrentUser(@Req() req: { user: Record<string, unknown> }): Record<string, unknown> {
    return req.user;
  }

  @Get('health')
  @Public()
  health(): { status: string } {
    return { status: 'ok' };
  }
}
