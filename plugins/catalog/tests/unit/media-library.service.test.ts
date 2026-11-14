import { MEDIA_MAX_BYTES, type StoreId } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { MediaLibraryService } from '../../application/media-library.service';
import { MediaInUseError, MediaNotFoundError, MediaTooLargeError, MediaTypeError } from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { FakeOrderManagerCheck } from '../fakes/fake-order-manager-check';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size = 64): Uint8Array => Uint8Array.from({ length: size }, (_, i) => PNG_SIGNATURE[i] ?? 0);
const svg = (): Uint8Array => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
const html = (): Uint8Array => new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
const PAGE = { skip: 0, take: 50 };

describe('MediaLibraryService', () => {
  let world: ProductWorld;
  let service: MediaLibraryService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new MediaLibraryService(world.ports);
  });

  const upload = (scope: StoreScope, bytes: Uint8Array = png()) => service.upload(world.ctxOf(scope), scope, bytes);
  const listed = async (scope: StoreScope) => (await service.list(world.ctxOf(scope), scope, PAGE)).items;
  /** The caller reaches `stores` through its roles (D2132). */
  const reaching = (stores: readonly StoreId[] | 'all'): void => {
    world.orderManagerChecks.register(new FakeOrderManagerCheck(new Map(), stores === 'all' ? 'all' : new Set(stores)));
  };

  it('returns a url and lists it for the uploading store (AC7)', async () => {
    // Act
    const media = await upload(scopeA);

    // Assert
    expect(media).toMatchObject({ mimeType: 'image/png', url: expect.stringContaining('https://') as string });
    expect(await listed(scopeA)).toEqual([media]);
    expect(world.transactions).toBe(1);
  });

  it('refuses 5 242 881 bytes and stores nothing', async () => {
    // Act
    const uploading = upload(scopeA, png(MEDIA_MAX_BYTES + 1));

    // Assert
    await expect(uploading).rejects.toBeInstanceOf(MediaTooLargeError);
    expect([world.storage.files.size, world.media.rows.length]).toEqual([0, 0]);
  });

  it('accepts exactly the size limit', async () => {
    // Act
    const media = await upload(scopeA, png(MEDIA_MAX_BYTES));

    // Assert
    expect(media.fileSize).toBe(MEDIA_MAX_BYTES);
  });

  it.each([
    ['svg', svg()],
    ['an html file', html()],
    ['an empty file', new Uint8Array()],
  ])('refuses %s and stores nothing', async (_name, bytes) => {
    // Act
    const uploading = upload(scopeA, bytes);

    // Assert
    await expect(uploading).rejects.toBeInstanceOf(MediaTypeError);
    expect([world.storage.files.size, world.media.rows.length]).toEqual([0, 0]);
  });

  it('stores the format its bytes are, whatever the client called the file', async () => {
    // Act
    await upload(scopeA, png());

    // Assert
    expect(world.storage.storedFormats).toEqual([{ mimeType: 'image/png', extension: 'png' }]);
  });

  it('writes no media row when the content guard refuses the body', async () => {
    // Arrange
    world.storage.refuseContent = true;

    // Act
    const uploading = upload(scopeA);

    // Assert
    await expect(uploading).rejects.toBeInstanceOf(MediaTypeError);
    expect(world.media.rows).toEqual([]);
  });

  it("lists only the active store's media while no team check is registered", async () => {
    // Arrange
    const own = await upload(scopeA);
    await upload(scopeA2);

    // Act / Assert
    expect(await listed(scopeA)).toEqual([own]);
  });

  it('lists every store of the business for a caller reaching all of them, never business B', async () => {
    // Arrange
    reaching('all');
    const [first, second] = [await upload(scopeA), await upload(scopeA2)];
    await upload(scopeB);

    // Act
    const items = await listed(scopeA);

    // Assert
    expect(items.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("hides another store's media from a member limited to the active store", async () => {
    // Arrange
    reaching([scopeA.storeId]);
    const own = await upload(scopeA);
    await upload(scopeA2);

    // Act / Assert
    expect(await listed(scopeA)).toEqual([own]);
  });

  it('refuses deleting media used by a product, and keeps it', async () => {
    // Arrange
    const media = await upload(scopeA);
    world.storage.inUse.add(media.assetId);

    // Act
    const deleting = service.delete(world.ctxOf(scopeA), scopeA, media.id);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(MediaInUseError);
    expect(await listed(scopeA)).toEqual([media]);
  });

  it('deletes media of the other store for a caller reaching all stores, and removes its asset', async () => {
    // Arrange
    reaching('all');
    const media = await upload(scopeA2);

    // Act
    await service.delete(world.ctxOf(scopeA), scopeA, media.id);

    // Assert
    expect([world.media.rows, world.storage.files.has(media.assetId)]).toEqual([[], false]);
  });

  it("answers not found for media outside the caller's stores, of business B or with a malformed id", async () => {
    // Arrange
    reaching([scopeA.storeId]);
    const otherStore = await upload(scopeA2);
    const ofB = await upload(scopeB);
    const remove = (id: string) => service.delete(world.ctxOf(scopeA), scopeA, id);

    // Act / Assert
    await expect(remove(otherStore.id)).rejects.toBeInstanceOf(MediaNotFoundError);
    await expect(remove(ofB.id)).rejects.toBeInstanceOf(MediaNotFoundError);
    await expect(remove('abc')).rejects.toBeInstanceOf(MediaNotFoundError);
    expect(world.storage.files.size).toBe(2);
  });
});
