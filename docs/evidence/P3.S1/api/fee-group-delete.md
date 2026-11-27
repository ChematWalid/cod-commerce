# Delete a pricing option

A group that is no store's default deletes; the store's default and its platform table are refused with 409 `delivery-pricing.group-in-use` (D3108).

### DELETE /delivery-fees/:id (the platform table): 409

```http
DELETE http://127.0.0.1:23100/delivery-fees/<GROUP_PLATFORM_DEFAULT>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"ba-QXe7KEz0/bBhqQGjEE/fdLUDtps"

{
  "statusCode": 409,
  "code": "delivery-pricing.group-in-use",
  "message": "This pricing option is in use: choose another default before deleting it.",
  "path": "/delivery-fees/<GROUP_PLATFORM_DEFAULT>"
}
```

### DELETE /delivery-fees/:id (the store default): 409

```http
DELETE http://127.0.0.1:23100/delivery-fees/<GROUP_EVIDENCE>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"ba-HyR7sjIwylM/sVgHTFgurEcy+yc"

{
  "statusCode": 409,
  "code": "delivery-pricing.group-in-use",
  "message": "This pricing option is in use: choose another default before deleting it.",
  "path": "/delivery-fees/<GROUP_EVIDENCE>"
}
```

### DELETE /delivery-fees/:id (a spare group)

```http
DELETE http://127.0.0.1:23100/delivery-fees/<GROUP_SPARE>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"10-oV4hJxRVSENxc/wX8+mA4/Pe4tA"

{
  "success": true
}
```

### deleteDeliveryFeeGroup of the deleted group: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }",
  "variables": {
    "id": "<GROUP_SPARE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"bb-aVr299v/U2dBabAbx6gMal79pv4"

{
  "errors": [
    {
      "message": "Pricing option not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteDeliveryFeeGroup"
      ],
      "extensions": {
        "code": "delivery-pricing.not-found"
      }
    }
  ],
  "data": null
}
```

