import {
  amqpConnectError,
  AmqpConnectError,
  amqpConnectGracefullyStopped,
  AmqpConnectGracefullyStopped,
  connectServicesError,
  ConnectServicesError,
  emptyMessageError,
  EmptyMessageError,
  ConnectionNotInitialized,
  unexpectedNonStringAction,
  UnexpectedNonStringAction
} from './errors';

it('should have amqpConnectError', () => {
  expect(typeof amqpConnectError).toBe('function');
  const error = amqpConnectError({ username: 'guest', password: 'guest' }, 'some error');
  expect(error).toBeInstanceOf(AmqpConnectError);
});

it('should have amqpConnectGracefullyStopped', () => {
  expect(typeof amqpConnectError).toBe('function');
  const error = amqpConnectGracefullyStopped();
  expect(error).toBeInstanceOf(AmqpConnectGracefullyStopped);
});

it('should have connectServicesError', () => {
  expect(typeof connectServicesError).toBe('function');
  const error = connectServicesError('some error');
  expect(error).toBeInstanceOf(ConnectServicesError);
});

it('should have emptyMessageError', () => {
  expect(typeof emptyMessageError).toBe('function');
  const error = emptyMessageError();
  expect(error).toBeInstanceOf(EmptyMessageError);
});

it('should have ConnectionNotInitialized', () => {
  expect(typeof ConnectionNotInitialized).toBe('function');
});

it('should have unexpectedNonStringAction', () => {
  expect(typeof unexpectedNonStringAction).toBe('function');
  const error = unexpectedNonStringAction(undefined);
  expect(error).toBeInstanceOf(UnexpectedNonStringAction);
});
