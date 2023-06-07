import getAMQPNodeAdapter, { AMQPConnection } from './adapters/amqp-node';
import connectServiceQueues, { QueueOptions, ServiceConnection } from './service';
import { CreateServiceOptions } from './index';

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected'
}

const queueOptionsDefault: QueueOptions = { singleActiveConsumer: false };

const connect = (options: CreateServiceOptions): { service: ServiceConnection; connection: Promise<AMQPConnection> } => {
  const { connectOptions, logger, serviceName, queueOptions = queueOptionsDefault } = options;

  return connectServiceQueues(getAMQPNodeAdapter(), connectOptions, queueOptions, serviceName, logger);
};

export default connect;
