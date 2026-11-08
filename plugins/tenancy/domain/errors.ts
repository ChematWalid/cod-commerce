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
