import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext, Transaction } from '@vendure/core';
import { AccountProfileService, type ProfileUpdate } from '../application/account-profile.service';
import type { AccountProfile } from '../domain/profile';
import { withApiErrors } from './error-mapping';
import { activeUserIdOf, operationOf } from './operation';

/** The signed-in owner's own profile. The user is always the session's: no handler takes a user id. */
@Resolver()
export class ProfileResolver {
  constructor(private readonly profiles: AccountProfileService) {}

  @Query()
  @Allow(Permission.Owner)
  accountProfile(@Ctx() ctx: RequestContext): Promise<AccountProfile> {
    return withApiErrors(() => this.profiles.get(operationOf(ctx), activeUserIdOf(ctx)));
  }

  /** The photo is set with the stock `setActiveAdministratorAvatar`. */
  @Transaction()
  @Mutation()
  @Allow(Permission.Owner)
  updateAccountProfile(@Ctx() ctx: RequestContext, @Args('input') input: ProfileUpdate): Promise<AccountProfile> {
    return withApiErrors(() => this.profiles.update(operationOf(ctx), activeUserIdOf(ctx), input));
  }
}
