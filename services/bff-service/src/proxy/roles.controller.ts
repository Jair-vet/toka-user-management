import {
  All,
  Controller,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/roles')
@UseGuards(JwtGuard)
export class RolesController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  async handleBase(@Req() req: Request, @Res() res: Response) {
    return this.forward(req, res, '');
  }

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.forward(req, res, req.params[0] ?? '');
  }

  private async forward(req: Request, res: Response, sub: string) {
    const path = '/roles' + (sub ? `/${sub}` : '');
    const response = await this.proxy.forward(
      'role',
      path,
      req.method,
      req.headers as Record<string, string>,
      req.body,
      req.query as Record<string, string>,
    );
    return res.status(response.status).json(response.data);
  }
}
