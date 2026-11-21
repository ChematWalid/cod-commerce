# An archived offer is read only

Archived is final: edits are refused.

### PATCH /offers/:id of an archived offer

```http
PATCH http://127.0.0.1:23100/offers/<OFFER_FREE_DELIVERY>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "تعديل بعد الأرشفة"
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "offers.invalid-transition",
  "message": "This offer cannot change to that status.",
  "path": "/offers/<OFFER_FREE_DELIVERY>"
}
```

### updateOffer of an archived offer

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateOfferInput!) { updateOffer(id: $id, input: $input) { id status } }",
  "variables": {
    "id": "<OFFER_FREE_DELIVERY>",
    "input": {
      "title": "تعديل بعد الأرشفة"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This offer cannot change to that status.",
      "locations": [
        {
          "line": 1,
          "column": 54
        }
      ],
      "path": [
        "updateOffer"
      ],
      "extensions": {
        "code": "offers.invalid-transition"
      }
    }
  ],
  "data": null
}
```

