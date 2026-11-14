# Slug availability

Slugs are unique per store (D2103). The check never tells one business about another's slugs (D500).

### createCatalogProduct with an Arabic title: the slug follows it

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "input": {
      "title": "حذاء رياضي أحمر",
      "status": "active",
      "price": 4500
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
        "id": "14",
        "title": "حذاء رياضي أحمر",
        "slug": "حذاء-رياضي-أحمر",
        "status": "active",
        "price": 4500,
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
            "id": "23",
            "name": "حذاء رياضي أحمر",
            "sku": "",
            "price": 4500,
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
}
```

### The same Arabic slug in its store: taken

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $productId: ID) { catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }",
  "variables": {
    "slug": "حذاء-رياضي-أحمر"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogSlugAvailability": {
      "available": false,
      "slug": "حذاء-رياضي-أحمر"
    }
  }
}
```

### The product's own slug, while editing it: free

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $productId: ID) { catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }",
  "variables": {
    "slug": "حذاء-رياضي-أحمر",
    "productId": "14"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogSlugAvailability": {
      "available": true,
      "slug": "حذاء-رياضي-أحمر"
    }
  }
}
```

### GET /catalog/products/slug-availability (the Arabic slug, URL-encoded): taken

```http
GET http://127.0.0.1:23100/catalog/products/slug-availability?slug=%D8%AD%D8%B0%D8%A7%D8%A1-%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A-%D8%A3%D8%AD%D9%85%D8%B1
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "slug": "حذاء-رياضي-أحمر",
  "available": false
}
```

### The same slug in business B's store: free

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $productId: ID) { catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }",
  "variables": {
    "slug": "حذاء-رياضي-أحمر"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogSlugAvailability": {
      "available": true,
      "slug": "حذاء-رياضي-أحمر"
    }
  }
}
```

### Business B creates a product with slug ev-b-only-slug

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id title slug status price oldPrice sku barcode brandId tagIds highlightIds featuredAsset { id } assets { id } optionGroups { name values { name } } variants { id name sku price oldPrice barcode isHidden optionValues } settings { soldOut allowOutOfStockOrders } } } }",
  "variables": {
    "input": {
      "title": "Produit B",
      "slug": "ev-b-only-slug",
      "status": "active",
      "price": 1500
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
}
```

### Business A asks for B's slug: free in A's store (nothing about B leaks)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $productId: ID) { catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }",
  "variables": {
    "slug": "ev-b-only-slug"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogSlugAvailability": {
      "available": true,
      "slug": "ev-b-only-slug"
    }
  }
}
```

