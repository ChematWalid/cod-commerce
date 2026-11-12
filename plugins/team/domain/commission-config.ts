import {
  type BusinessId,
  COMMISSION_FIXED_MAX_DZD,
  COMMISSION_NAME_MAX_LENGTH,
  COMMISSION_PERCENT_MAX_BPS,
  type CommissionBasis,
  type CommissionConfigCommand,
  type CommissionValueKind,
  type Snowflake,
  type StoreAccessKind,
  TEAM_COMMISSION_ACTIVITY_FIELDS,
  type TeamCommissionActivityDiff,
  type TenantScope,
  toSnowflake,
  type UpdateCommissionConfigCommand,
} from '@cod/shared';
import { InvalidInputError } from './errors';

/** A commission structure a business gives its members: per confirmed or delivered order, fixed or percent. */
export interface CommissionConfig {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly name: string;
  /** Decides whether two names are the same; unique per business. */
  readonly nameKey: string;
  readonly basis: CommissionBasis;
  readonly valueKind: CommissionValueKind;
  /** Whole DZD for `fixed`, basis points for `percent`. */
  readonly value: number;
  readonly scope: StoreAccessKind;
  readonly storeIds: readonly Snowflake[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What {@link createCommissionConfig} needs. */
export interface NewCommissionConfigInput {
  readonly id: Snowflake;
  readonly scope: TenantScope;
  readonly command: CommissionConfigCommand;
  readonly now: Date;
}

const RUN_OF_SPACES = /\s+/g;

/** A name as kept: NFKC, trimmed, runs of spaces collapsed. */
const cleanName = (raw: string): string => raw.normalize('NFKC').replace(RUN_OF_SPACES, ' ').trim();

/** The uniqueness key of a commission name; upper then lower case also folds `ß` to `ss`. */
export function commissionNameKeyOf(name: string): string {
  return cleanName(name).toUpperCase().toLowerCase();
}

const VALUE_CAP: Readonly<Record<CommissionValueKind, number>> = {
  fixed: COMMISSION_FIXED_MAX_DZD,
  percent: COMMISSION_PERCENT_MAX_BPS,
};

function isValidValue(kind: CommissionValueKind, value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= VALUE_CAP[kind];
}

function isValidName(name: string): boolean {
  const length = Array.from(name).length;
  return length > 0 && length <= COMMISSION_NAME_MAX_LENGTH;
}

/**
 * Builds a valid commission config of the scope's business. The API schema already checks the input; this keeps
 * the invariants true for any other caller.
 *
 * @throws {InvalidInputError} for a blank or long name, a value out of range (percent above 100 %), or a `selected`
 * scope without stores.
 */
export function createCommissionConfig(input: NewCommissionConfigInput): CommissionConfig {
  const { command } = input;
  const name = cleanName(command.name);
  const selectedWithoutStores = command.scope === 'selected' && command.storeIds.length === 0;
  if (!isValidName(name) || !isValidValue(command.valueKind, command.value) || selectedWithoutStores) {
    throw new InvalidInputError();
  }
  return {
    id: input.id,
    businessId: input.scope.businessId,
    name,
    nameKey: commissionNameKeyOf(name),
    basis: command.basis,
    valueKind: command.valueKind,
    value: command.value,
    scope: command.scope,
    storeIds: command.scope === 'all' ? [] : command.storeIds.map(toSnowflake),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** The command that rebuilds `config` as it is, with `patch` applied; stores follow the scope, as on creation. */
function commandOf(config: CommissionConfig, patch: UpdateCommissionConfigCommand): CommissionConfigCommand {
  return {
    name: patch.name ?? config.name,
    basis: patch.basis ?? config.basis,
    valueKind: patch.valueKind ?? config.valueKind,
    value: patch.value ?? config.value,
    scope: patch.scope ?? config.scope,
    storeIds: patch.scope === undefined ? [...config.storeIds] : (patch.storeIds ?? []),
  };
}

/**
 * `config` with `patch` applied, stamped `now`. The result must be a valid config on its own: a switch to `percent`
 * re-checks the value against 100 %.
 *
 * @throws {InvalidInputError} as {@link createCommissionConfig} does.
 */
export function reviseCommissionConfig(
  config: CommissionConfig,
  patch: UpdateCommissionConfigCommand,
  now: Date,
): CommissionConfig {
  const revised = createCommissionConfig({
    id: config.id,
    scope: { businessId: config.businessId },
    command: commandOf(config, patch),
    now,
  });
  return { ...revised, createdAt: config.createdAt };
}

/** A commission field an activity row may name as changed, never with its value (D216). */
export type CommissionActivityField = TeamCommissionActivityDiff['changedFields'][number];

const sameStores = (left: readonly Snowflake[], right: readonly Snowflake[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/** The fields of `after` that differ from `before`, in the activity log's order. */
export function commissionChangedFields(before: CommissionConfig, after: CommissionConfig): CommissionActivityField[] {
  return TEAM_COMMISSION_ACTIVITY_FIELDS.filter((field) =>
    field === 'storeIds' ? !sameStores(before.storeIds, after.storeIds) : before[field] !== after[field],
  );
}

/** The whole diff of a commission's activity row (D216): which config, its name and the fields, never the value. */
export function commissionActivityDiff(
  config: Pick<CommissionConfig, 'id' | 'name'>,
  changedFields: readonly CommissionActivityField[],
): TeamCommissionActivityDiff {
  return { commissionConfigId: config.id, name: config.name, changedFields: [...changedFields] };
}
