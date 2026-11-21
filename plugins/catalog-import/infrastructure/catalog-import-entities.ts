import { ExportJobEntity } from './export-job.entity';
import { ImportJobEntity } from './import-job.entity';
import { ImportRowEntity } from './import-row.entity';
import { ProductOriginEntity } from './product-origin.entity';

/** Every table of catalog-import (migration `1795210000000-catalog-import.ts`). */
export const CATALOG_IMPORT_ENTITIES = [ImportJobEntity, ImportRowEntity, ExportJobEntity, ProductOriginEntity];
