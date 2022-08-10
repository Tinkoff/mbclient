interface MessageHeaders {
  recipients: string;
  requestId?: string;
  action?: string;
  type?: string;
  routingKey?: string;
  isOriginalContent?: boolean;
}

/**
 * Options listed below are distributed between own message options
 * and options specific for amqp client.
 */
interface DistributedMessageProperties {
  /**
   * if supplied, the message will be discarded from a queue once
   * it's been there longer than the given number of milliseconds.
   * In the specification this is a string; numbers supplied here
   * will be coerced to strings for transit.
   */
  expiration?: string;

  /**
   * If supplied, RabbitMQ will compare it to the username supplied
   * when opening the connection, and reject messages for which it
   * does not match.
   */
  userId?: string;

  /**
   * a priority for the message; ignored by versions of RabbitMQ older
   * than 3.5.0, or if the queue is not a priority queue
   */
  priority?: number;

  /**
   * Either 1 or falsey, meaning non-persistent; or, 2 or truthy,
   * meaning persistent. That's just obscure though. Use the
   * option persistent instead.
   */
  deliveryMode?: 1 | 2 | number;

  /**
   * a MIME type for the message content
   */
  contentType?: string;

  /**
   * a MIME encoding for the message content
   */
  contentEncoding?: string;

  /**
   * application specific headers to be carried along with the message
   * content. The value as sent may be augmented by extension-specific
   * fields if they are given in the parameters, for example, 'CC',
   * since these are encoded as message headers; the supplied value
   * won't be mutated
   */
  headers: MessageHeaders;

  /**
   * usually used to match replies to requests, or similar
   */
  correlationId?: string;

  /**
   * often used to name a queue to which the receiving application must
   * send replies, in an RPC scenario (many libraries assume this pattern)
   */
  replyTo?: string;

  /**
   * arbitrary application-specific identifier for the message
   */
  messageId?: string;

  /**
   * a timestamp for the message
   */
  timestamp: number;

  /**
   * an arbitrary application-specific type for the message
   */
  type?: string;

  /**
   * an arbitrary identifier for the originating application
   */
  appId?: string;
}

export interface MessageOptions extends DistributedMessageProperties {
  /**
   * an array of routing keys as strings; messages will be routed
   * to these routing keys in addition to that given as the routingKey
   * parameter. A string will be implicitly treated as an array
   * containing just that string. This will override any value given
   * for CC in the headers parameter. NB The property names CC and
   * BCC are case-sensitive.
   */
  CC?: string | string[];

  /**
   * If truthy, the message will survive broker restarts provided it's
   * in a queue that also survives restarts. Corresponds to, and
   * overrides, the property deliveryMode
   */
  persistent?: boolean;

  /**
   * if true, the message will be returned if it is not routed
   * to a queue (i.e., if there are no bindings that match its routing key).
   */
  mandatory?: boolean;

  /**
   * like CC, except that the value will not be sent in the
   * message headers to consumers.
   */
  BCC?: string | string[];
}

interface MessageFields {
  consumerTag: string;
  deliveryTag: number;
  redelivered: boolean;
  exchange: string;
  routingKey: string;
}

export interface Message {
  content: unknown;
  fields: MessageFields;
  properties: DistributedMessageProperties;
}

export interface MessageHandlerOptions {
  action?: string;
  message: Message;
  ack: () => void;
  nack: () => void;
}

export type MessageHandler = (options: MessageHandlerOptions) => Promise<void>;
