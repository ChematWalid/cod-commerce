import type { ObjectKey } from '../../domain/object-keys';

/** How a presigned upload must be sent: the exact headers were signed, so the browser sends them unchanged. */
export interface PresignedRequest {
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

/** What a presigned upload signs: the declared type and exact size (SigV4 cannot sign "at most N bytes"). */
export interface PresignPutRule {
  readonly contentType: string;
  readonly size: number;
  readonly ttlSeconds: number;
}

/** What a presigned download carries: an ascii, server-made attachment name and the content type. */
export interface PresignGetRule {
  readonly ttlSeconds: number;
  readonly downloadName: string;
  readonly contentType: string;
}

/** What a HEAD of an object answers. */
export interface ObjectHead {
  readonly size: number;
  readonly etag: string;
  readonly contentType: string;
}

/** A read pinned to the ETag analyze saw, and capped. */
export interface ReadRule {
  readonly maxBytes: number;
  readonly ifMatch: string;
}

/**
 * Private-bucket object access (D2208). Keys are server-made ({@link ObjectKey}); every adapter targets the private
 * bucket only (`S3_BUCKET_PRIVATE` on Garage, never R2).
 */
export interface ObjectStorage {
  /**
   * A presigned PUT of exactly `rule.size` bytes of `rule.contentType`, valid `rule.ttlSeconds`.
   * @throws InvalidImportInputError for a key outside `uploads/` (D2252)
   */
  presignPut(key: ObjectKey, rule: PresignPutRule): Promise<PresignedRequest>;
  /**
   * A presigned GET that downloads as an attachment.
   * @throws InvalidImportInputError for a key outside `exports/` or a name that is not plain ascii
   */
  presignGet(key: ObjectKey, rule: PresignGetRule): Promise<string>;
  /** The object's size, ETag and type, or null when there is none. */
  head(key: ObjectKey): Promise<ObjectHead | null>;
  /**
   * The object's bytes, if its ETag is still `rule.ifMatch`.
   * @throws JobStateError when the object changed or is gone; FileTooLargeError above `rule.maxBytes`
   */
  read(key: ObjectKey, rule: ReadRule): Promise<Uint8Array>;
  /** Writes (or overwrites) the object. */
  write(key: ObjectKey, body: Uint8Array | AsyncIterable<Uint8Array>, contentType: string): Promise<void>;
  /** Deletes the object; a missing one is not an error. */
  delete(key: ObjectKey): Promise<void>;
}
