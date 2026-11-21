/** How often {@link untilHolds} reads again. */
export const POLL_MS = 500;

/**
 * Polls `read` until it answers a value, not undefined. Past `timeoutMs` it fails naming `what` and the last state
 * `describe` reports, so a wait that never settles says so where it happens instead of a bare mismatch later.
 */
export async function untilHolds<T>(
  what: string,
  read: () => Promise<T | undefined>,
  timeoutMs: number,
  describe: () => Promise<string> = () => Promise.resolve(''),
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) {
      throw new Error(`${what} did not settle within ${String(timeoutMs / 1000)} s ${await describe()}`.trim());
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
