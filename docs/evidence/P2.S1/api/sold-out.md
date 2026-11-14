# Sold-out products

Until stock exists a product is sold out by its manual flag (D2107). "Stop orders" and "Resume orders" set `allowOutOfStockOrders` on the store's sold-out products; an empty list means all of them (D2108).

### updateCatalogProduct: mark the seed's hidden product sold out

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "id": "3",
    "input": {
      "settings": {
        "soldOut": true
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateCatalogProduct": {
      "warnings": [],
      "product": {
        "id": "3",
        "title": "قبعة تجريبية",
        "slug": "قبعة-تجريبية",
        "status": "hidden",
        "price": 1200,
        "oldPrice": null,
        "sku": "DEMO-CAP",
        "barcode": null,
        "brandId": null,
        "tagIds": [],
        "highlightIds": [],
        "featuredAsset": null,
        "assets": [],
        "optionGroups": [],
        "variants": [
          {
            "id": "6",
            "name": "قبعة تجريبية",
            "sku": "DEMO-CAP",
            "price": 1200,
            "oldPrice": null,
            "barcode": null,
            "isHidden": false,
            "optionValues": []
          }
        ],
        "settings": {
          "soldOut": true,
          "allowOutOfStockOrders": true
        }
      }
    }
  }
}
```

### catalogSoldOutProducts

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogSoldOutProducts { productId title allowOutOfStockOrders } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogSoldOutProducts": [
      {
        "productId": "3",
        "title": "قبعة تجريبية",
        "allowOutOfStockOrders": true
      }
    ]
  }
}
```

### catalogProducts: the sold-out tab

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "tab": "sold-out"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogProducts": {
      "totalItems": 1,
      "items": [
        {
          "id": "3",
          "title": "قبعة تجريبية",
          "status": "hidden",
          "sku": "DEMO-CAP",
          "brandId": null,
          "tagIds": []
        }
      ]
    }
  }
}
```

### stopCatalogSoldOutOrders: every sold-out product

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogSoldOutOrdersInput!) { stopCatalogSoldOutOrders(input: $input) { productId title allowOutOfStockOrders } }",
  "variables": {
    "input": {
      "productIds": []
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "stopCatalogSoldOutOrders": [
      {
        "productId": "3",
        "title": "قبعة تجريبية",
        "allowOutOfStockOrders": false
      }
    ]
  }
}
```

### resumeCatalogSoldOutOrders: one product

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogSoldOutOrdersInput!) { resumeCatalogSoldOutOrders(input: $input) { productId title allowOutOfStockOrders } }",
  "variables": {
    "input": {
      "productIds": [
        "3"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "resumeCatalogSoldOutOrders": [
      {
        "productId": "3",
        "title": "قبعة تجريبية",
        "allowOutOfStockOrders": true
      }
    ]
  }
}
```

### resumeCatalogSoldOutOrders on a product that is not sold out: nothing changes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogSoldOutOrdersInput!) { resumeCatalogSoldOutOrders(input: $input) { productId title allowOutOfStockOrders } }",
  "variables": {
    "input": {
      "productIds": [
        "11"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "resumeCatalogSoldOutOrders": []
  }
}
```

### GET /catalog/sold-out-products

```http
GET http://127.0.0.1:23100/catalog/sold-out-products
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "productId": "3",
    "title": "قبعة تجريبية",
    "allowOutOfStockOrders": true
  }
]
```

### POST /catalog/sold-out-products/stop-orders

```http
POST http://127.0.0.1:23100/catalog/sold-out-products/stop-orders
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": []
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "productId": "3",
    "title": "قبعة تجريبية",
    "allowOutOfStockOrders": false
  }
]
```

### POST /catalog/sold-out-products/resume-orders (no list: every sold-out product)

```http
POST http://127.0.0.1:23100/catalog/sold-out-products/resume-orders
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "productId": "3",
    "title": "قبعة تجريبية",
    "allowOutOfStockOrders": true
  }
]
```

