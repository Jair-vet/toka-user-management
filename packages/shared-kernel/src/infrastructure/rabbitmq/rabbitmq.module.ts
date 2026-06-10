import { DynamicModule, Module } from '@nestjs/common';
import { EventPublisher } from './event-publisher';
import { EventSubscriber } from './event-subscriber';

export interface RabbitMQModuleOptions {
  url: string;
}

@Module({})
export class RabbitMQModule {
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      providers: [
        {
          provide: 'RABBITMQ_OPTIONS',
          useValue: options,
        },
        EventPublisher,
        EventSubscriber,
      ],
      exports: [EventPublisher, EventSubscriber],
      global: true,
    };
  }
}
