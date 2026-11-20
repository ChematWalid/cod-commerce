/** Settles `call` on a later turn of the event loop, as a database round trip does. */
const afterRoundTrip = (call: () => unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    setImmediate(() => {
      Promise.resolve(call()).then(resolve, reject);
    });
  });

/**
 * `port` with every method answering on a later turn of the event loop. An in-memory fake settles within one
 * microtask run, so a test that starts a refused call and attaches its handler after awaiting another call passes on
 * the fake and reports an unhandled rejection on Postgres (CI run 44686430717); this makes the fake fail the same way.
 */
export function withRoundTrips<T extends object>(port: T): T {
  return new Proxy(port, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver);
      if (typeof member !== 'function') return member;
      return (...args: unknown[]) => afterRoundTrip(() => Reflect.apply(member, target, args) as unknown);
    },
  });
}
