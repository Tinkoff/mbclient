# Клиент брокера сообщений

[![pipeline status](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/badges/master/pipeline.svg)](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/commits/master)
[![coverage report](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/badges/master/coverage.svg)](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/commits/master)

Предназначен для соединения и работы с сервисом RabbitMQ

Примеры использования:

## Подписка
### Подписка на broadcast сообщения
```javascript
const client = createClient({
    serviceName: 'news',
    connectOptions: {
      username: 'test',
      password: '123',
      host: 'localhost',
      port: 5672,
    },
  });
```

###
### Подписка на broadcast сообщения по типу сообщения

```javascript
  const client = createClient({
    serviceName: 'news',
    connectOptions: {
      username: 'test',
      password: '123',
      host: 'localhost',
      port: 5672,
    },
  });

  // слушаем сообщения
  client.consumeByAction('logAction', ({ message, ack, nack }) => {
    // do something
    ack();
  });

  client.consumeByAction('otherAction', ({ message, ack, nack }) => {
    // do something
    ack();
  });
  ```

## Публикация
### Публикация сообщения с указанием получателей
```javascript
  client.send({
    action: 'comeAction';
    payload: 'some payload';
    requestId: 'id';
    recipients: ['news', 'test']; // сообщение будет отправлено news/test
  });
```

### Публикация без указания получателей (broadcast)
```javascript
  client.send({
    action: 'comeAction';
    payload: 'some payload';
    requestId: 'id';
  });
```

## Подписка на состояние соединения

Есть возможность подписаться на изменение состояния соединения с rabbitmq

```javascript
client.on('disconnected', () => {
 // do something
});

client.on('connected', () => {
 // do something
});
```

Поддерживаемые события:

`connecting` - Попытка подключения к amqp

`connected` - Успешное подключение к amqp

`disconnecting` - Закрытие соединения (обычно эмиттится при вызове close для graceful отключения)

`disconnected` - Потеря соединения с amqp в связи с ошибкой или в результате отработки close()
