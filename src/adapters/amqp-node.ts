import { connect } from 'amqplib';

import { Message, MessageOptions, RawMessage } from '../message';

const CONNECTION_EVENTS = ['error', 'close'];
const CHANNEL_EVENTS = ['error', 'return', 'drain'];

export interface AMQPOptions {
  username: string;
  password: string;
  host?: string;
  cluster?: string[];
  vhost?: string;
  heartbeat?: number;
  maxReconnects?: number;
  retryStrategy?: (times: number) => number;
  exchange?: string;
}

export interface QueueOptions {
  durable: boolean;
  arguments?: {
    'ha-mode'?: string;
  }
}

export interface ExchangeOptions {
  durable: boolean;
}

interface ConsumeResult {
  consumerTag: string;
}

export interface AMQPConnection {
  assertQueue: (queue: string, options: QueueOptions) => Promise<void>;
  assertExchange: (exchange: string, queue: string, options: ExchangeOptions) => Promise<void>;
  ack: (message: Message) => void;
  nack: (message: Message) => void;
  sendToQueue: (queue: string, message: Buffer, options: MessageOptions) => Promise<void>;
  bindQueue: (queue: string, exchange: string, routingRegExp: string) => Promise<void>;
  publish: (exchange: string, routingKey: string, message: Buffer, options: MessageOptions) => Promise<void>;
  consume: (queue: string, handler: (message: RawMessage) => void) => Promise<ConsumeResult>;
  prefetch: (maxMessages: number) => Promise<void>;
  cancel: (consumerTag: string) => Promise<void>;
  close: () => Promise<void>;
}

export interface AMQPAdapter {
  connect: (
    connectionString: string,
    options: AMQPOptions,
    cb: (eventName: string, message: Message) => void
  ) => Promise<AMQPConnection>;
}

const getAMQPNodeAdapter = (): AMQPAdapter => {
  return {
    async connect(
      connectionString: string,
      options: AMQPOptions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventHandler: (eventName: string, message: Message, ...args: any[]) => void
    ): Promise<AMQPConnection> {
      const connection = await connect(
        connectionString,
        options
      );
      const channel = await connection.createChannel();

      CONNECTION_EVENTS.forEach(eventName => {
        connection.on(eventName, (message: Message, ...args) => eventHandler(eventName, message, ...args));
      });

      CHANNEL_EVENTS.forEach(eventName => {
        channel.on(eventName, (message: Message, ...args) => eventHandler(eventName, message, ...args));
      });

      await channel.prefetch(1);

      return (channel as unknown) as AMQPConnection;
    }
  };
};

export default getAMQPNodeAdapter;
