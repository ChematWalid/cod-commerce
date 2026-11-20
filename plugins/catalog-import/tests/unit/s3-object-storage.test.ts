import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { exportFileKey, importSourceKey } from '../../domain/object-keys';
import { S3ObjectStorage } from '../../infrastructure/s3-object-storage';
import { bytesOf, SCOPE } from '../support/scope';

const BUCKET = 'cod-private';
const C = CATALOG_IMPORT_ERROR_CODES;
// Offline signing only: no request leaves the test, so the credentials are plain labels.
const credentials = { accessKeyId: 'synthetic-access-key-id', secretAccessKey: 'synthetic-secret-access-key' };
const clientAt = (endpoint: string): S3Client =>
  new S3Client({ endpoint, region: 'garage', forcePathStyle: true, credentials });

/** The adapter on an internal and a public client, the internal one's `send` stubbed with `answer`. */
function storageWith(answer: (command: unknown) => unknown = () => ({})) {
  const internal = clientAt('http://garage:3900');
  const publicClient = clientAt('http://localhost:3900');
  const send = vi
    .spyOn(internal, 'send')
    .mockImplementation((command: unknown) => Promise.resolve().then(() => answer(command)) as never);
  const publicSend = vi.spyOn(publicClient, 'send');
  const storage = new S3ObjectStorage({ client: internal, signingClient: publicClient, bucket: BUCKET });
  return { storage, send, publicSend };
}

/** A streamed object body, as the SDK's `Body` is in Node. */
const body = (...parts: string[]): AsyncIterable<Uint8Array> => Readable.from(parts.map(bytesOf));

const commandsOf = (send: ReturnType<typeof storageWith>['send']): unknown[] =>
  send.mock.calls.map(([command]) => command);

describe('S3ObjectStorage (D2208)', () => {
  it('presigned PUT signs the exact content-type and content-length (signableHeaders and unhoistableHeaders)', async () => {
    // Arrange
    const { storage } = storageWith();

    // Act
    const put = await storage.presignPut(importSourceKey(SCOPE, '7301'), {
      contentType: 'text/csv',
      size: 1234,
      ttlSeconds: 600,
    });

    // Assert
    const url = new URL(put.url);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect([...url.searchParams.keys()].map((name) => name.toLowerCase())).not.toContain('content-type');
    expect(put).toMatchObject({ method: 'PUT', headers: { 'content-type': 'text/csv', 'content-length': '1234' } });
  });

  it('signs with the public endpoint and heads with the internal one', async () => {
    // Arrange
    const { storage, send, publicSend } = storageWith(() => ({
      ContentLength: 5,
      ETag: '"e1"',
      ContentType: 'text/csv',
    }));

    // Act
    const put = await storage.presignPut(importSourceKey(SCOPE, '7301'), {
      contentType: 'text/csv',
      size: 5,
      ttlSeconds: 600,
    });
    const head = await storage.head(importSourceKey(SCOPE, '7301'));

    // Assert
    expect(new URL(put.url).host).toBe('localhost:3900');
    expect(head).toEqual({ size: 5, etag: '"e1"', contentType: 'text/csv' });
    expect(commandsOf(send)[0]).toBeInstanceOf(HeadObjectCommand);
    expect(publicSend).not.toHaveBeenCalled();
  });

  it('every command targets S3_BUCKET_PRIVATE', async () => {
    // Arrange
    const { storage, send } = storageWith((command) =>
      command instanceof GetObjectCommand ? { ContentLength: 2, Body: body('ok') } : { ContentLength: 2, ETag: '"e"' },
    );
    const key = exportFileKey(SCOPE, '7302');

    // Act
    await storage.head(key);
    await storage.read(key, { maxBytes: 10, ifMatch: '"e"' });
    await storage.write(key, bytesOf('ok'), 'text/csv');
    await storage.write(key, body('o', 'k'), 'text/csv');
    await storage.delete(key);
    const put = await storage.presignPut(importSourceKey(SCOPE, '7301'), {
      contentType: 'text/csv',
      size: 2,
      ttlSeconds: 600,
    });
    const get = await storage.presignGet(key, {
      ttlSeconds: 300,
      downloadName: 'products.csv',
      contentType: 'text/csv',
    });

    // Assert
    const commands = commandsOf(send) as { input: { Bucket: string; Key: string } }[];
    expect(commands.map((command) => command.constructor)).toEqual([
      HeadObjectCommand,
      GetObjectCommand,
      PutObjectCommand,
      PutObjectCommand,
      DeleteObjectCommand,
    ]);
    expect(commands.every((command) => command.input.Bucket === BUCKET && command.input.Key === key)).toBe(true);
    expect(new URL(put.url).pathname.startsWith(`/${BUCKET}/uploads/`)).toBe(true);
    expect(new URL(get).pathname.startsWith(`/${BUCKET}/exports/`)).toBe(true);
  });

  it('presignGet refuses a key outside exports/', async () => {
    // Arrange
    const { storage } = storageWith();

    // Act and Assert
    await expect(
      storage.presignGet(importSourceKey(SCOPE, '7301'), {
        ttlSeconds: 300,
        downloadName: 'source.csv',
        contentType: 'text/csv',
      }),
    ).rejects.toMatchObject({ code: C.INVALID_INPUT });
  });

  it('presignGet sets attachment disposition with an ascii server-made name', async () => {
    // Arrange
    const { storage } = storageWith();
    const key = exportFileKey(SCOPE, '7302');
    const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Act
    const url = new URL(
      await storage.presignGet(key, { ttlSeconds: 300, downloadName: 'products-7302.xlsx', contentType: xlsx }),
    );

    // Assert
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="products-7302.xlsx"');
    expect(url.searchParams.get('response-content-type')).toBe(xlsx);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    for (const downloadName of ['قائمة.xlsx', 'a"b.csv', 'a\r\nb.csv', '']) {
      await expect(storage.presignGet(key, { ttlSeconds: 300, downloadName, contentType: xlsx })).rejects.toMatchObject(
        {
          code: C.INVALID_INPUT,
        },
      );
    }
  });

  it('read sends If-Match', async () => {
    // Arrange
    const { storage, send } = storageWith(() => ({ ContentLength: 4, Body: body('na', 'me') }));
    const key = importSourceKey(SCOPE, '7301');

    // Act
    const bytes = await storage.read(key, { maxBytes: 10, ifMatch: '"e1"' });

    // Assert
    expect(new TextDecoder().decode(bytes)).toBe('name');
    expect((commandsOf(send)[0] as GetObjectCommand).input.IfMatch).toBe('"e1"');
  });

  it('read refuses an object above the cap, even when its length lies', async () => {
    // Arrange
    const declared = storageWith(() => ({ ContentLength: 11, Body: body('x') })).storage;
    const lying = storageWith(() => ({ ContentLength: 2, Body: body('abc', 'def') })).storage;
    const key = importSourceKey(SCOPE, '7301');

    // Act and Assert
    await expect(declared.read(key, { maxBytes: 10, ifMatch: '"e"' })).rejects.toMatchObject({
      code: C.FILE_TOO_LARGE,
    });
    await expect(lying.read(key, { maxBytes: 4, ifMatch: '"e"' })).rejects.toMatchObject({ code: C.FILE_TOO_LARGE });
  });

  it('read releases the body of an object it refuses above the cap', async () => {
    // Arrange: an unread body would hold its pooled socket until it timed out
    const refused = Readable.from([bytesOf('x')]);
    const destroy = vi.spyOn(refused, 'destroy');
    const { storage } = storageWith(() => ({ ContentLength: 11, Body: refused }));

    // Act
    const read = storage.read(importSourceKey(SCOPE, '7301'), { maxBytes: 10, ifMatch: '"e"' });

    // Assert
    await expect(read).rejects.toMatchObject({ code: C.FILE_TOO_LARGE });
    expect(destroy).toHaveBeenCalled();
  });

  it('read releases a body whose length lied once it passes the cap', async () => {
    // Arrange
    const lying = Readable.from([bytesOf('abc'), bytesOf('def'), bytesOf('ghi')]);
    const { storage } = storageWith(() => ({ ContentLength: 2, Body: lying }));

    // Act
    const read = storage.read(importSourceKey(SCOPE, '7301'), { maxBytes: 4, ifMatch: '"e"' });

    // Assert
    await expect(read).rejects.toMatchObject({ code: C.FILE_TOO_LARGE });
    expect(lying.destroyed).toBe(true);
  });

  it('presignPut refuses a key outside uploads/', async () => {
    // Arrange
    const { storage } = storageWith();

    // Act and Assert
    await expect(
      storage.presignPut(exportFileKey(SCOPE, '7302'), { contentType: 'text/csv', size: 12, ttlSeconds: 600 }),
    ).rejects.toMatchObject({ code: C.INVALID_INPUT });
  });

  it('a changed or missing object is a job-state refusal, and a missing head is null', async () => {
    // Arrange
    const failing = (name: string, status: number) => () => {
      throw Object.assign(new Error('S3 says no'), { name, $metadata: { httpStatusCode: status } });
    };
    const key = importSourceKey(SCOPE, '7301');

    // Act and Assert
    await expect(
      storageWith(failing('PreconditionFailed', 412)).storage.read(key, { maxBytes: 10, ifMatch: '"e"' }),
    ).rejects.toMatchObject({ code: C.JOB_STATE });
    await expect(
      storageWith(failing('NoSuchKey', 404)).storage.read(key, { maxBytes: 10, ifMatch: '"e"' }),
    ).rejects.toMatchObject({ code: C.JOB_STATE });
    expect(await storageWith(failing('NotFound', 404)).storage.head(key)).toBeNull();
    await expect(storageWith(failing('InternalError', 500)).storage.head(key)).rejects.toThrow('S3 says no');
  });
});
