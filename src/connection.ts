import getAMQPNodeAdapter, { AMQPConnection } from './adapters/amqp-node';
import connectServiceQueues, { ServiceConnection } from './service';
import { CreateServiceOptions } from './index';

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected'
}

const connect = (options: CreateServiceOptions): { service: ServiceConnection; connection: Promise<AMQPConnection> } => {
  const { connectOptions, serviceName } = options;

  return connectServiceQueues(getAMQPNodeAdapter(), connectOptions, serviceName, options.logger);
};

export default connect;
