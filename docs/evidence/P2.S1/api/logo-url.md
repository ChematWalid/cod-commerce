# Business and store logo URLs

`logoUrl` resolves only an asset the business (or the store's own channel) holds (D2120).

### uploadBusinessLogo

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data; boundary=[…]
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]
apollo-require-preflight: true

operations: {"query":"mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }","variables":{"file":null}}
map: {"0":["variables.file"]}
0: logo.png (image/png, 221 bytes)

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "uploadBusinessLogo": {
      "assetId": "5"
    }
  }
}
```

### updateBusiness: the logo

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id logoAssetId logoUrl } }",
  "variables": {
    "input": {
      "logoAssetId": "5"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateBusiness": {
      "id": "<BUSINESS_DEMO>",
      "logoAssetId": "5",
      "logoUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/b2/b2ed6ad27d763faf44c799bc23b60a48__preview.png"
    }
  }
}
```

### updateStore: the same logo for the store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id logoAssetId logoUrl showAddressField soldOutBehavior } }",
  "variables": {
    "id": "<STORE_DEMO>",
    "input": {
      "logoAssetId": "5"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateStore": {
      "id": "<STORE_DEMO>",
      "logoAssetId": "5",
      "logoUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/b2/b2ed6ad27d763faf44c799bc23b60a48__preview.png",
      "showAddressField": true,
      "soldOutBehavior": "keep"
    }
  }
}
```

### activeBusiness: logoUrl

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { activeBusiness { id name logoAssetId logoUrl } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeBusiness": {
      "id": "<BUSINESS_DEMO>",
      "name": "Demo",
      "logoAssetId": "5",
      "logoUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/b2/b2ed6ad27d763faf44c799bc23b60a48__preview.png"
    }
  }
}
```

### store: logoUrl

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { store(id: $id) { id name logoAssetId logoUrl } }",
  "variables": {
    "id": "<STORE_DEMO>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "store": {
      "id": "<STORE_DEMO>",
      "name": "Demo Store",
      "logoAssetId": "5",
      "logoUrl": "http://127.0.0.1:23100/assets/b/<BUSINESS_DEMO>/s/<STORE_DEMO>/preview/b2/b2ed6ad27d763faf44c799bc23b60a48__preview.png"
    }
  }
}
```

### activeBusiness as business B: no logo

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { activeBusiness { id name logoAssetId logoUrl } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeBusiness": {
      "id": "<BUSINESS_SECOND>",
      "name": "Second",
      "logoAssetId": null,
      "logoUrl": null
    }
  }
}
```

