import { CATALOG_OPERATIONS, CATALOG_ROUTES, restTargetOf, targetOf } from '../catalog-operations';
import type { IsolationCase } from '../matrix';
import { sweepCasesOf } from './endpoint-sweep';

/** Every generated catalog cell (P2.S1, D2115): see `endpoint-sweep.ts` for what each endpoint gets. */
export const CATALOG_SWEEP_CASES: readonly IsolationCase[] = sweepCasesOf({
  prefix: 'catalog',
  operations: CATALOG_OPERATIONS,
  routes: CATALOG_ROUTES,
  targetOf,
  restTargetOf,
});
