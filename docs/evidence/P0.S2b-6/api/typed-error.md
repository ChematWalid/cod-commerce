# Typed domain error

`createTemplateNote` with a blank title is refused by the domain with a typed error: `extensions.code` is `TEMPLATE_NOTE_INVALID_TITLE` and no data is returned.

### Business A: createTemplateNote with a blank title

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: business-a-token

{
  "query": "mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title body createdAt } }",
  "variables": {
    "input": {
      "title": "   ",
      "body": ""
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "A note title needs 1 to 120 characters",
      "locations": [
        {
          "line": 1,
          "column": 47
        }
      ],
      "path": [
        "createTemplateNote"
      ],
      "extensions": {
        "code": "TEMPLATE_NOTE_INVALID_TITLE"
      }
    }
  ],
  "data": null
}
```

