import { attachmentDisposition, checkDownload } from '../domain/download-name';
import { FileTooLargeError, JobStateError } from '../domain/errors';
import type { ObjectKey } from '../domain/object-keys';
import type {
  ObjectHead,
  ObjectStorage,
  PresignedRequest,
  PresignGetRule,
  PresignPutRule,
  ReadRule,
} from '../application/ports/object-storage.port';
import { collectBytes } from './object-bytes';

const MS_PER_SECOND = 1_000;

/** The value of `work` as a promise; a throw becomes a rejection, as from the S3 adapter. */
const settled = <T>(work: () => T): Promise<T> =>
  new Promise((resolve) => {
    resolve(work());
  });

interface StoredObject {
  readonly bytes: Uint8Array;
  readonly etag: string;
  readonly contentType: string;
}

/**
 * {@link ObjectStorage} in memory, for the integration and e2e suites (D2208); boot refuses it in production. Its
 * presigned URLs are opaque `memory://` links nothing serves: a test puts and reads bytes through the instance the
 * `OBJECT_STORAGE` token resolves to, and asserts the key and signing rules on the URL.
 */
export class MemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();
  private writes = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  presignPut(key: ObjectKey, rule: PresignPutRule): Promise<PresignedRequest> {
    const expiresAt = this.expiry(rule.ttlSeconds);
    const query = new URLSearchParams({ size: String(rule.size), type: rule.contentType });
    return Promise.resolve({
      url: `memory://${key}?${query.toString()}`,
      method: 'PUT',
      headers: { 'content-type': rule.contentType, 'content-length': String(rule.size) },
      expiresAt,
    });
  }

  presignGet(key: ObjectKey, rule: PresignGetRule): Promise<string> {
    return settled(() => {
      checkDownload(key, rule.downloadName);
      const query = new URLSearchParams({
        disposition: attachmentDisposition(rule.downloadName),
        type: rule.contentType,
        expires: this.expiry(rule.ttlSeconds).toISOString(),
      });
      return `memory://${key}?${query.toString()}`;
    });
  }

  head(key: ObjectKey): Promise<ObjectHead | null> {
    const stored = this.objects.get(key);
    return Promise.resolve(
      stored === undefined ? null : { size: stored.bytes.length, etag: stored.etag, contentType: stored.contentType },
    );
  }

  read(key: ObjectKey, rule: ReadRule): Promise<Uint8Array> {
    return settled(() => {
      const stored = this.objects.get(key);
      if (stored === undefined || stored.etag !== rule.ifMatch) throw new JobStateError();
      if (stored.bytes.length > rule.maxBytes) throw new FileTooLargeError();
      return stored.bytes.slice();
    });
  }

  async write(key: ObjectKey, body: Uint8Array | AsyncIterable<Uint8Array>, contentType: string): Promise<void> {
    const bytes = (await collectBytes(body)).slice();
    this.writes += 1;
    this.objects.set(key, { bytes, etag: `"memory-${String(this.writes)}"`, contentType });
  }

  delete(key: ObjectKey): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  private expiry(ttlSeconds: number): Date {
    return new Date(this.now().getTime() + ttlSeconds * MS_PER_SECOND);
  }
}
