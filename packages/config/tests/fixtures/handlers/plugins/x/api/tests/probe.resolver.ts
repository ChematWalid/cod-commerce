import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class ProbeResolver {
  @Query()
  probe(): number {
    return 1;
  }
}
