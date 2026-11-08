import { DomainError } from '@cod/shared';

/** The global settings do not offer every platform language, so a store's language cannot be trusted. */
export class LanguagesNotConfiguredError extends DomainError {
  readonly code = 'tenancy.languages-not-configured';

  constructor() {
    super('The global settings must offer every platform language before a store is created');
  }
}

/** A store language outside the platform languages, or one Vendure refused. */
export class UnsupportedStoreLanguageError extends DomainError {
  readonly code = 'tenancy.unsupported-store-language';

  constructor(language: string) {
    super(`The platform does not offer the language "${language}"`);
  }
}

/** A subdomain that is malformed or kept by the platform. The reason is safe to show. */
export class SubdomainInvalidError extends DomainError {
  readonly code = 'tenancy.subdomain-invalid';
}

/** A subdomain another store holds, archived stores included (D4). */
export class SubdomainTakenError extends DomainError {
  readonly code = 'tenancy.subdomain-taken';

  constructor() {
    super('This subdomain is already taken');
  }
}

/** A business or store name that is blank or too long. */
export class NameInvalidError extends DomainError {
  readonly code = 'tenancy.name-invalid';

  constructor() {
    super('A name must not be blank or too long');
  }
}

/** No store with this id is visible to the caller: it does not exist or belongs to someone else. */
export class StoreNotFoundError extends DomainError {
  readonly code = 'tenancy.store-not-found';

  constructor() {
    super('The store does not exist');
  }
}

/** An archived store cannot change: its subdomain stays reserved (D4). */
export class StoreArchivedError extends DomainError {
  readonly code = 'tenancy.store-archived';

  constructor() {
    super('The store is archived');
  }
}

/** Archiving would leave the business with no active store. */
export class LastStoreError extends DomainError {
  readonly code = 'tenancy.last-store';

  constructor() {
    super('A business must keep at least one active store');
  }
}

/** No business has this id. */
export class BusinessNotFoundError extends DomainError {
  readonly code = 'tenancy.business-not-found';

  constructor() {
    super('The business does not exist');
  }
}

/** A business with no Owner role, which only an interrupted provisioning could leave. */
export class BusinessOwnerRoleMissingError extends DomainError {
  readonly code = 'tenancy.business-owner-role-missing';

  constructor() {
    super('The business has no owner role');
  }
}

/** The platform seed has not created the Algeria zone. */
export class PlatformZoneMissingError extends DomainError {
  readonly code = 'tenancy.platform-zone-missing';

  constructor(zone: string) {
    super(`The platform zone "${zone}" does not exist`);
  }
}

/** This process holds no worker id lease right now, so it must not make ids (ADR 0003). */
export class IdGeneratorNotReadyError extends DomainError {
  readonly code = 'tenancy.id-generator-not-ready';

  constructor() {
    super('The id generator holds no worker id lease');
  }
}

/** Every leasable worker id is held by a live process. */
export class NoWorkerIdAvailableError extends DomainError {
  readonly code = 'tenancy.no-worker-id-available';

  constructor() {
    super('Every snowflake worker id is leased');
  }
}

/** An `orWhere` on a tenant query, which would widen it past the business filter (ADR 0002). */
export class TenantQueryWidenedError extends DomainError {
  readonly code = 'tenancy.tenant-query-widened';

  constructor() {
    super('A tenant query cannot widen its filter with orWhere: put the alternatives in Brackets inside andWhere');
  }
}

/** A write builder taken from a tenant query, which would not carry its business filter (ADR 0002). */
export class TenantQueryWriteRefusedError extends DomainError {
  readonly code = 'tenancy.tenant-query-write-refused';

  constructor() {
    super('A tenant query is read-only: write through TenantRepository');
  }
}

/** A caller's value for the parameter that holds a tenant query's business (ADR 0002). */
export class TenantQueryParameterReservedError extends DomainError {
  readonly code = 'tenancy.tenant-query-parameter-reserved';

  constructor() {
    super('This query parameter name is reserved for the tenant filter');
  }
}

/** A tenant scope with no business: TypeORM would drop the undefined filter and match every tenant. */
export class TenantScopeMissingError extends DomainError {
  readonly code = 'tenancy.tenant-scope-missing';

  constructor() {
    super('A tenant scope must carry a business id');
  }
}
