// tslint:disable no-magic-numbers

const defaultRetryStrategy = (times: number): number => {
  const timeMax = 2 ** times - 1;

  return Math.round(Math.random() * (timeMax * 500));
};

export default defaultRetryStrategy;
