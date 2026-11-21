# Products and variants

Products of the active store (D2100, D2101): Color × Size makes four variants named "<product> - <colour> / <size>" with SKUs `<sku>-1`…`-4` (AC1). Titles are written in the store's language (Arabic here) whatever the display language (D2112).

### createCatalogProduct: Color (red, blue) × Size (S, M)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "input": {
      "title": "قميص رياضي للأدلة",
      "status": "active",
      "price": 2500,
      "oldPrice": 3200,
      "sku": "EVTEE",
      "brandId": "<BRAND_KEPT>",
      "tagIds": [
        "<TAG_KEPT>"
      ],
      "highlightIds": [
        "<HIGHLIGHT>"
      ],
      "optionGroups": [
        {
          "name": "اللون",
          "values": [
            "أحمر",
            "أزرق"
          ]
        },
        {
          "name": "المقاس",
          "values": [
            "S",
            "M"
          ]
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createCatalogProduct": {
      "warnings": [],
      "product": {
        "id": "11",
        "title": "قميص رياضي للأدلة",
        "slug": "قميص-رياضي-للأدلة",
        "status": "active",
        "price": 2500,
        "oldPrice": 3200,
        "sku": "EVTEE",
        "barcode": null,
        "brandId": "<BRAND_KEPT>",
        "tagIds": [
          "<TAG_KEPT>"
        ],
        "highlightIds": [
          "<HIGHLIGHT>"
        ],
        "featuredAsset": null,
        "assets": [],
        "optionGroups": [
          {
            "name": "اللون",
            "values": [
              {
                "name": "أحمر"
              },
              {
                "name": "أزرق"
              }
            ]
          },
          {
            "name": "المقاس",
            "values": [
              {
                "name": "S"
              },
              {
                "name": "M"
              }
            ]
          }
        ],
        "variants": [
          {
            "id": "17",
            "name": "قميص رياضي للأدلة - أحمر / S",
            "sku": "EVTEE-1",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أحمر",
              "S"
            ]
          },
          {
            "id": "18",
            "name": "قميص رياضي للأدلة - أحمر / M",
            "sku": "EVTEE-2",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أحمر",
              "M"
            ]
          },
          {
            "id": "19",
            "name": "قميص رياضي للأدلة - أزرق / S",
            "sku": "EVTEE-3",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "S"
            ]
          },
          {
            "id": "20",
            "name": "قميص رياضي للأدلة - أزرق / M",
            "sku": "EVTEE-4",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "M"
            ]
          }
        ],
        "settings": {
          "soldOut": false,
          "allowOutOfStockOrders": true
        }
      }
    }
  }
}
```

### updateCatalogProduct: the second variant's price and barcode; the others keep theirs

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "id": "11",
    "input": {
      "variants": [
        {
          "id": "18",
          "price": 3100,
          "barcode": "6130000000017"
        }
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
      "warnings": [],
      "product": {
        "id": "11",
        "title": "قميص رياضي للأدلة",
        "slug": "قميص-رياضي-للأدلة",
        "status": "active",
        "price": 2500,
        "oldPrice": 3200,
        "sku": "EVTEE",
        "barcode": null,
        "brandId": "<BRAND_KEPT>",
        "tagIds": [
          "<TAG_KEPT>"
        ],
        "highlightIds": [
          "<HIGHLIGHT>"
        ],
        "featuredAsset": null,
        "assets": [],
        "optionGroups": [
          {
            "name": "اللون",
            "values": [
              {
                "name": "أحمر"
              },
              {
                "name": "أزرق"
              }
            ]
          },
          {
            "name": "المقاس",
            "values": [
              {
                "name": "S"
              },
              {
                "name": "M"
              }
            ]
          }
        ],
        "variants": [
          {
            "id": "17",
            "name": "قميص رياضي للأدلة - أحمر / S",
            "sku": "EVTEE-1",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أحمر",
              "S"
            ]
          },
          {
            "id": "18",
            "name": "قميص رياضي للأدلة - أحمر / M",
            "sku": "EVTEE-2",
            "price": 3100,
            "oldPrice": 3200,
            "barcode": "6130000000017",
            "isHidden": false,
            "optionValues": [
              "أحمر",
              "M"
            ]
          },
          {
            "id": "19",
            "name": "قميص رياضي للأدلة - أزرق / S",
            "sku": "EVTEE-3",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "S"
            ]
          },
          {
            "id": "20",
            "name": "قميص رياضي للأدلة - أزرق / M",
            "sku": "EVTEE-4",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "M"
            ]
          }
        ],
        "settings": {
          "soldOut": false,
          "allowOutOfStockOrders": true
        }
      }
    }
  }
}
```

### updateCatalogProduct: hiding one variant

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "id": "11",
    "input": {
      "variants": [
        {
          "id": "17",
          "isHidden": true
        }
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
      "warnings": [],
      "product": {
        "id": "11",
        "title": "قميص رياضي للأدلة",
        "slug": "قميص-رياضي-للأدلة",
        "status": "active",
        "price": 2500,
        "oldPrice": 3200,
        "sku": "EVTEE",
        "barcode": null,
        "brandId": "<BRAND_KEPT>",
        "tagIds": [
          "<TAG_KEPT>"
        ],
        "highlightIds": [
          "<HIGHLIGHT>"
        ],
        "featuredAsset": null,
        "assets": [],
        "optionGroups": [
          {
            "name": "اللون",
            "values": [
              {
                "name": "أحمر"
              },
              {
                "name": "أزرق"
              }
            ]
          },
          {
            "name": "المقاس",
            "values": [
              {
                "name": "S"
              },
              {
                "name": "M"
              }
            ]
          }
        ],
        "variants": [
          {
            "id": "17",
            "name": "قميص رياضي للأدلة - أحمر / S",
            "sku": "EVTEE-1",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": true,
            "optionValues": [
              "أحمر",
              "S"
            ]
          },
          {
            "id": "18",
            "name": "قميص رياضي للأدلة - أحمر / M",
            "sku": "EVTEE-2",
            "price": 3100,
            "oldPrice": 3200,
            "barcode": "6130000000017",
            "isHidden": false,
            "optionValues": [
              "أحمر",
              "M"
            ]
          },
          {
            "id": "19",
            "name": "قميص رياضي للأدلة - أزرق / S",
            "sku": "EVTEE-3",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "S"
            ]
          },
          {
            "id": "20",
            "name": "قميص رياضي للأدلة - أزرق / M",
            "sku": "EVTEE-4",
            "price": 2500,
            "oldPrice": 3200,
            "barcode": null,
            "isHidden": false,
            "optionValues": [
              "أزرق",
              "M"
            ]
          }
        ],
        "settings": {
          "soldOut": false,
          "allowOutOfStockOrders": true
        }
      }
    }
  }
}
```

### catalogProduct

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } }",
  "variables": {
    "id": "11"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogProduct": {
      "id": "11",
      "title": "قميص رياضي للأدلة",
      "slug": "قميص-رياضي-للأدلة",
      "status": "active",
      "price": 2500,
      "oldPrice": 3200,
      "sku": "EVTEE",
      "barcode": null,
      "brandId": "<BRAND_KEPT>",
      "tagIds": [
        "<TAG_KEPT>"
      ],
      "highlightIds": [
        "<HIGHLIGHT>"
      ],
      "featuredAsset": null,
      "assets": [],
      "optionGroups": [
        {
          "name": "اللون",
          "values": [
            {
              "name": "أحمر"
            },
            {
              "name": "أزرق"
            }
          ]
        },
        {
          "name": "المقاس",
          "values": [
            {
              "name": "S"
            },
            {
              "name": "M"
            }
          ]
        }
      ],
      "variants": [
        {
          "id": "17",
          "name": "قميص رياضي للأدلة - أحمر / S",
          "sku": "EVTEE-1",
          "price": 2500,
          "oldPrice": 3200,
          "barcode": null,
          "isHidden": true,
          "optionValues": [
            "أحمر",
            "S"
          ]
        },
        {
          "id": "18",
          "name": "قميص رياضي للأدلة - أحمر / M",
          "sku": "EVTEE-2",
          "price": 3100,
          "oldPrice": 3200,
          "barcode": "6130000000017",
          "isHidden": false,
          "optionValues": [
            "أحمر",
            "M"
          ]
        },
        {
          "id": "19",
          "name": "قميص رياضي للأدلة - أزرق / S",
          "sku": "EVTEE-3",
          "price": 2500,
          "oldPrice": 3200,
          "barcode": null,
          "isHidden": false,
          "optionValues": [
            "أزرق",
            "S"
          ]
        },
        {
          "id": "20",
          "name": "قميص رياضي للأدلة - أزرق / M",
          "sku": "EVTEE-4",
          "price": 2500,
          "oldPrice": 3200,
          "barcode": null,
          "isHidden": false,
          "optionValues": [
            "أزرق",
            "M"
          ]
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

### catalogProducts: All (the seed's five and the matrix product)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "tab": "all"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogProducts": {
      "totalItems": 6,
      "items": [
        {
          "id": "11",
          "title": "قميص رياضي للأدلة",
          "status": "active",
          "sku": "EVTEE",
          "brandId": "<BRAND_KEPT>",
          "tagIds": [
            "<TAG_KEPT>"
          ]
        },
        {
          "id": "5",
          "title": "حقيبة قماشية تجريبية",
          "status": "active",
          "sku": "DEMO-BAG",
          "brandId": null,
          "tagIds": []
        },
        {
          "id": "4",
          "title": "قارورة ماء تجريبية",
          "status": "active",
          "sku": "DEMO-BOTTLE",
          "brandId": "247397940216209408",
          "tagIds": [
            "247397940363010048"
          ]
        },
        {
          "id": "3",
          "title": "قبعة تجريبية",
          "status": "hidden",
          "sku": "DEMO-CAP",
          "brandId": null,
          "tagIds": []
        },
        {
          "id": "2",
          "title": "كوب سيراميك تجريبي",
          "status": "draft",
          "sku": "DEMO-MUG",
          "brandId": null,
          "tagIds": []
        },
        {
          "id": "1",
          "title": "قميص قطني تجريبي",
          "status": "active",
          "sku": "DEMO-TEE",
          "brandId": null,
          "tagIds": []
        }
      ]
    }
  }
}
```

### catalogProducts: Draft tab: drafts only

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "tab": "draft"
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
          "id": "2",
          "title": "كوب سيراميك تجريبي",
          "status": "draft",
          "sku": "DEMO-MUG",
          "brandId": null,
          "tagIds": []
        }
      ]
    }
  }
}
```

### catalogProducts: search by name

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "q": "قميص رياضي"
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
          "id": "11",
          "title": "قميص رياضي للأدلة",
          "status": "active",
          "sku": "EVTEE",
          "brandId": "<BRAND_KEPT>",
          "tagIds": [
            "<TAG_KEPT>"
          ]
        }
      ]
    }
  }
}
```

### catalogProducts: search by a variant SKU

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "q": "EVTEE-3"
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
          "id": "11",
          "title": "قميص رياضي للأدلة",
          "status": "active",
          "sku": "EVTEE",
          "brandId": "<BRAND_KEPT>",
          "tagIds": [
            "<TAG_KEPT>"
          ]
        }
      ]
    }
  }
}
```

### catalogProducts: search by a variant barcode

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "q": "6130000000017"
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
          "id": "11",
          "title": "قميص رياضي للأدلة",
          "status": "active",
          "sku": "EVTEE",
          "brandId": "<BRAND_KEPT>",
          "tagIds": [
            "<TAG_KEPT>"
          ]
        }
      ]
    }
  }
}
```

### catalogProducts: brand and tag filters combined

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id title status sku brandId tagIds } } }",
  "variables": {
    "options": {
      "brandId": "<BRAND_KEPT>",
      "tagId": "<TAG_KEPT>"
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
          "id": "11",
          "title": "قميص رياضي للأدلة",
          "status": "active",
          "sku": "EVTEE",
          "brandId": "<BRAND_KEPT>",
          "tagIds": [
            "<TAG_KEPT>"
          ]
        }
      ]
    }
  }
}
```

### POST /catalog/products: an old price below the price warns, it does not block (AC3)

```http
POST http://127.0.0.1:23100/catalog/products
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "منتج عبر REST",
  "status": "active",
  "price": 2500,
  "oldPrice": 2000,
  "sku": "EVREST"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "product": {
    "id": "12",
    "title": "منتج عبر REST",
    "slug": "منتج-عبر-rest",
    "description": null,
    "status": "active",
    "type": "physical",
    "oldPrice": 2000,
    "weight": null,
    "width": null,
    "height": null,
    "length": null,
    "brandId": null,
    "label": null,
    "cardCaption": null,
    "metaTitle": null,
    "metaDescription": null,
    "price": 2500,
    "sku": "EVREST",
    "barcode": null,
    "optionGroups": [],
    "createdAt": "2026-11-14T16:31:33.990Z",
    "updatedAt": "2026-11-14T16:31:33.990Z",
    "tagIds": [],
    "highlightIds": [],
    "collectionIds": [],
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
        "id": "21",
        "name": "منتج عبر REST",
        "sku": "EVREST",
        "price": 2500,
        "oldPrice": 2000,
        "barcode": null,
        "isHidden": false,
        "optionValues": [],
        "featuredAsset": null
      }
    ]
  },
  "warnings": [
    "catalog.old-price-below-price"
  ]
}
```

### GET /catalog/products/:id

```http
GET http://127.0.0.1:23100/catalog/products/12
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "12",
  "title": "منتج عبر REST",
  "slug": "منتج-عبر-rest",
  "description": null,
  "status": "active",
  "type": "physical",
  "oldPrice": 2000,
  "weight": null,
  "width": null,
  "height": null,
  "length": null,
  "brandId": null,
  "label": null,
  "cardCaption": null,
  "metaTitle": null,
  "metaDescription": null,
  "price": 2500,
  "sku": "EVREST",
  "barcode": null,
  "optionGroups": [],
  "createdAt": "2026-11-14T16:31:33.990Z",
  "updatedAt": "2026-11-14T16:31:33.990Z",
  "tagIds": [],
  "highlightIds": [],
  "collectionIds": [],
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
      "id": "21",
      "name": "منتج عبر REST",
      "sku": "EVREST",
      "price": 2500,
      "oldPrice": 2000,
      "barcode": null,
      "isHidden": false,
      "optionValues": [],
      "featuredAsset": null
    }
  ]
}
```

### PATCH /catalog/products/:id

```http
PATCH http://127.0.0.1:23100/catalog/products/12
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "label": "جديد",
  "cardCaption": "عرض محدود"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "product": {
    "id": "12",
    "title": "منتج عبر REST",
    "slug": "منتج-عبر-rest",
    "description": null,
    "status": "active",
    "type": "physical",
    "oldPrice": 2000,
    "weight": null,
    "width": null,
    "height": null,
    "length": null,
    "brandId": null,
    "label": "جديد",
    "cardCaption": "عرض محدود",
    "metaTitle": null,
    "metaDescription": null,
    "price": 2500,
    "sku": "EVREST",
    "barcode": null,
    "optionGroups": [],
    "createdAt": "2026-11-14T16:31:33.990Z",
    "updatedAt": "2026-11-14T16:31:34.558Z",
    "tagIds": [],
    "highlightIds": [],
    "collectionIds": [],
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
        "id": "21",
        "name": "منتج عبر REST",
        "sku": "EVREST",
        "price": 2500,
        "oldPrice": 2000,
        "barcode": null,
        "isHidden": false,
        "optionValues": [],
        "featuredAsset": null
      }
    ]
  },
  "warnings": [
    "catalog.old-price-below-price"
  ]
}
```

### POST /catalog/products/:id/status

```http
POST http://127.0.0.1:23100/catalog/products/12/status
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "status": "draft"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "12",
  "title": "منتج عبر REST",
  "slug": "منتج-عبر-rest",
  "description": null,
  "status": "draft",
  "type": "physical",
  "oldPrice": 2000,
  "weight": null,
  "width": null,
  "height": null,
  "length": null,
  "brandId": null,
  "label": "جديد",
  "cardCaption": "عرض محدود",
  "metaTitle": null,
  "metaDescription": null,
  "price": 2500,
  "sku": "EVREST",
  "barcode": null,
  "optionGroups": [],
  "createdAt": "2026-11-14T16:31:33.990Z",
  "updatedAt": "2026-11-14T16:31:34.813Z",
  "tagIds": [],
  "highlightIds": [],
  "collectionIds": [],
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
      "id": "21",
      "name": "منتج عبر REST",
      "sku": "EVREST",
      "price": 2500,
      "oldPrice": 2000,
      "barcode": null,
      "isHidden": false,
      "optionValues": [],
      "featuredAsset": null
    }
  ]
}
```

### GET /catalog/products?tab=draft&q=EVREST

```http
GET http://127.0.0.1:23100/catalog/products?tab=draft&q=EVREST
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "12",
      "title": "منتج عبر REST",
      "slug": "منتج-عبر-rest",
      "description": null,
      "status": "draft",
      "type": "physical",
      "oldPrice": 2000,
      "weight": null,
      "width": null,
      "height": null,
      "length": null,
      "brandId": null,
      "label": "جديد",
      "cardCaption": "عرض محدود",
      "metaTitle": null,
      "metaDescription": null,
      "price": 2500,
      "sku": "EVREST",
      "barcode": null,
      "optionGroups": [],
      "createdAt": "2026-11-14T16:31:33.990Z",
      "updatedAt": "2026-11-14T16:31:34.813Z",
      "tagIds": [],
      "highlightIds": [],
      "collectionIds": [],
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
          "id": "21",
          "name": "منتج عبر REST",
          "sku": "EVREST",
          "price": 2500,
          "oldPrice": 2000,
          "barcode": null,
          "isHidden": false,
          "optionValues": [],
          "featuredAsset": null
        }
      ]
    }
  ],
  "totalItems": 1
}
```

### DELETE /catalog/products/:id

```http
DELETE http://127.0.0.1:23100/catalog/products/12
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### GET /catalog/products/:id after the delete: 404

```http
GET http://127.0.0.1:23100/catalog/products/12
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "catalog.product-not-found",
  "message": "Product not found.",
  "path": "/catalog/products/12"
}
```

### setCatalogProductStatus: Hidden

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $status: CatalogProductStatus!) { setCatalogProductStatus(id: $id, status: $status) { id title status } }",
  "variables": {
    "id": "13",
    "status": "hidden"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setCatalogProductStatus": {
      "id": "13",
      "title": "منتج مؤقت",
      "status": "hidden"
    }
  }
}
```

### deleteCatalogProduct

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!) { deleteCatalogProduct(id: $id) }",
  "variables": {
    "id": "13"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteCatalogProduct": true
  }
}
```

### catalogProduct after the delete: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } }",
  "variables": {
    "id": "13"
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

