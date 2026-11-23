# GET /store/collections and /store/collection/:slug

The store's visible collections by position, and one collection with the first page of its listed products (D3219 f). Another store's slug answers an empty 404.

### Signed for the Arabic store

```http
GET http://127.0.0.1:23100/store/collections
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"c7-2faY+4uwRTDa9AfGc5NiCGqmx+M"

{
  "items": [
    {
      "id": "2",
      "slug": "malabis",
      "title": "ملابس وإكسسوارات",
      "description": "",
      "imagePath": null
    },
    {
      "id": "3",
      "slug": "manzil",
      "title": "المنزل",
      "description": "",
      "imagePath": null
    }
  ]
}
```

### Signed for the Arabic store: malabis, take=4

```http
GET http://127.0.0.1:23100/store/collection/malabis?take=4
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"3fe-uyu/lVsC8m76L7TpZ56Y1SPWIoI"

{
  "collection": {
    "id": "2",
    "slug": "malabis",
    "title": "ملابس وإكسسوارات",
    "description": "",
    "imagePath": null
  },
  "products": {
    "items": [
      {
        "id": "7",
        "slug": "صندل-جلدي-تجريبي",
        "name": "صندل جلدي تجريبي",
        "price": 3200,
        "oldPrice": null,
        "imagePath": "preview/8c/8cfd12f66a88d348c9fe17fd2f52d74b__preview.png",
        "soldOut": false
      },
      {
        "id": "6",
        "slug": "فستان-صيفي-تجريبي",
        "name": "فستان صيفي تجريبي",
        "price": 4900,
        "oldPrice": 5900,
        "imagePath": "preview/db/db5129e019ebf3e551525234a12760ba__preview.png",
        "soldOut": false
      },
      {
        "id": "5",
        "slug": "حقيبة-قماشية-تجريبية",
        "name": "حقيبة قماشية تجريبية",
        "price": 1800,
        "oldPrice": 2200,
        "imagePath": "preview/6d/6de1b79c02c22ca50089520e622e9213__preview.png",
        "soldOut": false
      },
      {
        "id": "1",
        "slug": "قميص-قطني-تجريبي",
        "name": "قميص قطني تجريبي",
        "price": 2500,
        "oldPrice": null,
        "imagePath": "preview/f9/f9f84e67eb1c9ebaea3d80d6e4aae3d2__preview.png",
        "soldOut": false
      }
    ],
    "totalItems": 4,
    "skip": 0,
    "take": 4
  }
}
```

### The same slug signed for the French store: 404

```http
GET http://127.0.0.1:23100/store/collection/malabis?take=4
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_SECOND>

HTTP/1.1 404 Not Found

```

