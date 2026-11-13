import type { IsolationCase } from '../matrix';
import { TEAM_CASES } from './team';
import { ACCOUNT_CASES } from './account';
import { PLATFORM_CASES } from './platform';
import { MEMBER_ACTIVITY_CASES } from './rbac-members';
import { ROLE_CASES } from './rbac-roles';
import { STOCK_READ_CASES } from './stock-reads';
import { STOCK_WRITE_CASES } from './stock-writes';
import { TENANCY_CASES } from './tenancy';
import { TENANCY_WRITE_CASES } from './tenancy-writes';

/** Every cell of the P1 isolation matrix, grouped by the plugin that owns the endpoint. */
export const ISOLATION_CASES: readonly IsolationCase[] = [
  ...TENANCY_CASES,
  ...TENANCY_WRITE_CASES,
  ...ROLE_CASES,
  ...MEMBER_ACTIVITY_CASES,
  ...PLATFORM_CASES,
  ...ACCOUNT_CASES,
  ...STOCK_READ_CASES,
  ...STOCK_WRITE_CASES,
  ...TEAM_CASES,
];
