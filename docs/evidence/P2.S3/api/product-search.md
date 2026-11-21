# Product search of the manual editor

The Add products dialog searches the active store's products by title (D2321); it needs `catalog.collections.edit`. Business B holds a product whose title also contains جري.

### storeCollectionProductSearch (جري) in A's store: p1, p2, p4, never B's product

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: StoreCollectionProductSearchInput) { storeCollectionProductSearch(options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "options": {
      "search": "جري",
      "take": 20
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionProductSearch": {
      "totalItems": 8,
      "items": [
        {
          "productId": "14",
          "title": "حقيبة جري",
          "status": "active",
          "price": 6000
        },
        {
          "productId": "12",
          "title": "حذاء جري أزرق",
          "status": "active",
          "price": 2800
        },
        {
          "productId": "11",
          "title": "حذاء جري أحمر",
          "status": "active",
          "price": 2500
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
        },
        {
          "productId": "2",
          "title": "كوب سيراميك تجريبي",
          "status": "draft",
          "price": 900
        },
        {
          "productId": "1",
          "title": "قميص قطني تجريبي",
          "status": "active",
          "price": 2500
        }
      ]
    }
  }
}
```

### GET /catalog/collections/product-search?search=جري (URL-encoded)

```http
GET http://127.0.0.1:23100/catalog/collections/product-search?search=%D8%AC%D8%B1%D9%8A&take=20
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "totalItems": 8,
  "items": [
    {
      "productId": "14",
      "title": "حقيبة جري",
      "status": "active",
      "price": 6000
    },
    {
      "productId": "12",
      "title": "حذاء جري أزرق",
      "status": "active",
      "price": 2800
    },
    {
      "productId": "11",
      "title": "حذاء جري أحمر",
      "status": "active",
      "price": 2500
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
    },
    {
      "productId": "2",
      "title": "كوب سيراميك تجريبي",
      "status": "draft",
      "price": 900
    },
    {
      "productId": "1",
      "title": "قميص قطني تجريبي",
      "status": "active",
      "price": 2500
    }
  ]
}
```

### The same search in business B's store: B's product only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: StoreCollectionProductSearchInput) { storeCollectionProductSearch(options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "options": {
      "search": "جري",
      "take": 20
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionProductSearch": {
      "totalItems": 1,
      "items": [
        {
          "productId": "16",
          "title": "حذاء جري من المتجر ب",
          "status": "active",
          "price": 2500
        }
      ]
    }
  }
}
```

