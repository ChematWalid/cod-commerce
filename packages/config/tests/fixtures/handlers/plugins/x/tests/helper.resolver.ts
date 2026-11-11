import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HelperResolver {
  @Query()
  helper(): number {
    return 1;
  }
}
