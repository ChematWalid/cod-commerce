# Performance before any order

Orders, delivered revenue and discount given (D2514); zeros until an order uses the offer.

### GET /offers/:id/stats

```http
GET http://127.0.0.1:23100/offers/<OFFER_QUANTITY>/stats
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"33-hwWqNPWBg1NtCzehACjBPh74S7g"

{
  "orders": 0,
  "deliveredRevenue": 0,
  "discountGiven": 0
}
```

### offerStats

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { offerStats(id: $id) { orders deliveredRevenue discountGiven } }",
  "variables": {
    "id": "<OFFER_QUANTITY>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"4c-rmbIZd+tl2rHR9dDw/vKTml/AlI"

{
  "data": {
    "offerStats": {
      "orders": 0,
      "deliveredRevenue": 0,
      "discountGiven": 0
    }
  }
}
```

