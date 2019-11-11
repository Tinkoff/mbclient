import { connect } from 'amqplib';
import getAMQPNodeAdapter from './amqp-node';

const connectMock = (connect as unknown) as jest.Mock<any>;

describe('amqp.node adapter', () => {
  it('is function', async () => {
    expect(typeof getAMQPNodeAdapter).toBe('function');
  });

  it('resolves adapter on call', () => {
    const adapter = getAMQPNodeAdapter();
    expect(adapter).toHaveProperty('connect');
  });

  it('connect adds event listeners', async () => {
    const createChannelOpt = { on: jest.fn(), prefetch: jest.fn() };
    const connectOpt = {
      createChannel: jest.fn().mockResolvedValue(createChannelOpt),
      on: jest.fn()
    };
    connectMock.mockResolvedValue(connectOpt);
    const adapter = getAMQPNodeAdapter();

    await adapter.connect(
      'connection-string',
      { username: 'username', password: 'password' },
      jest.fn()
    );

    expect(connectOpt.on.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    "error",
    [Function],
  ],
  Array [
    "close",
    [Function],
  ],
]
`);

    expect(createChannelOpt.on.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    "error",
    [Function],
  ],
  Array [
    "return",
    [Function],
  ],
  Array [
    "drain",
    [Function],
  ],
]
`);

    expect(createChannelOpt.prefetch.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  1,
]
`);
  });
});
