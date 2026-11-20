# Bulk edit

Status, brand, tags and price of up to 500 selected products of the active store (D2213); one result per product. `dryRun` computes the same results and writes nothing. Needs `catalog.products.edit`.

### bulkEditCatalogProducts, dry run: Draft and +10 %

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { results { productId ok changedFields error } } }",
  "variables": {
    "input": {
      "productIds": [
        "14",
        "15",
        "16"
      ],
      "changes": {
        "status": "draft",
        "price": {
          "mode": "percent",
          "value": 10
        }
      },
      "dryRun": true
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"11a-/Rq9KlTTlh+AZgt/hkNTRbijJx8"

{
  "data": {
    "bulkEditCatalogProducts": {
      "results": [
        {
          "productId": "14",
          "ok": true,
          "changedFields": [
            "status",
            "price"
          ],
          "error": null
        },
        {
          "productId": "15",
          "ok": true,
          "changedFields": [
            "status",
            "price"
          ],
          "error": null
        },
        {
          "productId": "16",
          "ok": true,
          "changedFields": [
            "status",
            "price"
          ],
          "error": null
        }
      ]
    }
  }
}
```

### catalogProduct after the dry run: unchanged

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "14"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"a7-PV9cXHJWDGuJfe5400SreoXv/BE"

{
  "data": {
    "catalogProduct": {
      "id": "14",
      "title": "منتج التعديل الجماعي 1",
      "status": "active",
      "price": 1000,
      "brandId": null,
      "tagIds": [],
      "type": "physical"
    }
  }
}
```

### bulkEditCatalogProducts: Draft, a brand, a tag and +10 %

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { results { productId ok changedFields error } } }",
  "variables": {
    "input": {
      "productIds": [
        "14",
        "15",
        "16"
      ],
      "changes": {
        "status": "draft",
        "brandId": "<BRAND_DEMO>",
        "addTagIds": [
          "<TAG_DEMO>"
        ],
        "price": {
          "mode": "percent",
          "value": 10
        }
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"147-vFYFwxzmPwrw7KicZjB8sb/2rok"

{
  "data": {
    "bulkEditCatalogProducts": {
      "results": [
        {
          "productId": "14",
          "ok": true,
          "changedFields": [
            "status",
            "brand",
            "tags",
            "price"
          ],
          "error": null
        },
        {
          "productId": "15",
          "ok": true,
          "changedFields": [
            "status",
            "brand",
            "tags",
            "price"
          ],
          "error": null
        },
        {
          "productId": "16",
          "ok": true,
          "changedFields": [
            "status",
            "brand",
            "tags",
            "price"
          ],
          "error": null
        }
      ]
    }
  }
}
```

### catalogProduct after the edit: Draft, 2 200 DZD, the brand and the tag

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "15"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"ca-4blUABjGW8ZqtySr+TNwQdYdU6k"

{
  "data": {
    "catalogProduct": {
      "id": "15",
      "title": "منتج التعديل الجماعي 2",
      "status": "draft",
      "price": 2200,
      "brandId": "<BRAND_DEMO>",
      "tagIds": [
        "<TAG_DEMO>"
      ],
      "type": "physical"
    }
  }
}
```

### POST /catalog/products/bulk-edit: one product of the store and one unknown id (a partial failure)

```http
POST http://127.0.0.1:23100/catalog/products/bulk-edit
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "14",
    "999999"
  ],
  "changes": {
    "status": "active",
    "price": {
      "mode": "amount",
      "value": -100
    }
  }
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"b3-1mtexw5JBTzJVGj1P15IfCCohbI"

{
  "results": [
    {
      "productId": "14",
      "ok": true,
      "changedFields": [
        "status",
        "price"
      ],
      "error": null
    },
    {
      "productId": "999999",
      "ok": false,
      "changedFields": [],
      "error": "catalog.product-not-found"
    }
  ]
}
```

### POST /catalog/products/bulk-edit with business B's brand: refused, nothing written

```http
POST http://127.0.0.1:23100/catalog/products/bulk-edit
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "16"
  ],
  "changes": {
    "brandId": "<BRAND_OF_B>"
  }
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"9a-8ZbX6g3AboxKmJI7EbcQvdkEvFc"

{
  "statusCode": 404,
  "code": "catalog-import.taxonomy-not-found",
  "message": "A brand or tag was not found in this store.",
  "path": "/catalog/products/bulk-edit"
}
```

