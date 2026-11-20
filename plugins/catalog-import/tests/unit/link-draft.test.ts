import { DESCRIPTION_MAX, PRODUCT_TITLE_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { HtmlProduct } from '../../domain/html-product';
import { linkDraftOf } from '../../domain/link-draft';

const LINK = 'https://shop.example.test/products/scarf';

const pageOf = (fields: Partial<HtmlProduct>): HtmlProduct => ({ imageUrls: [], ...fields });

describe('linkDraftOf (D2272)', () => {
  it("titles the Draft with the link's host when the page has no title", () => {
    // Act
    const draft = linkDraftOf(pageOf({ price: 900 }), LINK);

    // Assert
    expect(draft.create.product.title).toBe('shop.example.test');
  });

  it('cuts a long title at the product title maximum', () => {
    // Act
    const draft = linkDraftOf(pageOf({ title: 'x'.repeat(PRODUCT_TITLE_MAX + 40) }), LINK);

    // Assert
    expect(draft.create.product.title).toHaveLength(PRODUCT_TITLE_MAX);
  });

  it('prices a Draft 0 when the page states no price, as an always-draft product with no variants', () => {
    // Act
    const draft = linkDraftOf(
      pageOf({ title: 'Synthetic scarf', imageUrls: ['https://img.example.test/a.jpg'] }),
      LINK,
    );

    // Assert
    expect(draft.create).toEqual({
      product: { title: 'Synthetic scarf', status: 'draft', price: 0, tagIds: [], optionGroups: [] },
      variants: [],
    });
    expect(draft.imageUrls).toEqual(['https://img.example.test/a.jpg']);
  });

  it('cuts the description before an entity the maximum would split', () => {
    // Arrange: `&amp;` straddles the maximum
    const description = `${'a'.repeat(DESCRIPTION_MAX - 3)}&amp; more`;

    // Act
    const draft = linkDraftOf(pageOf({ title: 'T', description }), LINK);

    // Assert
    expect(draft.create.product.description).toBe('a'.repeat(DESCRIPTION_MAX - 3));
  });

  it('keeps a whole entity that ends within the maximum', () => {
    // Arrange
    const description = `${'a'.repeat(DESCRIPTION_MAX - 5)}&amp;tail`;

    // Act
    const draft = linkDraftOf(pageOf({ title: 'T', description }), LINK);

    // Assert
    expect(draft.create.product.description).toBe(`${'a'.repeat(DESCRIPTION_MAX - 5)}&amp;`);
  });

  it('omits a description the cut leaves empty', () => {
    // Arrange: an entity that opens the text and runs past the maximum
    const description = `&${'b'.repeat(DESCRIPTION_MAX)};`;

    // Act
    const draft = linkDraftOf(pageOf({ title: 'T', description }), LINK);

    // Assert
    expect(draft.create.product).not.toHaveProperty('description');
  });
});
