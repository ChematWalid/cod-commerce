import { DEV_API_PORT, isPort } from './ports';

/** Where `vite dev` finds the host-run api unless `API_HOST` says otherwise. */
const DEV_API_HOST = 'http://localhost';

/** The variables the dev server reads. The `.env.example` gate (`pnpm test:arch`) checks each one is documented. */
export const DASHBOARD_DEV_ENV_KEYS = ['API_HOST', 'API_PORT'] as const;

type DashboardDevEnvKey = (typeof DASHBOARD_DEV_ENV_KEYS)[number];

/** The api the dashboard's dev server calls: a scheme with a host, and the port apart, as the Vite plugin takes them. */
export interface DashboardDevApi {
  readonly host: string;
  readonly port: number;
}

/** `API_HOST` or `API_PORT` cannot address an api. The message names the variable, never its value. */
export class DashboardDevApiError extends Error {
  constructor(reason: string) {
    super(`Dashboard dev server: ${reason}`);
    this.name = 'DashboardDevApiError';
  }
}

/** A blank variable counts as unset, as in `loadEnv`. */
const valueOf = (source: NodeJS.ProcessEnv, name: DashboardDevEnvKey): string | undefined => source[name] || undefined;

function hostOf(value: string | undefined): string {
  if (value === undefined) {
    return DEV_API_HOST;
  }
  const url = URL.canParse(value) ? new URL(value) : undefined;
  const isOrigin = url !== undefined && ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  if (!isOrigin || url.port !== '') {
    throw new DashboardDevApiError('API_HOST must be http:// or https:// and a host, without port or path');
  }
  return value;
}

function portOf(value: string | undefined): number {
  const port = value === undefined ? DEV_API_PORT : Number(value);
  if (!isPort(port)) {
    throw new DashboardDevApiError('API_PORT is not a port');
  }
  return port;
}

/**
 * The api `pnpm dev:dashboard` calls, from `API_HOST` and `API_PORT`. Only the Vite dev server reads this: the
 * built dashboard calls the api that serves it.
 *
 * @throws {DashboardDevApiError} when a variable is set and invalid.
 */
export function dashboardDevApi(source: NodeJS.ProcessEnv): DashboardDevApi {
  return { host: hostOf(valueOf(source, 'API_HOST')), port: portOf(valueOf(source, 'API_PORT')) };
}
