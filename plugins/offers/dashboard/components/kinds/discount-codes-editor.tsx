import type { JSX } from 'react';
import { DEFAULT_DISCOUNT_CODES_CONFIG } from '../../model/default-configs';
import type { KindEditorProps } from '../kind-editor-slot';
import { ProductDiscountFields } from './product-discount-editor';

/**
 * Discount codes: a product discount a buyer gets by typing a code (D2403). The codes themselves are edited in the
 * codes card the editor shows for every offer activated by codes (D2540).
 */
export function DiscountCodesEditor(props: KindEditorProps): JSX.Element {
  return <ProductDiscountFields editor={props} defaults={DEFAULT_DISCOUNT_CODES_CONFIG} />;
}
