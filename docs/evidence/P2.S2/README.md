# Evidence for P2.S2 (packs, import and export)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P2.S2.sh`. Data is synthetic
(the demo seed, plus what the script creates and imports). Image built from a tree with no uncommitted change outside the
evidence folders and browser tests, last image-relevant commit `4fcc90a0e12d1f31a4cba73b536d2688a4c0c438`. Compose project `cod-evidence`; the
roles sign upload and download links for Garage at `http://127.0.0.1:23900`, whose bucket CORS `scripts/garage-cors.mjs`
set for the dashboard's origin; link imports use the fixture scraper (`LINK_IMPORT_SCRAPER=fixture`, host
`shop.example.test` only, D2214).

## API transcripts

| File | Shows |
| --- | --- |
| [`api/packs.md`](api/packs.md) | `catalogPack`, `saveCatalogPack`, `previewCatalogPack` and `GET`/`PUT /catalog/packs/:productId`, `POST /catalog/packs/preview`: a 10 % off pack of two products (3 150 DZD), fixed price and weight; a pack of a physical product and a pack inside a pack refused |
| [`api/bulk-edit.md`](api/bulk-edit.md) | `bulkEditCatalogProducts` and `POST /catalog/products/bulk-edit`: a dry run that writes nothing, status, brand, tags and +10 % prices, a partial failure (one unknown product), B's brand refused (`taxonomy-not-found`) |
| [`api/export.md`](api/export.md) | `catalogImportFields`, `catalogImportFormats` and their REST routes, `exportCatalogProducts` of selected products (written at once, the CSV downloaded through its presigned link), a filtered export of 520+ products as a job read until done (`catalogExport`, `GET …/exports/:id`, the xlsx downloaded). Those products were imported through the same flow, quietly; it took 1 attempt(s) of the same file (a failed attempt is the worker's database pool running dry under the pack recompute deliveries, issue #260) |
| [`api/import.md`](api/import.md) | `createCatalogImportUpload` (presigned PUT, exact size and type signed), the PUT to Garage, `analyzeCatalogImport`, `previewCatalogImport` (with a mapping override), `catalogImportPreview`, `confirmCatalogImport`, `catalogImport` with its error report link, and every REST route of the import |
| [`api/import-refusals.md`](api/import-refusals.md) | A larger body than signed: 403 from Garage, nothing stored; a PNG sent as CSV (`file-type`); an object whose size differs from the declared one (`file-too-large`); 5001 rows (`too-many-rows`); a create-only member's update rows (`update-forbidden`); a second confirm (`job-state`); 429 with `Retry-After` past the import budget |
| [`api/link-import.md`](api/link-import.md) | `createCatalogLinkImport`, `catalogLinkImport`, `polishCatalogProduct` and `POST /catalog/scrape/import-job`, `GET /catalog/scrape/import-jobs/:id`, `POST /catalog/scrape/products/:id/polish`; loopback, private and unknown hosts refused alike (`link-refused`) |
| [`api/isolation.md`](api/isolation.md) | Business A on B's pack, import, export and link import ids: not found over GraphQL, 404 over REST, a bulk edit and an export naming B's products touch nothing of B; A's session on B's channel FORBIDDEN; no session refused |

Store, business, brand, tag and job ids and channel tokens are placeholders; every assertion ran on the real values.
Product and variant ids are the engine's small integers. In every upload and download link the signature, credential and
session token are `[REDACTED]` (the link's path and expiry stay); spreadsheet bodies are shown as `<xlsx, N bytes>`.

## Screenshots

`screens/<screen>-<lang>-<viewport>.png`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: `product-create-type` (the new product editor's Product type choice, Physical product
or Pack), `pack-form` (the pack block of a saved 10 % off pack of two products), `product-list-actions` (two products
ticked, the action menu open on Import, Export and Bulk edit), `bulk-edit` (the dialog with a status and a price change),
`bulk-edit-result` (the dry run's per-product result), `export-dialog` (selected products, CSV), `export-job` (a filtered
export of more than 500 products: the job's progress; the dashboard's reads of the job are held back for the shot so the
worker cannot finish first), `import-upload` (a CSV chosen), `import-analyze` (a PNG renamed `.csv`: the analysis
refuses it, toast), `import-mapping` (the analyzed columns, one ignored), `import-preview` (rows to create, to update and
in error with their reasons) and `import-confirm` (after Confirm: rows created, updated and failed, the error report).
48 files.

## Browser assertions in `scripts/evidence/P2.S2-screens.mjs`

Each line below is a failing assertion in the script if it does not hold.

- Every shot: dir matches the display language and there is no horizontal overflow.
- Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.
- The new product editor offers Physical product and Pack as its product type.
- The pack editor block of the saved pack shows two component rows and its price.
- With two products ticked the action menu offers Import, Export and an enabled Bulk edit.
- The bulk edit dry run answers a per-product result (phase "reviewed") and writes nothing.
- The export dialog offers its scope and format; a filtered export above 500 products shows its progress.
- The import wizard refuses a PNG named .csv with the file-type message after the upload.
- The wizard maps the columns (the unknown one shown), previews the pack row as unsupported, and after Confirm shows the result with an error report.

## What was seen (§3a.17)

Every PNG of the run was opened and read by eye (2026-11-21). For all 48: the only product names in the chrome are our own
("CodShop Assistant", "Credits" placeholders of the shell); the framework's name appears nowhere (the account menu, which
holds the licence notice, is closed in every shot); no raw message id shows; Arabic pages mirror (sidebar on the right,
titles, labels and table columns from the right, primary buttons at the inline end, the `%` and `د.ج` suffixes on the
inline end of their fields); no page scrolls sideways. The "Verify your email" card and the trial strip are the shell's,
expected for the seeded owner. Product titles are Arabic in both display languages (the demo store's language, D2112);
"Synthetic silk scarf" / "Synthetic summer kaftan" are the fixture scraper's synthetic page titles (D2214).

Compared with "Products" in `docs/research/dashboard-captures.md` and the Orders export and bulk dialogs: the list's action
menu holds Import products, Export and Bulk edit (n selected); export asks which products (selected, or all the list's
filters find) and the format (Excel or CSV); bulk edit asks status, price change, brand and tags, previews per product, then
applies; the import is a four-step wizard (Upload, Columns, Preview, Confirm).

| Screen | ar desktop / mobile, en desktop / mobile |
| --- | --- |
| `product-create-type` | New product: the Product type list open under "Details" with Physical product (ticked) and Pack. |
| `pack-form` | The saved pack "حزمة القميص والقبعة": price 3150 read-only in Pricing with the hint that a pack is priced from its components, weight 500 g read-only; the Pack card with Sum of the components, Percentage, 10 %, Chosen per component, Sum of the components; two component rows (shirt, cap) with quantity 1 and Remove; the product picker; "Current price: 3,150 DZD" (Arabic: "د.ج 3.150"); Preview price and Save pack. On a phone the cards stack. |
| `product-list-actions` | The list searched for EVBULK: three products, two ticked; the action menu open with Import products, Export, Bulk edit (2 selected). On a phone the table keeps Product and Status. |
| `bulk-edit` | "Bulk edit (2 products)": Status Draft, Price Change by a percentage, Value 10 %, Brand / Add tag / Remove tag Keep as is, Preview changes and Cancel. |
| `bulk-edit-result` | After the dry run: "Would change: 2. Refused: 0." and one line per product (price; the status was already Draft), Apply changes instead of Preview. |
| `export-dialog` | Export products: Selected products (2), CSV, Export and Close. |
| `export-job` | A filtered export of every product (above 500), caught while the job is queued: the choices disabled, an unlabelled grey progress bar under them (no percentage, status or row count on screen) and no download yet. |
| `import-upload` | Step 1 Upload: the hint (Excel or CSV, 10 MB, 5,000 rows, one row per variant), the chosen products.csv, Upload and analyze. |
| `import-analyze` | A PNG named photo.csv: after the upload the analysis refuses it, toast "Only Excel (.xlsx) and CSV files can be imported." (Arabic: "يمكن استيراد ملفات Excel (.xlsx) وCSV فقط."). |
| `import-mapping` | Step 2 Columns: each file column with its field select (Product key, Name, Type, Status, Price, Variant SKU), "Remarque libre" set to Ignore this column with "Unknown column, ignored."; Back and Preview the rows. |
| `import-preview` | Step 3 Preview: To create 1, To update 1, With errors 1, With warnings 0; rows 2 Create, 3 Update (EVUPD-1), 4 Error "Only physical products can be imported." |
| `import-confirm` | Step 4 after Confirm: "Import finished", Created 1, Updated 1, Failed 1, Download the error report. |

Seen and left as is (issue #261, severity low):

- The bulk dry-run result names products by id ("Product 16: price"), not by title.
- On desktop the Price select of the bulk dialog is about 14 px wider than its column.
- On a phone the import preview table scrolls inside its card: the name is cut and the refusal reason is off screen until
  the merchant scrolls sideways.
- The native file input shows the browser's own "Choose File" in English on the Arabic pages (the test browser runs in
  en-US; a browser in Arabic shows its own words).
- The export job's progress bar carries no label: nothing on screen says the job is queued or running, how far it is or
  how many rows it holds, so a merchant cannot tell a queued job from a stuck dialog.

The phone overflow of the import preview and the id-only bulk result lines are to be fixed before the phase-end PR
(D2281).
