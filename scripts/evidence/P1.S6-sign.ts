// Signing helper of scripts/evidence/P1.S6.sh (and of the earlier evidence scripts that call a guarded route): signs internal
// requests with the run's synthetic keys through `@cod/shared/internal-auth` and signs demo webhooks with `demoSignature`.
// Run from the server package so the workspace packages resolve:
//
//   pnpm --filter @cod/server exec node --conditions=@cod/source -r ts-node/register/transpile-only \
//     ../../scripts/evidence/P1.S6-sign.ts internal < requests.json      -> JSON array of header maps
//   ... P1.S6-sign.ts demo <body-file>                                    -> `sha256=<hex>` (secret from EV_DEMO_SECRET)
//
// Env: INTERNAL_HMAC_KEYS and INTERNAL_HMAC_ACTIVE_KID (the signing key), EV_DEMO_SECRET (demo mode). Nothing secret is printed:
// the output is the signed headers a caller sends, which are replayable for 60 seconds only (D111).
/* global process, Buffer, console */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { demoSignature as DemoSignature } from '@cod/plugin-platform-webhooks';
import type {
  InternalSigningKey,
  parseInternalKeys as ParseKeys,
  signInternalRequest as Sign,
} from '@cod/shared/internal-auth';

// This file lives outside every package, so the workspace packages resolve from the server package, like its own code does.
const fromServer = createRequire(join(process.cwd(), 'package.json'));
const { demoSignature } = fromServer('@cod/plugin-platform-webhooks') as { demoSignature: typeof DemoSignature };
const { parseInternalKeys, signInternalRequest } = fromServer('@cod/shared/internal-auth') as {
  parseInternalKeys: typeof ParseKeys;
  signInternalRequest: typeof Sign;
};

interface SignRequest {
  readonly method: string;
  readonly path: string;
  /** The body as text; a file path in `bodyFile` wins (binary or large bodies). */
  readonly body?: string;
  readonly bodyFile?: string;
  readonly storeId?: string;
  readonly clientIp?: string;
  readonly clientCountry?: string;
  /** Seconds added to now: -61 gives a stale timestamp. */
  readonly tsOffset?: number;
}

function fail(message: string): never {
  console.error(`P1.S6-sign: ${message}`);
  process.exit(1);
}

function activeKey(): InternalSigningKey {
  const keys = parseInternalKeys(process.env.INTERNAL_HMAC_KEYS ?? '');
  const kid = process.env.INTERNAL_HMAC_ACTIVE_KID ?? keys[0]?.kid;
  return keys.find((key) => key.kid === kid) ?? fail('the active kid is not among INTERNAL_HMAC_KEYS');
}

function signInternal(): void {
  const key = activeKey();
  const requests = JSON.parse(readFileSync(0, 'utf8')) as readonly SignRequest[];
  const now = Math.floor(Date.now() / 1000);
  const headers = requests.map((request) => {
    const body = request.bodyFile === undefined ? (request.body ?? '') : readFileSync(request.bodyFile);
    return signInternalRequest(
      {
        method: request.method,
        pathWithQuery: request.path,
        body,
        ...(request.storeId === undefined ? {} : { storeId: request.storeId }),
        ...(request.clientIp === undefined ? {} : { clientIp: request.clientIp }),
        ...(request.clientCountry === undefined ? {} : { clientCountry: request.clientCountry }),
      },
      key,
      now + (request.tsOffset ?? 0),
    );
  });
  console.log(JSON.stringify(headers));
}

function signDemo(bodyFile: string | undefined): void {
  const secret = process.env.EV_DEMO_SECRET;
  if (secret === undefined || secret === '' || bodyFile === undefined)
    fail('usage: demo <body-file> with EV_DEMO_SECRET set');
  console.log(demoSignature(secret, Buffer.from(readFileSync(bodyFile))));
}

const [mode, argument] = process.argv.slice(2);
if (mode === 'internal') signInternal();
else if (mode === 'demo') signDemo(argument);
else fail('usage: internal | demo <body-file>');
