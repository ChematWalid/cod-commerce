# Import refusals

What the object store and the import refuse (D2208, D2209, D2210, D2217). Refusals carry a stable code; the file's text is never echoed.

### POST /catalog/import-export/uploads: 51 bytes declared

```http
POST http://127.0.0.1:23100/catalog/import-export/uploads
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "format": "csv",
  "size": 51,
  "contentType": "text/csv"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"27a-iKTucvH0FXHI5C6Inmu9XTWboYU"

{
  "importId": "<IMPORT_SIGNED>",
  "uploadUrl": "http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SIGNED>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115953Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject",
  "method": "PUT",
  "headers": {
    "content-type": "text/csv",
    "content-length": "51"
  },
  "expiresAt": "2026-11-21T12:09:53.689Z"
}
```

### PUT a larger body than signed to the link: Garage refuses it (403)

```http
PUT http://127.0.0.1:23900/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SIGNED>/source?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=[REDACTED]&X-Amz-Date=20261121T115953Z&X-Amz-Expires=600&X-Amz-Signature=[REDACTED]&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost&x-id=PutObject
Content-Type: text/csv
Content-Length: 91

big.csv (91 bytes, 51 signed)

HTTP/1.1 403 Forbidden
content-type: application/xml

<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Forbidden: Invalid signature</Message><Resource>/cod-private/uploads/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/imports/<IMPORT_SIGNED>/source</Resource><Region>garage</Region></Error>
```

### POST …/analyze: nothing was stored, so there is nothing to analyze

```http
POST http://127.0.0.1:23100/catalog/import-export/products/analyze
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "importId": "<IMPORT_SIGNED>"
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"ab-2EeheIQIujgdEqmyOgrgVWK7G4Q"

{
  "statusCode": 409,
  "code": "catalog-import.job-state",
  "message": "This import is not at a step that allows this; reload it.",
  "path": "/catalog/import-export/products/analyze"
}
```

### POST …/analyze of a PNG uploaded as CSV: file-type (the bytes are sniffed, the object deleted)

```http
POST http://127.0.0.1:23100/catalog/import-export/products/analyze
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "importId": "<IMPORT_PNG>"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"b3-dLJPwkCbm6dOyYEiJATwQgA6wag"

{
  "statusCode": 400,
  "code": "catalog-import.file-type",
  "message": "This file is not an xlsx or CSV spreadsheet of the declared type.",
  "path": "/catalog/import-export/products/analyze"
}
```

### POST …/analyze of an object of 91 bytes where 51 were declared: file-too-large

```http
POST http://127.0.0.1:23100/catalog/import-export/products/analyze
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "importId": "<IMPORT_MISMATCH>"
}

HTTP/1.1 413 Payload Too Large
content-type: application/json; charset=utf-8
etag: W/"a6-9uEtMr8HOl67C8YUbb9adk4WSfI"

{
  "statusCode": 413,
  "code": "catalog-import.file-too-large",
  "message": "The file is larger than declared or than 10 MB.",
  "path": "/catalog/import-export/products/analyze"
}
```

### POST …/analyze of 5001 rows: too-many-rows (at most 5 000)

```http
POST http://127.0.0.1:23100/catalog/import-export/products/analyze
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "importId": "<IMPORT_MANY>"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"ed-t5Y9ugW5xqvxwiDUAU667uirx2g"

{
  "statusCode": 400,
  "code": "catalog-import.too-many-rows",
  "message": "Too many rows: an import reads at most 5 000 rows and an export at most 20 000 products; narrow the file or the filter.",
  "path": "/catalog/import-export/products/analyze"
}
```

### POST /catalog/import-export/uploads with a content type that is not the format's: invalid-input (D2225)

```http
POST http://127.0.0.1:23100/catalog/import-export/uploads
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "format": "csv",
  "size": 100,
  "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"8f-S+hM13howdRY26+udCj9qzyt5VE"

{
  "statusCode": 400,
  "code": "catalog-import.invalid-input",
  "message": "Some of the details are not valid.",
  "path": "/catalog/import-export/uploads"
}
```

### POST …/confirm of the import already done: job-state (confirm runs once)

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_SHOWCASE>/confirm
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"c6-4wsswFUFQTE8Uufa/iZ486cXSuM"

{
  "statusCode": 409,
  "code": "catalog-import.job-state",
  "message": "This import is not at a step that allows this; reload it.",
  "path": "/catalog/import-export/products/imports/<IMPORT_SHOWCASE>/confirm"
}
```

### POST …/preview as a member holding create but not edit: the update row is an update-forbidden error, the new product a create

```http
POST http://127.0.0.1:23100/catalog/import-export/products/imports/<IMPORT_MEMBER>/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"179-hy9rnrs2KZ8byHrVbDhxTxVJtw0"

{
  "importId": "<IMPORT_MEMBER>",
  "totalItems": 2,
  "skip": 0,
  "take": 200,
  "items": [
    {
      "rowNumber": 2,
      "action": "error",
      "productKey": "EVUPD-1",
      "name": "منتج للتحديث",
      "messages": [
        "catalog-import.update-forbidden"
      ]
    },
    {
      "rowNumber": 3,
      "action": "create",
      "productKey": "EVMEMBER-1",
      "name": "منتج العضو",
      "messages": []
    }
  ],
  "summary": {
    "creates": 1,
    "updates": 0,
    "errors": 1,
    "warnings": 0
  }
}
```

### POST /catalog/import-export/uploads, call 31 of business B's owner within the hour: 429 with Retry-After

```http
POST http://127.0.0.1:23100/catalog/import-export/uploads
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "format": "csv",
  "size": 100,
  "contentType": "text/csv"
}

HTTP/1.1 429 Too Many Requests
retry-after: 118
content-type: application/json; charset=utf-8
etag: W/"82-zr2314dvafkTj55D4lpu5ISGLt8"

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 118,
  "path": "/catalog/import-export/uploads"
}
```

