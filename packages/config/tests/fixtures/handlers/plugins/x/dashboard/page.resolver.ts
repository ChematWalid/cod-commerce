import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class PageResolver {
  @Query()
  page(): number {
    return 1;
  }
}
