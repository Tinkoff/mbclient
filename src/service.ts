import { v4 as uuid } from 'uuid';
import EventEmitter from 'events';

import timeout from './timeout';
import randomPickConnectionString from './random-pick';
import {
  amqpConnectError,
  AmqpConnectGracefullyStopped,
  amqpConnectGracefullyStopped,
  ConnectionNotInitialized,
  emptyMessageError,
  EmptyMessageError,
  unexpectedNonStringAction
} from './errors';
import { MessageHandler, MessageHandlerOptions, MessageOptions } from './message';
import { ConnectionStatus } from './connection';
import {
  AMQPAdapter,
  AMQPConnection,
  AMQPMessage,
  AMQPMessageCallback,
  AMQPOptions,
  AMQPQueueArgs
} from './adapters/amqp-node';
import { Logger } from './logger';
import defaultRetryStrategy from './retry-strategies/default';

export interface QueueOptions {
  singleActiveConsumer: boolean;
}

const DEFAULT_HEART_BEAT = 30;
const DEFAULT_FRAME_MAX = 4096;

const DEFAULT_ACTION = 'defaultAction';

export class ServiceConnection extends EventEmitter {
  /**
   * The method of converting input content, in case of an error, returns an object with a string placed inside
   * @param {Uint8Array} content
   */
  static getContent(content: Uint8Array): unknown {
    const str = Buffer.from(content).toString('utf8');
    let data;
    try {
      data = JSON.parse(str);
    } catch (ignore) {
      data = { data: str };
    }

    return data;
  }

  /**
   * Validates AMQP message againts service rules and returns parsed result
   */
  static getContentFromMessage(message: AMQPMessage): unknown | never {
    if (message.body === null) {
      throw emptyMessageError();
    }

    return this.getContent(message.body);
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
    [DEFAULT_ACTION]: MessageHandler;
    [handlerName: string]: MessageHandler;
  };
  options: AMQPOptions;
  queueOptions: QueueOptions;
  connection: Promise<AMQPConnection> | null = null;

  constructor(adapter: AMQPAdapter, options: AMQPOptions, queueOptions: QueueOptions, serviceName: string, log: Logger) {
    super();

    this.options = options;
    this.queueOptions = queueOptions;
    this.name = serviceName;
    this.log = log;
    this.amqp = adapter;
    this.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.handlers = {
      [DEFAULT_ACTION]: async ({ message, ack }: MessageHandlerOptions): Promise<void> => {
        ack();
        const action = message.properties.headers.action;
        const actionErrorMessage = action ? `No handler for action ${action}` : `Action is empty`
        log.error(`[amqp-connection] ${actionErrorMessage} for message`, message);
      }
    };
  }

  hasHandlers(): boolean {
    return Object.keys(this.handlers).some(name => name !== DEFAULT_ACTION);
  }

  /**
   * Method returns queue args according to connection options
   *
   * In cluster mode:
   * According to RabbitMQ Highly Available (Mirrored) Queues configuration
   * ha-mode property should be set to 'all' to force queue replication
   */
  getQueueArgs(): AMQPQueueArgs {
    const args: AMQPQueueArgs = {};

    if (this.isClusterConnection()) {
      args["ha-mode"] = "all";
    }
    if (this.queueOptions.singleActiveConsumer) {
      args["x-single-active-consumer"] = true;
    }

    return args;
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
  async connect(): Promise<AMQPConnection> {
    this.setConnectionStatus(ConnectionStatus.CONNECTING);
    const connection = this.connection = this.getConnection();

    await this.assertTopicExchange();
    await this.assertServiceQueue();

    return connection;
  }

  /**
   * Assert service queue with name equal to service name
   */
  async assertServiceQueue(): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    const connection = await this.connection;

    await connection.queue(this.name, { durable: true }, this.getQueueArgs());
  }

  /**
   * Assert topic exchange. Service posts messages to topic exchange when no recipients provided
   */
  async assertTopicExchange(): Promise<void> {
    if (!this.connection) {
      throw new Error('No connection');
    }
    const connection = await this.connection;

    await connection.exchangeDeclare(ServiceConnection.getTopicExchange(this.options.exchange), 'topic', { durable: true });
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

      connection = await this.amqp.connect(connectionString, (error: Error) => {
        // eslint-disable-next-line promise/no-promise-in-callback
        this.handleConnectionClose(error).catch(error => this.log.error(error));
      });

      this.setConnectionStatus(ConnectionStatus.CONNECTED);
    } catch (error) {
      this.log.error(`[amqp-connection] ${error instanceof Error ? error.message : String(error)}`, error);

      await timeout(retryStrategy(attempt));
      this.log.info(`[amqp-connection] Retry connection to RabbitMQ. Attempt ${attempt}/${maxReconnects}`);

      if (attempt > maxReconnects) {
        throw amqpConnectError(this.options, 'Maximum attempts exceeded.');
      }

      return this.getConnection(attempt + 1);
    }

    return connection;
  }

  /**
   * Handle connection close
   */
  async handleConnectionClose(error: Error): Promise<void> {
    if (this.status === ConnectionStatus.DISCONNECTING || this.status === ConnectionStatus.CONNECTING) {
      return;
    }

    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    // set the "connecting" status in order to avoid concurrent connection in case
    // when the handler is called several times in the short period of time
    this.status = ConnectionStatus.CONNECTING;

    const { password, ...restOptions } = this.options;
    this.log.error('[amqp-connection] Connection closed.', error, restOptions);

    await this.unsubscribe();

    const connection = await this.connect();

    const handlers = Object.keys(this.handlers).filter(name => name !== DEFAULT_ACTION);

    if (handlers.length > 0) {
      await this.initQueue(this.name);

      for (const handler of handlers) {
        await connection.queueBind(this.name, ServiceConnection.getTopicExchange(this.options.exchange), `*.${handler}`);
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
    const { username, password, amqps = false, host = 'localhost:5672', vhost = '', heartbeat = DEFAULT_HEART_BEAT, frameMax = DEFAULT_FRAME_MAX } = this.options;
    const protocol = amqps ? 'amqps' : 'amqp';
    const connectionString = `${protocol}://${username}:${password}@${host}/${vhost}?frameMax=${frameMax}&heartbeat=${heartbeat}`;

    this.log.info('[amqp-connection] Configured for standalone');

    return connectionString;
  }

  /**
   * Pick random connection string from 'cluster' property
   */
  getConnectionStringFromCluster(): string {
    const { username, password, amqps = false, cluster = [], vhost = '', heartbeat = DEFAULT_HEART_BEAT, frameMax = DEFAULT_FRAME_MAX } = this.options;
    const protocol = amqps ? 'amqps' : 'amqp';
    const connectionStrings = cluster.map(
      host => `${protocol}://${username}:${password}@${host}/${vhost}?frameMax=${frameMax}&heartbeat=${heartbeat}`
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
    const action = options.headers?.action ?? 'default';
    const routingKey = options.headers?.routingKey ?? `${this.name}.${action}`;
    const isOriginalContent = options.headers?.isOriginalContent ?? false;
    const computedOptions = {
      messageId: uuid(),
      persistent: true,
      replyTo: this.name,
      ...options,
      headers: options.headers ? { ...options.headers } : { recipients: '' },
      timestamp: options.timestamp || options.timestamp === 0 ? new Date(options.timestamp) : new Date()
    };
    const connection = await this.connection;

    const content = isOriginalContent && Buffer.isBuffer(message) ? message : Buffer.from(JSON.stringify(message));

    if (recipients.length) {
      await Promise.all(
        recipients.map(recipient => connection.basicPublish('', recipient, content, computedOptions))
      );
      return;
    }

    await connection.basicPublish(
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
  async messageHandler(message: AMQPMessage): Promise<void> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    try {
      const messageAction = message.properties.headers?.action ?? DEFAULT_ACTION;
      if (typeof messageAction !== 'string') {
        throw unexpectedNonStringAction(messageAction);
      }

      const handler = this.getActionHandler(messageAction);
      const connection = await this.connection;

      await handler({
        message: {
          content: ServiceConnection.getContentFromMessage(message),
          fields: {
            consumerTag: message.consumerTag,
            deliveryTag: message.deliveryTag,
            redelivered: message.redelivered,
            exchange: message.exchange,
            routingKey: message.routingKey,
          },
          properties: {
            ...message.properties,
            headers: {
              recipients: '',
              ...message.properties.headers
            },
            timestamp: message.properties.timestamp?.getTime() ?? Date.now(),
          },
        },
        ack: (): void => {
          connection.basicAck(message.deliveryTag);
        },
        nack: (): void => {
          connection.basicNack(message.deliveryTag);
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
    return this.handlers[handlerName] ?? this.handlers[DEFAULT_ACTION];
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
  subscribe(onConsume: MessageHandler): Promise<void> {
    this.setActionHandler(DEFAULT_ACTION, onConsume);

    return this.initQueue(this.name);
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
    await connection.queueBind(this.name, ServiceConnection.getTopicExchange(this.options.exchange), `*.${actionType}`);
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
      await this.consumeQueue(queue, (message: AMQPMessage) => {
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

    try {
      const connection = await this.connection;
      const queue = this.queuesConsumerTags[this.name];

      if (queue !== undefined) {
        await connection.basicCancel(queue);
      }

      this.log.info(`[amqp-connection] unsubscribed from queue "${this.name}"\n`);
    } catch (error) {
      this.log.error('[amqp-connection] cannot unsubscribe. \n', error instanceof Error ? error.message : error);
    } finally {
      delete this.queuesConsumerTags[this.name];
    }
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

      this.log.error(`[amqp-connection] Cannot close connection. ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    }
  }

  /**
   * Consume queue and bind callback to incoming messages
   */
  async consumeQueue(queue: string, callback: AMQPMessageCallback): Promise<boolean> {
    if (!this.connection) {
      throw new ConnectionNotInitialized();
    }
    const connection = await this.connection;
    await connection.prefetch(1);
    const { tag } = await connection.basicConsume(queue, { noAck: false }, callback);
    this.queuesConsumerTags[queue] = tag;

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
  queueOptions: QueueOptions,
  serviceName: string,
  log: Logger
): { service: ServiceConnection; connection: Promise<AMQPConnection> } => {
  const service = new ServiceConnection(adapter, options, queueOptions, serviceName, log);
  const connection = service.connect();

  return { service, connection };
};

export default connectService;
