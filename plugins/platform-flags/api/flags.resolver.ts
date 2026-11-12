import { platformStaffPermission } from '@cod/plugin-tenancy';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, type RequestContext } from '@vendure/core';
import { FlagAdminService, type FlagView } from '../application/flag-admin.service';
import type { OverrideScope } from '../domain/snapshot';
import { mapDomainError } from './error-mapping';

type GraphQlScope = 'PLAN' | 'BUSINESS' | 'STORE';

/** A flag as the Admin API returns it (`FeatureFlag`): scopes are enum names and `updatedAt` is a `DateTime`. */
export interface FeatureFlagDto extends Omit<FlagView, 'updatedAt' | 'overrides'> {
  readonly updatedAt: Date;
  readonly overrides: readonly { readonly scope: GraphQlScope; readonly scopeId: string; readonly enabled: boolean }[];
}

interface UpdateArgs {
  readonly input: {
    readonly key: string;
    readonly defaultEnabled?: boolean | null;
    readonly rolloutPercent?: number | null;
    readonly description?: string | null;
  };
}

interface OverrideArgs {
  readonly input: { readonly key: string; readonly scope: GraphQlScope; readonly scopeId: string; readonly enabled: boolean };
}

interface OverrideKeyArgs {
  readonly input: { readonly key: string; readonly scope: GraphQlScope; readonly scopeId: string };
}

interface EvaluateArgs {
  readonly key: string;
  readonly businessId?: string | null;
  readonly storeId?: string | null;
}

const toScope = (scope: GraphQlScope): OverrideScope => scope.toLowerCase() as OverrideScope;

const toDto = (view: FlagView): FeatureFlagDto => ({
  ...view,
  updatedAt: new Date(view.updatedAt),
  overrides: view.overrides.map((override) => ({
    ...override,
    scope: override.scope.toUpperCase() as GraphQlScope,
  })),
});

/** The staff who made the change, for the audit line. */
const actorOf = (ctx: RequestContext): string => `user:${String(ctx.activeUserId ?? 'unknown')}`;

/** The Admin API of the operational flags: platform staff only, so no handler takes a tenant. */
@Resolver()
export class FlagsResolver {
  constructor(private readonly admin: FlagAdminService) {}

  @Query()
  @Allow(platformStaffPermission.Permission)
  async featureFlags(): Promise<FeatureFlagDto[]> {
    return (await this.admin.list()).map(toDto);
  }

  @Query()
  @Allow(platformStaffPermission.Permission)
  async evaluateFeatureFlag(@Args() args: EvaluateArgs): Promise<boolean> {
    try {
      return await this.admin.evaluate(args.key, args.businessId ?? undefined, args.storeId ?? undefined);
    } catch (error: unknown) {
      mapDomainError(error);
    }
  }

  @Mutation()
  @Allow(platformStaffPermission.Permission)
  async updateFeatureFlag(@Ctx() ctx: RequestContext, @Args() args: UpdateArgs): Promise<FeatureFlagDto> {
    const { key, defaultEnabled, rolloutPercent, description } = args.input;
    try {
      return toDto(
        await this.admin.update(actorOf(ctx), {
          key,
          ...(defaultEnabled === null || defaultEnabled === undefined ? {} : { defaultEnabled }),
          ...(rolloutPercent === null || rolloutPercent === undefined ? {} : { rolloutPercent }),
          ...(description === null || description === undefined ? {} : { description }),
        }),
      );
    } catch (error: unknown) {
      mapDomainError(error);
    }
  }

  @Mutation()
  @Allow(platformStaffPermission.Permission)
  async setFeatureFlagOverride(@Ctx() ctx: RequestContext, @Args() args: OverrideArgs): Promise<FeatureFlagDto> {
    try {
      return toDto(await this.admin.setOverride(actorOf(ctx), { ...args.input, scope: toScope(args.input.scope) }));
    } catch (error: unknown) {
      mapDomainError(error);
    }
  }

  @Mutation()
  @Allow(platformStaffPermission.Permission)
  async removeFeatureFlagOverride(@Ctx() ctx: RequestContext, @Args() args: OverrideKeyArgs): Promise<FeatureFlagDto> {
    try {
      return toDto(await this.admin.removeOverride(actorOf(ctx), { ...args.input, scope: toScope(args.input.scope) }));
    } catch (error: unknown) {
      mapDomainError(error);
    }
  }
}
