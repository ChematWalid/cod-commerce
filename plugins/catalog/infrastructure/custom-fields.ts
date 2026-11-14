import {
  BARCODE_MAX,
  CARD_CAPTION_MAX,
  LABEL_MAX,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} from '@cod/shared';
import { type CustomFieldConfig, LanguageCode, type RuntimeVendureConfig } from '@vendure/core';
import {
  DEFAULT_PRODUCT_STATUS,
  DEFAULT_PRODUCT_TYPE,
  SHORT_KIND_MAX_LENGTH,
  SNOWFLAKE_TEXT_LENGTH,
} from '../domain/constants';

/** The smallest money amount, size or position: none is negative (ADR 0004, D2125). */
const NON_NEGATIVE = 0;

const label = (en: string, ar: string) => ({
  label: [
    { languageCode: LanguageCode.en, value: en },
    { languageCode: LanguageCode.ar, value: ar },
  ],
});

/** A whole number that may be absent: money in DZD, sizes in grams and centimetres (D2125). */
const optionalAmount = (name: string, en: string, ar: string, isPublic: boolean): CustomFieldConfig => ({
  name,
  type: 'int',
  nullable: true,
  min: NON_NEGATIVE,
  public: isPublic,
  ...label(en, ar),
});

/** A one-line text that may be absent, stored in the store's language (D2112). */
const optionalText = (name: string, length: number, en: string, ar: string): CustomFieldConfig => ({
  name,
  type: 'string',
  length,
  nullable: true,
  ...label(en, ar),
});

/** A merchant-only word from a fixed list, such as the product status. */
const kindField = (
  name: string,
  defaultValue: string,
  values: readonly string[],
  labels: ReturnType<typeof label>,
): CustomFieldConfig => ({
  name,
  type: 'string',
  length: SHORT_KIND_MAX_LENGTH,
  nullable: false,
  defaultValue,
  options: values.map((value) => ({ value })),
  public: false,
  ...labels,
});

/** The order of an option or of its values, which Vendure cannot keep on a many-to-many (D2124). */
const position = (): CustomFieldConfig => ({
  name: 'position',
  type: 'int',
  nullable: false,
  defaultValue: NON_NEGATIVE,
  min: NON_NEGATIVE,
  ...label('Position', 'الترتيب'),
});

/** Merchant-only product fields stay out of the Shop API: the storefront reads through the catalog (D2109). */
function productFields(): CustomFieldConfig[] {
  return [
    kindField('status', DEFAULT_PRODUCT_STATUS, PRODUCT_STATUSES, label('Status', 'الحالة')),
    kindField('type', DEFAULT_PRODUCT_TYPE, PRODUCT_TYPES, label('Type', 'النوع')),
    optionalAmount('oldPrice', 'Old price', 'السعر القديم', true),
    // A snowflake of `catalog_brand` as text: no custom field type holds a bigint (D2100, D2140).
    {
      name: 'brandId',
      type: 'string',
      length: SNOWFLAKE_TEXT_LENGTH,
      nullable: true,
      index: true,
      public: false,
      ...label('Brand', 'العلامة التجارية'),
    },
    optionalAmount('weight', 'Weight (g)', 'الوزن (غ)', false),
    optionalAmount('width', 'Width (cm)', 'العرض (سم)', false),
    optionalAmount('height', 'Height (cm)', 'الارتفاع (سم)', false),
    optionalAmount('length', 'Length (cm)', 'الطول (سم)', false),
    optionalText('label', LABEL_MAX, 'Label', 'الشارة'),
    optionalText('cardCaption', CARD_CAPTION_MAX, 'Card caption', 'نص البطاقة'),
    optionalText('metaTitle', META_TITLE_MAX, 'SEO title', 'عنوان محركات البحث'),
    optionalText('metaDescription', META_DESCRIPTION_MAX, 'SEO description', 'وصف محركات البحث'),
  ];
}

function variantFields(): CustomFieldConfig[] {
  return [
    optionalAmount('oldPrice', 'Old price', 'السعر القديم', true),
    {
      name: 'isHidden',
      type: 'boolean',
      nullable: false,
      defaultValue: false,
      public: false,
      ...label('Hidden', 'مخفي'),
    },
    // Indexed: the admin search finds products by a variant's barcode (D2123).
    { ...optionalText('barcode', BARCODE_MAX, 'Barcode', 'الباركود'), index: true, public: false },
  ];
}

/**
 * Adds the catalog's fields to Vendure's product, variant and option entities (D2100). The config is shared by every
 * role, so the columns come from one committed migration (D2139). Our endpoints call services directly, which skip
 * custom-field validation: the domain checks every value first.
 */
export function configureCatalogCustomFields(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.customFields.Product.push(...productFields());
  config.customFields.ProductVariant.push(...variantFields());
  config.customFields.ProductOptionGroup.push(position());
  config.customFields.ProductOption.push(position());
  return config;
}
