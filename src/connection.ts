import getAMQPNodeAdapter, { AMQPConnection, AMQPQueueOptions } from './adapters/amqp-node';
import connectServiceQueues, { ServiceConnection } from './service';
import { CreateServiceOptions } from './index';

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected'
}

const queueOptionsDefault: AMQPQueueOptions = { args: {} };

const connect = (options: CreateServiceOptions): { service: ServiceConnection; connection: Promise<AMQPConnection> } => {
  const { connectOptions, logger, serviceName, queueOptions = queueOptionsDefault } = options;

  return connectServiceQueues(getAMQPNodeAdapter(), connectOptions, queueOptions, serviceName, logger);
};

export default connect;
