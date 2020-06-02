import connect from './connection';
import { AMQPOptions } from './adapters/amqp-node';
import { Logger } from './logger';
import { MessageHandlerOptions, MessageHandler } from './message';

export interface CreateServiceOptions {
  appId?: string;
  serviceName: string;
  logger: Logger;
  connectOptions: AMQPOptions;
}

export interface ClientSendMessage {
  action: string;
  payload: any;
  requestId?: string;
  recipients?: string[];
  correlationId?: string;
  routingKey?: string;
  isOriginalContent?: boolean;
}

type Listener = (eventName: string, listener: (...args: any[]) => void) => void;

export interface Client {
  send: (options: ClientSendMessage) => Promise<any>;
  consume: (callback: MessageHandler) => Promise<any>;
  consumeByAction: (actionType: string, callback: MessageHandler) => Promise<any>;
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
    send: async (clientSendMessageOptions: ClientSendMessage): Promise<any> =>
      connection.then(async () => {
        const { payload, action, requestId, recipients = [], correlationId, routingKey, isOriginalContent = false } = clientSendMessageOptions;
        const sendMessageOptions = {
          replyTo: serviceName,
          correlationId,
          timestamp: Date.now(),
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

    consume: async (callback: MessageHandler): Promise<void> =>
      connection.then(async () => service.subscribe(callback)),

    consumeByAction: async (
      actionType: string,
      callback: (options: MessageHandlerOptions) => Promise<void>
    ): Promise<void> => connection.then(async () => service.subscribeOn(actionType, callback)),

    cancel: async (): Promise<any> => connection.then(async () => service.unsubscribe()),
    close: async (): Promise<void> => service.close(),
    on: service.on.bind(service),
    once: service.on.bind(service)
  };
}

export { default as createMessageError } from './create-error';
export { default as connectService, ServiceConnection } from './service';
