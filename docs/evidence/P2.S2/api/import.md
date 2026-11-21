# Spreadsheet import

Upload → analyze → preview → confirm (D2210). The upload is a presigned PUT straight to the private bucket, its exact size and content type signed (D2208); the analysis reads the object's HEAD first. The preview plans each row (create, update or error, with message ids only); confirm writes exactly the planned rows in a job and keeps a CSV report of the failed ones. Every step needs `catalog.products.create`; an update row also `catalog.products.edit`.

### createCatalogImportUpload: a 6-line CSV; the answer is a presigned PUT under uploads/b/<business>/s/<store>/

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogImportUploadInput!) { createCatalogImportUpload(input: $input) { importId uploadUrl method headers { name value } expiresAt } }",
  "variables": {
    "input": {
      "format": "csv",
      "size": 528,
      "contentType": "text/csv"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"2c5-KkvAnPZM1+9AX9YOjWql9IDOyPo"

{
  "data": {
    "createCatalogImportUpload": {
      "importId": "<IMPORT_SHOWCASE>",
      "uploadUrl": "http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SHOWCASE>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235410Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject",
      "method": "PUT",
      "headers": [
        {
          "name": "content-type",
          "value": "text/csv"
        },
        {
          "name": "content-length",
          "value": "528"
        }
      ],
      "expiresAt": "2026-11-21T00:04:10.182Z"
    }
  }
}
```

### PUT the file to the upload link (Garage): stored

```http
PUT http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SHOWCASE>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235410Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject
Content-Type: text/csv
Content-Length: 528

showcase.csv (528 bytes: a header and five rows)

HTTP/1.1 200 OK
etag: "f61b62964d3a03939bc2454218c7c57f"
```

### analyzeCatalogImport: header row, five rows, columns mapped by name (the unknown one ignored)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { importId status format rowCount progress headerRow columns { column header field warning } summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl } }",
  "variables": {
    "input": {
      "importId": "<IMPORT_SHOWCASE>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"3cb-oinxAugib8S5BejgVaYVUtrWbpU"

{
  "data": {
    "analyzeCatalogImport": {
      "importId": "<IMPORT_SHOWCASE>",
      "status": "analyzed",
      "format": "csv",
      "rowCount": 5,
      "progress": 0,
      "headerRow": 0,
      "columns": [
        {
          "column": 0,
          "header": "product_key",
          "field": "product_key",
          "warning": null
        },
        {
          "column": 1,
          "header": "name",
          "field": "name",
          "warning": null
        },
        {
          "column": 2,
          "header": "type",
          "field": "type",
          "warning": null
        },
        {
          "column": 3,
          "header": "status",
          "field": "status",
          "warning": null
        },
        {
          "column": 4,
          "header": "price",
          "field": "price",
          "warning": null
        },
        {
          "column": 5,
          "header": "old_price",
          "field": "old_price",
          "warning": null
        },
        {
          "column": 6,
          "header": "brand",
          "field": "brand",
          "warning": null
        },
        {
          "column": 7,
          "header": "tags",
          "field": "tags",
          "warning": null
        },
        {
          "column": 8,
          "header": "variant_sku",
          "field": "variant_sku",
          "warning": null
        },
        {
          "column": 9,
          "header": "image_urls",
          "field": "image_urls",
          "warning": null
        },
        {
          "column": 10,
          "header": "Remarque libre",
          "field": null,
          "warning": "catalog-import.warn-unknown-column"
        }
      ],
      "summary": null,
      "result": null,
      "errorCode": null,
      "errorReportUrl": null
    }
  }
}
```

### previewCatalogImport, the free-text column mapped to description: one create, one update, three errors

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: CatalogImportPreviewInput) { previewCatalogImport(id: $id, input: $input) { importId totalItems skip take items { rowNumber action productKey name messages } summary { creates updates errors warnings } } }",
  "variables": {
    "id": "<IMPORT_SHOWCASE>",
    "input": {
      "mapping": [
        {
          "column": 10,
          "field": "description"
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"321-5wdBUK3+P9kg9F/ets5veNUMfR4"

{
  "data": {
    "previewCatalogImport": {
      "importId": "<IMPORT_SHOWCASE>",
      "totalItems": 5,
      "skip": 0,
      "take": 200,
      "items": [
        {
          "rowNumber": 2,
          "action": "create",
          "productKey": "EVIMP-1",
          "name": "قميص مستورد",
          "messages": []
        },
        {
          "rowNumber": 3,
          "action": "update",
          "productKey": "EVUPD-1",
          "name": "منتج للتحديث",
          "messages": []
        },
        {
          "rowNumber": 4,
          "action": "error",
          "productKey": "EVIMP-2",
          "name": "سعر غير صالح",
          "messages": [
            "catalog-import.row-invalid-value"
          ]
        },
        {
          "rowNumber": 5,
          "action": "error",
          "productKey": "EVIMP-3",
          "name": "حزمة مستوردة",
          "messages": [
            "catalog-import.row-type-unsupported"
          ]
        },
        {
          "rowNumber": 6,
          "action": "error",
          "productKey": "id:999999",
          "name": "منتج غير موجود",
          "messages": [
            "catalog-import.row-product-not-found"
          ]
        }
      ],
      "summary": {
        "creates": 1,
        "updates": 1,
        "errors": 3,
        "warnings": 0
      }
    }
  }
}
```

### catalogImportPreview: a page of the stored preview

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!, $skip: Int, $take: Int) { catalogImportPreview(id: $id, skip: $skip, take: $take) { importId totalItems skip take items { rowNumber action productKey name messages } summary { creates updates errors warnings } } }",
  "variables": {
    "id": "<IMPORT_SHOWCASE>",
    "skip": 2,
    "take": 2
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1bf-luVpJ4+GGjfRt8YpXlbenC/s0Qk"

{
  "data": {
    "catalogImportPreview": {
      "importId": "<IMPORT_SHOWCASE>",
      "totalItems": 5,
      "skip": 2,
      "take": 2,
      "items": [
        {
          "rowNumber": 4,
          "action": "error",
          "productKey": "EVIMP-2",
          "name": "سعر غير صالح",
          "messages": [
            "catalog-import.row-invalid-value"
          ]
        },
        {
          "rowNumber": 5,
          "action": "error",
          "productKey": "EVIMP-3",
          "name": "حزمة مستوردة",
          "messages": [
            "catalog-import.row-type-unsupported"
          ]
        }
      ],
      "summary": {
        "creates": 1,
        "updates": 1,
        "errors": 3,
        "warnings": 0
      }
    }
  }
}
```

### GET /catalog/import-export/products/imports/:id/preview

```http
GET http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_SHOWCASE>/preview?skip=0&take=5
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2fc-/f+pkVzwgrmYp3gjAXqfBzyFvyU"

{
  "importId": "<IMPORT_SHOWCASE>",
  "totalItems": 5,
  "skip": 0,
  "take": 5,
  "items": [
    {
      "rowNumber": 2,
      "action": "create",
      "productKey": "EVIMP-1",
      "name": "قميص مستورد",
      "messages": []
    },
    {
      "rowNumber": 3,
      "action": "update",
      "productKey": "EVUPD-1",
      "name": "منتج للتحديث",
      "messages": []
    },
    {
      "rowNumber": 4,
      "action": "error",
      "productKey": "EVIMP-2",
      "name": "سعر غير صالح",
      "messages": [
        "catalog-import.row-invalid-value"
      ]
    },
    {
      "rowNumber": 5,
      "action": "error",
      "productKey": "EVIMP-3",
      "name": "حزمة مستوردة",
      "messages": [
        "catalog-import.row-type-unsupported"
      ]
    },
    {
      "rowNumber": 6,
      "action": "error",
      "productKey": "id:999999",
      "name": "منتج غير موجود",
      "messages": [
        "catalog-import.row-product-not-found"
      ]
    }
  ],
  "summary": {
    "errors": 3,
    "creates": 1,
    "updates": 1,
    "warnings": 0
  }
}
```

### confirmCatalogImport: the job is queued

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { confirmCatalogImport(id: $id) { importId status format rowCount progress headerRow columns { column header field warning } summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl } }",
  "variables": {
    "id": "<IMPORT_SHOWCASE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"3e3-4zfifhjDl01vWw/vnNn2BNVI85g"

{
  "data": {
    "confirmCatalogImport": {
      "importId": "<IMPORT_SHOWCASE>",
      "status": "confirming",
      "format": "csv",
      "rowCount": 5,
      "progress": 0,
      "headerRow": 0,
      "columns": [
        {
          "column": 0,
          "header": "product_key",
          "field": "product_key",
          "warning": null
        },
        {
          "column": 1,
          "header": "name",
          "field": "name",
          "warning": null
        },
        {
          "column": 2,
          "header": "type",
          "field": "type",
          "warning": null
        },
        {
          "column": 3,
          "header": "status",
          "field": "status",
          "warning": null
        },
        {
          "column": 4,
          "header": "price",
          "field": "price",
          "warning": null
        },
        {
          "column": 5,
          "header": "old_price",
          "field": "old_price",
          "warning": null
        },
        {
          "column": 6,
          "header": "brand",
          "field": "brand",
          "warning": null
        },
        {
          "column": 7,
          "header": "tags",
          "field": "tags",
          "warning": null
        },
        {
          "column": 8,
          "header": "variant_sku",
          "field": "variant_sku",
          "warning": null
        },
        {
          "column": 9,
          "header": "image_urls",
          "field": "image_urls",
          "warning": null
        },
        {
          "column": 10,
          "header": "Remarque libre",
          "field": "description",
          "warning": null
        }
      ],
      "summary": {
        "creates": 1,
        "updates": 1,
        "errors": 3,
        "warnings": 0
      },
      "result": null,
      "errorCode": null,
      "errorReportUrl": null
    }
  }
}
```

### catalogImport: done, one created, one updated, three failed, with the error report link

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogImport(id: $id) { importId status format rowCount progress headerRow columns { column header field warning } summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl } }",
  "variables": {
    "id": "<IMPORT_SHOWCASE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"632-n1YujUsFY32TKaqvs8Nfb/ZU7kM"

{
  "data": {
    "catalogImport": {
      "importId": "<IMPORT_SHOWCASE>",
      "status": "done",
      "format": "csv",
      "rowCount": 5,
      "progress": 100,
      "headerRow": 0,
      "columns": [
        {
          "column": 0,
          "header": "product_key",
          "field": "product_key",
          "warning": null
        },
        {
          "column": 1,
          "header": "name",
          "field": "name",
          "warning": null
        },
        {
          "column": 2,
          "header": "type",
          "field": "type",
          "warning": null
        },
        {
          "column": 3,
          "header": "status",
          "field": "status",
          "warning": null
        },
        {
          "column": 4,
          "header": "price",
          "field": "price",
          "warning": null
        },
        {
          "column": 5,
          "header": "old_price",
          "field": "old_price",
          "warning": null
        },
        {
          "column": 6,
          "header": "brand",
          "field": "brand",
          "warning": null
        },
        {
          "column": 7,
          "header": "tags",
          "field": "tags",
          "warning": null
        },
        {
          "column": 8,
          "header": "variant_sku",
          "field": "variant_sku",
          "warning": null
        },
        {
          "column": 9,
          "header": "image_urls",
          "field": "image_urls",
          "warning": null
        },
        {
          "column": 10,
          "header": "Remarque libre",
          "field": "description",
          "warning": null
        }
      ],
      "summary": {
        "creates": 1,
        "updates": 1,
        "errors": 3,
        "warnings": 0
      },
      "result": {
        "created": 1,
        "updated": 1,
        "failed": 3
      },
      "errorCode": null,
      "errorReportUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SHOWCASE>/errors?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235412Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22import-errors-<IMPORT_SHOWCASE>.csv%22&response-content-type=text%2Fcsv&x-id=GetObject"
    }
  }
}
```

### GET the error report link: the failed rows and their reasons (CSV)

```http
GET http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SHOWCASE>/errors?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235412Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22import-errors-<IMPORT_SHOWCASE>.csv%22&response-content-type=text%2Fcsv&x-id=GetObject

HTTP/1.1 200 OK
etag: "d18256e0635428e44db27c3c79c2d76e"
content-type: text/csv
content-disposition: attachment; filename="import-errors-<IMPORT_SHOWCASE>.csv"

row,reasons,product_key,name,variant_sku
4,catalog-import.row-invalid-value,EVIMP-2,سعر غير صالح,EVIMP-2
5,catalog-import.row-type-unsupported,EVIMP-3,حزمة مستوردة,EVIMP-3
6,catalog-import.row-product-not-found,id:999999,منتج غير موجود,
```

### catalogProduct of EVUPD-1: the update row's price written

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "537"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"97-MQ2y4vOIo3DjARoQPS4cbbYDdIo"

{
  "data": {
    "catalogProduct": {
      "id": "537",
      "title": "منتج للتحديث",
      "status": "active",
      "price": 1200,
      "brandId": null,
      "tagIds": [],
      "type": "physical"
    }
  }
}
```

### catalogProducts for EVIMP-1: created with its brand and tag matched by name

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { items { id title price brandId tagIds } } }",
  "variables": {
    "options": {
      "q": "EVIMP-1"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"a2-GJV1wLY/zumt0qpe8jpRTvhJKoo"

{
  "data": {
    "catalogProducts": {
      "items": [
        {
          "id": "538",
          "title": "قميص مستورد",
          "price": 2200,
          "brandId": "<BRAND_DEMO>",
          "tagIds": [
            "<TAG_DEMO>"
          ]
        }
      ]
    }
  }
}
```

### POST /catalog/import-export/uploads

```http
POST http://127.0.0.1:23100/catalog/import-export/uploads
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "format": "csv",
  "size": 94,
  "contentType": "text/csv"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"27a-D+G+PhVFxkohVpUQeHSeUd9QPrY"

{
  "importId": "<IMPORT_REST>",
  "uploadUrl": "http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_REST>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235413Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject",
  "method": "PUT",
  "headers": {
    "content-type": "text/csv",
    "content-length": "94"
  },
  "expiresAt": "2026-11-21T00:04:13.921Z"
}
```

### PUT the file to the upload link

```http
PUT http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_REST>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261120T235413Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject
Content-Type: text/csv
Content-Length: 94

rest.csv (94 bytes)

HTTP/1.1 200 OK
etag: "09741a2e63fbc7ea3cacd3a66a01fefc"
```

### POST /catalog/import-export/products/analyze

```http
POST http://127.0.0.1:23100/catalog/import-export/products/analyze
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "importId": "<IMPORT_REST>"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"205-R22+mIghw8/lBR0xaLcEfGjO4+Q"

{
  "importId": "<IMPORT_REST>",
  "status": "analyzed",
  "format": "csv",
  "rowCount": 1,
  "progress": 0,
  "headerRow": 0,
  "columns": [
    {
      "column": 0,
      "header": "product_key",
      "field": "product_key",
      "warning": null
    },
    {
      "column": 1,
      "header": "name",
      "field": "name",
      "warning": null
    },
    {
      "column": 2,
      "header": "status",
      "field": "status",
      "warning": null
    },
    {
      "column": 3,
      "header": "price",
      "field": "price",
      "warning": null
    },
    {
      "column": 4,
      "header": "variant_sku",
      "field": "variant_sku",
      "warning": null
    }
  ],
  "summary": null,
  "result": null,
  "errorCode": null,
  "errorReportUrl": null
}
```

### POST /catalog/import-export/products/imports/:id/preview (the detected mapping)

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_REST>/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"f0-I8lariDfHa5sISlurug6TqQb3vc"

{
  "importId": "<IMPORT_REST>",
  "totalItems": 1,
  "skip": 0,
  "take": 200,
  "items": [
    {
      "rowNumber": 2,
      "action": "create",
      "productKey": "EVREST-1",
      "name": "منتج عبر REST",
      "messages": []
    }
  ],
  "summary": {
    "creates": 1,
    "updates": 0,
    "errors": 0,
    "warnings": 0
  }
}
```

### POST /catalog/import-export/products/imports/:id/confirm

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_REST>/confirm
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"234-tkZWQKCOjpTs/kEe4SFSJxBelZU"

{
  "importId": "<IMPORT_REST>",
  "status": "confirming",
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
      "field": "status",
      "column": 2,
      "header": "status",
      "warning": null
    },
    {
      "field": "price",
      "column": 3,
      "header": "price",
      "warning": null
    },
    {
      "field": "variant_sku",
      "column": 4,
      "header": "variant_sku",
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

### GET /catalog/import-export/products/imports/:id: done, nothing failed (no report)

```http
GET http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"250-8ngG2Dh+PTFz08xC6yc0/nvEhVQ"

{
  "importId": "<IMPORT_REST>",
  "status": "done",
  "format": "csv",
  "rowCount": 1,
  "progress": 100,
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
      "field": "status",
      "column": 2,
      "header": "status",
      "warning": null
    },
    {
      "field": "price",
      "column": 3,
      "header": "price",
      "warning": null
    },
    {
      "field": "variant_sku",
      "column": 4,
      "header": "variant_sku",
      "warning": null
    }
  ],
  "summary": {
    "errors": 0,
    "creates": 1,
    "updates": 0,
    "warnings": 0
  },
  "result": {
    "failed": 0,
    "created": 1,
    "updated": 0
  },
  "errorCode": null,
  "errorReportUrl": null
}
```

