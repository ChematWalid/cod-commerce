import type { Repository } from 'typeorm';

/** Forbidden: application/ depending on TypeORM, type-only imports included. */
export type AnyRepository = Repository<object>;
