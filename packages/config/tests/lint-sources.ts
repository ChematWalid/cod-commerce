import { LINT_LIMITS } from '../eslint/lint-limits.mjs';

/** Source builders for the size rules; every size derives from `LINT_LIMITS`, so no limit is copied here. */

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

/** A function with `branches` `if` statements: cyclomatic complexity is `branches + 1`. */
export const withComplexity = (complexity: number): string => {
  const branches = range(complexity - 1).map(
    (index) => `  if (flag === '${String(index)}') return '${String(index)}';`,
  );
  return `export const pick = (flag: string): string => {\n${branches.join('\n')}\n  return flag;\n};\n`;
};

/** A function with `depth` nested `if` blocks. */
export const withDepth = (depth: number): string => {
  const open = range(depth).map(() => 'if (flag) {');
  const close = range(depth).map(() => '}');
  return `export const nest = (flag: boolean): number => {\n  let total = 0;\n  ${open.join('\n')}\n  total = total + total;\n  ${close.join('\n')}\n  return total;\n};\n`;
};

/** A function taking `count` parameters. */
export const withParams = (count: number): string => {
  const params = range(count).map((index) => `p${String(index)}: string`);
  return `export const join = (${params.join(', ')}): string => '';\n`;
};

export const OVER = {
  complexity: withComplexity(LINT_LIMITS.complexity + 1),
  depth: withDepth(LINT_LIMITS.maxDepth + 1),
  params: withParams(LINT_LIMITS.maxParams + 1),
};

export const AT_LIMIT = {
  complexity: withComplexity(LINT_LIMITS.complexity),
  depth: withDepth(LINT_LIMITS.maxDepth),
  params: withParams(LINT_LIMITS.maxParams),
};
