import omit from 'lodash/omit';

export class ConnectServicesError extends Error {
  payload: object;

  constructor(msg: string, errPayload: object = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class AmqpConnectError extends Error {
  payload: object;

  constructor(msg: string, errPayload: object = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class AmqpConnectGracefullyStopped extends Error {
  payload: object;

  constructor(msg: string, errPayload: object = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class EmptyMessageError extends Error {
  payload: object;

  constructor(msg: string, errPayload: object = {}) {
    super(msg);

    this.payload = errPayload;
  }
}

export class ConnectionNotInitialized extends Error {
  constructor() {
    super('Connection was not ininialized with connect() method.');
  }
}

export function connectServicesError(message: any): ConnectServicesError {
  return new ConnectServicesError('Error connecting services.', message);
}

export function amqpConnectGracefullyStopped(): AmqpConnectGracefullyStopped {
  return new AmqpConnectGracefullyStopped('Connection process gracefully stopped.');
}

export function amqpConnectError(options: any, message: any): AmqpConnectError {
  let errorString = `Connection to AMQP server failed.\noptions:\n`;
  errorString += JSON.stringify(omit(options, ['password']));
  errorString += `\nerror: ${message}`;

  return new AmqpConnectError(errorString);
}

export function emptyMessageError(): EmptyMessageError {
  const errorString = `received an empty message.
                      looks like connection was lost or vhost was deleted,
                      cancelling subscriptions to queues`;

  return new EmptyMessageError(errorString);
}
