import { Injectable } from '@nestjs/common';
import type { PlanOfBusinessPort } from '../domain/ports/plan-of-business.port';

/** Nobody has a plan until P9.S1 brings them, so plan overrides match nothing (D116). */
@Injectable()
export class NoPlanAdapter implements PlanOfBusinessPort {
  planKeyOf(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
}
