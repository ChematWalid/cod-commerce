# Export

Selected products (at most 500) or every product the list's filter finds (D2211). Up to 500 rows the file is written at once and answered with a 5-minute download link; above, a job on the `imports-exports` queue writes it and `catalogExport` is read until it is done. Pack products are skipped and counted (D2220). Needs `catalog.products.view`.

### catalogImportFields: the spreadsheet columns, in file order (D2209)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogImportFields { key required } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"304-aaV1pmMBePDobdypTrMiGJ24sY8"

{
  "data": {
    "catalogImportFields": [
      {
        "key": "product_key",
        "required": false
      },
      {
        "key": "name",
        "required": true
      },
      {
        "key": "description",
        "required": false
      },
      {
        "key": "status",
        "required": false
      },
      {
        "key": "type",
        "required": false
      },
      {
        "key": "price",
        "required": true
      },
      {
        "key": "old_price",
        "required": false
      },
      {
        "key": "weight",
        "required": false
      },
      {
        "key": "brand",
        "required": false
      },
      {
        "key": "tags",
        "required": false
      },
      {
        "key": "collections",
        "required": false
      },
      {
        "key": "option1_name",
        "required": false
      },
      {
        "key": "option1_value",
        "required": false
      },
      {
        "key": "option2_name",
        "required": false
      },
      {
        "key": "option2_value",
        "required": false
      },
      {
        "key": "option3_name",
        "required": false
      },
      {
        "key": "option3_value",
        "required": false
      },
      {
        "key": "variant_sku",
        "required": false
      },
      {
        "key": "barcode",
        "required": false
      },
      {
        "key": "image_urls",
        "required": false
      }
    ]
  }
}
```

### catalogImportFormats

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogImportFormats { format contentType extension } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"d7-Q3jmqRfnw7deJMe0GnwfZfq+DsQ"

{
  "data": {
    "catalogImportFormats": [
      {
        "format": "xlsx",
        "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "extension": "xlsx"
      },
      {
        "format": "csv",
        "contentType": "text/csv",
        "extension": "csv"
      }
    ]
  }
}
```

### GET /catalog/import-export/fields

```http
GET http://127.0.0.1:23100/catalog/import-export/fields
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2e2-qiYJMy3kLV6CpgXVne19n7p2Ofw"

[
  {
    "key": "product_key",
    "required": false
  },
  {
    "key": "name",
    "required": true
  },
  {
    "key": "description",
    "required": false
  },
  {
    "key": "status",
    "required": false
  },
  {
    "key": "type",
    "required": false
  },
  {
    "key": "price",
    "required": true
  },
  {
    "key": "old_price",
    "required": false
  },
  {
    "key": "weight",
    "required": false
  },
  {
    "key": "brand",
    "required": false
  },
  {
    "key": "tags",
    "required": false
  },
  {
    "key": "collections",
    "required": false
  },
  {
    "key": "option1_name",
    "required": false
  },
  {
    "key": "option1_value",
    "required": false
  },
  {
    "key": "option2_name",
    "required": false
  },
  {
    "key": "option2_value",
    "required": false
  },
  {
    "key": "option3_name",
    "required": false
  },
  {
    "key": "option3_value",
    "required": false
  },
  {
    "key": "variant_sku",
    "required": false
  },
  {
    "key": "barcode",
    "required": false
  },
  {
    "key": "image_urls",
    "required": false
  }
]
```

### GET /catalog/import-export/formats

```http
GET http://127.0.0.1:23100/catalog/import-export/formats
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"b4-CaGQAFk17Bs3bq6jL3ITZCgU4aA"

[
  {
    "format": "xlsx",
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "extension": "xlsx"
  },
  {
    "format": "csv",
    "contentType": "text/csv",
    "extension": "csv"
  }
]
```

### exportCatalogProducts: two products and the pack, CSV; written at once, the pack skipped

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { exportId status progress rowCount skippedPacks errorCode downloadUrl } }",
  "variables": {
    "input": {
      "scope": "selected",
      "format": "csv",
      "productIds": [
        "14",
        "15",
        "13"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"2d9-hJCkHZuaKU6jNSNdjdJWnMFKgrk"

{
  "data": {
    "exportCatalogProducts": {
      "exportId": "<EXPORT_SELECTED>",
      "status": "done",
      "progress": 100,
      "rowCount": 2,
      "skippedPacks": 1,
      "errorCode": null,
      "downloadUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_SELECTED>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115810Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_SELECTED>.csv%22&response-content-type=text%2Fcsv&x-id=GetObject"
    }
  }
}
```

### GET the download link: the CSV, as an attachment

```http
GET http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_SELECTED>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115810Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_SELECTED>.csv%22&response-content-type=text%2Fcsv&x-id=GetObject

HTTP/1.1 200 OK
etag: "d194c3377633b41c574e5494c05387a4"
content-type: text/csv
content-disposition: attachment; filename="products-<EXPORT_SELECTED>.csv"

product_key,name,description,status,type,price,old_price,weight,brand,tags,collections,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,variant_sku,barcode,image_urls
EVBULK-1,منتج التعديل الجماعي 1,,active,physical,1000,,,علامة الحزم,تخفيضات,,,,,,,,EVBULK-1,,
EVBULK-2,منتج التعديل الجماعي 2,,draft,physical,2200,,,علامة الحزم,تخفيضات,,,,,,,,EVBULK-2,,
```

### POST /catalog/products/export: one product, Excel

```http
POST http://127.0.0.1:23100/catalog/products/export
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "scope": "selected",
  "format": "xlsx",
  "productIds": [
    "16"
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2ef-i7bFbQZM8Nj27qL6xiKQNy/6LwE"

{
  "exportId": "<EXPORT_REST>",
  "status": "done",
  "progress": 100,
  "rowCount": 1,
  "skippedPacks": 0,
  "errorCode": null,
  "downloadUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_REST>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115811Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_REST>.xlsx%22&response-content-type=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&x-id=GetObject"
}
```

### GET the download link: the Excel file

```http
GET http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_REST>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115811Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_REST>.xlsx%22&response-content-type=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&x-id=GetObject

HTTP/1.1 200 OK
etag: "472f71472d86e6339742d783f01779ab"
content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
content-disposition: attachment; filename="products-<EXPORT_REST>.xlsx"

<xlsx, 6236 bytes>
```

### exportCatalogProducts, filtered: the 520 products imported for this (above 500), queued as a job

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { exportId status progress rowCount skippedPacks errorCode downloadUrl } }",
  "variables": {
    "input": {
      "scope": "filtered",
      "format": "xlsx",
      "query": {
        "q": "EVJOB"
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"a6-EnXoJmNEtQkXqeXupBlHlHi3lv8"

{
  "data": {
    "exportCatalogProducts": {
      "exportId": "<EXPORT_JOB>",
      "status": "queued",
      "progress": 0,
      "rowCount": 0,
      "skippedPacks": 0,
      "errorCode": null,
      "downloadUrl": null
    }
  }
}
```

### catalogExport: the job done, with a fresh download link

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogExport(id: $id) { exportId status progress rowCount skippedPacks errorCode downloadUrl } }",
  "variables": {
    "id": "<EXPORT_JOB>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"30d-dTsA0zhpzJnlO4Tbf+/Fkb/xsJg"

{
  "data": {
    "catalogExport": {
      "exportId": "<EXPORT_JOB>",
      "status": "done",
      "progress": 100,
      "rowCount": 520,
      "skippedPacks": 0,
      "errorCode": null,
      "downloadUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_JOB>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115946Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_JOB>.xlsx%22&response-content-type=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&x-id=GetObject"
    }
  }
}
```

### GET /catalog/import-export/exports/:id

```http
GET http://127.0.0.1:23100/catalog/import-export/exports/<EXPORT_JOB>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2f1-NyyRXiE+euSICYFsrvr/Od2IQm8"

{
  "exportId": "<EXPORT_JOB>",
  "status": "done",
  "progress": 100,
  "rowCount": 520,
  "skippedPacks": 0,
  "errorCode": null,
  "downloadUrl": "http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_JOB>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115947Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_JOB>.xlsx%22&response-content-type=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&x-id=GetObject"
}
```

### GET the download link: the job's Excel file

```http
GET http://127.0.0.1:23900/cod-private/exports/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/exports/<EXPORT_JOB>/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115947Z&X-Amz-Expires=300&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22products-<EXPORT_JOB>.xlsx%22&response-content-type=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet&x-id=GetObject

HTTP/1.1 200 OK
etag: "68066b99f431520a7fc614caf65f67f4"
content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
content-disposition: attachment; filename="products-<EXPORT_JOB>.xlsx"

<xlsx, 23476 bytes>
```

