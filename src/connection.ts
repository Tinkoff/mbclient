import getAMQPNodeAdapter from './adapters/amqp-node';
import connectServiceQueues, { ServiceConnection } from '../service/service';
import { CreateServiceOptions } from '../index';

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected'
}

const connect = (options: CreateServiceOptions): { service: ServiceConnection; connection: Promise<void> } => {
  const { connectOptions, serviceName } = options;

  if (!options.logger) {
    throw new Error('logger is required.');
  }

  return connectServiceQueues(getAMQPNodeAdapter(), connectOptions, serviceName, options.logger);
};

export default connect;
