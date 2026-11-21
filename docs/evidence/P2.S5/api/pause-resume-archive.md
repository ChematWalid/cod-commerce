# Pause, resume, archive

The lifecycle of a published offer (D2510); `offers.edit`.

### POST /offers/:id/pause

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/pause
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2b7-C+zLjNa2tGUB4qDDjAtmvhv0nJI"

{
  "id": "<OFFER_FREE_DELIVERY>",
  "kind": "free_delivery",
  "method": "automatic",
  "title": "توصيل مجاني للأدلة",
  "label": {},
  "config": {
    "threshold": {
      "type": "none"
    }
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
  "status": "paused",
  "startsAt": null,
  "endsAt": null,
  "publishedAt": "2026-11-21T06:29:36.775Z",
  "pausedAt": "2026-11-21T06:29:40.407Z",
  "archivedAt": null,
  "usageCount": 0,
  "version": 3,
  "targets": [],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  },
  "allowedMoves": [
    "resume",
    "archive"
  ],
  "editable": true,
  "deletable": false
}
```

### POST /offers/:id/resume

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/resume
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2a0-vUl3SS5shNkZ209pwl/rFdYRpjg"

{
  "id": "<OFFER_FREE_DELIVERY>",
  "kind": "free_delivery",
  "method": "automatic",
  "title": "توصيل مجاني للأدلة",
  "label": {},
  "config": {
    "threshold": {
      "type": "none"
    }
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
  "publishedAt": "2026-11-21T06:29:36.775Z",
  "pausedAt": null,
  "archivedAt": null,
  "usageCount": 0,
  "version": 4,
  "targets": [],
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
```

### POST /offers/:id/archive

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/archive
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2a8-9lmjrocQ8fIyhWy9CIYdojLIGN8"

{
  "id": "<OFFER_FREE_DELIVERY>",
  "kind": "free_delivery",
  "method": "automatic",
  "title": "توصيل مجاني للأدلة",
  "label": {},
  "config": {
    "threshold": {
      "type": "none"
    }
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
  "status": "archived",
  "startsAt": null,
  "endsAt": null,
  "publishedAt": "2026-11-21T06:29:36.775Z",
  "pausedAt": null,
  "archivedAt": "2026-11-21T06:29:40.658Z",
  "usageCount": 0,
  "version": 5,
  "targets": [],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  },
  "allowedMoves": [],
  "editable": false,
  "deletable": false
}
```

### POST /offers/:id/resume of an archived offer: 409

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/resume
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"95-kDobX+QfcfMwJpREma7jHGJ71wU"

{
  "statusCode": 409,
  "code": "offers.invalid-transition",
  "message": "This offer cannot change to that status.",
  "path": "/offers/<OFFER_FREE_DELIVERY>/resume"
}
```

