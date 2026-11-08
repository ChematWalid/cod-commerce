# templateNote and templateNotes

Reading business A's notes: `templateNote(id)` and the newest-first page `templateNotes(take, skip)`, same session and channel as `create-note.md`. Ids and timestamps are placeholders (`<NOTE_A1_ID>` is the English note, `<NOTE_A2_ID>` the Arabic one).

### Business A: templateNote(id) of the English note

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

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
    "templateNote": {
      "id": "<NOTE_A1_ID>",
      "title": "Call supplier",
      "body": "About the late order",
      "createdAt": "<TIMESTAMP>"
    }
  }
}
```

### Business A: templateNotes(take: 10, skip: 0), newest first

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

### Business A: templateNotes(take: 1, skip: 1), the second page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }",
  "variables": {
    "take": 1,
    "skip": 1
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "templateNotes": [
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

