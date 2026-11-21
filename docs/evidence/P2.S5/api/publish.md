# Publish

A complete draft becomes `active` and gets `publishedAt`; `offers.edit`.

### POST /offers/:id/publish

```http
POST http://127.0.0.1:23100/offers/<OFFER_QUANTITY>/publish
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<OFFER_QUANTITY>",
  "kind": "quantity",
  "method": "automatic",
  "title": "عرض الكمية للأدلة",
  "label": {},
  "config": {
    "tiers": [
      {
        "price": 10,
        "quantity": 2,
        "preselected": true,
        "freeDelivery": false
      },
      {
        "price": 15,
        "quantity": 3,
        "preselected": false,
        "freeDelivery": true
      }
    ],
    "priceMode": "percent"
  },
  "combinesWith": {
    "order": false,
    "product": false,
    "delivery": false
  },
  "eligibility": {
    "wilayas": [],
    "audience": "everyone",
    "channels": [],
    "deliveryMethods": []
  },
  "totalUsageLimit": null,
  "perBuyerLimit": null,
  "status": "active",
  "startsAt": null,
  "endsAt": null,
  "publishedAt": "2026-11-21T05:06:34.537Z",
  "pausedAt": null,
  "archivedAt": null,
  "usageCount": 0,
  "version": 2,
  "targets": [
    {
      "role": "buy",
      "refType": "product",
      "refId": "11"
    }
  ],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  }
}
```

### publishOffer (a free-delivery offer)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { publishOffer(id: $id) { id kind status publishedAt } }",
  "variables": {
    "id": "<OFFER_FREE_DELIVERY>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "publishOffer": {
      "id": "<OFFER_FREE_DELIVERY>",
      "kind": "free_delivery",
      "status": "active",
      "publishedAt": "2026-11-21T05:06:34.863Z"
    }
  }
}
```

