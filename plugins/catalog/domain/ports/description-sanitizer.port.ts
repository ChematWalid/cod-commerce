/** Turns a merchant's rich-text description into the HTML the storefront may render (D2122). */
export interface DescriptionSanitizerPort {
  /** The description with every tag, attribute and link scheme outside the allow-list removed. */
  sanitize(html: string): string;
}
