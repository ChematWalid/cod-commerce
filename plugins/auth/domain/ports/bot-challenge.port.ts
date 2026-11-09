/** `unavailable`: the provider could not answer, which lets the sign-up through (D35). */
export type BotChallengeOutcome = 'passed' | 'failed' | 'unavailable';

/** Tells a person from a bot at sign-up (D35). */
export interface BotChallengePort {
  /** Never throws: a provider that cannot be reached answers `unavailable`. */
  verify(token: string | undefined): Promise<BotChallengeOutcome>;
}
