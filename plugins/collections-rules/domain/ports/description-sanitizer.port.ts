/** Cleans a collection description written as HTML down to the markup a product description keeps (D2322, D2122). */
export interface DescriptionSanitizerPort {
  sanitize(html: string): string;
}
