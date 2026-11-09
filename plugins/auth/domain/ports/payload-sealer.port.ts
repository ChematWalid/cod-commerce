/** Keeps a queued payload unreadable and untampered while it sits in the queue store. */
export interface PayloadSealerPort {
  seal(payload: unknown): string;
  /** @throws Error if the value was altered, sealed under another key or is not a sealed payload. */
  open(sealed: string): unknown;
}
