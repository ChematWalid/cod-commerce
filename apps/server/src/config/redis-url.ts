import type { RedisOptions } from 'ioredis';

/** A `REDIS_URL` that cannot be read as `redis(s)://[user:password@]host[:port][/db]`. The message never contains the URL. */
export class InvalidRedisUrlError extends Error {
  constructor(reason: string) {
    super(`Invalid Redis URL: ${reason}`);
    this.name = 'InvalidRedisUrlError';
  }
}

const REDIS_PROTOCOLS = ['redis:', 'rediss:'];
const TLS_PROTOCOL = 'rediss:';
const DEFAULT_REDIS_PORT = 6379;
const DATABASE_INDEX = /^\d+$/;

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new InvalidRedisUrlError('it is not a URL (a reserved character in the password must be percent-encoded)');
  }
}

function decode(part: string, label: string): string | undefined {
  try {
    return part === '' ? undefined : decodeURIComponent(part);
  } catch {
    throw new InvalidRedisUrlError(`the ${label} has an invalid percent-encoding`);
  }
}

/** The database index in the path (`/2`), or undefined when the path names none. */
function databaseOf(pathname: string): number | undefined {
  const index = pathname.replace(/^\//, '');
  if (index === '') {
    return undefined;
  }
  if (!DATABASE_INDEX.test(index)) {
    throw new InvalidRedisUrlError('the path must be a database index, e.g. redis://host:6379/0');
  }
  return Number(index);
}

/**
 * The `ioredis` options of a `redis://` or `rediss://` URL. `loadEnv` validates `REDIS_URL` with this same
 * parser, so a URL that passed `loadEnv` never throws here.
 *
 * @throws {InvalidRedisUrlError} when the URL is not a well-formed Redis URL.
 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = parseUrl(url);
  if (!REDIS_PROTOCOLS.includes(parsed.protocol)) {
    throw new InvalidRedisUrlError('must be a redis:// or rediss:// URL');
  }
  if (parsed.hostname === '') {
    throw new InvalidRedisUrlError('the host is empty');
  }
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? DEFAULT_REDIS_PORT : Number(parsed.port),
    username: decode(parsed.username, 'user'),
    password: decode(parsed.password, 'password'),
    db: databaseOf(parsed.pathname),
    tls: parsed.protocol === TLS_PROTOCOL ? {} : undefined,
  };
}
