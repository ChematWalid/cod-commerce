// Proves the S3 endpoint (Garage) works: PUT, GET, presigned GET, anonymous denied.
/* global fetch */
import { randomUUID } from 'node:crypto';
import console from 'node:console';
import process from 'node:process';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const env = process.env;
for (const key of ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET_PRIVATE']) {
  if (!env[key]) throw new Error(`missing env ${key}`);
}

const endpoint = env.S3_ENDPOINT;
const Bucket = env.S3_BUCKET_PRIVATE;
const Key = `probe/${randomUUID()}.txt`;
const body = 'cod-probe';

const client = new S3Client({
  endpoint,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

function expect(condition, message) {
  if (!condition) throw new Error(`object-storage check failed: ${message}`);
}

await client.send(new PutObjectCommand({ Bucket, Key, Body: body }));
try {
  const got = await client.send(new GetObjectCommand({ Bucket, Key }));
  expect((await got.Body.transformToString()) === body, 'GET returned a different body');

  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: 60 });
  const presigned = await fetch(url);
  expect(presigned.status === 200, `presigned GET answered ${presigned.status}`);

  const anonymous = await fetch(`${endpoint}/${Bucket}/${Key}`);
  expect(anonymous.status === 403, `anonymous GET answered ${anonymous.status}, wanted 403`);
} finally {
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
}
console.log('OBJECT-STORAGE-OK');
