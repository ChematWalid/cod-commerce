/**
 * The error `call` rejects with. Await it where the call starts: a refused call left pending while the test awaits
 * another one rejects with no handler, which Vitest reports as an unhandled error (CI run 44686430717).
 *
 * @throws when `call` resolves instead.
 */
export async function rejectionOf(call: Promise<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('the call resolved; a rejection was expected');
}
