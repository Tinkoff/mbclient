import { AMQPChannel, AMQPClient, AMQPError } from '@cloudamqp/amqp-client';
export { AMQPError, AMQPMessage, QueueParams } from '@cloudamqp/amqp-client';

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

export type AMQPConnection = Pick<AMQPChannel, 'basicAck' | 'basicCancel' | 'basicConsume' | 'basicNack' | 'basicPublish' | 'close' | 'exchangeDeclare' | 'prefetch' | 'queue' | 'queueBind'>;

export interface AMQPAdapter {
  connect: (
    connectionString: string,
    closeHandler: (error: AMQPError) => Promise<void>
  ) => Promise<AMQPConnection>;
}

const getAMQPNodeAdapter = (): AMQPAdapter => {
  return {
    async connect(
      connectionString: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      closeHandler: (error: AMQPError) => Promise<void>
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
