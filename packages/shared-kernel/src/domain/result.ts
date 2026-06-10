export type Result<T, E = Error> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly isOk = true as const;
  readonly isErr = false as const;

  constructor(public readonly value: T) {}

  static of<T>(value: T): Ok<T> {
    return new Ok(value);
  }
}

export class Err<E> {
  readonly isOk = false as const;
  readonly isErr = true as const;

  constructor(public readonly error: E) {}

  static of<E>(error: E): Err<E> {
    return new Err(error);
  }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value);
export const err = <E>(error: E): Err<E> => new Err(error);
