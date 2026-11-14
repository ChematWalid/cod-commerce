/** Header names of one column in each dashboard language; matched after {@link normalizeImportHeader}. */
export type ImportFieldAliases = {
  readonly ar: readonly string[];
  readonly en: readonly string[];
  readonly fr: readonly string[];
};

/** One column of the product spreadsheet (D2209): its stable key, its header aliases and whether a file needs it. */
export type ImportField = {
  readonly key: string;
  readonly aliases: ImportFieldAliases;
  readonly required: boolean;
};

function field<Key extends string>(key: Key, aliases: ImportFieldAliases, required = false) {
  return { key, aliases, required } as const;
}

const FIRST_OPTION = 1;
const SECOND_OPTION = 2;
const THIRD_OPTION = 3;

/** Header aliases of the name column of option `n` (1 to `MAX_OPTION_GROUPS`). */
const optionName = (n: number): ImportFieldAliases => ({
  ar: [`اسم الخيار ${String(n)}`],
  en: [`option ${String(n)} name`],
  fr: [`nom option ${String(n)}`, `nom de l'option ${String(n)}`],
});

/** Header aliases of the value column of option `n`. */
const optionValue = (n: number): ImportFieldAliases => ({
  ar: [`قيمة الخيار ${String(n)}`],
  en: [`option ${String(n)} value`],
  fr: [`valeur option ${String(n)}`, `valeur de l'option ${String(n)}`],
});

/**
 * The columns of the product spreadsheet, in export order (D2209): one row per variant. The keys are the export
 * header and never change; a new format version adds keys. Every key also matches itself on import.
 */
export const IMPORT_FIELDS = [
  field('product_key', {
    ar: ['مفتاح المنتج', 'رمز المنتج'],
    en: ['product key', 'product sku', 'product id'],
    fr: ['clé produit', 'sku produit', 'référence produit'],
  }),
  field(
    'name',
    { ar: ['الاسم', 'اسم المنتج'], en: ['name', 'title', 'product name'], fr: ['nom', 'titre', 'nom du produit'] },
    true,
  ),
  field('description', { ar: ['الوصف'], en: ['description'], fr: ['description'] }),
  field('status', { ar: ['الحالة'], en: ['status'], fr: ['statut'] }),
  field('type', { ar: ['النوع', 'نوع المنتج'], en: ['type', 'product type'], fr: ['type', 'type de produit'] }),
  field('price', { ar: ['السعر', 'سعر البيع'], en: ['price', 'sale price'], fr: ['prix', 'prix de vente'] }, true),
  field('old_price', {
    ar: ['السعر القديم', 'السعر قبل التخفيض'],
    en: ['old price', 'compare at price', 'compare price'],
    fr: ['ancien prix', 'prix barré'],
  }),
  field('weight', { ar: ['الوزن', 'الوزن (غ)'], en: ['weight', 'weight (g)'], fr: ['poids', 'poids (g)'] }),
  field('brand', { ar: ['العلامة التجارية', 'الماركة'], en: ['brand'], fr: ['marque'] }),
  field('tags', { ar: ['الوسوم'], en: ['tags', 'tag'], fr: ['étiquettes', 'tags'] }),
  field('collections', { ar: ['المجموعات'], en: ['collections', 'collection'], fr: ['collections'] }),
  field('option1_name', optionName(FIRST_OPTION)),
  field('option1_value', optionValue(FIRST_OPTION)),
  field('option2_name', optionName(SECOND_OPTION)),
  field('option2_value', optionValue(SECOND_OPTION)),
  field('option3_name', optionName(THIRD_OPTION)),
  field('option3_value', optionValue(THIRD_OPTION)),
  field('variant_sku', {
    ar: ['رمز المتغير', 'رمز SKU'],
    en: ['sku', 'variant sku'],
    fr: ['sku variante', 'référence'],
  }),
  field('barcode', {
    ar: ['الباركود', 'الرمز الشريطي'],
    en: ['barcode', 'ean', 'gtin'],
    fr: ['code-barres', 'code barre'],
  }),
  field('image_urls', {
    ar: ['الصور', 'روابط الصور'],
    en: ['image urls', 'images', 'image url'],
    fr: ['images', 'urls images', 'liens images'],
  }),
] as const satisfies readonly ImportField[];

/** One of the column keys of {@link IMPORT_FIELDS}. */
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key'];

/** The column keys, in export order. */
export const IMPORT_FIELD_KEYS: readonly ImportFieldKey[] = IMPORT_FIELDS.map(({ key }) => key);
/** The header row an export writes: the field keys, in order, so the file re-imports (AC3). */
export const EXPORT_HEADER: readonly ImportFieldKey[] = IMPORT_FIELD_KEYS;
/** The column keys as an enum-like object, for schemas. */
export const IMPORT_FIELD_KEY_ENUM = Object.fromEntries(IMPORT_FIELD_KEYS.map((key) => [key, key])) as {
  readonly [Key in ImportFieldKey]: Key;
};

const COMBINING_MARKS = /\p{M}/gu;
const TATWEEL_AND_BOM = /[\u0640\uFEFF]/g;
const SEPARATORS = /[\s_\-.:]+/g;

/**
 * How a header cell is compared with the aliases: compatibility form without marks (accents, Arabic short vowels,
 * hamza seats), tatweel or BOM, lower case, with runs of spaces, `_`, `-`, `.` and `:` as one space. "Prix_de-Vente"
 * and "prix de vente" are one header, as are "Clé" and "cle".
 */
export function normalizeImportHeader(header: string): string {
  return header
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(TATWEEL_AND_BOM, '')
    .toLowerCase()
    .replace(SEPARATORS, ' ')
    .trim();
}
