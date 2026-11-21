import { z } from 'zod';
import { hasReservedTld, isDeployed } from './deployed-env';

/** The parts of the environment the tenancy checks read. */
interface TenancyEnv {
  readonly APP_ENV: string;
  readonly PLATFORM_DOMAIN?: string | undefined;
  readonly SNOWFLAKE_WORKER_ID?: number | undefined;
}

/** A deployed server must know its real domain, and only tests may skip the worker id lease (ADR 0003). */
export function rejectUnsafeTenancySettings(env: TenancyEnv, context: z.RefinementCtx): void {
  if (isDeployed(env) && env.PLATFORM_DOMAIN === undefined) {
    context.addIssue({ code: 'custom', path: ['PLATFORM_DOMAIN'], message: 'is required in this environment' });
  }
  if (isDeployed(env) && env.PLATFORM_DOMAIN !== undefined && hasReservedTld(env.PLATFORM_DOMAIN)) {
    context.addIssue({
      code: 'custom',
      path: ['PLATFORM_DOMAIN'],
      message: 'ends in a reserved name (invalid, test, example, localhost or local): set the real domain',
    });
  }
  if (env.APP_ENV !== 'test' && env.SNOWFLAKE_WORKER_ID !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['SNOWFLAKE_WORKER_ID'],
      message: 'is only allowed when APP_ENV is test',
    });
  }
}
