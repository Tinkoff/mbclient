import infiniteRetryStrategy from './infinite';

describe('#infiniteRetryStrategy', () => {
    it('is a function', () => {
        expect(typeof infiniteRetryStrategy).toBe('function');
    });

    it('returns a number', () => {
        const delay = infiniteRetryStrategy(1);

        expect(typeof delay).toBe('number');
        expect(delay).toBe(1000);
    });
});
