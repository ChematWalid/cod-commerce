/** A variant as the picker shows it: prices already formatted by the server, the image source built there too. */
export interface VariantChoice {
  readonly id: string;
  readonly optionCodes: readonly string[];
  /** The server's price, formatted in the store's language; the browser computes no price (ADR 0017). */
  readonly price: string;
  readonly oldPrice: string | null;
  /** An asset source (`assetSource`) or none: the variant then shows the product's own image. */
  readonly imageSrc: string | null;
  readonly soldOut: boolean;
}

/** An option group with the label the server wrote for it ("Choose colour"). */
export interface OptionGroupChoice {
  readonly code: string;
  readonly label: string;
  readonly options: readonly { readonly code: string; readonly name: string }[];
}

/** The option chosen in each group, by group code. */
export type Selection = Readonly<Record<string, string>>;

function sameOptions(variant: VariantChoice, codes: readonly string[]): boolean {
  return variant.optionCodes.length === codes.length && codes.every((code) => variant.optionCodes.includes(code));
}

/** The variant whose options are exactly the selected ones, if the product has one. */
export function variantOf(variants: readonly VariantChoice[], selection: Selection): VariantChoice | undefined {
  return variants.find((variant) => sameOptions(variant, Object.values(selection)));
}

/** The selection of one variant: in each group, the option of that variant. */
function selectionOfVariant(groups: readonly OptionGroupChoice[], variant: VariantChoice): Selection {
  const entries = groups.flatMap((group) => {
    const option = group.options.find((candidate) => variant.optionCodes.includes(candidate.code));
    return option === undefined ? [] : [[group.code, option.code] as const];
  });
  return Object.fromEntries(entries);
}

/** What the picker starts on: the first variant in stock, or the first variant when all are sold out. */
export function initialSelection(groups: readonly OptionGroupChoice[], variants: readonly VariantChoice[]): Selection {
  const start = variants.find((variant) => !variant.soldOut) ?? variants[0];
  return start === undefined ? {} : selectionOfVariant(groups, start);
}

/** `selection` with `optionCode` chosen in `groupCode`. */
export function withOption(selection: Selection, groupCode: string, optionCode: string): Selection {
  return { ...selection, [groupCode]: optionCode };
}
