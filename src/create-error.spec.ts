import createError from './create-error';

it('should create stringified object with "error" key', () => {
  expect(createError('test')).toMatchInlineSnapshot(`"{\\"error\\":\\"test\\"}"`);
});
