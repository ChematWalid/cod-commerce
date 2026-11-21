# Pause, resume, archive

The lifecycle of a published offer (D2510); `offers.edit`.

### POST /offers/:id/pause

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/pause
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

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
  "publishedAt": "2026-11-21T05:06:34.863Z",
  "pausedAt": "2026-11-21T05:06:38.677Z",
  "archivedAt": null,
  "usageCount": 0,
  "version": 3,
  "targets": [],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  }
}
```

### POST /offers/:id/resume

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/resume
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

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
  "publishedAt": "2026-11-21T05:06:34.863Z",
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
  }
}
```

### POST /offers/:id/archive

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/archive
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

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
  "publishedAt": "2026-11-21T05:06:34.863Z",
  "pausedAt": null,
  "archivedAt": "2026-11-21T05:06:38.901Z",
  "usageCount": 0,
  "version": 5,
  "targets": [],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  }
}
```

### POST /offers/:id/resume of an archived offer: 409

```http
POST http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>/resume
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "offers.invalid-transition",
  "message": "This offer cannot change to that status.",
  "path": "/offers/<OFFER_FREE_DELIVERY>/resume"
}
```

