import connect from './index';
import connectService from '../service/service';

jest.mock('../service');
jest.mock('./adapters/amqp-node', () => jest.fn().mockReturnValue({ connect: jest.fn() }));

const connectServiceMock = connectService as jest.Mock;

describe('connect', () => {
  it('calls connectServiceQueues with amqp.node adapter and computed options', async () => {
    const optionsMock = {
      connectOptions: {
        username: 'stub',
        password: 'test',
      },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      serviceName: 'test',
    };

    connect(optionsMock);

    expect(connectServiceMock.mock.calls[0]).toMatchInlineSnapshot(`
Array [
  Object {
    "connect": [MockFunction],
  },
  Object {
    "password": "test",
    "username": "stub",
  },
  "test",
  Object {
    "error": [MockFunction],
    "info": [MockFunction],
    "warn": [MockFunction],
  },
]
`);
  });
});
