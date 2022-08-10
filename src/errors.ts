import { AMQPOptions } from './adapters/amqp-node';

export class ConnectServicesError extends Error {
  payload: unknown;

  constructor(msg: string, errPayload: unknown) {
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
    super('Connection was not initialized with connect() method.');
  }
}

export function connectServicesError(message: unknown): ConnectServicesError {
  return new ConnectServicesError('Error connecting services.', message);
}

export class UnexpectedNonStringAction extends Error {
  action: unknown;

  constructor(msg: string, action: unknown) {
    super(msg);

    this.action = action;
  }
}

export function amqpConnectGracefullyStopped(): AmqpConnectGracefullyStopped {
  return new AmqpConnectGracefullyStopped('Connection process gracefully stopped.');
}

export function amqpConnectError(options: AMQPOptions, message: string): AmqpConnectError {
  const { password, ...restOptions } = options;

  return new AmqpConnectError(`Connection to AMQP server failed.\nOptions:\n${JSON.stringify(restOptions)}\nError: ${message}`);
}

export function emptyMessageError(): EmptyMessageError {
  const errorString = `Received an empty message. Looks like connection was lost or vhost was deleted, cancelling subscriptions to queues`;

  return new EmptyMessageError(errorString);
}

export function unexpectedNonStringAction(action: unknown): UnexpectedNonStringAction {
  return new UnexpectedNonStringAction('Received unexpected non-string action', action);
}
