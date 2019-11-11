import defaultRetryStrategy from './default';

it('is a function', () => {
  expect(typeof defaultRetryStrategy).toBe('function');
});

it('returns a number', () => {
  const delay = defaultRetryStrategy(1);

  expect(typeof delay).toBe('number');
  expect(isFinite(delay)).toBe(true);
});
