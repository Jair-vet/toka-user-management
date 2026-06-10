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
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Controller('api/ai')
@UseGuards(JwtGuard)
export class AiController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly config: ConfigService,
  ) {}

  @All('chat/stream')
  async streamProxy(@Req() req: Request, @Res() res: Response) {
    const aiBaseUrl = this.config.get<string>('services.ai');
    const upstreamUrl = `${aiBaseUrl}/ai/chat/stream`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const upstream = await axios.post(upstreamUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
        authorization: req.headers['authorization'] || '',
        'x-correlation-id': req.headers['x-correlation-id'] || '',
      },
      responseType: 'stream',
    });

    upstream.data.pipe(res);
    upstream.data.on('error', () => res.end());
  }

  @All()
  async handleBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardAi(req, res, '');
  }

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.forwardAi(req, res, req.params[0] ?? '');
  }

  private async forwardAi(req: Request, res: Response, sub: string) {
    const path = '/ai' + (sub ? `/${sub}` : '');
    const response = await this.proxy.forward(
      'ai',
      path,
      req.method,
      req.headers as Record<string, string>,
      req.body,
      req.query as Record<string, string>,
    );
    return res.status(response.status).json(response.data);
  }
}
