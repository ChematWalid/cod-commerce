# Packs

A Pack product groups other products of its store (D2202): priced as the sum of its components with a discount, or at a fixed price; weighed as their sum or fixed. Reads need `catalog.products.view`, writes and the preview `catalog.products.edit`. The stored price of the pack product follows each save.

### createCatalogProduct with type pack (catalog, D2201)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id sku price type } } }",
  "variables": {
    "input": {
      "title": "حزمة القميص والقبعة",
      "status": "active",
      "type": "pack",
      "price": 0,
      "sku": "EVPACK"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"61-RmfoQB45b3ouOltTR/4L8g/Rpto"

{
  "data": {
    "createCatalogProduct": {
      "product": {
        "id": "13",
        "sku": "EVPACK",
        "price": 0,
        "type": "pack"
      }
    }
  }
}
```

### previewCatalogPack: (1 500 + 2 000) × 90 % = 3 150 DZD, 300 + 200 g; nothing saved

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CatalogPackInput!) { previewCatalogPack(input: $input) { price weightGrams sharedValues { value price } } }",
  "variables": {
    "input": {
      "packPricingMode": "components_sum",
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packWeightMode": "components_sum",
      "components": [
        {
          "productId": "11",
          "quantity": 1
        },
        {
          "productId": "12",
          "quantity": 1
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"53-C5KWApAUJ0aA2PVdAJpqkt+MxoY"

{
  "data": {
    "previewCatalogPack": {
      "price": 3150,
      "weightGrams": 500,
      "sharedValues": []
    }
  }
}
```

### saveCatalogPack: the pack's components, discount and modes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($productId: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $productId, input: $input) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "13",
    "input": {
      "packPricingMode": "components_sum",
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packWeightMode": "components_sum",
      "components": [
        {
          "productId": "11",
          "quantity": 1
        },
        {
          "productId": "12",
          "quantity": 1
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1b3-hAuc4ruyTHjwn0s27+SDWx6MGuE"

{
  "data": {
    "saveCatalogPack": {
      "productId": "13",
      "status": "ok",
      "packPricingMode": "components_sum",
      "packFixedPrice": null,
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packSharedOption": null,
      "packWeightMode": "components_sum",
      "packFixedWeightGrams": null,
      "components": [
        {
          "productId": "11",
          "variantId": null,
          "quantity": 1
        },
        {
          "productId": "12",
          "variantId": null,
          "quantity": 1
        }
      ],
      "price": 3150,
      "weightGrams": 500
    }
  }
}
```

### catalogPack

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($productId: ID!) { catalogPack(productId: $productId) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "13"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1af-e/EIWl2b4Y2tvyH/jiQMBJlqgTk"

{
  "data": {
    "catalogPack": {
      "productId": "13",
      "status": "ok",
      "packPricingMode": "components_sum",
      "packFixedPrice": null,
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packSharedOption": null,
      "packWeightMode": "components_sum",
      "packFixedWeightGrams": null,
      "components": [
        {
          "productId": "11",
          "variantId": null,
          "quantity": 1
        },
        {
          "productId": "12",
          "variantId": null,
          "quantity": 1
        }
      ],
      "price": 3150,
      "weightGrams": 500
    }
  }
}
```

### catalogProduct of the pack: its stored price is the pack's

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { catalogProduct(id: $id) { id title status price brandId tagIds type } }",
  "variables": {
    "id": "13"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"9f-0ZcGGIIfRRudb2Tr40O0cMI3QeY"

{
  "data": {
    "catalogProduct": {
      "id": "13",
      "title": "حزمة القميص والقبعة",
      "status": "active",
      "price": 3150,
      "brandId": null,
      "tagIds": [],
      "type": "pack"
    }
  }
}
```

### GET /catalog/packs/:productId

```http
GET http://127.0.0.1:23100/catalog/packs/13
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"195-mBhnkEmL+3/WUyy/UpurHfeMtJ8"

{
  "productId": "13",
  "status": "ok",
  "packPricingMode": "components_sum",
  "packFixedPrice": null,
  "packDiscountType": "percent",
  "packDiscountValue": 10,
  "packVariantMode": "per_component",
  "packSharedOption": null,
  "packWeightMode": "components_sum",
  "packFixedWeightGrams": null,
  "components": [
    {
      "productId": "11",
      "variantId": null,
      "quantity": 1
    },
    {
      "productId": "12",
      "variantId": null,
      "quantity": 1
    }
  ],
  "price": 3150,
  "weightGrams": 500
}
```

### POST /catalog/packs/preview: a fixed price and weight

```http
POST http://127.0.0.1:23100/catalog/packs/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "packPricingMode": "fixed",
  "packFixedPrice": 2999,
  "packVariantMode": "per_component",
  "packWeightMode": "fixed",
  "packFixedWeightGrams": 450,
  "components": [
    {
      "productId": "11",
      "quantity": 2
    },
    {
      "productId": "12",
      "quantity": 1
    }
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"32-SdHsE6eGE18I6CLlK9EMtFWuSVE"

{
  "price": 2999,
  "weightGrams": 450,
  "sharedValues": []
}
```

### PUT /catalog/packs/:productId: the fixed pack

```http
PUT http://127.0.0.1:23100/catalog/packs/13
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "packPricingMode": "fixed",
  "packFixedPrice": 2999,
  "packVariantMode": "per_component",
  "packWeightMode": "fixed",
  "packFixedWeightGrams": 450,
  "components": [
    {
      "productId": "11",
      "quantity": 2
    },
    {
      "productId": "12",
      "quantity": 1
    }
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"17f-bMzSlNjTXfQ6jF0P5MoTQT5S4aY"

{
  "productId": "13",
  "status": "ok",
  "packPricingMode": "fixed",
  "packFixedPrice": 2999,
  "packDiscountType": null,
  "packDiscountValue": null,
  "packVariantMode": "per_component",
  "packSharedOption": null,
  "packWeightMode": "fixed",
  "packFixedWeightGrams": 450,
  "components": [
    {
      "productId": "11",
      "variantId": null,
      "quantity": 2
    },
    {
      "productId": "12",
      "variantId": null,
      "quantity": 1
    }
  ],
  "price": 2999,
  "weightGrams": 450
}
```

### saveCatalogPack: back to 10 % off the components (the pack the screens show)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($productId: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $productId, input: $input) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "13",
    "input": {
      "packPricingMode": "components_sum",
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packWeightMode": "components_sum",
      "components": [
        {
          "productId": "11",
          "quantity": 1
        },
        {
          "productId": "12",
          "quantity": 1
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"1b3-hAuc4ruyTHjwn0s27+SDWx6MGuE"

{
  "data": {
    "saveCatalogPack": {
      "productId": "13",
      "status": "ok",
      "packPricingMode": "components_sum",
      "packFixedPrice": null,
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packSharedOption": null,
      "packWeightMode": "components_sum",
      "packFixedWeightGrams": null,
      "components": [
        {
          "productId": "11",
          "variantId": null,
          "quantity": 1
        },
        {
          "productId": "12",
          "variantId": null,
          "quantity": 1
        }
      ],
      "price": 3150,
      "weightGrams": 500
    }
  }
}
```

### saveCatalogPack on a physical product: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($productId: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $productId, input: $input) { productId status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams } }",
  "variables": {
    "productId": "11",
    "input": {
      "packPricingMode": "components_sum",
      "packDiscountType": "percent",
      "packDiscountValue": 10,
      "packVariantMode": "per_component",
      "packWeightMode": "components_sum",
      "components": [
        {
          "productId": "11",
          "quantity": 1
        },
        {
          "productId": "12",
          "quantity": 1
        }
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"ac-/uaSQfEJXQ7IKnWOVgeSU4Ao9ag"

{
  "errors": [
    {
      "message": "This product is not a pack.",
      "locations": [
        {
          "line": 1,
          "column": 57
        }
      ],
      "path": [
        "saveCatalogPack"
      ],
      "extensions": {
        "code": "packs.not-a-pack"
      }
    }
  ],
  "data": null
}
```

### POST /catalog/packs/preview with a pack as a component: refused

```http
POST http://127.0.0.1:23100/catalog/packs/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "packPricingMode": "components_sum",
  "packVariantMode": "per_component",
  "packWeightMode": "components_sum",
  "components": [
    {
      "productId": "13",
      "quantity": 1
    },
    {
      "productId": "12",
      "quantity": 1
    }
  ]
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
etag: W/"7d-GNgklZdKHj199KwlM9fn1tPY37Y"

{
  "statusCode": 400,
  "code": "packs.component-is-pack",
  "message": "A pack cannot contain a pack.",
  "path": "/catalog/packs/preview"
}
```

