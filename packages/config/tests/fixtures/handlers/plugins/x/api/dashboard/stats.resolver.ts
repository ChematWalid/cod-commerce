import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class StatsResolver {
  @Query()
  stats(): number {
    return 1;
  }
}
