import connect from './connection';
import { AMQPOptions } from './adapters/amqp-node';
import { Logger } from './logger';
import { MessageHandlerOptions, MessageHandler } from './message';

export interface CreateServiceOptions {
  appId?: string;
  serviceName: string;
  logger?: Logger;
  connectOptions: AMQPOptions;
}

export interface ClientSendMessage {
  action: string;
  payload: unknown;
  requestId?: string;
  recipients?: string[];
  correlationId?: string;
  routingKey?: string;
  isOriginalContent?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (eventName: string, listener: (...args: any[]) => void) => void;

export interface Client {
  send: (options: ClientSendMessage) => Promise<void>;
  consume: (callback: MessageHandler) => Promise<void>;
  consumeByAction: (actionType: string, callback: MessageHandler) => Promise<void>;
  cancel: () => Promise<void>;
  close: () => Promise<void>;
  on: Listener;
  once: Listener;
}

/**
 * Create message broker client.
 */
export function createClient(options: CreateServiceOptions): Client {
  const { serviceName } = options;
  const { service, connection } = connect(options);

  return {
    send: (clientSendMessageOptions: ClientSendMessage): Promise<void> =>
      connection.then(() => {
        const { payload, action, requestId, recipients = [], correlationId, routingKey, isOriginalContent = false } = clientSendMessageOptions;
        const sendMessageOptions = {
          replyTo: serviceName,
          correlationId,
          timestamp: new Date(),
          headers: {
            requestId,
            recipients: recipients.join(','),
            action,
            routingKey,
            isOriginalContent
          }
        };

        return service.postMessage(recipients, payload, sendMessageOptions);
      }),

    consume: (callback: MessageHandler): Promise<void> =>
      connection.then(() => service.subscribe(callback)),

    consumeByAction: (
      actionType: string,
      callback: (options: MessageHandlerOptions) => Promise<void>
    ): Promise<void> => connection.then(() => service.subscribeOn(actionType, callback)),

    cancel: (): Promise<void> => connection.then(() => service.unsubscribe()),
    close: (): Promise<void> => service.close(),
    on: service.on.bind(service),
    once: service.on.bind(service)
  };
}

export { default as createMessageError } from './create-error';
export { default as connectService, ServiceConnection } from './service';
export { MessageHandlerOptions } from './message';
export { AMQPOptions as ConnectOptions } from './adapters/amqp-node';
