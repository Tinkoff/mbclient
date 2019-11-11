## [6.2.2](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/compare/v6.2.1...v6.2.2) (2019-10-01)


### Bug Fixes

* fixed ClientSendMessage typings (requestId and correlationId was required) ([4cbf318](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/commit/4cbf318))
* fixed repo link ([82e2e1b](https://gitlab-rnd.tcsbank.ru/pfa/libs-server-message-broker-client/commit/82e2e1b))

# Changelog

## [6.2.1]
- Исправлен путь к тайпингам библиотеки.

## [6.1.0]
- Добавлен новый статус - disconnected
- ServiceConnection унаследован от EventEmitter и теперь эмиттит события при изменении статуса соединения
- Теперь есть возможность подписаться на события состояния подключения к amqp

## [6.0.3]
### Изменено
- Исправления в CI

## [6.0.2]
### Изменено
- amqplib обновлен до версии 0.5.3
- Добавлен CI

## [6.0.1]
### Изменено
- команда test изменена на check
- исправлен интерфейс сообщения в send

## [6.0.0]
### Изменено
- Из зависимостей убран @pfa/server-log
- logger обязательно необходимо передавать в опциях
- добавлен метод disconnect
- действие по умолчанию для неизвестных сообщений - ack и логгирование ошибки
- подписка не выполняется если нет экшенов (producer only)

## [5.0.0] - 2018-01-09
### Изменено
- Обновлен @pfa/server-log до версии 2.0.0

## [4.3.0] - 2017-11-01
### Изменено
- поддержка reconnects, heartveat

## [4.1.3] - 2017-10-29
### Изменено
- Убран password из options при логгировании

## [4.1.0] - 2017-10-10
### Изменено
- Обновлены зависимости
- Обновлены настройки ESLint и Flow

## [4.0.0] - 2017-10-10
### Изменено
- Больше не нужно сериализовать/десериализовать поле content в сообщениях вручную
