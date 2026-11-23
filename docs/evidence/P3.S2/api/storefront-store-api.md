# Storefront /api/store/*

The same-origin store API the browser calls (D3223 e): the store comes from the host, never from the client. A `storeId` naming another store answers an empty 400; a path outside the table or with dot segments an empty 404; every answer is `private, no-store`.

### Host: demo.localhost, GET /api/store/products (body cut by the script to its first two items)

```http
GET http://127.0.0.1:23001/api/store/products
Host: demo.localhost

HTTP/1.1 200 OK
cache-control: private, no-store
content-type: application/json; charset=utf-8

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
    }
  ],
  "totalItems": 9,
  "skip": 0,
  "take": 24
}
```

### Host: second.localhost, GET /api/store/products?storeId=<the Arabic store>: 400, empty

```http
GET http://127.0.0.1:23001/api/store/products?storeId=<STORE_DEMO>
Host: second.localhost

HTTP/1.1 400 Bad Request
cache-control: private, no-store
```

### Host: demo.localhost, GET /api/store/product/..%2F..%2Fshop-api: 404, empty

```http
GET http://127.0.0.1:23001/api/store/product/..%2F..%2Fshop-api
Host: demo.localhost

HTTP/1.1 404 Not Found
cache-control: private, no-store
```

