import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { DomainEvent } from '../../domain/domain-event';

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.ConfirmChannel;

  constructor(@Inject('RABBITMQ_OPTIONS') private readonly options: { url: string }) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.options.url);
      this.channel = await this.connection.createConfirmChannel();
      this.logger.log('RabbitMQ EventPublisher connected');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      // Retry after delay
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore
    }
  }

  async publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const message = Buffer.from(JSON.stringify(event));

    return new Promise((resolve, reject) => {
      this.channel!.publish(
        exchange,
        routingKey,
        message,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          timestamp: event.occurredAt.getTime(),
          headers: {
            'x-correlation-id': event.correlationId,
            'x-event-type': event.eventType,
          },
        },
        (err) => {
          if (err) {
            this.logger.error(`Failed to publish event ${event.eventType}`, err);
            reject(err);
          } else {
            this.logger.debug(`Published event ${event.eventType} to ${exchange}/${routingKey}`);
            resolve();
          }
        },
      );
    });
  }
}
