/** Receives a refusal no handler was waiting for when its round trip went out. */
export type UnawaitedRefusalReporter = (error: Error) => void;

/** A call's answer that records whether a handler was attached to it. */
class TrackedAnswer<T> extends Promise<T> {
  awaited = false;

  // Chained promises stay plain, so only the caller's own handler counts.
  static override get [Symbol.species](): PromiseConstructor {
    return Promise;
  }

  override then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    this.awaited = true;
    return super.then(onFulfilled, onRejected);
  }
}

interface InFlightCall {
  readonly answer: TrackedAnswer<unknown>;
  readonly run: (awaitedAtStart: boolean) => void;
}

const describeRefusal = (refusal: unknown): string => (refusal instanceof Error ? refusal.message : String(refusal));

const unawaitedRefusal = (refusal: unknown): Error =>
  new Error(
    `a refused repository call had no handler when its round trip went out (${describeRefusal(refusal)}); ` +
      'await it where it starts, as Postgres may answer it before any other pending call (D2443)',
  );

/** Fails the running test with an uncaught error, as Vitest does for an unhandled rejection on Postgres. */
const failTheTest: UnawaitedRefusalReporter = (error) => {
  queueMicrotask(() => {
    throw error;
  });
};

/**
 * A wrapper that answers every call on a later turn of the event loop, as a database round trip does. Calls started
 * before that turn travel together; a refusal among them that had no handler yet when they went out is reported,
 * because Postgres may answer the calls in any order and settle that refusal before its handler exists. This catches
 * a refusal left pending across another awaited call and two refusals started together then awaited in turn, which
 * an in-memory fake answering in start order would let pass (CI run 44686430717).
 */
export function roundTrips(report: UnawaitedRefusalReporter): <T extends object>(port: T) => T {
  let inFlight: InFlightCall[] = [];

  const sendInFlight = (): void => {
    const sent = inFlight;
    inFlight = [];
    const awaitedAtStart = sent.map((call) => call.answer.awaited);
    sent.forEach((call, index) => {
      call.run(awaitedAtStart[index] ?? false);
    });
  };

  const afterRoundTrip = (call: () => unknown): Promise<unknown> => {
    let run: InFlightCall['run'] = () => undefined;
    const answer = new TrackedAnswer<unknown>((resolve, reject) => {
      run = (awaitedAtStart) => {
        Promise.resolve()
          .then(call)
          .then(resolve, (refusal: unknown) => {
            if (!awaitedAtStart) report(unawaitedRefusal(refusal));
            reject(refusal);
          });
      };
    });
    if (inFlight.length === 0) setImmediate(sendInFlight);
    inFlight.push({ answer, run });
    return answer;
  };

  return <T extends object>(port: T): T =>
    new Proxy(port, {
      get(target, key, receiver) {
        const member: unknown = Reflect.get(target, key, receiver);
        if (typeof member !== 'function') return member;
        return (...args: unknown[]) => afterRoundTrip(() => Reflect.apply(member, target, args) as unknown);
      },
    });
}

/** `port` answering on a later turn and failing the test on a refusal not awaited where it starts (D2443). */
export const withRoundTrips: <T extends object>(port: T) => T = roundTrips(failTheTest);
