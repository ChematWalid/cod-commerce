# GET /store/resolve

The storefront asks the api which store a host belongs to (signed, ADR 0008). The answer is the public store shape (D3203): name, language and direction, primary host, address-field and sold-out settings. An unknown host and an unsigned call answer an empty 404.

### Signed, host demo.localhost

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"107-XFJE3IKy/y9gDsQVdK1YEnFdRCY"

{
  "storeId": "<STORE_DEMO>",
  "businessId": "<BUSINESS_DEMO>",
  "language": "ar",
  "name": "Demo Store",
  "description": "",
  "logo": null,
  "logoPath": null,
  "direction": "rtl",
  "primaryHost": "demo.localhost",
  "showAddressField": true,
  "soldOutBehavior": "keep",
  "status": "active"
}
```

### Signed, host second.localhost

```http
GET http://127.0.0.1:23100/store/resolve?host=second.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"10b-V0DbKZwOl3z/cIR74fttmexs/mY"

{
  "storeId": "<STORE_SECOND>",
  "businessId": "<BUSINESS_SECOND>",
  "language": "fr",
  "name": "Second Store",
  "description": "",
  "logo": null,
  "logoPath": null,
  "direction": "ltr",
  "primaryHost": "second.localhost",
  "showAddressField": true,
  "soldOutBehavior": "keep",
  "status": "active"
}
```

### Signed, host demo2.localhost

```http
GET http://127.0.0.1:23100/store/resolve?host=demo2.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"10a-2N/9O4ujRzzuS7NReB2oZzkQhCw"

{
  "storeId": "<STORE_EN>",
  "businessId": "<BUSINESS_DEMO>",
  "language": "en",
  "name": "Demo Store 2",
  "description": "",
  "logo": null,
  "logoPath": null,
  "direction": "ltr",
  "primaryHost": "demo2.localhost",
  "showAddressField": true,
  "soldOutBehavior": "keep",
  "status": "active"
}
```

### Signed, unknown host nope.localhost: 404

```http
GET http://127.0.0.1:23100/store/resolve?host=nope.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"7b-w5Xa+EJqlr2cu7za/frNMkCJ73Y"

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-23T02:40:53.826Z",
  "path": "/store/resolve?host=nope.localhost"
}
```

### Unsigned: 404, as if the route did not exist

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost

HTTP/1.1 404 Not Found

```

