import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Permission } from '@vendure/core';

@Resolver()
export class GuardedResolver {
  @Query()
  @Allow(Permission.Public)
  guarded(): number {
    return 1;
  }
}
