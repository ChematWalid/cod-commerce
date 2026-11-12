/** The operational flags (D116). Keys are dotted, lower-case and stable: they are stored, logged and switched by staff. */
export const FLAG_KEYS = {
  intakeSpool: 'intake.spool.enabled',
  inboundWebhooks: 'inbound-webhooks.enabled',
  ai: 'ai.enabled',
  capi: 'capi.enabled',
} as const;

/** One of the {@link FLAG_KEYS} values. */
export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];

/** A flag as it is inserted when missing: staff values are never overwritten by a later run. */
export interface FlagSeed {
  readonly key: FlagKey;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly rolloutPercent: number;
}

/**
 * Every flag that exists. Inserted if missing on each migrate (D116); the values are a first guess that P3.S4 and
 * P9 confirm. All are on at 100 %: these are kill switches, off only while an incident lasts.
 */
export const FLAG_SEEDS: readonly FlagSeed[] = [
  {
    key: FLAG_KEYS.intakeSpool,
    description: 'Accept new orders into the intake spool; off stops intake while a fault is being handled.',
    defaultEnabled: true,
    rolloutPercent: 100,
  },
  {
    key: FLAG_KEYS.inboundWebhooks,
    description: 'Accept inbound provider webhooks; off answers 503 so providers retry later.',
    defaultEnabled: true,
    rolloutPercent: 100,
  },
  {
    key: FLAG_KEYS.ai,
    description: 'Run the AI features (suggestions and replies); off turns every AI call off.',
    defaultEnabled: true,
    rolloutPercent: 100,
  },
  {
    key: FLAG_KEYS.capi,
    description: 'Send server-side conversion events to the ad platforms; off stops the sends.',
    defaultEnabled: true,
    rolloutPercent: 100,
  },
];

const FLAG_KEY_SET: ReadonlySet<string> = new Set(Object.values(FLAG_KEYS));

/** True when `value` is one of the {@link FLAG_KEYS}. */
export function isFlagKey(value: string): value is FlagKey {
  return FLAG_KEY_SET.has(value);
}
