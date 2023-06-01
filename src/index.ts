import connect from './connection';
import { AMQPOptions, AMQPQueueOptions } from './adapters/amqp-node';
import { Logger } from './logger';
import { MessageHandler } from './message';

export interface CreateServiceOptions {
  serviceName: string;
  logger: Logger;
  connectOptions: AMQPOptions;
  queueOptions?: AMQPQueueOptions;
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
    /**
     * Send a message.
     * When sending a message indicating the recipients, the message sent to their queue directly.
     * Otherwise, the message sent via routingKey "{serviceName}.{Action}" to the dispatcher exchange.
     * @param clientSendMessageOptions
     */
    send: (clientSendMessageOptions: ClientSendMessage): Promise<void> =>
      connection.then(() => {
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

    /**
     * Subscribe to messages from service queue.
     * The handler will be called if there is no handler for specified action type.
     * @param callback
     */
    consume: (callback: MessageHandler): Promise<void> =>
      connection.then(() => service.subscribe(callback)),

    /**
     * Subscribe to messages from service queue and handle only specific actions.
     * @param actionType
     * @param callback
     */
    consumeByAction: (
      actionType: string,
      callback: MessageHandler
    ): Promise<void> => connection.then(() => service.subscribeOn(actionType, callback)),

    /**
     * Unsubscribe to queue
     */
    cancel: (): Promise<void> => connection.then(() => service.unsubscribe()),

    /**
     * Close connection
     */
    close: (): Promise<void> => service.close(),

    /**
     * Subscribe to connection events
     */
    on: service.on.bind(service),

    /**
     * Subscribe to connection events
     */
    once: service.on.bind(service)
  };
}

export { default as createMessageError } from './create-error';
export { default as connectService, ServiceConnection } from './service';
export { MessageHandlerOptions } from './message';
export { AMQPOptions as ConnectOptions } from './adapters/amqp-node';
