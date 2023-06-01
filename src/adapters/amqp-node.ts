import { AMQPClient, AMQPError } from '@cloudamqp/amqp-client';

export interface AMQPOptions {
  /**
   * Username for authentication
   */
  username: string;
  /**
   * Password
   */
  password: string;
  /**
   * AMQP host to connect to
   * @default localhost:5672
   */
  host?: string;
  /**
   * List of hosts if AMQP cluster is used
   */
  cluster?: string[];
  /**
   * Enable secure connection
   * @default false
   */
  amqps?: boolean;
  /**
   * Virtual Host
   * @default /
   */
  vhost?: string;
  /**
   * Heartbeat timeout value in seconds (an integer) to negotiate with the server
   * @default 30
   */
  heartbeat?: number;
  /**
   * The size in bytes of the maximum frame allowed over the connection
   * @default 4096
   */
  frameMax?: number;
  /**
   * Max reconnect attempts
   * @default Infinity
   */
  maxReconnects?: number;
  /**
   * Function that returns milliseconds number to delay before reconnect attempt.
   * @default Default strategy implements exponential backoff algorithm.
   * @param attempt attempt number
   */
  retryStrategy?: (attempt: number) => number;
  /**
   * AMQP exchange name to bind to. It will be created if it doesn't exist.
   * @default dispatcher
   */
  exchange?: string;
}

export interface AMQPQueueOptions {
  args: AMQPQueueArgs;
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
export interface AMQPQueueArgs { 'ha-mode'?: 'all'; 'x-single-active-consumer'?: boolean; }

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
