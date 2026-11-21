/** A JSON-LD node as parsed: an object of unknown fields. */
export type LdNode = Readonly<Record<string, unknown>>;

const PRODUCT_TYPE = 'Product';
/** Deepest nesting looked into for the product node (`@graph`, lists, `mainEntity`). */
const MAX_DEPTH = 4;

const isNode = (value: unknown): value is LdNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isProduct(node: LdNode): boolean {
  const type = node['@type'];
  return type === PRODUCT_TYPE || (Array.isArray(type) && type.includes(PRODUCT_TYPE));
}

/** The children a product may sit in: list items, the `@graph` and `mainEntity`. */
function childrenOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isNode(value)) return [];
  return [value['@graph'], value['mainEntity']].filter((child) => child !== undefined);
}

function findProduct(value: unknown, depth: number): LdNode | undefined {
  if (isNode(value) && isProduct(value)) return value;
  if (depth >= MAX_DEPTH) return undefined;
  for (const child of childrenOf(value)) {
    const found = findProduct(child, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** A JSON-LD block's value; a malformed block is the page's own fault and reads as nothing (D2214). */
function parsedBlock(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Expected input from any shop's page, not a fault of ours: the block is skipped, the other blocks still count.
    return undefined;
  }
}

/** The first `schema.org/Product` node of a page's JSON-LD blocks, or undefined. */
export function productNodeOf(blocks: readonly string[]): LdNode | undefined {
  for (const block of blocks) {
    const product = findProduct(parsedBlock(block), 0);
    if (product !== undefined) return product;
  }
  return undefined;
}
