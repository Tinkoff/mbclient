// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

export interface Logger {
  info(...args: Args[]): void;
  warn(...args: Args[]): void;
  error(...args: Args[]): void;
}
