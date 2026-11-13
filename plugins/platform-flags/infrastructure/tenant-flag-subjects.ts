import { TenantContextMissingError, tenantOf } from '@cod/plugin-tenancy';
import type { RequestContext } from '@vendure/core';
import { Injectable } from '@nestjs/common';
import type { FlagSubjectPort } from '../application/ports';
import type { FlagSubject } from '../domain/snapshot';

/** The subject of a request: its tenant's business and active store when the tenant guard resolved one. */
@Injectable()
export class TenantFlagSubjects implements FlagSubjectPort {
  subjectOf(request: object): FlagSubject {
    try {
      const { businessId, activeStoreId } = tenantOf(request as RequestContext);
      return { businessId, storeId: activeStoreId };
    } catch (error: unknown) {
      if (error instanceof TenantContextMissingError) return {};
      throw error;
    }
  }
}
