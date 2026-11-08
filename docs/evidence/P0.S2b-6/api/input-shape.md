# CreateTemplateNoteInput

Introspection of the mutation's input type: it has `body` and `title` only. There is no business or channel field, so a caller cannot choose the tenant (it comes from the request's channel).

### Introspect CreateTemplateNoteInput

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { __type(name: \"CreateTemplateNoteInput\") { name inputFields { name type { kind name ofType { name } } } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "__type": {
      "name": "CreateTemplateNoteInput",
      "inputFields": [
        {
          "name": "title",
          "type": {
            "kind": "NON_NULL",
            "name": null,
            "ofType": {
              "name": "String"
            }
          }
        },
        {
          "name": "body",
          "type": {
            "kind": "NON_NULL",
            "name": null,
            "ofType": {
              "name": "String"
            }
          }
        }
      ]
    }
  }
}
```

