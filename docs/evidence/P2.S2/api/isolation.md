# Business A against business B's packs, imports, exports and link imports

A foreign id answers exactly like an unknown one (D2136, D2278); another business's channel token is refused outright.

### catalogPack of B's pack, A's session on A's store: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($productId: ID!) { catalogPack(productId: $productId) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "544"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1e-1coeEoSEQajgFNanV2B5lx3rVNE"

{
  "data": {
    "catalogPack": null
  }
}
```

### GET /catalog/packs/<B's pack>: 404

```http
GET http://127.0.0.1:23100/catalog/packs/544
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"6b-RBU4yU8AWNHoRQbrqq+eKLZODfY"

{
  "statusCode": 404,
  "code": "packs.not-found",
  "message": "Pack product not found.",
  "path": "/catalog/packs/544"
}
```

### PUT /catalog/packs/<B's pack>: 404, B's pack unchanged

```http
PUT http://127.0.0.1:23100/catalog/packs/544
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "packPricingMode": "fixed",
  "packFixedPrice": 1,
  "packVariantMode": "per_component",
  "packWeightMode": "components_sum",
  "components": [
    {
      "productId": "12",
      "quantity": 1
    },
    {
      "productId": "11",
      "quantity": 1
    }
  ]
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"6b-RBU4yU8AWNHoRQbrqq+eKLZODfY"

{
  "statusCode": 404,
  "code": "packs.not-found",
  "message": "Pack product not found.",
  "path": "/catalog/packs/544"
}
```

### previewCatalogPack with B's product as a component: not found, no price

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogPackInput!) { previewCatalogPack(input: $input) { price weightGrams sharedValues { value price } } }",
  "variables": {
    "input": {
      "packPricingMode": "components_sum",
      "packVariantMode": "per_component",
      "packWeightMode": "components_sum",
      "components": [
        {
          "productId": "542",
          "quantity": 1
        },
        {
          "productId": "12",
          "quantity": 1
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"d8-MpIldaYvydnJy8QBTfDiUCqCJjg"

{
  "errors": [
    {
      "message": "A component product or variant was not found in this store.",
      "locations": [
        {
          "line": 1,
          "column": 40
        }
      ],
      "path": [
        "previewCatalogPack"
      ],
      "extensions": {
        "code": "packs.component-not-found"
      }
    }
  ],
  "data": null
}
```

### B's import id read by A: job-not-found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogImport(id: $id) { importId status format rowCount progress headerRow columns { column header field warning } summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl } }",
  "variables": {
    "id": "<IMPORT_OF_B>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"bf-TmhsnfFaVFDTeJYuZYX1JGsbDf0"

{
  "errors": [
    {
      "message": "This import or export was not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
        }
      ],
      "path": [
        "catalogImport"
      ],
      "extensions": {
        "code": "catalog-import.job-not-found"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/import-export/products/imports/<B's import>: 404

```http
GET http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_OF_B>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"ad-ljlEudJK4+hBgLvz5gMP8tWlsSk"

{
  "statusCode": 404,
  "code": "catalog-import.job-not-found",
  "message": "This import or export was not found.",
  "path": "/catalog/import-export/products/imports/<IMPORT_OF_B>"
}
```

### B's export id read by A: job-not-found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogExport(id: $id) { exportId status progress rowCount skippedPacks errorCode downloadUrl } }",
  "variables": {
    "id": "<EXPORT_OF_B>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"bf-/q1amDyzm7bCAkdryH2Od5ti+lM"

{
  "errors": [
    {
      "message": "This import or export was not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
        }
      ],
      "path": [
        "catalogExport"
      ],
      "extensions": {
        "code": "catalog-import.job-not-found"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/import-export/exports/<B's export>: 404

```http
GET http://127.0.0.1:23100/catalog/import-export/exports/<EXPORT_OF_B>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"a4-4uwYbdGwl3jJNMz6hpRAlCnihtM"

{
  "statusCode": 404,
  "code": "catalog-import.job-not-found",
  "message": "This import or export was not found.",
  "path": "/catalog/import-export/exports/<EXPORT_OF_B>"
}
```

### B's link id read by A: job-not-found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogLinkImport(id: $id) { importId status sourceUrl productId } }",
  "variables": {
    "id": "<LINK_OF_B>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"c3-yB3KsGRDuGl9uckxVKxLu4DXTpQ"

{
  "errors": [
    {
      "message": "This import or export was not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
        }
      ],
      "path": [
        "catalogLinkImport"
      ],
      "extensions": {
        "code": "catalog-import.job-not-found"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/scrape/import-jobs/<B's link>: 404

```http
GET http://127.0.0.1:23100/catalog/scrape/import-jobs/<LINK_OF_B>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"a1-7t3+WV7y7cqtYSli+tqMu7fgrv4"

{
  "statusCode": 404,
  "code": "catalog-import.job-not-found",
  "message": "This import or export was not found.",
  "path": "/catalog/scrape/import-jobs/<LINK_OF_B>"
}
```

### POST /catalog/import-export/products/imports/<B's import>/preview: 404

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_OF_B>/preview
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"b5-mXjXNuJ3Mm9VCPXatDxZrKHrGLs"

{
  "statusCode": 404,
  "code": "catalog-import.job-not-found",
  "message": "This import or export was not found.",
  "path": "/catalog/import-export/products/imports/<IMPORT_OF_B>/preview"
}
```

### POST /catalog/import-export/products/imports/<B's import>/confirm: 404

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_OF_B>/confirm
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"b5-Yy1ZovWAOaN5AcSRWPD3ZnTkNtQ"

{
  "statusCode": 404,
  "code": "catalog-import.job-not-found",
  "message": "This import or export was not found.",
  "path": "/catalog/import-export/products/imports/<IMPORT_OF_B>/confirm"
}
```

### B reads its import: still previewed, A's confirm did nothing

```http
GET http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_OF_B>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"1ab-oiYiL+nJxOZqh+/UkG4NpARJrj0"

{
  "importId": "<IMPORT_OF_B>",
  "status": "previewed",
  "format": "csv",
  "rowCount": 1,
  "progress": 0,
  "headerRow": 0,
  "columns": [
    {
      "field": "product_key",
      "column": 0,
      "header": "product_key",
      "warning": null
    },
    {
      "field": "name",
      "column": 1,
      "header": "name",
      "warning": null
    },
    {
      "field": "price",
      "column": 2,
      "header": "price",
      "warning": null
    }
  ],
  "summary": {
    "errors": 0,
    "creates": 1,
    "updates": 0,
    "warnings": 0
  },
  "result": null,
  "errorCode": null,
  "errorReportUrl": null
}
```

### POST /catalog/products/bulk-edit naming B's product: reported not found

```http
POST http://127.0.0.1:23100/catalog/products/bulk-edit
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "542"
  ],
  "changes": {
    "status": "draft"
  }
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"77-GZWyzWHv83PSlMJdgduro7m+uso"

{
  "results": [
    {
      "productId": "542",
      "productTitle": null,
      "ok": false,
      "changedFields": [],
      "error": "catalog.product-not-found"
    }
  ]
}
```

### POST /catalog/products/export of B's product id: an empty file

```http
POST http://127.0.0.1:23100/catalog/products/export
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "scope": "selected",
  "format": "csv",
  "productIds": [
    "542"
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2b5-e4kBRqPdtDARshr29fBz/4pFq3Q"

{
  "exportId": "<EXPORT_A_OF_B>",
  "status": "done",
  "progress": 100,
  "rowCount": 0,
  "skippedPacks": 0,
  "errorCode": null,
  "downloadUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_A_OF_B>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T120007Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_A_OF_B>.csv%22&response-content-type=text%2Fcsv&x-id=GetObject"
}
```

### POST /catalog/scrape/products/<B's product>/polish: 404

```http
POST http://127.0.0.1:23100/catalog/scrape/products/542/polish
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"81-qvdSS3rznyU5V5t2FohHO9wzORE"

{
  "statusCode": 404,
  "code": "catalog.product-not-found",
  "message": "Product not found.",
  "path": "/catalog/scrape/products/542/polish"
}
```

### B reads its product: still active

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "542"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"89-tAoh+cudFWSzhVFrGwmVRrnueCQ"

{
  "data": {
    "catalogProduct": {
      "id": "542",
      "title": "Produit B",
      "status": "active",
      "price": 1500,
      "brandId": null,
      "tagIds": [],
      "type": "physical"
    }
  }
}
```

### catalogPack, A's session with B's channel token: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($productId: ID!) { catalogPack(productId: $productId) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "13"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"cd-OlfYLynE3froOOERSdPFDqNO9RA"

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "catalogPack"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": {
    "catalogPack": null
  }
}
```

### GET /catalog/import-export/fields, A's session with B's channel token: 403

```http
GET http://127.0.0.1:23100/catalog/import-export/fields
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8
etag: W/"87-6rjDBKMWs93DqQCBBE4MV2xlUcM"

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-21T12:00:08.784Z",
  "path": "/catalog/import-export/fields"
}
```

### catalogImportFields without a session: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
vendure-token: [REDACTED]

{
  "query": "query { catalogImportFields { key required } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"c4-ovpWcAQfL4LfOAUmJDvRG4jgBB4"

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "catalogImportFields"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

