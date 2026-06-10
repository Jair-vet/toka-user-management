import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsString, MinLength } from 'class-validator';
import axios from 'axios';
import { Request, Response } from 'express';

class LoginBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

@Controller('api/auth')
export class CredentialsController {
  constructor(private readonly config: ConfigService) {}

  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authBaseUrl = this.config.get<string>('services.auth');
    const { data } = await axios.post<TokenSet>(`${authBaseUrl}/auth/login`, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const session = (req as Request & { session: Record<string, unknown> }).session;
    session['accessToken'] = data.accessToken;
    session['refreshToken'] = data.refreshToken;
    session['expiresAt'] = Date.now() + data.expiresIn * 1000;

    return res.json({
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
      tokenType: data.tokenType,
    });
  }
}
