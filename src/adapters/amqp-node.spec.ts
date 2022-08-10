import { AMQPClient, AMQPError } from '@cloudamqp/amqp-client';
import getAMQPNodeAdapter from './amqp-node';

const AMQPClientMock = (AMQPClient as unknown) as jest.Mock<any>;

describe('amqp.node adapter', () => {
  it('is function', async () => {
    expect(typeof getAMQPNodeAdapter).toBe('function');
  });

  it('resolves adapter on call', () => {
    const adapter = getAMQPNodeAdapter();
    expect(adapter).toHaveProperty('connect');
  });

  it('connect adds event listeners', async () => {
    const channelOpt = {
      prefetch: jest.fn()
    };
    const connectOpt = {
      channel: jest.fn().mockResolvedValue(channelOpt),
      onerror: jest.fn()
    };
    const amqpOpt = {
      connect: jest.fn().mockResolvedValue(connectOpt)
    };
    AMQPClientMock.mockReturnValue(amqpOpt);
    const closeHandler = jest.fn();
    const adapter = getAMQPNodeAdapter();

    await adapter.connect(
      'amqp://localhost',
      closeHandler
    );
    connectOpt.onerror({ message: 'some error' } as AMQPError);

    expect(closeHandler).lastCalledWith({ message: 'some error' });

    expect(channelOpt.prefetch.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  1,
]
`);
  });
});
