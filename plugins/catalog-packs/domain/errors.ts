import { CATALOG_PACKS_ERROR_CODES, DomainError } from '@cod/shared';

const C = CATALOG_PACKS_ERROR_CODES;

/** Input that breaks a pack rule, or a pack whose computed price no column can hold; the value is never repeated. */
export class InvalidPackInputError extends DomainError {
  readonly code = C.INVALID_INPUT;
  constructor() {
    super('Invalid pack input');
  }
}

/** No pack product with that id in the active store; a foreign or malformed id answers the same (D2136). */
export class PackNotFoundError extends DomainError {
  readonly code = C.NOT_FOUND;
  constructor() {
    super('No such pack');
  }
}

/** The product exists but is not of type `pack`, so it holds no components. */
export class NotAPackError extends DomainError {
  readonly code = C.NOT_A_PACK;
  constructor() {
    super('The product is not a pack');
  }
}

/** A component line names a product, or a variant of it, that the active store does not hold. */
export class ComponentNotFoundError extends DomainError {
  readonly code = C.COMPONENT_NOT_FOUND;
  constructor() {
    super('No such component product');
  }
}

/** A component is a pack itself (the pack included): packs do not nest. */
export class ComponentIsPackError extends DomainError {
  readonly code = C.COMPONENT_IS_PACK;
  constructor() {
    super('A pack cannot hold a pack');
  }
}

/** In `shared_option` mode a component lacks the shared option, or has another option beside it. */
export class SharedOptionMissingError extends DomainError {
  readonly code = C.SHARED_OPTION_MISSING;
  constructor() {
    super('A component does not have exactly the shared option');
  }
}

/** In `shared_option` mode no value of the shared option is sold by every component. */
export class NoCommonValueError extends DomainError {
  readonly code = C.NO_COMMON_VALUE;
  constructor() {
    super('The components share no value of the option');
  }
}

/** The refusals that make a stored pack unpriceable when a component changes: recompute marks it stale (D2203). */
export const PACK_RULE_ERRORS = [
  InvalidPackInputError,
  ComponentNotFoundError,
  ComponentIsPackError,
  SharedOptionMissingError,
  NoCommonValueError,
] as const;

/** True for a {@link PACK_RULE_ERRORS} refusal. */
export const isPackRuleError = (error: unknown): boolean => PACK_RULE_ERRORS.some((type) => error instanceof type);
