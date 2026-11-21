# Automatic collections

A rule is All (every condition) or Any (at least one) over Tag, Brand, Price, On sale, Title and option conditions (D2303). Price and option conditions read visible variants only. Products of this transcript: p1 `11` حذاء جري أحمر (2500, promo tag, red and blue), p2 `12` حذاء جري أزرق (2800, promo, blue), p3 `13` قميص قطني أحمر (1500, red), p4 `14` حقيبة جري (6000, promo, no colour), p5 `15` قبعة صيفية (1200, red hidden, green).

### AC1: createStoreCollection, All of Tag is any of [promo], Price 2000-5000, اللون is any of [أحمر]

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "أحذية ترويجية حمراء",
      "featuredAssetId": "1",
      "visible": true,
      "position": 2,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "values": [
              "<TAG_PROMO>"
            ]
          },
          {
            "field": "price",
            "operator": "between",
            "min": 2000,
            "max": 5000
          },
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_any_of",
            "values": [
              "أحمر"
            ]
          }
        ]
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStoreCollection": {
      "id": "6",
      "title": "أحذية ترويجية حمراء",
      "slug": "أحذية-ترويجية-حمراء",
      "description": null,
      "featuredAsset": {
        "id": "1"
      },
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "option": null,
            "values": [
              "<TAG_PROMO>"
            ],
            "min": null,
            "max": null,
            "value": null
          },
          {
            "field": "price",
            "operator": "between",
            "option": null,
            "values": null,
            "min": 2000,
            "max": 5000,
            "value": null
          },
          {
            "field": "option",
            "operator": "is_any_of",
            "option": "اللون",
            "values": [
              "أحمر"
            ],
            "min": null,
            "max": null,
            "value": null
          }
        ]
      },
      "visible": true,
      "position": 2,
      "productCount": 1
    }
  }
}
```

### storeCollectionProducts of the All collection: p1 only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "6",
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
          "productId": "11",
          "title": "حذاء جري أحمر",
          "status": "active",
          "price": 2500
        }
      ]
    }
  }
}
```

### AC1: POST /catalog/collections, the same three conditions with Any

```http
POST http://127.0.0.1:23100/catalog/collections
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "أي شرط",
  "visible": true,
  "position": 3,
  "mode": "automatic",
  "rule": {
    "version": 1,
    "match": "any",
    "conditions": [
      {
        "field": "tag",
        "operator": "is_any_of",
        "values": [
          "<TAG_PROMO>"
        ]
      },
      {
        "field": "price",
        "operator": "between",
        "min": 2000,
        "max": 5000
      },
      {
        "field": "option",
        "option": "اللون",
        "operator": "is_any_of",
        "values": [
          "أحمر"
        ]
      }
    ]
  }
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "title": "أي شرط",
  "slug": "أي-شرط",
  "description": null,
  "featuredAsset": null,
  "id": "7",
  "mode": "automatic",
  "rule": {
    "version": 1,
    "match": "any",
    "conditions": [
      {
        "option": null,
        "values": [
          "<TAG_PROMO>"
        ],
        "min": null,
        "max": null,
        "value": null,
        "field": "tag",
        "operator": "is_any_of"
      },
      {
        "option": null,
        "values": null,
        "min": 2000,
        "max": 5000,
        "value": null,
        "field": "price",
        "operator": "between"
      },
      {
        "option": "اللون",
        "values": [
          "أحمر"
        ],
        "min": null,
        "max": null,
        "value": null,
        "field": "option",
        "operator": "is_any_of"
      }
    ]
  },
  "visible": true,
  "position": 3,
  "productCount": 5
}
```

### GET /catalog/collections/:id/products of the Any collection: p1-p4 and the seed's shirt (price in range), not p5 (its only red variant is hidden, 1200 is out of range, no promo tag)

```http
GET http://127.0.0.1:23100/catalog/collections/7/products?take=50
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "productId": "14",
      "title": "حقيبة جري",
      "status": "active",
      "price": 6000
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
    },
    {
      "productId": "11",
      "title": "حذاء جري أحمر",
      "status": "active",
      "price": 2500
    },
    {
      "productId": "1",
      "title": "قميص قطني تجريبي",
      "status": "active",
      "price": 2500
    }
  ],
  "totalItems": 5
}
```

### AC2: createStoreCollection, Tag is not [promo]

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "بدون ترويج",
      "visible": false,
      "position": 5,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_not",
            "values": [
              "<TAG_PROMO>"
            ]
          }
        ]
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStoreCollection": {
      "id": "8",
      "title": "بدون ترويج",
      "slug": "بدون-ترويج",
      "description": null,
      "featuredAsset": null,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_not",
            "option": null,
            "values": [
              "<TAG_PROMO>"
            ],
            "min": null,
            "max": null,
            "value": null
          }
        ]
      },
      "visible": false,
      "position": 5,
      "productCount": 7
    }
  }
}
```

### storeCollectionProducts of Tag is not [promo]: p3 and p5 with the seed's products, none of p1, p2, p4

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!, $options: StoreCollectionProductListInput) { storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } } }",
  "variables": {
    "id": "8",
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
      "totalItems": 7,
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

### AC3: p5's red variant is hidden

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title variants { id isHidden optionValues } } }",
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
      "title": "قبعة صيفية",
      "variants": [
        {
          "id": "22",
          "isHidden": true,
          "optionValues": [
            "أحمر"
          ]
        },
        {
          "id": "23",
          "isHidden": false,
          "optionValues": [
            "أخضر"
          ]
        }
      ]
    }
  }
}
```

### AC3: POST /catalog/collections, اللون is any of [أحمر]

```http
POST http://127.0.0.1:23100/catalog/collections
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "كل الأحمر",
  "visible": true,
  "position": 4,
  "mode": "automatic",
  "rule": {
    "version": 1,
    "match": "all",
    "conditions": [
      {
        "field": "option",
        "option": "اللون",
        "operator": "is_any_of",
        "values": [
          "أحمر"
        ]
      }
    ]
  }
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "title": "كل الأحمر",
  "slug": "كل-الأحمر",
  "description": null,
  "featuredAsset": null,
  "id": "9",
  "mode": "automatic",
  "rule": {
    "version": 1,
    "match": "all",
    "conditions": [
      {
        "option": "اللون",
        "values": [
          "أحمر"
        ],
        "min": null,
        "max": null,
        "value": null,
        "field": "option",
        "operator": "is_any_of"
      }
    ]
  },
  "visible": true,
  "position": 4,
  "productCount": 3
}
```

### GET /catalog/collections/:id/products: p1 and p3, not p5 (red only on a hidden variant) nor p2 (blue)

```http
GET http://127.0.0.1:23100/catalog/collections/9/products?take=50
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
    },
    {
      "productId": "11",
      "title": "حذاء جري أحمر",
      "status": "active",
      "price": 2500
    },
    {
      "productId": "1",
      "title": "قميص قطني تجريبي",
      "status": "active",
      "price": 2500
    }
  ],
  "totalItems": 3
}
```

### AC3: createStoreCollection, اللون is not [أحمر]

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "بلا أحمر",
      "visible": false,
      "position": 7,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_not",
            "values": [
              "أحمر"
            ]
          }
        ]
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStoreCollection": {
      "id": "10",
      "title": "بلا أحمر",
      "slug": "بلا-أحمر",
      "description": null,
      "featuredAsset": null,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "option",
            "operator": "is_not",
            "option": "اللون",
            "values": [
              "أحمر"
            ],
            "min": null,
            "max": null,
            "value": null
          }
        ]
      },
      "visible": false,
      "position": 7,
      "productCount": 7
    }
  }
}
```

### GET /catalog/collections/:id/products of اللون is not [أحمر]: p5 (its red variant is hidden), p4 (no colour) and p2 (blue), neither p1 nor p3

```http
GET http://127.0.0.1:23100/catalog/collections/10/products?take=50
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
    }
  ],
  "totalItems": 7
}
```

### createStoreCollection with a price range whose minimum is above its maximum: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "قاعدة خاطئة",
      "visible": true,
      "position": 6,
      "mode": "automatic",
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "price",
            "operator": "between",
            "min": 5000,
            "max": 1000
          }
        ]
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The conditions are not valid.",
      "locations": [
        {
          "line": 1,
          "column": 50
        }
      ],
      "path": [
        "createStoreCollection"
      ],
      "extensions": {
        "code": "collections.rule-invalid"
      }
    }
  ],
  "data": null
}
```

### POST /catalog/collections with the same rule: 400

```http
POST http://127.0.0.1:23100/catalog/collections
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "قاعدة خاطئة",
  "visible": true,
  "position": 6,
  "mode": "automatic",
  "rule": {
    "version": 1,
    "match": "all",
    "conditions": [
      {
        "field": "price",
        "operator": "between",
        "min": 5000,
        "max": 1000
      }
    ]
  }
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8

{
  "statusCode": 400,
  "code": "collections.rule-invalid",
  "message": "The conditions are not valid.",
  "path": "/catalog/collections"
}
```

