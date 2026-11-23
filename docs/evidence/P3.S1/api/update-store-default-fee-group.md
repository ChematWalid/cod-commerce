# Store default pricing option

`updateStore` links one of the store's own groups as its default (#207); tenancy asks delivery pricing whether the group is the store's (D3111).

### updateStore(defaultDeliveryFeeGroupId: own group)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId } }",
  "variables": {
    "id": "<STORE_DEMO>",
    "input": {
      "defaultDeliveryFeeGroupId": "<GROUP_EVIDENCE>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"66-99r8c9gvkX+AfEW24joPIXg1vlI"

{
  "data": {
    "updateStore": {
      "id": "<STORE_DEMO>",
      "defaultDeliveryFeeGroupId": "<GROUP_EVIDENCE>"
    }
  }
}
```

