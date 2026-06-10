import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CircuitBreaker from 'opossum';

interface ServiceConfig {
  name: string;
  baseUrl: string;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly breakers = new Map<string, any>();

  constructor(private readonly config: ConfigService) {
    const services: ServiceConfig[] = [
      { name: 'auth', baseUrl: this.config.get<string>('services.auth')! },
      { name: 'user', baseUrl: this.config.get<string>('services.user')! },
      { name: 'role', baseUrl: this.config.get<string>('services.role')! },
      { name: 'audit', baseUrl: this.config.get<string>('services.audit')! },
      { name: 'ai', baseUrl: this.config.get<string>('services.ai')! },
    ];

    for (const svc of services) {
      const breaker = new CircuitBreaker(
        async (reqConfig: AxiosRequestConfig) => {
          const response = await axios({ ...reqConfig, baseURL: svc.baseUrl });
          return response;
        },
        {
          timeout: 10000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
        },
      );
      breaker.on('open', () =>
        this.logger.warn(`Circuit breaker OPEN for service: ${svc.name}`),
      );
      breaker.on('halfOpen', () =>
        this.logger.log(`Circuit breaker HALF-OPEN for service: ${svc.name}`),
      );
      breaker.on('close', () =>
        this.logger.log(`Circuit breaker CLOSED for service: ${svc.name}`),
      );
      this.breakers.set(svc.name, breaker);
    }
  }

  async forward<T = unknown>(
    service: string,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<AxiosResponse<T>> {
    const breaker = this.breakers.get(service);
    if (!breaker) {
      throw new ServiceUnavailableException(`Unknown service: ${service}`);
    }

    const { authorization, 'x-correlation-id': correlationId, ...rest } = headers;

    const reqConfig: AxiosRequestConfig = {
      url: path,
      method: method as AxiosRequestConfig['method'],
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { authorization } : {}),
        ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
      },
      ...(body ? { data: body } : {}),
      ...(query && Object.keys(query).length ? { params: query } : {}),
    };

    try {
      return await breaker.fire(reqConfig) as AxiosResponse<T>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Breaker is open')) {
        throw new ServiceUnavailableException(
          `Service ${service} is temporarily unavailable`,
        );
      }
      throw err;
    }
  }
}
