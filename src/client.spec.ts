import { createClient } from './index';
import connect from './connection';

jest.mock('./connection', () =>
  jest.fn().mockReturnValue({
    service: {
      postMessage: jest.fn(),
      subscribe: jest.fn(),
      subscribeOn: jest.fn(),
      unsubscribe: jest.fn(),
      on: jest.fn(),
      once: jest.fn()
    },
    connection: Promise.resolve()
  })
);
const now = 1479427200000;
jest.spyOn(Date, 'now').mockImplementation(() => now);

const connectMock = (connect as unknown) as jest.Mock;

const optionsMock = {
  serviceName: 'test',
  subscriptions: {
    actionFilter: '^logAction$',
    type: 'black',
    subscriptions: ['news']
  },
  connectOptions: {
    username: 'test',
    password: '123',
    host: 'localhost:5672'
  },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
};

describe('createClient', () => {
  it('is a function', () => {
    expect(typeof createClient).toBe('function');
  });

  it('calls connect', () => {
    createClient(optionsMock);

    expect(connect).toBeCalledWith(optionsMock);
  });

  it('returns object with methods', () => {
    const client = createClient(optionsMock);

    expect(typeof client).toBe('object');
    expect(client).toHaveProperty('send');
    expect(client).toHaveProperty('consume');
    expect(client).toHaveProperty('consumeByAction');
    expect(client).toHaveProperty('cancel');
  });

  describe('client methods', () => {
    const connectOpt = {
      service: {
        postMessage: jest.fn(),
        subscribe: jest.fn(),
        subscribeOn: jest.fn(),
        unsubscribe: jest.fn(),
        on: jest.fn(),
        once: jest.fn()
      },
      connection: Promise.resolve()
    };
    connectMock.mockReturnValue(connectOpt);
    const client = createClient(optionsMock);
    describe('#send', () => {
      it('is function', () => {
        expect(typeof client.send).toBe('function');
      });

      it('posts message to service queue', async () => {
        await client.send({
          action: 'test',
          requestId: '1',
          correlationId: '1',
          recipients: ['news'],
          payload: 'test',
          routingKey: 'test_route',
          isOriginalContent: false
        });

        expect(connectOpt.service.postMessage.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Array [
    "news",
  ],
  "test",
  Object {
    "correlationId": "1",
    "headers": Object {
      "action": "test",
      "isOriginalContent": false,
      "recipients": "news",
      "requestId": "1",
      "routingKey": "test_route",
    },
    "replyTo": "test",
    "timestamp": 1479427200000,
  },
]
`);
      });
    });

    describe('#consume', () => {
      const callback = jest.fn();

      it('is a function', () => {
        expect(typeof client.consume).toBe('function');
      });

      it('subscribes on service queue', async () => {
        await client.consume(callback);
        expect(connectOpt.service.subscribe).lastCalledWith(callback);
      });
    });

    describe('#consumeByAction', () => {
      const callback = jest.fn();

      it('is a function', () => {
        expect(typeof client.consumeByAction).toBe('function');
      });

      it('subscribes on input queue', async () => {
        await client.consumeByAction('someAction', callback);
        expect(connectOpt.service.subscribeOn).lastCalledWith('someAction', callback);
      });
    });

    describe('#cancel', () => {
      it('is a function', () => {
        expect(typeof client.cancel).toBe('function');
      });

      it('unsubscribes from queue', async () => {
        await client.cancel();

        expect(connectOpt.service.unsubscribe).toBeCalled();
      });
    });
  });
});
