import type { IsolationCase } from '../matrix';
import { TENANCY_CASES } from './tenancy';

/** Every cell of the P1 isolation matrix, grouped by the plugin that owns the endpoint. */
export const ISOLATION_CASES: readonly IsolationCase[] = [...TENANCY_CASES];
