// Proves against the real Garage that a presigned upload holds the browser to what it declared (D2208): the URL is
// signed by plugins/catalog-import's own built adapter (`garageObjectStorage`, the factory the server uses, D2279),
// so a PUT with a larger body than signed is refused with 403 and writes nothing, and the declared body is stored.
// The memory storage of the integration and e2e suites cannot show this; the browser workflow runs it after `pnpm build`.
// Usage: pnpm build && node --env-file=.env scripts/check-presigned-put.mjs
/* global fetch */
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import console from 'node:console';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { garageObjectStorage } = require('../plugins/catalog-import/dist/infrastructure/garage-object-storage.js');

const env = process.env;
for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET_PRIVATE']) {
  if (!env[key]) throw new Error(`missing env ${key}`);
}

const FORBIDDEN = 403;
const OK = 200;
const TTL_SECONDS = 60;
const CONTENT_TYPE = 'text/csv';

const endpoint = env.S3_ENDPOINT || `http://127.0.0.1:${env.GARAGE_S3_HOST_PORT || '3900'}`;
const storage = garageObjectStorage({
  kind: 's3',
  endpoint,
  publicEndpoint: env.S3_PUBLIC_ENDPOINT || endpoint,
  region: env.S3_REGION || 'garage',
  forcePathStyle: (env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  bucket: env.S3_BUCKET_PRIVATE,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
});
const key = `uploads/probe/${randomUUID()}/source`;
const DECLARED_CSV = 'product_key,name,price\r\nPROBE-1,Probe,1';
const declared = Buffer.from(DECLARED_CSV);
const larger = Buffer.from(`${DECLARED_CSV}\r\nPROBE-2,Extra row,2`);

function expect(condition, message) {
  if (!condition) throw new Error(`presigned PUT check failed: ${message}`);
}

const stored = async () => (await storage.head(key)) !== null;

/** Deletes the probe object; a failed cleanup is logged, never thrown, so it cannot hide the check's own failure. */
async function cleanUp() {
  try {
    await storage.delete(key);
  } catch (error) {
    console.error(`presigned PUT check: could not delete the probe object ${key}`, error);
  }
}

const { url } = await storage.presignPut(key, {
  contentType: CONTENT_TYPE,
  size: declared.length,
  ttlSeconds: TTL_SECONDS,
});
const put = (body) => fetch(url, { method: 'PUT', headers: { 'content-type': CONTENT_TYPE }, body });

try {
  const tooLarge = await put(larger);
  expect(tooLarge.status === FORBIDDEN, `a larger body than signed answered ${tooLarge.status}, wanted ${FORBIDDEN}`);
  expect(!(await stored()), 'a refused PUT stored an object');

  const exact = await put(declared);
  expect(exact.status === OK, `the declared body answered ${exact.status}, wanted ${OK}`);
  expect(await stored(), 'the declared body was not stored');
} finally {
  await cleanUp();
}
console.log('PRESIGNED-PUT-OK');
