import { Brackets, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import {
  TenantQueryParameterReservedError,
  TenantQueryWidenedError,
  TenantQueryWriteRefusedError,
} from '../domain/errors';

/** The query parameter holding the scope's business. */
export const TENANT_BUSINESS_PARAMETER = 'tenantBusinessId';

const refuseWidening = (): never => {
  throw new TenantQueryWidenedError();
};

const refuseWrite = (): never => {
  throw new TenantQueryWriteRefusedError();
};

/**
 * Keeps a select builder inside its tenant: the builder's own methods would otherwise replace the business filter
 * (`where`), escape it (a bare `a OR b` is joined without parentheses, `orWhere`), rewrite its value (parameters),
 * or leave it behind (`clone`, write builders).
 */
export function lockToTenant<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  businessId: string,
): SelectQueryBuilder<T> {
  const andWhere = query.andWhere.bind(query);
  const narrow = (where: unknown, parameters?: ObjectLiteral): SelectQueryBuilder<T> =>
    andWhere(
      new Brackets((inner) => {
        inner.where(where as string, parameters);
      }),
    );
  const setParameter = query.setParameter.bind(query);
  const clone = query.clone.bind(query);

  query.where = narrow;
  query.andWhere = narrow;
  query.orWhere = refuseWidening;
  // TypeORM's own pagination copies the parameters back, so only a different value is refused.
  query.setParameter = (key, value) => {
    if (key === TENANT_BUSINESS_PARAMETER && value !== businessId) throw new TenantQueryParameterReservedError();
    return setParameter(key, value);
  };
  query.clone = () => lockToTenant(clone(), businessId);
  query.insert = refuseWrite;
  query.update = refuseWrite;
  query.delete = refuseWrite;
  query.softDelete = refuseWrite;
  query.restore = refuseWrite;
  query.relation = refuseWrite;
  return query;
}
