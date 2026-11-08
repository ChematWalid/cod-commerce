/** Types for `lint-limits.mjs`, so TypeScript tests can import the limits without `allowJs`. */
export const LINT_LIMITS: {
  readonly complexity: number;
  readonly maxLines: number;
  readonly maxLinesPerFunction: number;
  readonly maxDepth: number;
  readonly maxParams: number;
};
