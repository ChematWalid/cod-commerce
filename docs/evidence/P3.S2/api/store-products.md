# GET /store/products

One page of the store's listed products, read from the per-store projection (D3205): active and visible only, never a draft or a hidden product. The store is the signed `x-store-id`, never a query parameter.

### Signed for the Arabic store, take=4

```http
GET http://127.0.0.1:23100/store/products?take=4
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"3b2-7jPvxx/H1DtNgZCj8+IBNC5o6xI"

{
  "items": [
    {
      "id": "24",
      "slug": "سروال-قطني-للأدلة",
      "name": "سروال قطني للأدلة",
      "price": 2900,
      "oldPrice": null,
      "imagePath": "b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/06/06b850a9b4a834ab89e4cb3a9adece0f__preview.png",
      "soldOut": false
    },
    {
      "id": "10",
      "slug": "عطر-العود-التجريبي",
      "name": "عطر العود التجريبي",
      "price": 3800,
      "oldPrice": null,
      "imagePath": "preview/99/990fb0837f00621ee56e5d67ac697957__preview.png",
      "soldOut": false
    },
    {
      "id": "9",
      "slug": "وسادة-مطرزة-تجريبية",
      "name": "وسادة مطرزة تجريبية",
      "price": 1600,
      "oldPrice": null,
      "imagePath": "preview/65/654dc240db8be42dd42de44e6e00d717__preview.png",
      "soldOut": false
    },
    {
      "id": "8",
      "slug": "مصباح-مكتب-تجريبي",
      "name": "مصباح مكتب تجريبي",
      "price": 2700,
      "oldPrice": null,
      "imagePath": "preview/97/97c89cb59ac4548267bb94053a71ed6f__preview.png",
      "soldOut": false
    }
  ],
  "totalItems": 9,
  "skip": 0,
  "take": 4
}
```

### Signed for the English store, sort=price-asc: its three products only

```http
GET http://127.0.0.1:23100/store/products?sort=price-asc
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_EN>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2b1-QTGLZoOWOVRTQPdIIS06tOFDz8Y"

{
  "items": [
    {
      "id": "23",
      "slug": "ceramic-mug",
      "name": "Ceramic mug",
      "price": 1200,
      "oldPrice": 1500,
      "imagePath": "b/<BUSINESS_DEMO>/s/<STORE_EN>/preview/e3/e37c062e174933c29ea3ddbcab0193c8__preview.png",
      "soldOut": false
    },
    {
      "id": "22",
      "slug": "canvas-tote-bag",
      "name": "Canvas tote bag",
      "price": 1800,
      "oldPrice": null,
      "imagePath": "b/<BUSINESS_DEMO>/s/<STORE_EN>/preview/75/75244900e90ac3e690480d70feb08776__preview.png",
      "soldOut": false
    },
    {
      "id": "21",
      "slug": "linen-shirt",
      "name": "Linen shirt",
      "price": 3200,
      "oldPrice": 3900,
      "imagePath": "b/<BUSINESS_DEMO>/s/<STORE_EN>/preview/32/32ec294928a052b58073e5fd21eda127__preview.png",
      "soldOut": false
    }
  ],
  "totalItems": 3,
  "skip": 0,
  "take": 24
}
```

### Unsigned: 404

```http
GET http://127.0.0.1:23100/store/products

HTTP/1.1 404 Not Found

```

