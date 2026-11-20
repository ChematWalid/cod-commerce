# @cod/plugin-catalog-import

Bulk edit, export and import of a store's products, link import and the AI hooks (P2.S2, D2200, D2207-D2215).
Products are written only through catalog's explicit-scope facade `CatalogProductCommands` (D2201).

| Layer | What lives there |
|---|---|
| `domain/` | object keys (`uploads/`, `exports/` + `tenantObjectKey`), `sniffSpreadsheet`, `inspectZip` (D2222), job kinds, export rows and the formula guard (D2209, D2256) |
| `application/` | ports (`ObjectStorage`, `CatalogProductsPort`, `CatalogExportReadsPort`, job repository and scan), `SpreadsheetFormatRegistry`, bulk edit, export (now ≤ 500, job above, D2211, D2257) |
| `infrastructure/` | `S3ObjectStorage` / `MemoryObjectStorage`, the four tables, the xlsx (exceljs) and CSV (csv-stringify, BOM) writers, the `imports-exports` queue: kind registry, `JobStoreContext`, reconcile source, the `product-export` handler |
| `api/` | Tasks 7-10: bulk edit, export, import, link import |

- Object storage (D2208): the private bucket `S3_BUCKET_PRIVATE` on Garage only, keys server-made. Presigned URLs are
  signed on `S3_PUBLIC_ENDPOINT` (blank = `S3_ENDPOINT`); a presigned PUT signs the exact type and size. The dev
  stack needs bucket CORS once: `node scripts/garage-cors.mjs` (also run by `scripts/check-data-services.sh`).
- Queue (D2212): catalog-import alone defines `imports-exports`; other plugins add kinds through
  `IMPORTS_EXPORTS_JOB_REGISTRAR`. One job per business at a time; the worker takes the scope and actor from the job
  row, fails it when the payload disagrees, and the reconciler re-enqueues lost jobs and fails stalled ones.
- Options: `CatalogImportPlugin.init({ objectStorage, linkScraper, appEnv })`; production refuses the memory storage
  and the fixture scraper. The test configs re-call `init` with `{ kind: 'memory' }` and `'fixture'`.

Tests: `pnpm --filter @cod/plugin-catalog-import test` (unit) and `test:integration` (CI part `catalog-import`,
worker id 1017, kit on `@cod/testing`'s `StoreKit`, D2216).
