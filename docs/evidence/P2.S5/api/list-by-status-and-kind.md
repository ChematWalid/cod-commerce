# List by status and kind

A page of the active store's offers, newest first; the query string (REST) or `options` (GraphQL) filters it.

### GET /offers?status=active&kind=quantity

```http
GET http://127.0.0.1:23100/offers?status=active&kind=quantity
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"36b-jpPQrcOEYaDna6SW3M+gvyAs+oc"

{
  "items": [
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
      "publishedAt": "2026-11-21T06:29:36.458Z",
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
      },
      "allowedMoves": [
        "pause",
        "archive"
      ],
      "editable": true,
      "deletable": false
    }
  ],
  "totalItems": 1
}
```

### offers(options: { status: draft })

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: OfferListInput) { offers(options: $options) { totalItems items { id kind method title status allowedMoves editable deletable } } }",
  "variables": {
    "options": {
      "status": "draft"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"413-sCvUzi6yeEZycBYjLASDC9n6OeE"

{
  "data": {
    "offers": {
      "totalItems": 5,
      "items": [
        {
          "id": "<OFFER_CODES>",
          "kind": "product_discount",
          "method": "codes",
          "title": "رموز الخصم للأدلة",
          "status": "draft",
          "allowedMoves": [
            "publish",
            "archive"
          ],
          "editable": true,
          "deletable": true
        },
        {
          "id": "<OFFER_ADDON>",
          "kind": "addon",
          "method": "automatic",
          "title": "إضافة بعد الطلب للأدلة",
          "status": "draft",
          "allowedMoves": [
            "publish",
            "archive"
          ],
          "editable": true,
          "deletable": true
        },
        {
          "id": "<OFFER_BXGY>",
          "kind": "bxgy",
          "method": "automatic",
          "title": "اشتر 2 واحصل على 1 للأدلة",
          "status": "draft",
          "allowedMoves": [
            "publish",
            "archive"
          ],
          "editable": true,
          "deletable": true
        },
        {
          "id": "<OFFER_COPY>",
          "kind": "quantity",
          "method": "automatic",
          "title": "عرض الكمية للأدلة",
          "status": "draft",
          "allowedMoves": [
            "publish",
            "archive"
          ],
          "editable": true,
          "deletable": true
        },
        {
          "id": "<OFFER_INCOMPLETE>",
          "kind": "quantity",
          "method": "automatic",
          "title": "مسودة بلا منتج",
          "status": "draft",
          "allowedMoves": [
            "publish",
            "archive"
          ],
          "editable": true,
          "deletable": true
        }
      ]
    }
  }
}
```

