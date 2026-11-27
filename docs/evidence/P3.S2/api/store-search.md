# GET /store/product/search

Arabic-aware search (ADR 0014): diacritics and letter variants are folded the same way in TypeScript and SQL, and a business's Darija synonyms map Latin-script words to the Arabic word a merchant writes.

### q=قميص (no diacritics), Arabic store

```http
GET http://127.0.0.1:23100/store/product/search?q=%D9%82%D9%85%D9%8A%D8%B5
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"fc-Ukyq4Q9i73PjEY+vkofobq6CF3I"

{
  "items": [
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
  "totalItems": 1,
  "skip": 0,
  "take": 24
}
```

### q=قَمِيص (with fatha and kasra): the same hits

```http
GET http://127.0.0.1:23100/store/product/search?q=%D9%82%D9%8E%D9%85%D9%90%D9%8A%D8%B5
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"fc-Ukyq4Q9i73PjEY+vkofobq6CF3I"

{
  "items": [
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
  "totalItems": 1,
  "skip": 0,
  "take": 24
}
```

### q=serwal (Latin-script Darija): سروال قطني للأدلة first

```http
GET http://127.0.0.1:23100/store/product/search?q=serwal
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"12d-Or12TE+qt53YnuwnITxw8Ox1h7c"

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
    }
  ],
  "totalItems": 1,
  "skip": 0,
  "take": 24
}
```

### q=قميص signed for the French store: none of the Arabic store's products

```http
GET http://127.0.0.1:23100/store/product/search?q=%D9%82%D9%85%D9%8A%D8%B5
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_SECOND>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2e-+YG8ihi7nh3tO0TxRLUpINaOqdY"

{
  "items": [],
  "totalItems": 0,
  "skip": 0,
  "take": 24
}
```

