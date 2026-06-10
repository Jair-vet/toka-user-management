import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

export type MessageHandler = (message: Record<string, unknown>, ack: () => void, nack: (requeue?: boolean) => void) => Promise<void>;

@Injectable()
export class EventSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventSubscriber.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private handlers: Array<{ queue: string; handler: MessageHandler }> = [];

  constructor(@Inject('RABBITMQ_OPTIONS') private readonly options: { url: string }) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.options.url);
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(10);
      this.logger.log('RabbitMQ EventSubscriber connected');
      // Re-register handlers after reconnect
      for (const { queue, handler } of this.handlers) {
        await this.consume(queue, handler);
      }
    } catch (error) {
      this.logger.error('Failed to connect RabbitMQ subscriber', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async consume(queue: string, handler: MessageHandler): Promise<void> {
    if (!this.channel) {
      this.handlers.push({ queue, handler });
      return;
    }

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString()) as Record<string, unknown>;
        await handler(
          content,
          () => this.channel?.ack(msg),
          (requeue = false) => this.channel?.nack(msg, false, requeue),
        );
      } catch (error) {
        this.logger.error(`Error processing message from ${queue}`, error);
        this.channel?.nack(msg, false, false); // Send to DLQ
      }
    });

    this.logger.log(`Consuming from queue: ${queue}`);
  }
}
