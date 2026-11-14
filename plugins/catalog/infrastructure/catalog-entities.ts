import { BrandEntity } from './brand.entity';
import { HighlightEntity } from './highlight.entity';
import { MediaEntity } from './media.entity';
import { ProductHighlightEntity } from './product-highlight.entity';
import { ProductSettingsEntity } from './product-settings.entity';
import { ProductTagEntity } from './product-tag.entity';
import { TagEntity } from './tag.entity';

/** The catalog's own tables (D2100), every one a `TenantEntity` reached only through `TenantRepository`. */
export const CATALOG_ENTITIES = [
  BrandEntity,
  TagEntity,
  ProductTagEntity,
  HighlightEntity,
  ProductHighlightEntity,
  ProductSettingsEntity,
  MediaEntity,
];
