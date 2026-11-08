# Two-business isolation

Business A (`business-a`, token `business-a-token`) and business B (`business-b`, token `business-b-token`) are two Vendure channels created through the Admin API (ADR 0002: one channel per business; neither is the platform's default channel). Each has notes; the same superadmin session reads from both by switching only the `vendure-token` header. A never reads B's note by id nor in its list, and the converse; an unknown channel token is refused instead of falling back to the default channel. Note ids and timestamps are placeholders; the script asserts each result on the real ids.

### Token business-a-token resolves to channel business-a

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "query { activeChannel { id code } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeChannel": {
      "id": "2",
      "code": "business-a"
    }
  }
}
```

### Token business-b-token resolves to channel business-b

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-b-token

{
  "query": "query { activeChannel { id code } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeChannel": {
      "id": "3",
      "code": "business-b"
    }
  }
}
```

### No token resolves to the platform's default channel, which is neither A nor B

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { activeChannel { id code } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeChannel": {
      "id": "1",
      "code": "__default_channel__"
    }
  }
}
```

### In B: templateNote(id of A's English note) is null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-b-token

{
  "query": "query ($id: String!) { templateNote(id: $id) { id title body createdAt } }",
  "variables": {
    "id": "<NOTE_A1_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNote": null
  }
}
```

### In B: templateNote(id of B's own note) is found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-b-token

{
  "query": "query ($id: String!) { templateNote(id: $id) { id title body createdAt } }",
  "variables": {
    "id": "<NOTE_B1_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNote": {
      "id": "<NOTE_B1_ID>",
      "title": "B's private note",
      "body": "Only business B sees this",
      "createdAt": "<TIMESTAMP>"
    }
  }
}
```

### In B: templateNotes lists only B's note

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-b-token

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 10,
    "skip": 0
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNotes": [
      {
        "id": "<NOTE_B1_ID>",
        "title": "B's private note",
        "body": "Only business B sees this",
        "createdAt": "<TIMESTAMP>"
      }
    ]
  }
}
```

### In A: templateNote(id of B's note) is null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "query ($id: String!) { templateNote(id: $id) { id title body createdAt } }",
  "variables": {
    "id": "<NOTE_B1_ID>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNote": null
  }
}
```

### In A: templateNotes lists only A's two notes

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 10,
    "skip": 0
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNotes": [
      {
        "id": "<NOTE_A2_ID>",
        "title": "مكالمة المورد",
        "body": "بخصوص الطلبية المتأخرة",
        "createdAt": "<TIMESTAMP>"
      },
      {
        "id": "<NOTE_A1_ID>",
        "title": "Call supplier",
        "body": "About the late order",
        "createdAt": "<TIMESTAMP>"
      }
    ]
  }
}
```

### On the platform (default channel): templateNotes is empty

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 10,
    "skip": 0
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNotes": []
  }
}
```

### Unknown channel token 'nope': refused, no data

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: nope

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 10,
    "skip": 0
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "No Channel with the token \"nope\" could be found",
      "locations": [
        {
          "line": 1,
          "column": 34
        }
      ],
      "path": [
        "templateNotes"
      ],
      "extensions": {
        "code": "CHANNEL_NOT_FOUND"
      }
    }
  ],
  "data": null
}
```

