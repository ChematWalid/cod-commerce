// Lets the dashboard upload import files to, and download exports from, the private bucket (D2208): bucket CORS on
// Garage. Presigned PUT and GET from the dashboard's origin only; the browser sends `content-type`, reads `ETag`.
// Run once per dev stack after `docker compose up` (check-data-services.sh, the browser workflow and the evidence
// script run it too). Usage: node --env-file=.env scripts/garage-cors.mjs
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

const env = process.env;
for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET_PRIVATE']) {
  if (!env[key]) throw new Error(`missing env ${key}`);
}

const DEFAULT_DASHBOARD_URL = 'http://localhost:3100';
const endpoint = env.S3_ENDPOINT || `http://127.0.0.1:${env.GARAGE_S3_HOST_PORT || '3900'}`;
const origin = new URL(env.AUTH_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).origin;
const Bucket = env.S3_BUCKET_PRIVATE;
const rule = {
  AllowedOrigins: [origin],
  AllowedMethods: ['PUT', 'GET'],
  AllowedHeaders: ['content-type'],
  ExposeHeaders: ['ETag'],
  MaxAgeSeconds: 600,
};

const client = new S3Client({
  endpoint,
  region: env.S3_REGION || 'garage',
  forcePathStyle: (env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

function expect(condition, message) {
  if (!condition) throw new Error(`garage CORS check failed: ${message}`);
}

await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: [rule] } }));
const { CORSRules = [] } = await client.send(new GetBucketCorsCommand({ Bucket }));
const lower = (values = []) => values.map((value) => value.toLowerCase());
const stored = CORSRules.find((candidate) => (candidate.AllowedOrigins ?? []).includes(origin));
expect(stored !== undefined, `no rule for ${origin}`);
expect(lower(stored.AllowedHeaders).includes('content-type'), 'content-type is not an allowed header');
expect(lower(stored.ExposeHeaders).includes('etag'), 'ETag is not exposed');
expect(
  ['PUT', 'GET'].every((method) => (stored.AllowedMethods ?? []).includes(method)),
  'PUT and GET are not allowed',
);
console.log(`GARAGE-CORS-OK ${origin}`);
