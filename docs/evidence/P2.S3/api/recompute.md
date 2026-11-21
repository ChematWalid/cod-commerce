# Membership follows product changes

Every product write publishes `product.changed`; the worker recomputes the store's automatic collections under the store lock (D2334). The reads after a change poll until the worker has caught up (at most 120s); the transcript shows the first read that holds.

### Before: Tag is any of [new] has no product

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "11",
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
      "totalItems": 0,
      "items": []
    }
  }
}
```

### updateCatalogProduct: p3 gets the new tag

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { product { id title tagIds variants { id price isHidden optionValues } } } }",
  "variables": {
    "id": "13",
    "input": {
      "tagIds": [
        "<TAG_NEW>"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateCatalogProduct": {
      "product": {
        "id": "13",
        "title": "قميص قطني أحمر",
        "tagIds": [
          "<TAG_NEW>"
        ],
        "variants": [
          {
            "id": "20",
            "price": 1500,
            "isHidden": false,
            "optionValues": [
              "أحمر"
            ]
          }
        ]
      }
    }
  }
}
```

### After: p3 is a member

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "11",
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
      "totalItems": 1,
      "items": [
        {
          "productId": "13",
          "title": "قميص قطني أحمر",
          "status": "active",
          "price": 1500
        }
      ]
    }
  }
}
```

### GET /catalog/collections/:id/products: the same

```http
GET http://127.0.0.1:23100/catalog/collections/11/products
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "productId": "13",
      "title": "قميص قطني أحمر",
      "status": "active",
      "price": 1500
    }
  ],
  "totalItems": 1
}
```

### Before: Price 1000-2000 holds p3 (1500) and p5 (1200)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "12",
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
      "totalItems": 5,
      "items": [
        {
          "productId": "15",
          "title": "قبعة صيفية",
          "status": "active",
          "price": 1200
        },
        {
          "productId": "13",
          "title": "قميص قطني أحمر",
          "status": "active",
          "price": 1500
        },
        {
          "productId": "5",
          "title": "حقيبة قماشية تجريبية",
          "status": "active",
          "price": 1800
        },
        {
          "productId": "4",
          "title": "قارورة ماء تجريبية",
          "status": "active",
          "price": 1500
        },
        {
          "productId": "3",
          "title": "قبعة تجريبية",
          "status": "hidden",
          "price": 1200
        }
      ]
    }
  }
}
```

### PATCH /catalog/products/:id: p3's price raised to 2500

```http
PATCH http://127.0.0.1:23100/catalog/products/13
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "variants": [
    {
      "id": "20",
      "price": 2500
    }
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "product": {
    "id": "13",
    "title": "قميص قطني أحمر",
    "slug": "قميص-قطني-أحمر",
    "description": null,
    "status": "active",
    "type": "physical",
    "oldPrice": null,
    "weight": null,
    "width": null,
    "height": null,
    "length": null,
    "brandId": null,
    "label": null,
    "cardCaption": null,
    "metaTitle": null,
    "metaDescription": null,
    "price": 1500,
    "sku": null,
    "barcode": null,
    "optionGroups": [
      {
        "id": "7",
        "name": "اللون",
        "values": [
          {
            "id": "12",
            "name": "أحمر"
          }
        ]
      }
    ],
    "createdAt": "2026-11-21T03:47:45.457Z",
    "updatedAt": "2026-11-21T03:48:02.881Z",
    "tagIds": [
      "<TAG_NEW>"
    ],
    "highlightIds": [],
    "collectionIds": [
      "2"
    ],
    "settings": {
      "nameInDelivery": null,
      "isFragile": false,
      "allowParcelOpening": false,
      "allowOutOfStockOrders": true,
      "soldOut": false,
      "quantityRules": {
        "enabled": false,
        "min": 1,
        "step": 1
      },
      "orderManagerIds": [],
      "customAttributes": []
    },
    "featuredAsset": null,
    "assets": [],
    "variants": [
      {
        "id": "20",
        "name": "قميص قطني أحمر - أحمر",
        "sku": "",
        "price": 2500,
        "oldPrice": null,
        "barcode": null,
        "isHidden": false,
        "optionValues": [
          "أحمر"
        ],
        "featuredAsset": null
      }
    ]
  },
  "warnings": []
}
```

### After: p3 has left, p5 stays

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "12",
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
      "totalItems": 4,
      "items": [
        {
          "productId": "15",
          "title": "قبعة صيفية",
          "status": "active",
          "price": 1200
        },
        {
          "productId": "5",
          "title": "حقيبة قماشية تجريبية",
          "status": "active",
          "price": 1800
        },
        {
          "productId": "4",
          "title": "قارورة ماء تجريبية",
          "status": "active",
          "price": 1500
        },
        {
          "productId": "3",
          "title": "قبعة تجريبية",
          "status": "hidden",
          "price": 1200
        }
      ]
    }
  }
}
```

### GET /catalog/collections/:id/products: the same

```http
GET http://127.0.0.1:23100/catalog/collections/12/products
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "productId": "15",
      "title": "قبعة صيفية",
      "status": "active",
      "price": 1200
    },
    {
      "productId": "5",
      "title": "حقيبة قماشية تجريبية",
      "status": "active",
      "price": 1800
    },
    {
      "productId": "4",
      "title": "قارورة ماء تجريبية",
      "status": "active",
      "price": 1500
    },
    {
      "productId": "3",
      "title": "قبعة تجريبية",
      "status": "hidden",
      "price": 1200
    }
  ],
  "totalItems": 4
}
```

