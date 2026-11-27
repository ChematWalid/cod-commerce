# GET /store/product/:slug

The product page of the signed store: options, variants with their prices and option codes, images as storage paths (D3209). Another store's slug and a draft answer an empty 404 (D3206).

### Signed for the Arabic store: وسادة مطرزة تجريبية

```http
GET http://127.0.0.1:23100/store/product/%D9%88%D8%B3%D8%A7%D8%AF%D8%A9-%D9%85%D8%B7%D8%B1%D8%B2%D8%A9-%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A%D8%A9
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"28c-AYasXaTZFVwQDD4oaMN/7wZ/0eg"

{
  "id": "9",
  "slug": "وسادة-مطرزة-تجريبية",
  "name": "وسادة مطرزة تجريبية",
  "description": "",
  "images": [
    {
      "path": "preview/65/654dc240db8be42dd42de44e6e00d717__preview.png",
      "alt": "وسادة مطرزة تجريبية"
    }
  ],
  "optionGroups": [
    {
      "code": "5",
      "name": "اللون",
      "options": [
        {
          "code": "10",
          "name": "أحمر"
        },
        {
          "code": "11",
          "name": "بيج"
        }
      ]
    }
  ],
  "variants": [
    {
      "id": "15",
      "sku": "DEMO-CUSHION-1",
      "price": 1600,
      "oldPrice": null,
      "optionCodes": [
        "10"
      ],
      "imagePath": null,
      "soldOut": false
    },
    {
      "id": "16",
      "sku": "DEMO-CUSHION-2",
      "price": 1600,
      "oldPrice": null,
      "optionCodes": [
        "11"
      ],
      "imagePath": null,
      "soldOut": false
    }
  ],
  "metaTitle": "",
  "metaDescription": ""
}
```

### The same slug signed for the French store: 404, empty

```http
GET http://127.0.0.1:23100/store/product/%D9%88%D8%B3%D8%A7%D8%AF%D8%A9-%D9%85%D8%B7%D8%B1%D8%B2%D8%A9-%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A%D8%A9
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_SECOND>

HTTP/1.1 404 Not Found

```

### A draft's slug in its own store: 404

```http
GET http://127.0.0.1:23100/store/product/%D9%83%D9%88%D8%A8-%D8%B3%D9%8A%D8%B1%D8%A7%D9%85%D9%8A%D9%83-%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 404 Not Found

```

