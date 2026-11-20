import { RateLimitedError, RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';

/** Caps the bulk edits, imports, exports and link imports one administrator and one business can run (D2217). */
@Injectable()
export class ImportThrottle {
  constructor(private readonly limiter: RateLimiter) {}

  /**
   * Spends one bulk edit (up to 500 product writes). The narrower actor budget is spent first, so one administrator
   * past its own cap is refused before its calls can drain the budget the whole business shares.
   *
   * @throws RateLimitedError (429) past the actor's or the business's bulk-edit budget.
   */
  async spendBulkEdit(businessId: BusinessId, administratorKey: string): Promise<void> {
    // An administrator acts for one business, but its id says which one only with the business.
    await this.spend('catalog-bulk-edit-actor', `${businessId}:${administratorKey}`);
    await this.spend('catalog-bulk-edit-business', businessId);
  }

  /**
   * Spends one export (up to 20 000 products read, D2211) of the business's shared budget.
   *
   * @throws RateLimitedError (429) past the business's export budget.
   */
  async spendExport(businessId: BusinessId): Promise<void> {
    await this.spend('catalog-export-business', businessId);
  }

  /**
   * Spends one import step that reads the file or writes the catalog: an upload, an analyze, a preview with its
   * mapping, or a confirm (D2217). The actor's budget first, then the business's.
   *
   * @throws RateLimitedError (429) past the actor's or the business's import budget.
   */
  async spendImport(businessId: BusinessId, administratorKey: string): Promise<void> {
    await this.spend('catalog-import-actor', `${businessId}:${administratorKey}`);
    await this.spend('catalog-import-business', businessId);
  }

  /**
   * Spends one link import or polish (D2217): a fetch of a page on the internet, or an AI call from P9.S7b. The
   * actor's budget first, then the business's.
   *
   * @throws RateLimitedError (429) past the actor's or the business's scrape budget.
   */
  async spendScrape(businessId: BusinessId, administratorKey: string): Promise<void> {
    await this.spend('catalog-scrape-actor', `${businessId}:${administratorKey}`);
    await this.spend('catalog-scrape-business', businessId);
  }

  private async spend(policy: RateLimitPolicyName, key: string): Promise<void> {
    const decision = await this.limiter.consume(policy, key);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
  }
}
