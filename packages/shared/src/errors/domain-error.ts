/**
 * Base class of every typed domain error. Each API surface maps errors by their stable `code`.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable identifier, e.g. `tenancy.invalid-business-id`. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
