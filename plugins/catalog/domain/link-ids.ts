/**
 * The ids of a product's tag or highlight links with repeats dropped, each kept at its first place: a link exists once
 * per product (unique index), and the first mention sets the display order.
 */
export function distinctLinkIds<T extends string>(ids: readonly T[]): readonly T[] {
  return [...new Set(ids)];
}
