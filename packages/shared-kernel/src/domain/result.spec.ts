import { Err, Ok, err, ok } from './result';

describe('Result', () => {
  it('creates Ok values', () => {
    const result = ok('value');

    expect(result).toBeInstanceOf(Ok);
    expect(result.isOk).toBe(true);
    expect(result.isErr).toBe(false);
    expect(result.value).toBe('value');
  });

  it('creates Err values', () => {
    const error = new Error('failed');
    const result = err(error);

    expect(result).toBeInstanceOf(Err);
    expect(result.isOk).toBe(false);
    expect(result.isErr).toBe(true);
    expect(result.error).toBe(error);
  });
});
