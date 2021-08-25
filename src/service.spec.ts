import connectService, { ServiceConnection } from './service';
import { AMQPConnection } from './adapters/amqp-node';
import { ConnectionStatus } from './connection';
import { amqpConnectError, amqpConnectGracefullyStopped } from './errors';
import { Message } from './message';
import { Logger } from './logger';

const testAdapter = { connect: jest.fn() };
const optionsMock = {
  username: 'test',
  password: 'test123',
  host: 'localhost'
};
const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};
const amqpConnection = {
  assertQueue: jest.fn(),
  ack: jest.fn(),
  nack: jest.fn(),
  assertExchange: jest.fn(),
  bindQueue: jest.fn(),
  cancel: jest.fn(),
  close: jest.fn(),
  consume: jest.fn().mockReturnValue({ consumerTag: 'tag' }),
  prefetch: jest.fn(),
  publish: jest.fn(),
  sendToQueue: jest.fn()
};
let serviceConnection: ServiceConnection;

beforeEach(() => {
  serviceConnection = new ServiceConnection(testAdapter, optionsMock, 'dispatcher', logger);
  serviceConnection.connection = Promise.resolve<AMQPConnection>(amqpConnection);
  logger.error.mockClear();
});

describe('#constructor', () => {
  it('sets options', () => {
    expect(serviceConnection.options).toBe(optionsMock);
  });

  it('sets adapter', () => {
    expect(serviceConnection.amqp).toBe(testAdapter);
  });

  it('sets default action handler', () => {
    expect(serviceConnection.handlers).toHaveProperty('defaultAction');
    expect(typeof serviceConnection.handlers.defaultAction).toBe('function');
  });

  it('default action acks message', () => {
    const ack = jest.fn();
    serviceConnection.handlers.defaultAction({
      ack,
      nack: jest.fn(),
      message: {
        content: {},
        fields: {
          consumerTag: 'abc',
          deliveryTag: 3,
          exchange: 'ex',
          redelivered: false,
          routingKey: 'route'
        },
        properties: { headers: { recipients: 'recipient' }, timestamp: 123 }
      }
    });
    expect(ack).toBeCalled();
  });
});

describe('#getQueueOptions', () => {
  it('returns options with durable set to true', () => {
    expect(serviceConnection.getQueueOptions()).toEqual({ durable: true });
  });

  it('returns options with durabile set to true and ha-mode=all if configured in cluster mode', () => {
    serviceConnection.options.cluster = ['a', 'b', 'c'];

    expect(serviceConnection.getQueueOptions()).toEqual({
      arguments: {
        'ha-mode': 'all'
      },
      durable: true
    });
  });
});

describe('#isClusterConnection', () => {
  it('returns true if one or more hosts provided via "cluster"', () => {
    serviceConnection.options.cluster = ['a', 'b', 'c'];

    expect(serviceConnection.isClusterConnection()).toBe(true);
  });

  it('returns false if no clusters present in "cluster"', () => {
    serviceConnection.options.cluster = [];

    expect(serviceConnection.isClusterConnection()).toBe(false);
  });

  it('returns false if "cluster" property not set', () => {
    serviceConnection.options.cluster = undefined;

    expect(serviceConnection.isClusterConnection()).toBe(false);
  });
});

describe('#connect', () => {
  it('calls and awaits getConnection, then asserts queues and topic exchange', async () => {
    serviceConnection.getConnection = jest.fn();
    serviceConnection.assertServiceQueue = jest.fn();
    serviceConnection.assertTopicExchange = jest.fn();

    await serviceConnection.connect();

    expect(serviceConnection.getConnection).toBeCalled();
    expect(serviceConnection.assertServiceQueue).toBeCalled();
    expect(serviceConnection.assertTopicExchange).toBeCalled();
  });
});

describe('#assertServiceQueue', () => {
  it('asserts and await assertion of service queue', async () => {
    serviceConnection.getQueueOptions = jest.fn().mockReturnValue({ durable: true });

    await serviceConnection.assertServiceQueue();

    expect(amqpConnection.assertQueue).lastCalledWith('dispatcher', { durable: true });
  });

  it('should throw if connection not initialized', async () => {
    const notInitializedServiceConnection = new ServiceConnection(testAdapter, optionsMock, 'dispatcher', logger);

    await expect(notInitializedServiceConnection.assertServiceQueue()).rejects.toThrowError('Connection was not initialized with connect() method.');
  });
});

describe('#getConnection', () => {
  it('sets retry strategy from options and retries on errors', async () => {
    const serviceConn = new ServiceConnection(testAdapter, optionsMock, 'dispatcher', logger);

    const retryStrategy = jest.fn().mockReturnValue(5);

    serviceConn.options.retryStrategy = retryStrategy;
    serviceConn.options.maxReconnects = 2;
    serviceConn.getConnectionString = (): never => {
      throw new Error('Connection error');
    };

    await expect(serviceConn.getConnection()).rejects.toThrow(amqpConnectError(optionsMock, 'Maximum attempts exceeded.'));

    expect(retryStrategy).toBeCalledWith(1);
    expect(retryStrategy).toBeCalledWith(2);
  });

  it('calls adapter connect method', async () => {
    const mockConnect = jest.fn();
    const mockConnectionEventHandler = jest.fn();

    serviceConnection.amqp.connect = mockConnect;
    serviceConnection.connectionEventHandler = mockConnectionEventHandler

    await serviceConnection.getConnection();
    mockConnect.mock.calls[0]?.[2]('close', {});
    expect(mockConnect).toBeCalled();
    expect(mockConnectionEventHandler).toBeCalledWith('close', {});
  });

  it('generate error when status is disconnecting', async () => {
    const serviceConn = new ServiceConnection(testAdapter, optionsMock, 'dispatcher', logger);
    serviceConn.status = ConnectionStatus.DISCONNECTING;
    await expect(serviceConn.getConnection()).rejects.toThrow(amqpConnectGracefullyStopped());
  });
});

describe('#connectionEventHandler', () => {
  const message = { content: 'message' };

  it('calls connection error handler on error event', () => {
    serviceConnection.handleConnectionClose = jest.fn().mockResolvedValue({});

    serviceConnection.connectionEventHandler('close', message as unknown as Message);

    expect(serviceConnection.handleConnectionClose).lastCalledWith(message);
  });
  it('an event other than close is logged with the type warn', () => {
    const warnStub = jest.fn();
    serviceConnection.log = {warn: warnStub} as unknown as Logger;
    serviceConnection.connectionEventHandler('blocked', message as unknown as Message);

    expect(warnStub).toBeCalledWith({eventName: 'blocked', eventMessage: message}, '[amqp-connection] Unsupported connection event');
  });
});

describe('#handleConnectionError', () => {
  it('logs error to console', () => {
    serviceConnection.unsubscribe = jest.fn();
    serviceConnection.connect = jest.fn();
    const message = { content: 'message' };

    serviceConnection.handleConnectionClose(message as any);

    const { password, ...loggedOptions } = optionsMock;
    expect(logger.error).toBeCalledWith('[amqp-connection] Connection closed.', message, loggedOptions);
  });
});

describe('#getConnectionString', () => {
  it('if in cluster mode calls getConnectionStringFromCluster', () => {
    serviceConnection.getConnectionStringFromCluster = jest.fn().mockReturnValue('connection');
    serviceConnection.getConnectionStringStandalone = jest.fn();
    serviceConnection.options.cluster = ['a', 'b', 'c'];

    serviceConnection.getConnectionString();

    expect(serviceConnection.getConnectionStringFromCluster).toBeCalled();
    expect(serviceConnection.getConnectionStringStandalone).not.toBeCalled();
  });

  it('if in standalone mode calls getConnectionStringStandalone', () => {
    serviceConnection.getConnectionStringStandalone = jest.fn().mockReturnValue('connection');
    serviceConnection.getConnectionStringFromCluster = jest.fn();
    serviceConnection.options.cluster = [];

    serviceConnection.getConnectionString();

    expect(serviceConnection.getConnectionStringFromCluster).not.toBeCalled();
    expect(serviceConnection.getConnectionStringStandalone).toBeCalled();
  });

  it('throws if no connection string in result', () => {
    serviceConnection.getConnectionStringStandalone = jest.fn();
    serviceConnection.getConnectionStringFromCluster = jest.fn();
    serviceConnection.options.cluster = ['a', 'b', 'c'];

    expect(serviceConnection.getConnectionString).toThrow();
  });

  it('returns connection string', () => {
    serviceConnection.getConnectionStringStandalone = jest.fn().mockReturnValue('connection');
    serviceConnection.getConnectionStringFromCluster = jest.fn();
    serviceConnection.options.cluster = [];

    const connectionString = serviceConnection.getConnectionString();

    expect(connectionString).toBe('connection');
  });
});

describe('#getConnectionStringStandalone', () => {
  it('creates connection string from options', () => {
    const connectionString = serviceConnection.getConnectionStringStandalone();

    expect(connectionString).toBe('amqp://test:test123@localhost/?heartbeat=30');
  });

  it('logs current connection mode', () => {
    serviceConnection.getConnectionStringStandalone();
    serviceConnection.getConnectionStringStandalone();

    expect(logger.info.mock.calls[logger.info.mock.calls.length - 1]).toMatchInlineSnapshot(`
Array [
  "[amqp-connection] Configured for standalone",
]
`);
  });
});

describe('#getConnectionStringFromCluster', () => {
  it('picks connection string from options property "cluster"', () => {
    serviceConnection.options.cluster = ['host1:5672', 'host2:5672', 'host3:5672'];

    const randomCluster = serviceConnection.getConnectionStringFromCluster();

    expect(
      serviceConnection.options.cluster.map(
        host => `amqp://${optionsMock.username}:${optionsMock.password}@${host}/?heartbeat=30`
      )
    ).toContain(randomCluster);
  });

  it('logs current connection mode', () => {
    serviceConnection.options.cluster = ['host1:5672', 'host2:5672', 'host3:5672'];
    serviceConnection.getConnectionStringFromCluster();
    serviceConnection.getConnectionStringFromCluster();

    expect(logger.info.mock.calls[logger.info.mock.calls.length - 1]).toMatchInlineSnapshot(`
Array [
  "[amqp-connection] Configured for cluster",
]
`);
  });
});

describe('#postMessage', () => {
  beforeEach(() => {
    const now = 1552405726176;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('calls connection "sendToQueue" with default options', async () => {
    await serviceConnection.postMessage(['news'], { foo: 'bar' }, { messageId: '42' });
    const mockCalls = amqpConnection.sendToQueue.mock.calls;

    expect(mockCalls[mockCalls.length - 1]).toMatchInlineSnapshot(`
Array [
  "news",
  Object {
    "data": Array [
      123,
      34,
      102,
      111,
      111,
      34,
      58,
      34,
      98,
      97,
      114,
      34,
      125,
    ],
    "type": "Buffer",
  },
  Object {
    "headers": Object {
      "recipients": "",
    },
    "messageId": "42",
    "persistent": true,
    "replyTo": "dispatcher",
    "timestamp": 1552405726176,
  },
]
`);
  });

  it('calls connection "sendToQueue" with default options overwritten', async () => {
    await serviceConnection.postMessage(
      ['news'],
      { foo: 'bar' },
      {
        messageId: '43'
      }
    );
    const mockCalls = amqpConnection.sendToQueue.mock.calls;
    expect(mockCalls[mockCalls.length - 1]).toMatchInlineSnapshot(`
Array [
  "news",
  Object {
    "data": Array [
      123,
      34,
      102,
      111,
      111,
      34,
      58,
      34,
      98,
      97,
      114,
      34,
      125,
    ],
    "type": "Buffer",
  },
  Object {
    "headers": Object {
      "recipients": "",
    },
    "messageId": "43",
    "persistent": true,
    "replyTo": "dispatcher",
    "timestamp": 1552405726176,
  },
]
`);
  });
});

describe('#messageHandler', () => {
  const messageMock = {
    content: Buffer.from(JSON.stringify({ foo: 'bar' })),
    properties: {
      headers: { recipients: 'rec', action: 'customAction' },
      timestamp: 123
    },
    fields: {
      consumerTag: 'abc',
      deliveryTag: 3,
      exchange: 'ex',
      redelivered: false,
      routingKey: 'route'
    }
  };

  it('validates message', async () => {
    const validateMessage = jest.spyOn(ServiceConnection, 'validateMessage');

    await serviceConnection.messageHandler(messageMock);

    expect(validateMessage).lastCalledWith(messageMock);
    validateMessage.mockRestore();
  });

  it('logs error if cannot validate', async () => {
    const validateMessage = jest.spyOn(ServiceConnection, 'validateMessage').mockImplementation(() => {
      throw new Error('validation error');
    });

    await serviceConnection.messageHandler(messageMock);

    expect(logger.error.mock.calls[logger.error.mock.calls.length - 1]).toMatchInlineSnapshot(`
Array [
  [Error: validation error],
]
`);

    validateMessage.mockRestore();
  });

  it('calls getActionHandler to get action handler', async () => {
    serviceConnection.getActionHandler = jest.fn();

    await serviceConnection.messageHandler(messageMock);

    expect(serviceConnection.getActionHandler).lastCalledWith('customAction');
  });

  it('calls action handler', async () => {
    const handler = jest.fn();
    serviceConnection.getActionHandler = (): jest.Mock => handler;

    await serviceConnection.messageHandler(messageMock);

    expect(handler.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Object {
    "ack": [Function],
    "message": Object {
      "content": Object {
        "foo": "bar",
      },
      "fields": Object {
        "consumerTag": "abc",
        "deliveryTag": 3,
        "exchange": "ex",
        "redelivered": false,
        "routingKey": "route",
      },
      "properties": Object {
        "headers": Object {
          "action": "customAction",
          "recipients": "rec",
        },
        "timestamp": 123,
      },
    },
    "nack": [Function],
  },
]
`);
  });
});

describe('#setActionHandler', () => {
  it('sets action handler to hash map', () => {
    const handlerMock = async (): Promise<void> => undefined;

    serviceConnection.setActionHandler('handler1', handlerMock);

    expect(serviceConnection.handlers.handler1).toBe(handlerMock);
  });
});

describe('#getActionHandler', () => {
  it('gets action handler from hash map', () => {
    const handlerMock = async (): Promise<void> => undefined;

    serviceConnection.handlers.handler1 = handlerMock;

    expect(serviceConnection.getActionHandler('handler1')).toBe(handlerMock);
  });
});

describe('#validateMessage', () => {
  it('not throws if message is valid', () => {
    const messageMock = {
      content: Buffer.from('hello world'),
      properties: {
        headers: { recipients: 'rec', action: 'customAction' },
        timestamp: 123
      },
      fields: {
        consumerTag: 'abc',
        deliveryTag: 3,
        exchange: 'ex',
        redelivered: false,
        routingKey: 'route'
      }
    };
    const validateMessage = ServiceConnection.validateMessage.bind(null, messageMock);

    expect(validateMessage).not.toThrow();
  });

  it('should throw if message is empty', () => {
    expect(() => ServiceConnection.validateMessage(null)).toThrowError('Received an empty message. Looks like connection was lost or vhost was deleted, cancelling subscriptions to queues');
  });
});

describe('#subscribe', () => {
  it('sets default action handler to one provided in parameters', async () => {
    serviceConnection.initQueue = jest.fn().mockResolvedValue(true);
    serviceConnection.setActionHandler = jest.fn().mockResolvedValue(true);

    await serviceConnection.subscribe(async () => undefined);

    expect(serviceConnection.setActionHandler).lastCalledWith('defaultAction', expect.any(Function));
  });
});

describe('#subscribeOn', () => {
  it('sets action handler for action', async () => {
    serviceConnection.initQueue = jest.fn().mockResolvedValue(true);
    serviceConnection.setActionHandler = jest.fn().mockResolvedValue(true);

    await serviceConnection.subscribeOn('actionAction', async () => undefined);

    expect(amqpConnection.bindQueue).lastCalledWith('dispatcher', 'dispatcher', '*.actionAction');
    expect(serviceConnection.setActionHandler).lastCalledWith('actionAction', expect.any(Function));
  });
});

describe('#initQueue', () => {
  it('consumes queue if it was not consumed before', async () => {
    serviceConnection.consumeQueue = jest.fn();

    serviceConnection.handlers = {
      defaultAction: async (): Promise<void> => undefined,
    };

    await serviceConnection.initQueue('input');

    expect(serviceConnection.consumeQueue).lastCalledWith('input', expect.any(Function));
  });

  it('not consumes queue if it is already consumed', async () => {
    serviceConnection.consumeQueue = jest.fn();
    serviceConnection.queuesConsumerTags.input = 'ssdSDGHISdfadsg';

    await serviceConnection.initQueue('input');

    expect(serviceConnection.consumeQueue).not.toBeCalled();
  });
});

describe('#unsubscribe', () => {
  it('cancels connection with queue consumer tag', async () => {
    serviceConnection.queuesConsumerTags.dispatcher = 'ssdSDGHISdfadsg';

    await serviceConnection.unsubscribe();

    expect(amqpConnection.cancel).lastCalledWith('ssdSDGHISdfadsg');
    expect(serviceConnection.queuesConsumerTags.input).toBeUndefined();
  });
});

describe('#consumeQueue', () => {
  it('consumes queue and saves its consumer tag to hash map', async () => {
    const result = await serviceConnection.consumeQueue('dispatcher', () => undefined);

    expect(amqpConnection.prefetch).lastCalledWith(1);
    expect(amqpConnection.consume).lastCalledWith('dispatcher', expect.any(Function));
    expect(serviceConnection.queuesConsumerTags.dispatcher).toBe('tag');
    expect(result).toBe(true);
  });
});

describe('connectService', () => {
  it('return object with service and connection', () => {
    const result = connectService(testAdapter, optionsMock, 'dispatcher', logger);
    result.connection.catch(() => {
      // Do nothing
    });
    expect(result).toHaveProperty('service');
    expect(result).toHaveProperty('connection');
  });
});

describe('#getTopicExchange', () => {
  it('should return default topic exchange when parameter exchange is empty', () => {
    expect(ServiceConnection.getTopicExchange()).toBe('dispatcher');
  });
  it('should return value parameter exchange when parameter exchange isn\'t empty', () => {
    expect(ServiceConnection.getTopicExchange('my_dispatcher')).toBe('my_dispatcher');
  });
});

describe('#getContent', () => {
  it('should return JSON parse object when buffer contains json object', () => {
    const exampleData = {route: 'test'};
    const content: Buffer = Buffer.from(JSON.stringify(exampleData));
    expect(ServiceConnection.getContent(content)).toEqual(exampleData);
  });
  it('should return default object with property data when buffer doesn\'t contain json object', () => {
    const exampleData = 'test';
    const content: Buffer = Buffer.from(exampleData);
    expect(ServiceConnection.getContent(content)).toEqual({data: 'test'});
  });
});

describe('#assertTopicExchange', () => {
  it('calls and awaits getConnection, then asserts queues and topic exchange', async () => {
    serviceConnection.connection = null;

    await expect(serviceConnection.assertTopicExchange()).rejects.toThrow('No connection');
  });
});
