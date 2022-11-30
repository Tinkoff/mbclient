import connectService, { ServiceConnection } from './service';
import { AMQPConnection } from './adapters/amqp-node';
import { ConnectionStatus } from './connection';
import { amqpConnectError, amqpConnectGracefullyStopped, ConnectionNotInitialized } from './errors';

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
  basicAck: jest.fn(),
  basicCancel: jest.fn(),
  basicConsume: jest.fn().mockReturnValue({ tag: 'tag' }),
  basicNack: jest.fn(),
  basicPublish: jest.fn(),
  close: jest.fn(),
  exchangeDeclare: jest.fn(),
  prefetch: jest.fn(),
  queue: jest.fn(),
  queueBind: jest.fn()
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
          redelivered: false,
          exchange: 'ex',
          routingKey: 'route',
        },
        properties: {
          headers: { recipients: 'recipient' },
          timestamp: 1479427200000
        }
      }
    });
    expect(ack).toBeCalled();
  });
});

describe('#getQueueArgs', () => {
  it('return empty object if configured in standalone mode', () => {
    expect(serviceConnection.getQueueArgs()).toEqual({});
  });

  it('return ha-mode=all if configured in cluster mode', () => {
    serviceConnection.options.cluster = ['a', 'b', 'c'];

    expect(serviceConnection.getQueueArgs()).toEqual({ 'ha-mode': 'all' });
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
    await serviceConnection.assertServiceQueue();

    expect(amqpConnection.queue).lastCalledWith('dispatcher', { durable: true }, {});
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

    serviceConnection.amqp.connect = mockConnect;

    await serviceConnection.getConnection();
    expect(mockConnect).toBeCalled();
  });

  it('generate error when status is disconnecting', async () => {
    const serviceConn = new ServiceConnection(testAdapter, optionsMock, 'dispatcher', logger);
    serviceConn.status = ConnectionStatus.DISCONNECTING;
    await expect(serviceConn.getConnection()).rejects.toThrow(amqpConnectGracefullyStopped());
  });
});

describe('#handleConnectionClose', () => {
  it('reconnects if status is CONNECTED', async () => {
    serviceConnection.status = ConnectionStatus.CONNECTED;
    serviceConnection.unsubscribe = jest.fn().mockResolvedValue({});
    serviceConnection.connect = jest.fn();
    serviceConnection.initQueue = jest.fn();

    await serviceConnection.handleConnectionClose({} as unknown as Error);

    expect(serviceConnection.unsubscribe).toBeCalled();
    expect(serviceConnection.connect).toBeCalled();
    expect(serviceConnection.initQueue).not.toBeCalled();
  });

  it('reconnects and rebinds handlers', async () => {
    serviceConnection.status = ConnectionStatus.CONNECTED;
    serviceConnection.unsubscribe = jest.fn().mockResolvedValue({});
    const connection = { queueBind: jest.fn() };
    serviceConnection.connect = jest.fn().mockResolvedValue(connection);
    serviceConnection.initQueue = jest.fn();

    const handlerMock = async () => undefined;
    serviceConnection.setActionHandler('handler1', handlerMock);

    await serviceConnection.handleConnectionClose({} as unknown as Error);

    expect(serviceConnection.unsubscribe).toBeCalled();
    expect(serviceConnection.connect).toBeCalled();
    expect(serviceConnection.initQueue).toBeCalled();
    expect(connection.queueBind).toBeCalledWith('dispatcher', 'dispatcher', '*.handler1');
  });

  it('reconnects and rebinds handlers only once', async () => {
    serviceConnection.status = ConnectionStatus.CONNECTED;
    serviceConnection.unsubscribe = jest.fn().mockResolvedValue({});
    const connection = { queueBind: jest.fn() };
    serviceConnection.connect = jest.fn().mockResolvedValue(connection);
    serviceConnection.initQueue = jest.fn();

    const handlerMock = async () => undefined;
    serviceConnection.setActionHandler('handler1', handlerMock);
    serviceConnection.setActionHandler('handler1', handlerMock);

    await Promise.all([
      serviceConnection.handleConnectionClose({} as unknown as Error),
      serviceConnection.handleConnectionClose({} as unknown as Error),
      serviceConnection.handleConnectionClose({} as unknown as Error)
    ]);

    expect(serviceConnection.unsubscribe).toBeCalledTimes(1);
    expect(serviceConnection.connect).toBeCalledTimes(1);
    expect(serviceConnection.initQueue).toBeCalledTimes(1);
    expect(connection.queueBind).toBeCalledTimes(1);
  });

  it.each([ConnectionStatus.DISCONNECTING, ConnectionStatus.CONNECTING])('does not reconnect if status is %s', async (status) => {
    serviceConnection.status = status;
    serviceConnection.unsubscribe = jest.fn().mockResolvedValue({});
    serviceConnection.connect = jest.fn();
    serviceConnection.initQueue = jest.fn();

    await serviceConnection.handleConnectionClose({} as unknown as Error);

    expect(serviceConnection.unsubscribe).not.toBeCalled();
    expect(serviceConnection.connect).not.toBeCalled();
    expect(serviceConnection.initQueue).not.toBeCalled();
  });
});

describe('#handleConnectionError', () => {
  it('logs error to console', () => {
    serviceConnection.status = ConnectionStatus.CONNECTED;
    serviceConnection.unsubscribe = jest.fn();
    serviceConnection.connect = jest.fn();
    const message = { content: 'message' };

    serviceConnection.handleConnectionClose(message as any);

    const { password, ...loggedOptions } = optionsMock;
    expect(logger.error).toBeCalledWith('[amqp-connection] Connection closed.', message, loggedOptions);
  });
});

describe('#getConnectionString', () => {
  it('throws if connection string is empty', () => {
    serviceConnection.getConnectionStringStandalone = jest.fn().mockReturnValue('');
    serviceConnection.getConnectionStringFromCluster = jest.fn();
    serviceConnection.options.cluster = [];

    expect(() => serviceConnection.getConnectionString()).toThrow('Wrong configuration. Either cluster or standalone mode should be enabled');
  });

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

    expect(connectionString).toBe('amqp://test:test123@localhost/?frameMax=4096&heartbeat=30');
  });

  it('creates connection string from options with amqps', () => {
    serviceConnection.options.amqps = true;
    const connectionString = serviceConnection.getConnectionStringStandalone();

    expect(connectionString).toBe('amqps://test:test123@localhost/?frameMax=4096&heartbeat=30');
    delete serviceConnection.options.amqps;
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
        host => `amqp://${optionsMock.username}:${optionsMock.password}@${host}/?frameMax=4096&heartbeat=30`
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
    jest.useFakeTimers().setSystemTime(new Date(1479427200000));
  });

  it('throws error if connection is null', async () => {
    serviceConnection.connection = null;
    await expect(serviceConnection.postMessage(['news'], { foo: 'bar' }, { messageId: '42' })).rejects.toThrow(ConnectionNotInitialized);
  });

  it('calls connection "basicPublish" with default options', async () => {
    await serviceConnection.postMessage(['news'], { foo: 'bar' }, { messageId: '42' });
    const mockCalls = amqpConnection.basicPublish.mock.calls;

    expect(mockCalls[mockCalls.length - 1]).toMatchInlineSnapshot(`
Array [
  "",
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
    "timestamp": 2016-11-18T00:00:00.000Z,
  },
]
`);
  });

  it('calls connection "basicPublish" with default options overwritten', async () => {
    await serviceConnection.postMessage(['news'], { foo: 'bar' }, { messageId: '43' });
    const mockCalls = amqpConnection.basicPublish.mock.calls;
    expect(mockCalls[mockCalls.length - 1]).toMatchInlineSnapshot(`
Array [
  "",
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
    "timestamp": 2016-11-18T00:00:00.000Z,
  },
]
`);
  });

  it('calls connection "basicPublush" passing exchange if no recipients specified', async () => {
    await serviceConnection.postMessage([], { foo: 'bar' }, { messageId: '43' });
    const mockCalls = amqpConnection.basicPublish.mock.calls;

    expect(mockCalls[mockCalls.length - 1]).toMatchInlineSnapshot(`
Array [
  "dispatcher",
  "dispatcher.default",
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
    "timestamp": 2016-11-18T00:00:00.000Z,
  },
]
`);
  });
});

describe('#messageHandler', () => {
  const messageMock = {
    body: new Uint8Array(Buffer.from(JSON.stringify({ foo: 'bar' }))),
    consumerTag: 'abc',
    deliveryTag: 3,
    exchange: 'ex',
    redelivered: false,
    routingKey: 'route',
    properties: {
      headers: { recipients: 'rec', action: 'customAction' },
      timestamp: new Date(1479427200000)
    }
  };

  it('throws error if connection is null', async () => {
    serviceConnection.connection = null;

    await expect(serviceConnection.messageHandler(messageMock)).rejects.toThrow(ConnectionNotInitialized);
  });

  it("logs error if truthy action field in headers has type different from string", async () => {
    await serviceConnection.messageHandler({
      ...messageMock,
      properties: {
        ...messageMock.properties,
        headers: {
          ...messageMock.properties.headers,
          action: true
        },
      }
    });

    expect(logger.error).toHaveBeenCalled();
  });

  it('delegates message validation and parsing to getContentFromMessage', async () => {
    const getContentFromMessage = jest.spyOn(ServiceConnection, 'getContentFromMessage');

    await serviceConnection.messageHandler(messageMock);

    expect(getContentFromMessage).lastCalledWith(messageMock);
    getContentFromMessage.mockRestore();
  });

  it('logs error if cannot validate', async () => {
    const getContentFromMessage = jest.spyOn(ServiceConnection, 'getContentFromMessage').mockImplementation(() => {
      throw new Error('validation error');
    });

    await serviceConnection.messageHandler(messageMock);

    expect(logger.error.mock.calls[logger.error.mock.calls.length - 1]).toMatchInlineSnapshot(`
Array [
  [Error: validation error],
]
`);

    getContentFromMessage.mockRestore();
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
        "timestamp": 1479427200000,
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

describe('#getContentFromMessage', () => {
  const messageMock = {
    body: new Uint8Array(Buffer.from('hello world')),
    consumerTag: 'abc',
    deliveryTag: 3,
    exchange: 'ex',
    redelivered: false,
    routingKey: 'route',
    properties: {
      headers: { recipients: 'rec', action: 'customAction' },
      timestamp: new Date(1479427200000)
    }
  };

  it('not throws if message is valid', () => {
    expect(() => {
      ServiceConnection.getContentFromMessage(messageMock);
    }).not.toThrow();
  });

  it('throws if message is empty', () => {
    expect(() => {
      ServiceConnection.getContentFromMessage({ ...messageMock, body: null })
    }).toThrowError('Received an empty message. Looks like connection was lost or vhost was deleted, cancelling subscriptions to queues');
  });

  it('delegates body parsing to getContent', () => {
    const getContent = jest.spyOn(ServiceConnection, 'getContent');

    const result = ServiceConnection.getContentFromMessage(messageMock);

    expect(getContent).lastCalledWith(messageMock.body);
    expect(result).toEqual({ data: 'hello world' });
    getContent.mockRestore();
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
  it('throws error if connection is null', async () => {
    serviceConnection.connection = null;
    await expect(serviceConnection.subscribeOn('actionAction', jest.fn())).rejects.toThrow(ConnectionNotInitialized);
  });

  it('sets action handler for action', async () => {
    serviceConnection.initQueue = jest.fn().mockResolvedValue(true);
    serviceConnection.setActionHandler = jest.fn().mockResolvedValue(true);

    await serviceConnection.subscribeOn('actionAction', async () => undefined);

    expect(amqpConnection.queueBind).lastCalledWith('dispatcher', 'dispatcher', '*.actionAction');
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
  it('throws error if connection is null', async () => {
    serviceConnection.connection = null;

    await expect(serviceConnection.unsubscribe()).rejects.toThrow(ConnectionNotInitialized);
  });

  it('logs any error occured', async () => {
    serviceConnection.connection = Promise.reject(new Error());

    await serviceConnection.unsubscribe();

    expect(logger.error).toHaveBeenCalled();
  });

  it('cancels connection with queue consumer tag', async () => {
    serviceConnection.queuesConsumerTags.dispatcher = 'ssdSDGHISdfadsg';

    await serviceConnection.unsubscribe();

    expect(amqpConnection.basicCancel).lastCalledWith('ssdSDGHISdfadsg');
    expect(serviceConnection.queuesConsumerTags.input).toBeUndefined();
  });
});

describe('#close', () => {
  it('throws if connection not initialized', async () => {
    serviceConnection.connection = null;

    await expect(serviceConnection.close()).rejects.toThrow(ConnectionNotInitialized);
  });

  it('set status to DISCONNECTING before closing and to DISCONNECTED after', async () => {
    const setConnectionStatus = jest.spyOn(serviceConnection, 'setConnectionStatus');

    await serviceConnection.close();

    expect(setConnectionStatus).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTING);
    expect(setConnectionStatus).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
  });

  it('closes amqp channel', async () => {
    await serviceConnection.close();

    expect(amqpConnection.close).toHaveBeenCalled();
  });

  it('log info if connection already gracefully stopped', async () => {
    serviceConnection.connection = Promise.reject(amqpConnectGracefullyStopped());

    await serviceConnection.close();

    expect(logger.info).toHaveBeenCalled();
  });

  it('log error if any other error occured', async () => {
    serviceConnection.connection = Promise.reject(new Error());

    await serviceConnection.close();

    expect(logger.error).toHaveBeenCalled();
  });
});

describe('#consumeQueue', () => {
  it('throws error if connection is null', async () => {
    serviceConnection.connection = null;
    await expect(serviceConnection.consumeQueue('dispatcher', jest.fn())).rejects.toThrow(ConnectionNotInitialized);
  });

  it('consumes queue and saves its consumer tag to hash map', async () => {
    const result = await serviceConnection.consumeQueue('dispatcher', () => undefined);

    expect(amqpConnection.prefetch).lastCalledWith(1);
    expect(amqpConnection.basicConsume).lastCalledWith('dispatcher', { noAck: false }, expect.any(Function));
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
    const exampleData = { route: 'test' };
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

describe('#hasHandlers', () => {
  it('should return false if only default handler set', () => {
    expect(serviceConnection.hasHandlers()).toEqual(false);
  });
  it('should return true if custom handler set', () => {
    serviceConnection.setActionHandler('handler1', jest.fn());
    expect(serviceConnection.hasHandlers()).toEqual(true);
  });
});
