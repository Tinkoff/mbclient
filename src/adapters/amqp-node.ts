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
}

export interface AMQPConnection {
  assertQueue: (queue: string, options: AMQPOptions) => Promise<any>;
  assertExchange: (exchange: string, queue: string, options: any) => Promise<any>;
  ack: (message: Message) => void;
  nack: (message: Message) => void;
  sendToQueue: (queue: string, message: Buffer, options: MessageOptions) => Promise<any>;
  bindQueue: (queue: string, exchange: string, routingRegExp: string) => Promise<any>;
  publish: (exchange: string, routingKey: string, message: Buffer, options: MessageOptions) => Promise<any>;
  consume: (queue: string, handler: (message: RawMessage) => void) => Promise<any>;
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
      eventHandler: (eventName: string, message?: any, ...args: any[]) => void
    ): Promise<AMQPConnection> {
      const connection = await connect(
        connectionString,
        options
      );
      const channel = await connection.createChannel();

      CONNECTION_EVENTS.forEach(eventName => {
        connection.on(eventName, (...args) => eventHandler(eventName, ...args));
      });

      CHANNEL_EVENTS.forEach(eventName => {
        channel.on(eventName, (...args) => eventHandler(eventName, ...args));
      });

      await channel.prefetch(1);

      return (channel as unknown) as AMQPConnection;
    }
  };
};

export default getAMQPNodeAdapter;
