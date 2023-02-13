## [3.2.2](https://github.com/Tinkoff/mbclient/compare/v3.2.1...v3.2.2) (2023-02-13)


### Bug Fixes

* change default host ([dcc30ff](https://github.com/Tinkoff/mbclient/commit/dcc30ffba56c265e8640b652c89b23dd1972c9c7))
* delete unused appId parameter ([73230ef](https://github.com/Tinkoff/mbclient/commit/73230ef52bcdd2690193c9b178426d40556e63ba))

## [3.2.1](https://github.com/Tinkoff/mbclient/compare/v3.2.0...v3.2.1) (2022-12-01)


### Bug Fixes

* **mbclient:** fix reconnect logic ([3cf0450](https://github.com/Tinkoff/mbclient/commit/3cf045090427c640a8b20e0509ba3c8df53c29e8))
* **mbclient:** make logger required in CreateServiceOptions interface ([623dbd2](https://github.com/Tinkoff/mbclient/commit/623dbd26cb70b7029f0114fbe5fe0e0388e0c71b))

# [3.2.0](https://github.com/Tinkoff/mbclient/compare/v3.1.0...v3.2.0) (2022-09-23)


### Features

* add protocol and maxFrame configuration ([6e634c3](https://github.com/Tinkoff/mbclient/commit/6e634c373545c50d84b120717366ebff3a7e965b))

# [3.1.0](https://github.com/Tinkoff/mbclient/compare/v3.0.0...v3.1.0) (2022-08-24)


### Features

* replace amqplib with amqp-client.js ([9f2dd56](https://github.com/Tinkoff/mbclient/commit/9f2dd56270fe82a0449bbd85c5ef2c978a22f0e5))

# [3.0.0](https://github.com/Tinkoff/mbclient/compare/v2.3.0...v3.0.0) (2022-06-10)


### Features

* **deps:** update amqplib to 0.10.0 ([#36](https://github.com/Tinkoff/mbclient/issues/36)) ([4fc9def](https://github.com/Tinkoff/mbclient/commit/4fc9defa197eccb51c4cbb1f0bac733bc9a3aeda))


### BREAKING CHANGES

* **deps:** drop Node.js v10 support

Update all dev dependencies

Add Node.js v18 support.

# [2.3.0](https://github.com/Tinkoff/mbclient/compare/v2.2.1...v2.3.0) (2022-03-10)


### Features

* add action value to no action error message in default handler and fix context on close event ([faaba6e](https://github.com/Tinkoff/mbclient/commit/faaba6eee7f6ece36cb385c7270c6371d242293c))

## [2.2.1](https://github.com/Tinkoff/mbclient/compare/v2.2.0...v2.2.1) (2021-10-08)


### Bug Fixes

* restore queue bindings on reconnect ([#34](https://github.com/Tinkoff/mbclient/issues/34)) ([c264b67](https://github.com/Tinkoff/mbclient/commit/c264b674ac6c231c7961ce87f1bd473af50894e1))

# [2.2.0](https://github.com/Tinkoff/mbclient/compare/v2.1.0...v2.2.0) (2021-08-25)


### Features

* **deps:** add logging of unprocessed events ([#31](https://github.com/Tinkoff/mbclient/issues/31)) ([fc2f94a](https://github.com/Tinkoff/mbclient/commit/fc2f94aadd32a008a1f6d6385ae06360129abc25))

# [2.1.0](https://github.com/Tinkoff/mbclient/compare/v2.0.0...v2.1.0) (2021-08-11)


### Features

* **deps:** upgrade amqplib up to 0.8.0 ([#28](https://github.com/Tinkoff/mbclient/issues/28)) ([b97c2ef](https://github.com/Tinkoff/mbclient/commit/b97c2efc4169a4578d031cf7ca92ca0614f43616))

# [2.0.0](https://github.com/Tinkoff/mbclient/compare/v1.1.2...v2.0.0) (2021-05-09)


### Bug Fixes

* remove redundant async ([2eaf7c9](https://github.com/Tinkoff/mbclient/commit/2eaf7c904305fae047a4fdf898ce8f6239824057))


### Features

* export `MessageHandlerOptions` and `AMQPOptions` ([b228731](https://github.com/Tinkoff/mbclient/commit/b22873165751f847d6cc7bfa0b84b015ca2540fb))
* tslint to eslint ([feab382](https://github.com/Tinkoff/mbclient/commit/feab3823e03d7b20fe930e270d9fc2a3bd3478f2))


### BREAKING CHANGES

* drop Node.js v8 support.

Node.js v14 build added.

Some types made more exact (instead of `any`).

## [1.1.2](https://github.com/Tinkoff/mbclient/compare/v1.1.1...v1.1.2) (2020-07-13)


### Bug Fixes

* **release:** Change api function signature ([d355470](https://github.com/Tinkoff/mbclient/commit/d355470cd93c240b2b7ae45c6b6040cf03b8d757))

## [1.1.1](https://github.com/Tinkoff/mbclient/compare/v1.1.0...v1.1.1) (2020-06-10)


### Bug Fixes

* **release:** Change default retry strategy ([cc86c82](https://github.com/Tinkoff/mbclient/commit/cc86c82bda0ce48d1bfb5481ed1f2ccffa20eb30))

# [1.1.0](https://github.com/Tinkoff/mbclient/compare/v1.0.0...v1.1.0) (2020-06-03)


### Features

* **release:** Add support customize field exchange and routingKey. Added ability to not convert content. Up lib version. ([1c0ecf3](https://github.com/Tinkoff/mbclient/commit/1c0ecf3fb43d4ed2eff645b18a608c14c2de7df0))

# 1.0.0 (2020-06-03)


### Bug Fixes

* docs typo fix ([008d9ca](https://github.com/Tinkoff/mbclient/commit/008d9caba869936835ef09ec6f265cf6b9abfc39))
* update coveralls ([28019c3](https://github.com/Tinkoff/mbclient/commit/28019c3721d0f668018f535b106fff42624cf342))
