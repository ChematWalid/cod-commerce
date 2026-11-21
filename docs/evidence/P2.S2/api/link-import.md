# Link import and polish

A product page's link becomes a Draft product (D2214): title, description, price and image links read from the page, flagged for image review, no image fetched. This stack runs the fixture scraper (synthetic pages on `shop.example.test` only); the HTTP scraper's guard refuses private, loopback and internal hosts with the same code. Polish is the AI hook (D2215): identity until P9.S7b, nothing saved.

### createCatalogLinkImport: a synthetic product page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogLinkImportInput!) { createCatalogLinkImport(input: $input) { importId status sourceUrl productId } }",
  "variables": {
    "input": {
      "url": "https://shop.example.test/products/kaftan"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"a1-G/eymgRzt5ysswBp28QIls3vgmc"

{
  "data": {
    "createCatalogLinkImport": {
      "importId": "<LINK_IMPORT>",
      "status": "done",
      "sourceUrl": "https://shop.example.test/products/kaftan",
      "productId": "540"
    }
  }
}
```

### catalogProduct: the Draft the link made

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "540"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"96-ExRJYaabEE87ci1+sRO+EG4biC8"

{
  "data": {
    "catalogProduct": {
      "id": "540",
      "title": "Synthetic summer kaftan",
      "status": "draft",
      "price": 4500,
      "brandId": null,
      "tagIds": [],
      "type": "physical"
    }
  }
}
```

### catalogLinkImport

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { catalogLinkImport(id: $id) { importId status sourceUrl productId } }",
  "variables": {
    "id": "<LINK_IMPORT>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"9b-vCOg/79r/2B90XtlJUN0vK3Psds"

{
  "data": {
    "catalogLinkImport": {
      "importId": "<LINK_IMPORT>",
      "status": "done",
      "sourceUrl": "https://shop.example.test/products/kaftan",
      "productId": "540"
    }
  }
}
```

### polishCatalogProduct: the text unchanged (identity hook)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!) { polishCatalogProduct(id: $id) { productId title description } }",
  "variables": {
    "id": "540"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"93-KgLRHmiU3tHRnUl41XRFMdymED8"

{
  "data": {
    "polishCatalogProduct": {
      "productId": "540",
      "title": "Synthetic summer kaftan",
      "description": "A light cotton kaftan for summer evenings."
    }
  }
}
```

### POST /catalog/scrape/import-job

```http
POST http://127.0.0.1:23100/catalog/scrape/import-job
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "url": "https://shop.example.test/products/scarf"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"7a-kNCln4koEOvitUUBLWF1VIQ16sE"

{
  "importId": "<LINK_IMPORT_REST>",
  "status": "done",
  "sourceUrl": "https://shop.example.test/products/scarf",
  "productId": "541"
}
```

### GET /catalog/scrape/import-jobs/:id

```http
GET http://127.0.0.1:23100/catalog/scrape/import-jobs/<LINK_IMPORT_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"7a-kNCln4koEOvitUUBLWF1VIQ16sE"

{
  "importId": "<LINK_IMPORT_REST>",
  "status": "done",
  "sourceUrl": "https://shop.example.test/products/scarf",
  "productId": "541"
}
```

### POST /catalog/scrape/products/:id/polish

```http
POST http://127.0.0.1:23100/catalog/scrape/products/541/polish
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"6e-94Eo26NzrlBETbw75aDrRutde4g"

{
  "productId": "541",
  "title": "Synthetic silk scarf",
  "description": "A synthetic scarf page that shows no price."
}
```

### POST /catalog/scrape/import-job with http://127.0.0.1/admin: link-refused

```http
POST http://127.0.0.1:23100/catalog/scrape/import-job
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "url": "http://127.0.0.1/admin"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"b3-sKiyk5GZh0ZpaRTBZszBDrvinHI"

{
  "statusCode": 400,
  "code": "catalog-import.link-refused",
  "message": "This link cannot be imported. Use the public web address of a product page.",
  "path": "/catalog/scrape/import-job"
}
```

### POST /catalog/scrape/import-job with http://10.0.0.5/product: link-refused

```http
POST http://127.0.0.1:23100/catalog/scrape/import-job
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "url": "http://10.0.0.5/product"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"b3-sKiyk5GZh0ZpaRTBZszBDrvinHI"

{
  "statusCode": 400,
  "code": "catalog-import.link-refused",
  "message": "This link cannot be imported. Use the public web address of a product page.",
  "path": "/catalog/scrape/import-job"
}
```

### POST /catalog/scrape/import-job with https://unknown-shop.example.com/p/1: link-refused

```http
POST http://127.0.0.1:23100/catalog/scrape/import-job
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "url": "https://unknown-shop.example.com/p/1"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"b3-sKiyk5GZh0ZpaRTBZszBDrvinHI"

{
  "statusCode": 400,
  "code": "catalog-import.link-refused",
  "message": "This link cannot be imported. Use the public web address of a product page.",
  "path": "/catalog/scrape/import-job"
}
```

