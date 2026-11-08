# createTemplateNote

`createTemplateNote` on the Admin API (`POST /admin-api`), superadmin session (bearer token, redacted), in the channel of business A (`vendure-token: business-a-token`). The business is the channel the request runs in; the input has no business field. The generated id is a positive 63-bit decimal string (format asserted by the script) and is shown as a placeholder, as are the timestamps.

### Business A: create an English note

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title body createdAt } }",
  "variables": {
    "input": {
      "title": "Call supplier",
      "body": "About the late order"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createTemplateNote": {
      "id": "<NOTE_A1_ID>",
      "title": "Call supplier",
      "body": "About the late order",
      "createdAt": "<TIMESTAMP>"
    }
  }
}
```

### Business A: create an Arabic note

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title body createdAt } }",
  "variables": {
    "input": {
      "title": "مكالمة المورد",
      "body": "بخصوص الطلبية المتأخرة"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createTemplateNote": {
      "id": "<NOTE_A2_ID>",
      "title": "مكالمة المورد",
      "body": "بخصوص الطلبية المتأخرة",
      "createdAt": "<TIMESTAMP>"
    }
  }
}
```

