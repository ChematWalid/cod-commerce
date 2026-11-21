# Only drafts delete

A published offer is archived, never deleted (D2521); a draft deletes. `offers.delete`.

### DELETE /offers/:id of an active offer: 409

```http
DELETE http://127.0.0.1:23100/offers/<OFFER_QUANTITY>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "offers.offer-not-deletable",
  "message": "Only a draft can be deleted. Archive this offer instead.",
  "path": "/offers/<OFFER_QUANTITY>"
}
```

### DELETE /offers/:id of a draft

```http
DELETE http://127.0.0.1:23100/offers/<OFFER_DELETED>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### GET /offers/:id of the deleted draft: 404

```http
GET http://127.0.0.1:23100/offers/<OFFER_DELETED>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "offers.offer-not-found",
  "message": "Offer not found.",
  "path": "/offers/<OFFER_DELETED>"
}
```

