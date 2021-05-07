import { AMQPOptions } from './adapters/amqp-node';

export class ConnectServicesError extends Error {
  payload: unknown;

  constructor(msg: string, errPayload: unknown = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class AmqpConnectError extends Error {
  payload: unknown;

  constructor(msg: string, errPayload: unknown = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class AmqpConnectGracefullyStopped extends Error {
  payload: unknown;

  constructor(msg: string, errPayload: unknown = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class EmptyMessageError extends Error {
  payload: unknown;

  constructor(msg: string, errPayload: unknown = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class ConnectionNotInitialized extends Error {
  constructor() {
    super('Connection was not ininialized with connect() method.');
  }
}

export function connectServicesError(message: unknown): ConnectServicesError {
  return new ConnectServicesError('Error connecting services.', message);
}

export function amqpConnectGracefullyStopped(): AmqpConnectGracefullyStopped {
  return new AmqpConnectGracefullyStopped('Connection process gracefully stopped.');
}

export function amqpConnectError(options: AMQPOptions, message: string): AmqpConnectError {
  let errorString = `Connection to AMQP server failed.\noptions:\n`;
  const { password, ...restOptions } = options;
  errorString += JSON.stringify(restOptions);
  errorString += `\nerror: ${message}`;

  return new AmqpConnectError(errorString);
}

export function emptyMessageError(): EmptyMessageError {
  const errorString = `received an empty message.
                      looks like connection was lost or vhost was deleted,
                      cancelling subscriptions to queues`;

  return new EmptyMessageError(errorString);
}
