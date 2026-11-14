# Brands, tags and highlights

Each belongs to one store of one business (D2100); reads need `catalog.products.view`, writes `catalog.products.edit`. The REST routes mirror the GraphQL operations (D2102).

### catalogBrands: the store's brands (the seed's)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogBrands { id name } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogBrands": [
      {
        "id": "247397940216209408",
        "name": "علامة تجريبية"
      }
    ]
  }
}
```

### createCatalogBrand

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id name } }",
  "variables": {
    "input": {
      "name": "علامة الأدلة"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createCatalogBrand": {
      "id": "<BRAND_KEPT>",
      "name": "علامة الأدلة"
    }
  }
}
```

### updateCatalogBrand

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: CatalogBrandInput!) { updateCatalogBrand(id: $id, input: $input) { id name } }",
  "variables": {
    "id": "<BRAND_KEPT>",
    "input": {
      "name": "علامة الأدلة الجديدة"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateCatalogBrand": {
      "id": "<BRAND_KEPT>",
      "name": "علامة الأدلة الجديدة"
    }
  }
}
```

### deleteCatalogBrand

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteCatalogBrand(id: $id) }",
  "variables": {
    "id": "<BRAND_DELETED>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteCatalogBrand": true
  }
}
```

### GET /catalog/brands

```http
GET http://127.0.0.1:23100/catalog/brands
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<BRAND_KEPT>",
    "name": "علامة الأدلة الجديدة",
    "createdAt": "2026-11-14T16:31:23.854Z",
    "updatedAt": "2026-11-14T16:31:24.176Z"
  },
  {
    "id": "247397940216209408",
    "name": "علامة تجريبية",
    "createdAt": "2026-11-14T16:31:05.379Z",
    "updatedAt": "2026-11-14T16:31:05.379Z"
  }
]
```

### POST /catalog/brands

```http
POST http://127.0.0.1:23100/catalog/brands
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Evidence brand"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<BRAND_REST>",
  "name": "Evidence brand",
  "createdAt": "2026-11-14T16:31:25.190Z",
  "updatedAt": "2026-11-14T16:31:25.190Z"
}
```

### PATCH /catalog/brands/:id

```http
PATCH http://127.0.0.1:23100/catalog/brands/<BRAND_REST>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Evidence brand 2"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<BRAND_REST>",
  "name": "Evidence brand 2",
  "createdAt": "2026-11-14T16:31:25.190Z",
  "updatedAt": "2026-11-14T16:31:25.321Z"
}
```

### DELETE /catalog/brands/:id

```http
DELETE http://127.0.0.1:23100/catalog/brands/<BRAND_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### catalogTags: the store's tags (the seed's)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogTags { id name } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogTags": [
      {
        "id": "247397940363010048",
        "name": "جديد"
      }
    ]
  }
}
```

### createCatalogTag

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id name } }",
  "variables": {
    "input": {
      "name": "صيفي"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createCatalogTag": {
      "id": "<TAG_KEPT>",
      "name": "صيفي"
    }
  }
}
```

### updateCatalogTag

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: CatalogTagInput!) { updateCatalogTag(id: $id, input: $input) { id name } }",
  "variables": {
    "id": "<TAG_KEPT>",
    "input": {
      "name": "صيف"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateCatalogTag": {
      "id": "<TAG_KEPT>",
      "name": "صيف"
    }
  }
}
```

### deleteCatalogTag

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteCatalogTag(id: $id) }",
  "variables": {
    "id": "<TAG_DELETED>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteCatalogTag": true
  }
}
```

### GET /catalog/tags

```http
GET http://127.0.0.1:23100/catalog/tags
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<TAG_KEPT>",
    "name": "صيف",
    "createdAt": "2026-11-14T16:31:25.752Z",
    "updatedAt": "2026-11-14T16:31:26.024Z"
  },
  {
    "id": "247397940363010048",
    "name": "جديد",
    "createdAt": "2026-11-14T16:31:05.414Z",
    "updatedAt": "2026-11-14T16:31:05.414Z"
  }
]
```

### POST /catalog/tags

```http
POST http://127.0.0.1:23100/catalog/tags
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Evidence tag"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<TAG_REST>",
  "name": "Evidence tag",
  "createdAt": "2026-11-14T16:31:26.943Z",
  "updatedAt": "2026-11-14T16:31:26.943Z"
}
```

### PATCH /catalog/tags/:id

```http
PATCH http://127.0.0.1:23100/catalog/tags/<TAG_REST>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Evidence tag 2"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<TAG_REST>",
  "name": "Evidence tag 2",
  "createdAt": "2026-11-14T16:31:26.943Z",
  "updatedAt": "2026-11-14T16:31:27.088Z"
}
```

### DELETE /catalog/tags/:id

```http
DELETE http://127.0.0.1:23100/catalog/tags/<TAG_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### catalogHighlights: the store's highlights (the seed's)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogHighlights { id text } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogHighlights": [
      {
        "id": "<HIGHLIGHT>",
        "text": "جودة مضمونة"
      },
      {
        "id": "<HIGHLIGHT>",
        "text": "الدفع عند الاستلام"
      },
      {
        "id": "<HIGHLIGHT>",
        "text": "توصيل سريع"
      }
    ]
  }
}
```

### createCatalogHighlight

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogHighlightInput!) { createCatalogHighlight(input: $input) { id text } }",
  "variables": {
    "input": {
      "text": "قماش متين"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createCatalogHighlight": {
      "id": "<HIGHLIGHT>",
      "text": "قماش متين"
    }
  }
}
```

### updateCatalogHighlight

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: CatalogHighlightInput!) { updateCatalogHighlight(id: $id, input: $input) { id text } }",
  "variables": {
    "id": "<HIGHLIGHT>",
    "input": {
      "text": "قماش قطني متين"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateCatalogHighlight": {
      "id": "<HIGHLIGHT>",
      "text": "قماش قطني متين"
    }
  }
}
```

### deleteCatalogHighlight

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteCatalogHighlight(id: $id) }",
  "variables": {
    "id": "<HIGHLIGHT_DELETED>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteCatalogHighlight": true
  }
}
```

### GET /catalog/highlights

```http
GET http://127.0.0.1:23100/catalog/highlights
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<HIGHLIGHT>",
    "text": "قماش قطني متين",
    "createdAt": "2026-11-14T16:31:27.497Z",
    "updatedAt": "2026-11-14T16:31:27.806Z"
  },
  {
    "id": "<HIGHLIGHT>",
    "text": "جودة مضمونة",
    "createdAt": "2026-11-14T16:31:05.480Z",
    "updatedAt": "2026-11-14T16:31:05.480Z"
  },
  {
    "id": "<HIGHLIGHT>",
    "text": "الدفع عند الاستلام",
    "createdAt": "2026-11-14T16:31:05.456Z",
    "updatedAt": "2026-11-14T16:31:05.456Z"
  },
  {
    "id": "<HIGHLIGHT>",
    "text": "توصيل سريع",
    "createdAt": "2026-11-14T16:31:05.432Z",
    "updatedAt": "2026-11-14T16:31:05.432Z"
  }
]
```

### POST /catalog/highlights

```http
POST http://127.0.0.1:23100/catalog/highlights
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "text": "Evidence highlight"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<HIGHLIGHT_REST>",
  "text": "Evidence highlight",
  "createdAt": "2026-11-14T16:31:28.645Z",
  "updatedAt": "2026-11-14T16:31:28.645Z"
}
```

### PATCH /catalog/highlights/:id

```http
PATCH http://127.0.0.1:23100/catalog/highlights/<HIGHLIGHT_REST>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "text": "Evidence highlight 2"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<HIGHLIGHT_REST>",
  "text": "Evidence highlight 2",
  "createdAt": "2026-11-14T16:31:28.645Z",
  "updatedAt": "2026-11-14T16:31:28.796Z"
}
```

### DELETE /catalog/highlights/:id

```http
DELETE http://127.0.0.1:23100/catalog/highlights/<HIGHLIGHT_REST>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### A product with seven highlights: refused (at most six, AC3)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "input": {
      "title": "منتج بسبع مزايا",
      "status": "active",
      "price": 1000,
      "highlightIds": [
        "<HIGHLIGHT>",
        "<HIGHLIGHT>",
        "<HIGHLIGHT>",
        "<HIGHLIGHT>",
        "<HIGHLIGHT>",
        "<HIGHLIGHT>",
        "<HIGHLIGHT>"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "A product can show at most 6 highlights.",
      "locations": [
        {
          "line": 1,
          "column": 49
        }
      ],
      "path": [
        "createCatalogProduct"
      ],
      "extensions": {
        "code": "catalog.too-many-highlights"
      }
    }
  ],
  "data": null
}
```

