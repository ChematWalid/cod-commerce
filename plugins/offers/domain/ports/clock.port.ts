/** The current instant; injected so the engine and the token stay pure and testable. */
export interface Clock {
  now(): Date;
}
