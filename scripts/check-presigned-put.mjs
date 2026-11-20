// Proves against the real Garage that a presigned upload holds the browser to what it declared (D2208): the URL is
// signed as plugins/catalog-import's S3 adapter signs it (content-type and content-length as signed headers, never in
// the query), so a PUT with a larger body than signed is refused with 403 and writes nothing, and the declared body
// is stored. The memory storage of the integration and e2e suites cannot show this; the browser workflow runs it.
// Usage: node --env-file=.env scripts/check-presigned-put.mjs
/* global fetch */
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import console from 'node:console';
import process from 'node:process';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const env = process.env;
for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET_PRIVATE']) {
  if (!env[key]) throw new Error(`missing env ${key}`);
}

const FORBIDDEN = 403;
const OK = 200;
const NOT_FOUND = 404;
const TTL_SECONDS = 60;
/** Signed as headers, never hoisted into the query, as the adapter does. */
const SIGNED_UPLOAD_HEADERS = new Set(['content-type', 'content-length']);
const CONTENT_TYPE = 'text/csv';

const endpoint = env.S3_ENDPOINT || `http://127.0.0.1:${env.GARAGE_S3_HOST_PORT || '3900'}`;
const Bucket = env.S3_BUCKET_PRIVATE;
const Key = `uploads/probe/${randomUUID()}/source`;
const DECLARED_CSV = 'product_key,name,price\r\nPROBE-1,Probe,1';
const declared = Buffer.from(DECLARED_CSV);
const larger = Buffer.from(`${DECLARED_CSV}\r\nPROBE-2,Extra row,2`);

const client = new S3Client({
  endpoint,
  region: env.S3_REGION || 'garage',
  forcePathStyle: (env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  // As the adapter's clients: a default checksum would sign the empty body's CRC32 into the URL.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

function expect(condition, message) {
  if (!condition) throw new Error(`presigned PUT check failed: ${message}`);
}

/** Whether the probe object exists, as a HEAD answers it. */
async function stored() {
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === NOT_FOUND) return false;
    throw error;
  }
}

const command = new PutObjectCommand({ Bucket, Key, ContentType: CONTENT_TYPE, ContentLength: declared.length });
const url = await getSignedUrl(client, command, {
  expiresIn: TTL_SECONDS,
  signableHeaders: SIGNED_UPLOAD_HEADERS,
  unhoistableHeaders: SIGNED_UPLOAD_HEADERS,
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
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
}
console.log('PRESIGNED-PUT-OK');
