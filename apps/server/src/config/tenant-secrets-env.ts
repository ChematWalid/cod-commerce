import { InvalidKekRingError, type KekEntry, parseKekEntries } from '@cod/plugin-platform-secrets/kek-ring';
import { z } from 'zod';

/** The settings the tenant secrets read (D114), spread into the server's schema. Messages never repeat a key. */
export const tenantSecretsEnvShape = {
  // The key-encryption keys, `kid:<64 hex>[,kid:<64 hex>]`: every key unwraps, the active kid wraps new data keys.
  // Required for every role, so a deployment cannot start without them.
  TENANT_SECRET_KEKS: z.string().superRefine((value, context) => {
    try {
      parseKekEntries(value);
    } catch (error) {
      if (!(error instanceof InvalidKekRingError)) {
        throw error;
      }
      context.addIssue({ code: 'custom', message: error.message });
    }
  }),
  TENANT_SECRET_ACTIVE_KID: z.string().min(1),
};

interface TenantSecretsEnv {
  readonly TENANT_SECRET_KEKS: string;
  readonly TENANT_SECRET_ACTIVE_KID: string;
}

/** The entries of `TENANT_SECRET_KEKS`, or none when it is malformed (its own issue reports that). */
function kekEntriesOf(env: TenantSecretsEnv): readonly KekEntry[] {
  try {
    return parseKekEntries(env.TENANT_SECRET_KEKS);
  } catch (error) {
    if (error instanceof InvalidKekRingError) {
      return [];
    }
    throw error;
  }
}

/** Each KEK's hex part, for the placeholder check: a key of all zeros is the `.env.example` value. */
export function tenantSecretsSecretsOf(env: TenantSecretsEnv): [name: string, value: string][] {
  return kekEntriesOf(env).map((entry): [string, string] => ['TENANT_SECRET_KEKS', entry.hex]);
}

/** New data keys are wrapped under the active kid, so it must name a key of the ring. */
export function requireKnownKekActiveKid(env: TenantSecretsEnv, context: z.RefinementCtx): void {
  const entries = kekEntriesOf(env);
  if (entries.length > 0 && !entries.some((entry) => entry.kid === env.TENANT_SECRET_ACTIVE_KID)) {
    context.addIssue({
      code: 'custom',
      path: ['TENANT_SECRET_ACTIVE_KID'],
      message: 'must be one of the kids in TENANT_SECRET_KEKS',
    });
  }
}
