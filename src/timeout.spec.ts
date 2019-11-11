import timeout from './timeout';

jest.useFakeTimers();

it('should resolve after specified number of milliseconds', async () => {
  expect.assertions(1);
  const time = 2000;
  const pendingPromise = timeout(time).then(resolved => {
    expect(resolved).toBeUndefined();
  });
  jest.runAllTimers();

  return pendingPromise;
});
