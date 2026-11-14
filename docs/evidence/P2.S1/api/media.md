# The media library

The business's images (AC7, D2113): PNG, JPEG, GIF or WebP by their bytes, at most 5 242 880 bytes. The upload is a GraphQL multipart request only (D2102).

### uploadCatalogMedia: a PNG

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data; boundary=[…]
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]
apollo-require-preflight: true

operations: {"query":"mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId url previewUrl mimeType width height fileSize } }","variables":{"file":null}}
map: {"0":["variables.file"]}
0: red.png (image/png, 220 bytes)

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "uploadCatalogMedia": {
      "id": "<MEDIA_RED>",
      "assetId": "1",
      "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/eb/ebde13a519e911354940acc07593eb57.png",
      "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/eb/ebde13a519e911354940acc07593eb57__preview.png",
      "mimeType": "image/png",
      "width": 96,
      "height": 96,
      "fileSize": 220
    }
  }
}
```

### catalogMedia

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogMediaListInput) { catalogMedia(options: $options) { totalItems items { id assetId url previewUrl mimeType width height fileSize } } }",
  "variables": {
    "options": {
      "take": 10
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogMedia": {
      "totalItems": 4,
      "items": [
        {
          "id": "<MEDIA_GREY>",
          "assetId": "4",
          "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/dd/dd39a146d8a299f608fb91ffe1ce104e.png",
          "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/dd/dd39a146d8a299f608fb91ffe1ce104e__preview.png",
          "mimeType": "image/png",
          "width": 96,
          "height": 96,
          "fileSize": 266
        },
        {
          "id": "<MEDIA_GREEN>",
          "assetId": "3",
          "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/cb/cbe1aaa17d381d4daf41036f1fb5f63a.png",
          "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/cb/cbe1aaa17d381d4daf41036f1fb5f63a__preview.png",
          "mimeType": "image/png",
          "width": 96,
          "height": 96,
          "fileSize": 221
        },
        {
          "id": "<MEDIA_BLUE>",
          "assetId": "2",
          "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/7e/7e411e8b809ae99965552346480a14c1.png",
          "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/7e/7e411e8b809ae99965552346480a14c1__preview.png",
          "mimeType": "image/png",
          "width": 96,
          "height": 96,
          "fileSize": 221
        },
        {
          "id": "<MEDIA_RED>",
          "assetId": "1",
          "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/eb/ebde13a519e911354940acc07593eb57.png",
          "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/eb/ebde13a519e911354940acc07593eb57__preview.png",
          "mimeType": "image/png",
          "width": 96,
          "height": 96,
          "fileSize": 220
        }
      ]
    }
  }
}
```

### uploadCatalogMedia: an SVG, refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data; boundary=[…]
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]
apollo-require-preflight: true

operations: {"query":"mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId url previewUrl mimeType width height fileSize } }","variables":{"file":null}}
map: {"0":["variables.file"]}
0: image.svg (image/svg+xml, 99 bytes)

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Only PNG, JPEG, GIF and WebP images can be uploaded.",
      "locations": [
        {
          "line": 1,
          "column": 29
        }
      ],
      "path": [
        "uploadCatalogMedia"
      ],
      "extensions": {
        "code": "catalog.media-type"
      }
    }
  ],
  "data": null
}
```

### uploadCatalogMedia: a JPEG of 5 242 881 bytes, refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data; boundary=[…]
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]
apollo-require-preflight: true

operations: {"query":"mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId url previewUrl mimeType width height fileSize } }","variables":{"file":null}}
map: {"0":["variables.file"]}
0: big.jpg (image/jpeg, 5242881 bytes)

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The image is larger than 5 MB.",
      "locations": [
        {
          "line": 1,
          "column": 29
        }
      ],
      "path": [
        "uploadCatalogMedia"
      ],
      "extensions": {
        "code": "catalog.media-too-large"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/media: the refused files stored nothing

```http
GET http://127.0.0.1:23100/catalog/media?take=10
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEDIA_GREY>",
      "assetId": "4",
      "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/dd/dd39a146d8a299f608fb91ffe1ce104e.png",
      "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/dd/dd39a146d8a299f608fb91ffe1ce104e__preview.png",
      "mimeType": "image/png",
      "width": 96,
      "height": 96,
      "fileSize": 266,
      "createdAt": "2026-11-14T14:52:16.977Z"
    },
    {
      "id": "<MEDIA_GREEN>",
      "assetId": "3",
      "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/cb/cbe1aaa17d381d4daf41036f1fb5f63a.png",
      "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/cb/cbe1aaa17d381d4daf41036f1fb5f63a__preview.png",
      "mimeType": "image/png",
      "width": 96,
      "height": 96,
      "fileSize": 221,
      "createdAt": "2026-11-14T14:52:16.683Z"
    },
    {
      "id": "<MEDIA_BLUE>",
      "assetId": "2",
      "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/7e/7e411e8b809ae99965552346480a14c1.png",
      "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/7e/7e411e8b809ae99965552346480a14c1__preview.png",
      "mimeType": "image/png",
      "width": 96,
      "height": 96,
      "fileSize": 221,
      "createdAt": "2026-11-14T14:52:16.335Z"
    },
    {
      "id": "<MEDIA_RED>",
      "assetId": "1",
      "url": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/source/eb/ebde13a519e911354940acc07593eb57.png",
      "previewUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/eb/ebde13a519e911354940acc07593eb57__preview.png",
      "mimeType": "image/png",
      "width": 96,
      "height": 96,
      "fileSize": 220,
      "createdAt": "2026-11-14T14:52:15.874Z"
    }
  ],
  "totalItems": 4
}
```

### updateCatalogProduct: two library images, the red one featured

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
      "assetIds": [
        "1",
        "2"
      ],
      "featuredAssetId": "1"
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
        "featuredAsset": {
          "id": "1"
        },
        "assets": [
          {
            "id": "1"
          },
          {
            "id": "2"
          }
        ],
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

### deleteCatalogMedia of an image a product uses: refused (D2128)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteCatalogMedia(id: $id) }",
  "variables": {
    "id": "<MEDIA_RED>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This image is used by a product.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteCatalogMedia"
      ],
      "extensions": {
        "code": "catalog.media-in-use"
      }
    }
  ],
  "data": null
}
```

### deleteCatalogMedia of an unused image

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteCatalogMedia(id: $id) }",
  "variables": {
    "id": "<MEDIA_GREY>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteCatalogMedia": true
  }
}
```

### DELETE /catalog/media/:id

```http
DELETE http://127.0.0.1:23100/catalog/media/<MEDIA_GREEN>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### catalogMedia as business B: none of A's images

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: CatalogMediaListInput) { catalogMedia(options: $options) { totalItems items { id assetId url previewUrl mimeType width height fileSize } } }",
  "variables": {
    "options": {
      "take": 10
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "catalogMedia": {
      "totalItems": 0,
      "items": []
    }
  }
}
```

