import type { Repository } from 'typeorm';

/** Forbidden: domain/ depending on TypeORM, which resolves into node_modules as it does in the workspace. */
export type AnyRepository = Repository<object>;
