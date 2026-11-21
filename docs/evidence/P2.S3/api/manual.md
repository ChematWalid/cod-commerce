# Manual collections

A manual collection holds the products the merchant picks, in the order picked (D2302); setting them replaces the list. An automatic collection takes no hand-picked products.

### setStoreCollectionProducts: p3, p1, p2

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id mode productCount } }",
  "variables": {
    "id": "2",
    "productIds": [
      "13",
      "11",
      "12"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setStoreCollectionProducts": {
      "id": "2",
      "mode": "manual",
      "productCount": 3
    }
  }
}
```

### storeCollectionProducts: in the order set

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "2",
    "options": {
      "take": 50
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionProducts": {
      "totalItems": 3,
      "items": [
        {
          "productId": "13",
          "title": "قميص قطني أحمر",
          "status": "active",
          "price": 1500
        },
        {
          "productId": "11",
          "title": "حذاء جري أحمر",
          "status": "active",
          "price": 2500
        },
        {
          "productId": "12",
          "title": "حذاء جري أزرق",
          "status": "active",
          "price": 2800
        }
      ]
    }
  }
}
```

### PUT /catalog/collections/:id/products: reordered p1, p3, p2

```http
PUT http://127.0.0.1:23100/catalog/collections/2/products
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "11",
    "13",
    "12"
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "title": "تخفيضات الصيف",
  "slug": "تخفيضات-الصيف",
  "description": "مختارات الصيف بأسعار مخفضة",
  "featuredAsset": {
    "id": "1",
    "preview": "http://127.0.0.1:23100/assets/b/249734040897200128/s/<STORE_DEMO>/preview/c0/c0ae59d316cfce0b4d5a31d8855ca62a__preview.png"
  },
  "id": "2",
  "mode": "manual",
  "rule": null,
  "visible": true,
  "position": 0,
  "productCount": 3
}
```

### GET /catalog/collections/:id/products: the new order

```http
GET http://127.0.0.1:23100/catalog/collections/2/products
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "productId": "11",
      "title": "حذاء جري أحمر",
      "status": "active",
      "price": 2500
    },
    {
      "productId": "13",
      "title": "قميص قطني أحمر",
      "status": "active",
      "price": 1500
    },
    {
      "productId": "12",
      "title": "حذاء جري أزرق",
      "status": "active",
      "price": 2800
    }
  ],
  "totalItems": 3
}
```

### setStoreCollectionProducts on an automatic collection: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id mode productCount } }",
  "variables": {
    "id": "6",
    "productIds": [
      "12"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This collection gets its products from its conditions.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setStoreCollectionProducts"
      ],
      "extensions": {
        "code": "collections.not-manual"
      }
    }
  ],
  "data": null
}
```

### PUT /catalog/collections/<automatic>/products: 409

```http
PUT http://127.0.0.1:23100/catalog/collections/6/products
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "12"
  ]
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "collections.not-manual",
  "message": "This collection gets its products from its conditions.",
  "path": "/catalog/collections/6/products"
}
```

### setStoreCollectionProducts with business B's product: not found, nothing changes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id mode productCount } }",
  "variables": {
    "id": "2",
    "productIds": [
      "11",
      "16"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "A product was not found in this store.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setStoreCollectionProducts"
      ],
      "extensions": {
        "code": "collections.product-not-found"
      }
    }
  ],
  "data": null
}
```

### PUT /catalog/collections/:id/products with B's product: 404

```http
PUT http://127.0.0.1:23100/catalog/collections/2/products
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "productIds": [
    "16"
  ]
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.product-not-found",
  "message": "A product was not found in this store.",
  "path": "/catalog/collections/2/products"
}
```

