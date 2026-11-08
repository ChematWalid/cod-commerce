import { isPlatformLanguageCode, type StoreId } from '@cod/shared';
import { UnsupportedStoreLanguageError } from '../domain/errors';
import { assertValidName } from '../domain/name';
import type { OperationContext } from '../domain/ports/operation-context';
import type { Store, StoreActor, StorePatch } from '../domain/store';
import { requireActiveStore } from './store-access';
import type { StoreAdminPorts } from './store-admin-ports';

function assertValidPatch({ name, language }: StorePatch): void {
  if (name !== undefined) {
    assertValidName(name);
  }
  if (language !== undefined && !isPlatformLanguageCode(language)) {
    throw new UnsupportedStoreLanguageError(language);
  }
}

/** Changes a store's settings, keeping its channel's language in step (D7). */
export class UpdateStoreService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /**
   * Applies `patch` in one transaction, so a refused channel update leaves the store unchanged.
   *
   * @throws {@link NameInvalidError}, {@link UnsupportedStoreLanguageError}, {@link StoreNotFoundError} or
   * {@link StoreArchivedError}.
   */
  async update(ctx: OperationContext, actor: StoreActor, id: StoreId, patch: StorePatch): Promise<Store> {
    assertValidPatch(patch);
    const updated = await this.ports.transaction.run(ctx, (transactional) =>
      this.apply(transactional, actor, id, patch),
    );
    await this.ports.hosts.invalidate({ storeId: updated.id, subdomains: [updated.subdomain] });
    return updated;
  }

  private async apply(ctx: OperationContext, actor: StoreActor, id: StoreId, patch: StorePatch): Promise<Store> {
    const store = await requireActiveStore(this.ports.stores, ctx, actor, id);
    if (patch.language !== undefined && patch.language !== store.language) {
      await this.ports.channels.updateChannelLanguage(ctx, store.channelId, patch.language);
    }
    const write = { ...patch, updatedAt: this.ports.clock() };
    await this.ports.stores.update(ctx, actor.businessId, id, write);
    return { ...store, ...write };
  }
}
