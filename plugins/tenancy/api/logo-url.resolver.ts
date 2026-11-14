import { toBusinessId } from '@cod/shared';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { LogoUrlService } from '../application/logo-url.service';
import type { Business } from '../domain/business';
import { asOperationContext } from '../domain/ports/operation-context';
import type { Store } from '../domain/store';
import { withApiErrors } from './error-mapping';

/**
 * `Business.logoUrl`. The parent was already read under its query's permission and tenant checks; the asset is
 * checked against that business's store channels on every read (D2120).
 */
@Resolver('Business')
export class BusinessLogoUrlResolver {
  constructor(private readonly logos: LogoUrlService) {}

  /** The logo's preview URL, or `null` when there is none or it is not the business's own asset. */
  @ResolveField()
  logoUrl(@Ctx() ctx: RequestContext, @Parent() business: Business): Promise<string | null> {
    return withApiErrors(() =>
      this.logos.urlOf(asOperationContext(ctx), toBusinessId(business.id), business.logoAssetId),
    );
  }
}

/** `Store.logoUrl`, checked against the store's own channel, the rule `updateStore` writes it under (D2120). */
@Resolver('Store')
export class StoreLogoUrlResolver {
  constructor(private readonly logos: LogoUrlService) {}

  /** The logo's preview URL, or `null` when there is none or the store's channel does not hold it. */
  @ResolveField()
  logoUrl(@Ctx() ctx: RequestContext, @Parent() store: Store): Promise<string | null> {
    return withApiErrors(() => this.logos.storeUrlOf(asOperationContext(ctx), store));
  }
}
