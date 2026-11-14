import { Readable } from 'node:stream';
import { AUTH_ERROR_CODES } from '@cod/shared';
import type { AssetService, ChannelService, ConfigService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { MediaTypeError } from '../../domain/errors';
import { IMAGE_FORMATS } from '../../domain/image-format';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { VendureAssetReads } from '../../infrastructure/vendure-asset-reads';
import { VendureMediaStorage } from '../../infrastructure/vendure-media-storage.adapter';

const STORE_CHANNEL = 7;
const DEFAULT_CHANNEL = 1;
const ctx = asOperationContext({ channelId: STORE_CHANNEL, req: {} });
const asset = { id: 55, source: 'b/1/s/2/source/ab/x.png', preview: 'b/1/s/2/preview/ab/x__preview.png' };
const storedAsset = { ...asset, mimeType: 'image/png', width: 3, height: 2, fileSize: 64 };
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Upload {
  readonly filename: string;
  readonly mimetype: string;
  readonly createReadStream: () => Readable;
}

/** Vendure's services as the adapter uses them, recording every call. */
function world(options: { create?: () => Promise<unknown>; inUse?: boolean; channels?: readonly number[] } = {}) {
  const calls: string[] = [];
  const uploads: Upload[] = [];
  const assets = {
    create: async (_ctx: unknown, input: { file: Promise<Upload> }) => {
      uploads.push(await input.file);
      return options.create ? options.create() : storedAsset;
    },
    delete: (_ctx: unknown, ids: readonly unknown[], force: boolean) => {
      calls.push(`delete ${ids.join(',')} force=${String(force)}`);
      return Promise.resolve({ result: 'DELETED' });
    },
  } as unknown as AssetService;
  const channels = {
    getDefaultChannel: () => Promise.resolve({ id: DEFAULT_CHANNEL }),
    removeFromChannels: (_ctx: unknown, _type: unknown, id: unknown, ids: readonly unknown[]) => {
      calls.push(`leave ${String(id)} ${ids.join(',')}`);
      return Promise.resolve();
    },
    assignToChannels: (_ctx: unknown, _type: unknown, id: unknown, ids: readonly unknown[]) => {
      calls.push(`join ${String(id)} ${ids.join(',')}`);
      return Promise.resolve();
    },
  } as unknown as ChannelService;
  const config = {
    assetOptions: { assetStorageStrategy: { toAbsoluteUrl: (_req: unknown, id: string) => `https://cdn.test/${id}` } },
  } as unknown as ConfigService;
  const reads = {
    assetsByIds: () => Promise.resolve([storedAsset]),
    channelIdsOf: () => Promise.resolve(options.channels),
    isInUse: () => Promise.resolve(options.inUse ?? false),
  } as unknown as VendureAssetReads;
  return { storage: new VendureMediaStorage(assets, channels, config, reads), calls, uploads };
}

describe('VendureMediaStorage', () => {
  it('stores the file under the sniffed type and extension, off the default channel, and answers its urls', async () => {
    // Arrange
    const { storage, calls, uploads } = world();

    // Act
    const stored = await storage.store(ctx, { bytes: png, format: IMAGE_FORMATS.png });

    // Assert
    expect(uploads.map(({ filename, mimetype }) => [filename, mimetype])).toEqual([['media.png', 'image/png']]);
    expect(calls).toEqual([`leave 55 ${String(DEFAULT_CHANNEL)}`]);
    expect(stored).toEqual({
      assetId: toCoreId('55'),
      url: `https://cdn.test/${asset.source}`,
      previewUrl: `https://cdn.test/${asset.preview}`,
      mimeType: 'image/png',
      width: 3,
      height: 2,
      fileSize: 64,
    });
  });

  it("maps the content guard's refusal (undecodable body, over 40 MP) to catalog.media-type", async () => {
    // Arrange
    const guardRefusal = Object.assign(new Error('The image must be a PNG'), { code: AUTH_ERROR_CODES.IMAGE_TYPE });
    const { storage } = world({ create: () => Promise.reject(guardRefusal) });

    // Act
    const storing = storage.store(ctx, { bytes: png, format: IMAGE_FORMATS.png });

    // Assert
    await expect(storing).rejects.toBeInstanceOf(MediaTypeError);
  });

  it("maps core's own type refusal to catalog.media-type", async () => {
    // Arrange
    const { storage } = world({
      create: () => Promise.resolve({ __typename: 'MimeTypeError', errorCode: 'MIME_TYPE_ERROR', message: 'no' }),
    });

    // Act
    const storing = storage.store(ctx, { bytes: png, format: IMAGE_FORMATS.png });

    // Assert
    await expect(storing).rejects.toBeInstanceOf(MediaTypeError);
  });

  it('rethrows any other failure unchanged', async () => {
    // Arrange
    const failure = new Error('bucket down');
    const { storage } = world({ create: () => Promise.reject(failure) });

    // Act
    const storing = storage.store(ctx, { bytes: png, format: IMAGE_FORMATS.png });

    // Assert
    await expect(storing).rejects.toBe(failure);
  });

  it("shares each attached asset with the product's store channel (D2113)", async () => {
    // Arrange
    const { storage, calls } = world();

    // Act
    await storage.shareWithStore(ctx, [toCoreId('55'), toCoreId('56')]);

    // Assert
    expect(calls).toEqual([`join 55 ${String(STORE_CHANNEL)}`, `join 56 ${String(STORE_CHANNEL)}`]);
  });

  it('answers in-use for an asset a live product or variant uses, and deletes nothing (D2128)', async () => {
    // Arrange
    const { storage, calls } = world({ inUse: true, channels: [STORE_CHANNEL] });

    // Act
    const removal = await storage.remove(ctx, toCoreId('55'));

    // Assert
    expect([removal, calls]).toEqual(['in-use', []]);
  });

  it('takes the asset out of every other store channel, then deletes it from the active one', async () => {
    // Arrange
    const { storage, calls } = world({ channels: [3, 9] });

    // Act
    const removal = await storage.remove(ctx, toCoreId('55'));

    // Assert
    expect(removal).toBe('removed');
    expect(calls).toEqual([`join 55 ${String(STORE_CHANNEL)}`, 'leave 55 3,9', 'delete 55 force=true']);
  });

  it('answers removed for an asset that is already gone', async () => {
    // Arrange
    const { storage, calls } = world({ channels: undefined });

    // Act
    const removal = await storage.remove(ctx, toCoreId('55'));

    // Assert
    expect([removal, calls]).toEqual(['removed', []]);
  });
});
