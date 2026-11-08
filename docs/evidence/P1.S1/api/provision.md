# provisionBusiness

SuperAdmin-only (D5). Creates the Seller, Business, Owner role, Channel and first Store in one transaction. Ids are placeholders; the password is redacted.

### Superadmin provisions a business

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: ProvisionBusinessInput!) { provisionBusiness(input: $input) { business { id name status } store { id subdomain language status } administratorId } }",
  "variables": {
    "input": {
      "name": "Third",
      "owner": {
        "emailAddress": "owner@third.example.test",
        "firstName": "Third",
        "lastName": "Owner",
        "password": "[REDACTED]"
      },
      "store": {
        "name": "Third Store",
        "subdomain": "third",
        "language": "ar"
      }
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "provisionBusiness": {
      "business": {
        "id": "<BUSINESS_C_ID>",
        "name": "Third",
        "status": "active"
      },
      "store": {
        "id": "<STORE_C_ID>",
        "subdomain": "third",
        "language": "ar",
        "status": "active"
      },
      "administratorId": "<ADMIN_C_ID>"
    }
  }
}
```

