import { MAX_IDENTIFIER_LENGTH, PARTITION_SUFFIX_LENGTH, SAFE_IDENTIFIER } from './constants';
import { InvalidPartitionPolicyError } from './errors';
import type { PartitionPolicy } from './policy';

const isCount = (value: number, minimum: number): boolean => Number.isInteger(value) && value >= minimum;

/** The first reason the policy cannot be maintained safely, or `null`. */
function problemWith(policy: PartitionPolicy): string | null {
  if (!SAFE_IDENTIFIER.test(policy.table)) return 'the table is not a plain identifier';
  if (!SAFE_IDENTIFIER.test(policy.column)) return 'the column is not a plain identifier';
  if (policy.table.length + PARTITION_SUFFIX_LENGTH > MAX_IDENTIFIER_LENGTH) {
    return 'the table name is too long for its partition names';
  }
  if (!isCount(policy.premake, 0)) return 'premake is not a whole number of intervals, zero or more';
  if (!isCount(policy.retain, 0)) return 'retain is not a whole number of intervals, zero or more';
  if (policy.scrub !== undefined && !isCount(policy.scrub.afterIntervals, 1)) {
    return 'the scrub age is not a whole number of intervals, one or more';
  }
  return null;
}

/** @throws InvalidPartitionPolicyError when the policy's names or counts would break the DDL. */
export function assertValidPolicy(policy: PartitionPolicy): void {
  const problem = problemWith(policy);
  if (problem !== null) throw new InvalidPartitionPolicyError(policy.table, problem);
}
