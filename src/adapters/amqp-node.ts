import { AMQPClient, AMQPError } from '@cloudamqp/amqp-client';

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

// to indicate, that these types are related to amqp-client.js, prepend them with AMQP
interface AMQPConsumeParams { noAck: false; }
interface AMQPConsumer { tag: string; }
interface AMQPExchangeParams { durable: true; }
type AMQPExchangeType = 'topic';
export type AMQPMessageCallback = (message: AMQPMessage) => void;
export interface AMQPMessage {
  body: Uint8Array | null;
  consumerTag: string;
  deliveryTag: number;
  exchange: string;
  properties: AMQPMessageProps;
  redelivered: boolean;
  routingKey: string;
}
interface AMQPMessageProps {
  appId?: string;
  contentEncoding?: string;
  contentType?: string;
  correlationId?: string;
  deliveryMode?: number;
  expiration?: string;
  headers?: Record<string, string | boolean | bigint | number | undefined | null | object>;
  messageId?: string;
  priority?: number;
  replyTo?: string;
  timestamp?: Date;
  type?: string;
  userId?: string;
}
interface AMQPQueueParams { durable: true; }
export interface AMQPQueueArgs { 'ha-mode'?: 'all'; }

// `reexport` type, enumerating only used subset
export type AMQPConnection = {
  basicAck: (deliveryTag: number) => Promise<void>;
  basicCancel: (consumerTag: string) => Promise<unknown>;
  basicConsume: (queueName: string, params: AMQPConsumeParams, callback: AMQPMessageCallback) => Promise<AMQPConsumer>;
  basicNack: (deliveryTag: number) => Promise<void>;
  basicPublish: (exchange: string, routingKey: string, data: Buffer, messageProps: AMQPMessageProps) => Promise<number>;
  close: () => Promise<void>;
  exchangeDeclare: (name: string, type: AMQPExchangeType, params: AMQPExchangeParams) => Promise<void>;
  prefetch: (count: number) => Promise<void>;
  queue: (name: string, params: AMQPQueueParams, args: AMQPQueueArgs) => Promise<unknown>;
  queueBind: (name: string, exchange: string, routingKey: string) => Promise<void>;
};

export interface AMQPAdapter {
  connect: (
    connectionString: string,
    closeHandler: (error: Error) => void
  ) => Promise<AMQPConnection>;
}

const getAMQPNodeAdapter = (): AMQPAdapter => {
  return {
    async connect(
      connectionString: string,
      closeHandler: (error: Error) => void
    ): Promise<AMQPConnection> {
      const amqp = new AMQPClient(connectionString);
      const connection = await amqp.connect();
      const channel = await connection.channel();

      await channel.prefetch(1);

      connection.onerror = (error: AMQPError) => {
        closeHandler(error);
      };

      return channel;
    }
  };
};

export default getAMQPNodeAdapter;
