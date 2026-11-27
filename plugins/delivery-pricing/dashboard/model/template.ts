/** The part of a list row the template search reads. */
export interface TemplateCandidate {
  readonly id: string;
  readonly isPlatformDefault: boolean;
}

/** One page of the list as the template search reads it. */
export interface TemplatePage {
  readonly items: readonly TemplateCandidate[];
  readonly totalItems: number;
}

/**
 * The id of the store's "Platform default prices" table, which a new pricing option starts from (D3138): the list
 * pages are read in turn until one holds it. Null when none does; reading stops on an empty page or past the total.
 */
export async function findPlatformDefaultId(
  fetchPage: (skip: number, take: number) => Promise<TemplatePage>,
  take: number,
): Promise<string | null> {
  for (let skip = 0; ; skip += take) {
    const page = await fetchPage(skip, take);
    const found = page.items.find((item) => item.isPlatformDefault);
    if (found !== undefined) return found.id;
    if (page.items.length === 0 || skip + take >= page.totalItems) return null;
  }
}
