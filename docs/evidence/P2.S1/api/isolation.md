# Business A against business B's catalog

A foreign id answers exactly like an unknown one (D2136); another business's channel token is refused outright.

### catalogProduct with B's product id, A's session on A's store: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } }",
  "variables": {
    "id": "15"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogProduct": null
  }
}
```

### GET /catalog/products/<B's product>: 404

```http
GET http://127.0.0.1:23100/catalog/products/15
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "catalog.product-not-found",
  "message": "Product not found.",
  "path": "/catalog/products/15"
}
```

### updateCatalogProduct of B's product: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "id": "15",
    "input": {
      "label": "x"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Product not found.",
      "locations": [
        {
          "line": 1,
          "column": 59
        }
      ],
      "path": [
        "updateCatalogProduct"
      ],
      "extensions": {
        "code": "catalog.product-not-found"
      }
    }
  ],
  "data": null
}
```

### DELETE /catalog/products/<B's product>: 404

```http
DELETE http://127.0.0.1:23100/catalog/products/15
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "catalog.product-not-found",
  "message": "Product not found.",
  "path": "/catalog/products/15"
}
```

### createCatalogProduct with B's brand id: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "input": {
      "title": "منتج بعلامة أجنبية",
      "status": "active",
      "price": 1000,
      "brandId": "<BRAND_OF_B>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Brand not found.",
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
        "code": "catalog.brand-not-found"
      }
    }
  ],
  "data": null
}
```

### B reads its product: unchanged by A's attempts

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } }",
  "variables": {
    "id": "15"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogProduct": {
      "id": "15",
      "title": "Produit B",
      "slug": "ev-b-only-slug",
      "status": "active",
      "price": 1500,
      "oldPrice": null,
      "sku": null,
      "barcode": null,
      "brandId": null,
      "tagIds": [],
      "highlightIds": [],
      "featuredAsset": null,
      "assets": [],
      "optionGroups": [],
      "variants": [
        {
          "id": "24",
          "name": "Produit B",
          "sku": "",
          "price": 1500,
          "oldPrice": null,
          "barcode": null,
          "isHidden": false,
          "optionValues": []
        }
      ],
      "settings": {
        "soldOut": false,
        "allowOutOfStockOrders": true
      }
    }
  }
}
```

### catalogProducts, A's session with B's channel token: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 45
        }
      ],
      "path": [
        "catalogProducts"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/products, A's session with B's channel token: 403

```http
GET http://127.0.0.1:23100/catalog/products
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-14T16:31:48.589Z",
  "path": "/catalog/products"
}
```

### catalogProducts without a session: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 45
        }
      ],
      "path": [
        "catalogProducts"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

