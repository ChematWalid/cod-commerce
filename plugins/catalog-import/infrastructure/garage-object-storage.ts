import { S3Client } from '@aws-sdk/client-s3';
import type { S3StorageOptions } from './plugin-options';
import { S3ObjectStorage } from './s3-object-storage';

/**
 * A Garage client. Checksums only when required: the SDK's default CRC32 would be signed into a presigned PUT as the
 * checksum of an empty body, and the browser's upload would then fail it (D2250).
 */
const s3ClientAt = (options: S3StorageOptions, endpoint: string): S3Client =>
  new S3Client({
    endpoint,
    region: options.region,
    forcePathStyle: options.forcePathStyle,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

/**
 * The private bucket on Garage as the server builds it (D2208): sends on the internal endpoint, signs on the public
 * one. `scripts/check-presigned-put.mjs` builds its probe through this too, so the CI check covers the real signer
 * (D2279).
 */
export function garageObjectStorage(options: S3StorageOptions): S3ObjectStorage {
  return new S3ObjectStorage({
    client: s3ClientAt(options, options.endpoint),
    signingClient: s3ClientAt(options, options.publicEndpoint),
    bucket: options.bucket,
  });
}
