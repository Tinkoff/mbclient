# Message Broker Client/Server

The MB client creates an abstraction over the inter-service interaction on top of RabbitMQ. The library defines a common interface for messages and provides ways to send and subscribe to them. The client supports automatic re-connections to RabbitMQ and support for the Rabbit cluster.

The mechanism is quite simple and currently supports 2 simple operation modes (sending directly to the queue, sending to topic exchange).

When a client created, a durable topic exchange ("dispatcher" by default) is automatically created, and a service queue (with the name that was passed as serviceName during initialization).

When sending a message indicating the recipients, the message sent to their queue directly. Otherwise, the message sent via routingKey "{serviceName}.{Action}" to the dispatcher exchange.

Check [FAQ](#FAQ) if you have questions.

## Create client

```javascript
import { createClient } from 'mbclient';

const logger = {
  info: console.log,
  warn: console.log,
  error: console.error,
}

const client = createClient({
  serviceName: 'news',
  logger,
  connectOptions: {
    username: 'test',
    password: '123',
    host: 'localhost',
    amqps: true,
    frameMax: 8192,
  },
});
```

See [AMQPOptions](https://github.com/Tinkoff/mbclient/blob/master/src/adapters/amqp-node.ts#L3) interface to get all available options.

## Subscribing

### Subscribe to messages by message type

```javascript
  // listening to messages
  client.consumeByAction('logAction', ({ message, ack, nack }) => {
    // do something
    ack();
  });

  client.consumeByAction('otherAction', ({ message, ack, nack }) => {
    // do something
    ack();
  });
```

### Subscribe to all messages from service's queue

The handler will be called if there is no handler for specified action type.

```javascript
  client.consume(({ message, ack, nack }) => {
    // do something
    ack();
  });
```

## Publishing

### Publishing a message indicating recipients

```javascript
  client.send({
    action: 'comeAction',
    payload: 'some payload',
    requestId: 'id',
    recipients: ['news', 'test'] // a message will be sent to news and test
  });
```

### Publication without specifying recipients (broadcast)
```javascript
  client.send({
    action: 'someAction', // Everyone who consumed on someAction will receive this message
    payload: 'some payload',
    requestId: 'id',
  });
```

## Subscribe to connection status

It is possible to subscribe to a change in connection status with rabbitmq

```javascript
client.on('disconnected', () => {
 // do something
});

client.on('connected', () => {
 // do something
});
```

Supported Events:

`connecting` - Attempt to connect to amqp

`connected` - Successful connection to amqp

`disconnecting` - Close the connection (usually emitted when calling close for a graceful disconnect)

`disconnected` - Loss of connection with amqp due to an error or as a result of processing close ()

## FAQ

### How to send a message to an exchange other than the default one?

Create one more client instance with required exchange name in connectOptions.

### How to send a message with specific routing key?

```javascript
client.send({
  action: 'someAction',
  payload: 'some payload',
  routingKey: 'my.routingKey'
});
```

### My action handler receive unexpected messages. How is this possible?

It may happen because of action names collision. For example, service A sends messages with action `entityCreated`
to service B directly (with specifying `recipients: ['serviceB']`). Later a service C was added that sends messages
with the same action, but uses broadcast sending. In this case service B will also receive messages from service C.

## License

```
Copyright 2019 Tinkoff Bank

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
