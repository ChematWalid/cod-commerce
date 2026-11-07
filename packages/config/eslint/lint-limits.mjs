// @ts-check

/**
 * Size and complexity limits of CLAUDE.md §3a.3, shared by ESLint and any tool that reports on them.
 */
export const LINT_LIMITS = /** @type {const} */ ({
  complexity: 10,
  maxLines: 300,
  maxLinesPerFunction: 40,
  maxDepth: 3,
  maxParams: 4,
});
