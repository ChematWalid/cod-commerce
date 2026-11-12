import { z } from 'zod';

/** The variable of the demo webhook handler, spread into the server's schema. */
export const demoEnvShape = {
  // Registers the demo webhook provider and its consumer (D110). A development and evidence aid: refused in production.
  PLATFORM_DEMO_HANDLERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
};

/** The parts of the environment the demo check reads. */
interface DemoEnv {
  readonly APP_ENV: string;
  readonly PLATFORM_DEMO_HANDLERS: boolean;
}

/** The demo webhook handler verifies with a tenant secret and writes events nobody asked for: never in production (D110). */
export function rejectDemoHandlersInProduction(env: DemoEnv, context: z.RefinementCtx): void {
  if (env.APP_ENV === 'production' && env.PLATFORM_DEMO_HANDLERS) {
    context.addIssue({
      code: 'custom',
      path: ['PLATFORM_DEMO_HANDLERS'],
      message: 'must not be true when APP_ENV is production',
    });
  }
}
