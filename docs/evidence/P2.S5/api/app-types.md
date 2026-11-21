# App types

The cards of the create dialog (D2515): seven built-in types, each naming its kind and method. Needs `offers.view`.

### GET /offers/app-types

```http
GET http://127.0.0.1:23100/offers/app-types
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "quantity",
    "kind": "quantity",
    "method": "automatic",
    "goal": "sell_more",
    "recommended": true
  },
  {
    "id": "free_delivery",
    "kind": "free_delivery",
    "method": "automatic",
    "goal": "delivery",
    "recommended": false
  },
  {
    "id": "product_discount",
    "kind": "product_discount",
    "method": "automatic",
    "goal": "stock",
    "recommended": false
  },
  {
    "id": "discount_codes",
    "kind": "product_discount",
    "method": "codes",
    "goal": "influencers",
    "recommended": false
  },
  {
    "id": "bxgy",
    "kind": "bxgy",
    "method": "automatic",
    "goal": null,
    "recommended": false
  },
  {
    "id": "order_discount",
    "kind": "order_discount",
    "method": "automatic",
    "goal": null,
    "recommended": false
  },
  {
    "id": "addon",
    "kind": "addon",
    "method": "automatic",
    "goal": null,
    "recommended": false
  }
]
```

### offerAppTypes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { offerAppTypes { id kind method goal recommended } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "offerAppTypes": [
      {
        "id": "quantity",
        "kind": "quantity",
        "method": "automatic",
        "goal": "sell_more",
        "recommended": true
      },
      {
        "id": "free_delivery",
        "kind": "free_delivery",
        "method": "automatic",
        "goal": "delivery",
        "recommended": false
      },
      {
        "id": "product_discount",
        "kind": "product_discount",
        "method": "automatic",
        "goal": "stock",
        "recommended": false
      },
      {
        "id": "discount_codes",
        "kind": "product_discount",
        "method": "codes",
        "goal": "influencers",
        "recommended": false
      },
      {
        "id": "bxgy",
        "kind": "bxgy",
        "method": "automatic",
        "goal": null,
        "recommended": false
      },
      {
        "id": "order_discount",
        "kind": "order_discount",
        "method": "automatic",
        "goal": null,
        "recommended": false
      },
      {
        "id": "addon",
        "kind": "addon",
        "method": "automatic",
        "goal": null,
        "recommended": false
      }
    ]
  }
}
```

