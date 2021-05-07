import uuid from 'uuid';
import omit from 'lodash/omit';
import defaultsDeep from 'lodash/defaultsDeep';
import EventEmitter from 'events';
import { isBuffer } from 'util';

import timeout from './timeout';
import randomPickConnectionString from './random-pick';
import {
  EmptyMessageError,
  AmqpConnectGracefullyStopped,
  emptyMessageError,
  amqpConnectError,
  amqpConnectGracefullyStopped,
  ConnectionNotInitialized
} from './errors';
import { RawMessage, Message, MessageOptions, MessageHandlerOptions, MessageHandler } from './message';
import { ConnectionStatus } from './connection';
import {
    AMQPAdapter,
    AMQPOptions,
    AMQPConnection,
    QueueOptions
} from './adapters/amqp-node';
import { Logger } from './logger';
import defaultRetryStrategy from './retry-strategies/default';

const DEFAULT_HEART_BEAT = 30;

export class ServiceConnection extends EventEmitter {
  /**
   * Validate AMQP message against service rules
   */
  static validateMessage(message: Message | null): void | never {
    const isEmptyMessage = (): boolean => message === null;

    if (isEmptyMessage()) {
      throw emptyMessageError();
    }
  }

  /**
   * The method of converting input content, in case of an error, returns an object with a string placed inside
   * @param {Buffer} content
   */
  static getContent(content: Buffer): unknown {
    let data;
    try {
      data = JSON.parse(content.toString());
    } catch (ignore) {
      data = {data: content.toString()};
    }

    return data;
  }

  /**
   * Return exchange name, if @exchange is empty, returns the default value(ServiceConnection.topicExchange)
   * @param exchange
   */
  static getTopicExchange(exchange?: string): string {
    if (exchange === undefined) {
      return ServiceConnection.topicExchange;
    }

    return exchange;
  }

  static topicExchange = 'dispatcher';

  name: string;
  amqp: AMQPAdapter;
  log: Logger;
  status: ConnectionStatus = ConnectionStatus.CONNECTING;
  queuesConsumerTags: {
    [queueName: string]: string;
  } = {};
  handlers: {
    defaultAction: MessageHandler;
    [handlerName: string]: MessageHandler | undefined;
  };
  options: AMQPOptions;
  connection: Promise<AMQPConnection> | null = null;

  constructor(adapter: AMQPAdapter, options: AMQPOptions, serviceName: string, log: Logger) {
    super();

    this.options = options;
    this.name = serviceName;
    this.log = log;
    this.amqp = adapter;
    this.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.handlers = {
      defaultAction: async ({ message, ack }): Promise<void> => {
        ack();
        const { fields } = message; // TODO check for {}
        log.error('[amqp-connection] No action for message', fields);
      }
    };
  }

  hasHandlers(): boolean {
    return Object.keys(omit(this.handlers, ['defaultAction'])).length > 0;
  }

  /**
   * Method returns queue options according to connection options
   *
   * In cluster mode:
   * According to RabbitMQ Highly Available (Mirrored) Queues configuration
   * ha-mode property should be set to 'all' to force queue replication
   *
   * In standalone mode no additional properties are provided
   */
  getQueueOptions(): QueueOptions {
    const options = {
      durable: true
    };

    if (this.isClusterConnection()) {
      return {
        ...options,
        arguments: {
          'ha-mode': 'all',
        }
      };
    }

    return options;
  }

  /**
   * Detects if connection configured as 'cluster' of rabbitMQ's or
   * as standalone.
   *
   * In standalone mode - only 'host' option required.
   * In cluster mode - an array of nodes should be provided via 'cluster'
   * property
   */
  isClusterConnection(): boolean {
    const { cluster = [] } = this.options;

    return !!cluster.length;
  }

  /**
   * Connect to AMQP server with service options
   */
  async connect(): Promise<void> {
    this.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.connection = this.getConnection();

    await this.assertTopicExchange();
    await this.assertServiceQueue();
  }

  /**
   * Assert service queue with name equal to service name
   */
  async assertServiceQueue(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    const connection = await this.connection;

    await connection.assertQueue(this.name, this.getQueueOptions());
  }

  /**
   * Assert topic exchange. Service posts messages to topic exchange when no recipients provided
   */
  async assertTopicExchange(): Promise<void> {
    if (!this.connection) {
      throw new Error();
    }
    const connection = await this.connection;

    await connection.assertExchange(ServiceConnection.getTopicExchange(this.options.exchange), 'topic', { durable: true });
  }

  /**
   * Tries to connect with AMQP with provided retry strategy or uses
   * default one. Default retry strategy implements exponential backoff algorithm.
   */
  async getConnection(attempt: number = 1): Promise<AMQPConnection> {
    const { retryStrategy = defaultRetryStrategy, maxReconnects = Infinity } = this.options;
    let connection;

    if (this.status === ConnectionStatus.DISCONNECTING) {
      throw amqpConnectGracefullyStopped();
    }

    try {
      const connectionString = this.getConnectionString();

      connection = await this.amqp.connect(connectionString, this.options, (eventName, message) => {
        this.connectionEventHandler(eventName, message);
      });

      this.setConnectionStatus(ConnectionStatus.CONNECTED);
    } catch (error) {
      await timeout(retryStrategy(attempt));

      this.log.error(`[amqp-connection] ${error.message}`, error);
      this.log.info(`[amqp-connection] Retry connection to RabbitMQ. Attempt ${attempt}/${maxReconnects}`);

      if (attempt > maxReconnects) {
        throw amqpConnectError(this.options, 'Maximum attempts exceeded.');
      }

      return this.getConnection(attempt + 1);
    }

    return connection;
  }

  /**
   * Handle connection and channel events
   */
  connectionEventHandler(eventName: string, eventMessage: Message): void {
    switch (eventName) {
      case 'close':
        this.handleConnectionClose(eventMessage).catch(this.log.error);
        break;
      default:
    }
  }

  /**
   * Handle connection errors
   */
  async handleConnectionClose(eventMessage: Message): Promise<void> {
    this.log.error('[amqp-connection] Connection closed.', eventMessage, omit(this.options, ['password']));

    this.emit(ConnectionStatus.DISCONNECTED);

    await this.unsubscribe();

    if (this.status !== ConnectionStatus.DISCONNECTING) {
      await this.connect();

      if (this.hasHandlers()) {
        await this.initQueue(this.name);
      }
    }
  }

  /**
   * Set current connection status
   */
  setConnectionStatus(status: ConnectionStatus): void {
    this.log.info(`[amqp-connection] --> ${status}`);
    this.status = status;
    this.emitCurrentStatus();
  }

  /**
   * Emits current connection status;
   */
  emitCurrentStatus(): void {
    this.emit(this.status);
  }

  /**
   * Gets connection string from options. Throws an error if configuration is not valid.
   */
  getConnectionString(): string {
    const connectionString = this.isClusterConnection()
      ? this.getConnectionStringFromCluster()
      : this.getConnectionStringStandalone();

    if (!connectionString) {
      throw amqpConnectError(this.options, 'Wrong configuration. Either cluster or standalone mode should be enabled');
    }

    return connectionString;
  }

  /**
   * Extract connection string from options using 'host' parameter
   */
  getConnectionStringStandalone(): string {
    const { username, password, host = '', vhost = '', heartbeat = DEFAULT_HEART_BEAT } = this.options;
    const connectionString = `amqp://${username}:${password}@${host}/${vhost}?heartbeat=${heartbeat}`;

    this.log.info('[amqp-connection] Configured for standalone');

    return connectionString;
  }

  /**
   * Pick random connection string from 'cluster' property
   */
  getConnectionStringFromCluster(): string {
    const { username, password, cluster = [], vhost = '', heartbeat = DEFAULT_HEART_BEAT } = this.options;
    const connectionStrings = cluster.map(
      host => `amqp://${username}:${password}@${host}/${vhost}?heartbeat=${heartbeat}`
    );

    this.log.info('[amqp-connection] Configured for cluster');

    return randomPickConnectionString(connectionStrings);
  }

  /**
   * Post message to recipients. If recipients array not empty, posts message directly to
   * recipient's queues. Otherwise message will be sent to topic exchange.
   *
   * @example
   *
   * service.postMessage(['news'], 'message', { persistent: true })
   * service.postMessage([], 'message', { replyTo: 'news' })
   */
  async postMessage(recipients: string[] = [], message: unknown, options: Partial<MessageOptions> = {}): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    this.log.info(`[amqp-client] send message to ${recipients.toString()}\n`, options);
    const defaultMessageOptions = {
      messageId: uuid.v4(),
      timestamp: Date.now(),
      persistent: true,
      replyTo: this.name
    };
    const { headers: { action = 'default' } = {} } = options;
    const { headers: { isOriginalContent = false } = {} } = options;
    const { headers: { routingKey = `${this.name}.${action}` } = {} } = options;
    const computedOptions = defaultsDeep({}, options, defaultMessageOptions);
    const connection = await this.connection;

    const content = isOriginalContent && isBuffer(message) ? message : Buffer.from(JSON.stringify(message));

    if (recipients.length) {
      await Promise.all(
        recipients.map(async recipient => connection.sendToQueue(recipient, content, computedOptions))
      );
      return;
    }

    return connection.publish(
        ServiceConnection.getTopicExchange(this.options.exchange),
        routingKey,
        content,
        computedOptions
    );
  }

  /**
   * Handles messages from queue.
   * Runs one of registered message handlers with message. If no suitable handlers
   * present runs with 'defaultAction' handler
   */
  async messageHandler(message: RawMessage): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    try {
      ServiceConnection.validateMessage(message);

      const {
        properties: {
          headers: { action: messageAction = 'defaultAction' }
        }
      } = message;
      const handler = this.getActionHandler(messageAction);
      const connection = await this.connection;

      await handler({
        message: {
          fields: message.fields,
          properties: message.properties,
          content: ServiceConnection.getContent(message.content)
        },
        ack: (): void => {
          connection.ack(message);
        },
        nack: (): void => {
          connection.nack(message);
        }
      });
    } catch (error) {
      if (error instanceof EmptyMessageError) {
        this.unsubscribe().catch(this.log.error);
      }

      this.log.error(error);
    }
  }

  /**
   * Register action handler in service.
   */
  setActionHandler(handlerName: string, handler: (options: MessageHandlerOptions) => Promise<void>): void {
    this.handlers[handlerName] = handler;
  }

  /**
   * Unregister action handler from service
   */
  getActionHandler(handlerName: string): (options: MessageHandlerOptions) => Promise<void> {
    return this.handlers[handlerName] ?? this.handlers.defaultAction;
  }

  /**
   * Subscribe to messages from service queue
   * @example
   *
   * service.subscribe(({ message, ack, nack }) => {
   *    // do something with message
   *    ack();
   * });
   */
  async subscribe(onConsume: MessageHandler): Promise<void> {
    this.setActionHandler('defaultAction', onConsume);

    await this.initQueue(this.name);
  }

  /**
   * Subscribe to messages from service queue
   * with specific actionType.
   *
   * @example
   *
   * service.subscribeOn('someAction', ({ message, ack, nack }) => {
   *    // do something with message
   *    ack();
   * });
   */
  async subscribeOn(actionType: string, onConsume: MessageHandler): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    this.setActionHandler(actionType, onConsume);
    const connection = await this.connection;
    await this.initQueue(this.name);
    await connection.bindQueue(this.name, ServiceConnection.getTopicExchange(this.options.exchange), `*.${actionType}`);
  }

  /**
   * Consumes queue if it's not already consumed
   *
   * Note: One ServiceConnection instance = one consumer. This should be not
   * changed in future due to vast amount of bugs occured when using
   * multiple consumers per queue in this class.
   *
   * These bugs are: circular message redelivery, because of
   * nature of 'nack' function. It tries to place message closer to
   * the head. See more info on this: http://www.rabbitmq.com/nack.html
   */
  async initQueue(queue: string): Promise<void> {
    if (!this.queuesConsumerTags[queue]) {
      await this.consumeQueue(queue, (message: RawMessage) => {
        this.messageHandler(message).catch(this.log.error);
      });

      this.log.info(`[amqp-connection] subscribed for queue "${queue}"`);
    }
  }

  /**
   * Safely unsubscribe from queue
   */
  async unsubscribe(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    this.log.warn(`[amqp-client] unsubscribing from input queue of "${this.name}"`);

    let result;

    try {
      const connection = await this.connection;

      result = await connection.cancel(this.queuesConsumerTags[this.name]);

      this.log.info(`[amqp-connection] unsubscribed from queue "${this.name}"\n`);
    } catch (error) {
      this.log.error('[amqp-connection] cannot unsubscribe. \n', error.message);
    } finally {
      delete this.queuesConsumerTags[this.name];
    }

    return result;
  }

  async close(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    this.setConnectionStatus(ConnectionStatus.DISCONNECTING);

    try {
      const connection = await this.connection;

      await connection.close();
    } catch (error) {
      if (error instanceof AmqpConnectGracefullyStopped) {
        this.log.info('[amqp-connection] Connection retry process gracefully stopped');

        return;
      }

      this.log.error(`[amqp-connection] Cannot close connection. ${error.message}\n`);
    } finally {
      this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    }
  }

  /**
   * Consume queue and bind handler to incoming messages
   */
  async consumeQueue(queue: string, handler: (message: RawMessage) => void): Promise<boolean> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    const connection = await this.connection;
    await connection.prefetch(1);
    const { consumerTag } = await connection.consume(queue, handler);
    this.queuesConsumerTags[queue] = consumerTag;

    return true;
  }
}

/**
 * Function with side-effects. Creates service, calls it's "connect" method
 * to connect to AMQP.
 *
 * @example
 *
 * const { service, connection } = await connectService({
 *   username: 'username'
 *   password: '123';
 *   host: 'localhost'
 *   port: 5672,
 *   vhost: 'dispatcher',
 * }
 */
const connectService = (
  adapter: AMQPAdapter,
  options: AMQPOptions,
  serviceName: string,
  log: Logger
): { service: ServiceConnection; connection: Promise<void> } => {
  const service = new ServiceConnection(adapter, options, serviceName, log);
  const connection = service.connect();

  return { service, connection };
};

export default connectService;
