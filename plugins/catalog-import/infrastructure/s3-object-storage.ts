import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  ObjectHead,
  ObjectStorage,
  PresignedRequest,
  PresignGetRule,
  PresignPutRule,
  ReadRule,
} from '../application/ports/object-storage.port';
import { attachmentDisposition, checkDownload } from '../domain/download-name';
import { FileTooLargeError, JobStateError } from '../domain/errors';
import type { ObjectKey } from '../domain/object-keys';
import { collectBytes } from './object-bytes';

const MS_PER_SECOND = 1_000;
const NOT_FOUND = 404;
const PRECONDITION_FAILED = 412;
/** Signed as headers, never hoisted into the query: the browser must send exactly the declared type and size. */
const SIGNED_UPLOAD_HEADERS = new Set(['content-type', 'content-length']);

/** The S3 adapter's clients and bucket. */
export interface S3ObjectStorageDeps {
  /** Talks to Garage on the internal endpoint (`S3_ENDPOINT`): HEAD, GET, PUT, DELETE. */
  readonly client: S3Client;
  /** Only signs, on the endpoint a browser reaches (`S3_PUBLIC_ENDPOINT`); never sends a request. */
  readonly signingClient: S3Client;
  /** `S3_BUCKET_PRIVATE`: every command targets it, never R2 (ADR 0012). */
  readonly bucket: string;
  readonly now?: () => Date;
}

interface S3ErrorShape {
  readonly name?: string;
  readonly $metadata?: { readonly httpStatusCode?: number };
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as S3ErrorShape).$metadata?.httpStatusCode : undefined;

/** A changed (412) or gone (404) object is a job-state refusal; anything else is the store's fault and propagates. */
function readErrorOf(error: unknown): unknown {
  const status = statusOf(error);
  return status === PRECONDITION_FAILED || status === NOT_FOUND ? new JobStateError() : error;
}

/** {@link ObjectStorage} on Garage through the AWS SDK v3 (D2208). */
export class S3ObjectStorage implements ObjectStorage {
  private readonly now: () => Date;

  constructor(private readonly deps: S3ObjectStorageDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async presignPut(key: ObjectKey, rule: PresignPutRule): Promise<PresignedRequest> {
    const command = new PutObjectCommand({
      Bucket: this.deps.bucket,
      Key: key,
      ContentType: rule.contentType,
      ContentLength: rule.size,
    });
    const url = await getSignedUrl(this.deps.signingClient, command, {
      expiresIn: rule.ttlSeconds,
      signableHeaders: SIGNED_UPLOAD_HEADERS,
      unhoistableHeaders: SIGNED_UPLOAD_HEADERS,
    });
    return {
      url,
      method: 'PUT',
      headers: { 'content-type': rule.contentType, 'content-length': String(rule.size) },
      expiresAt: new Date(this.now().getTime() + rule.ttlSeconds * MS_PER_SECOND),
    };
  }

  async presignGet(key: ObjectKey, rule: PresignGetRule): Promise<string> {
    checkDownload(key, rule.downloadName);
    const command = new GetObjectCommand({
      Bucket: this.deps.bucket,
      Key: key,
      ResponseContentDisposition: attachmentDisposition(rule.downloadName),
      ResponseContentType: rule.contentType,
    });
    return getSignedUrl(this.deps.signingClient, command, { expiresIn: rule.ttlSeconds });
  }

  async head(key: ObjectKey): Promise<ObjectHead | null> {
    try {
      const head = await this.deps.client.send(new HeadObjectCommand({ Bucket: this.deps.bucket, Key: key }));
      return { size: head.ContentLength ?? 0, etag: head.ETag ?? '', contentType: head.ContentType ?? '' };
    } catch (error: unknown) {
      if (statusOf(error) === NOT_FOUND) return null;
      throw error;
    }
  }

  async read(key: ObjectKey, rule: ReadRule): Promise<Uint8Array> {
    const command = new GetObjectCommand({ Bucket: this.deps.bucket, Key: key, IfMatch: rule.ifMatch });
    const object = await this.deps.client.send(command).catch((error: unknown) => {
      throw readErrorOf(error);
    });
    if ((object.ContentLength ?? 0) > rule.maxBytes) throw new FileTooLargeError();
    if (object.Body === undefined) throw new JobStateError();
    return collectBytes(object.Body as AsyncIterable<Uint8Array>, rule.maxBytes);
  }

  /** Buffers a streamed body first: a PutObject needs its length, and an export file is a few MiB at most. */
  async write(key: ObjectKey, body: Uint8Array | AsyncIterable<Uint8Array>, contentType: string): Promise<void> {
    const bytes = await collectBytes(body);
    await this.deps.client.send(
      new PutObjectCommand({
        Bucket: this.deps.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        ContentLength: bytes.length,
      }),
    );
  }

  async delete(key: ObjectKey): Promise<void> {
    await this.deps.client.send(new DeleteObjectCommand({ Bucket: this.deps.bucket, Key: key }));
  }
}
