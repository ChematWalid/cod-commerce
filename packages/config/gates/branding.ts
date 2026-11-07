/** A file to check: its repo-relative path and text content. */
export interface SourceFile {
  readonly path: string;
  readonly content: string;
}

/** The reference product's name (ADR 0007). Only this pattern and the `dirty` test fixture may contain it. */
const BRAND_NAME = /tassyir|tassya/i;

/**
 * Checks the ADR 0007 branding rule: product code uses neutral copy and never names the reference product.
 *
 * @param files the files to scan (apps, plugins and `packages/shared`)
 * @returns one message per offending file; empty when the code is clean
 */
export function findBrandingViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ content }) => BRAND_NAME.test(content))
    .map(({ path }) => `${path} names the reference product (ADR 0007: use neutral copy)`);
}
