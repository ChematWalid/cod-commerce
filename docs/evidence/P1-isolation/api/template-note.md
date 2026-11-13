# Isolation: template note

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### note.list (A attacks B)

A's owner lists template notes: A's note only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { templateNotes(take: 100) { id title body createdAt } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "templateNotes": [
      {
        "id": "<NOTE_A>",
        "title": "Note A ee06632b",
        "body": "private",
        "createdAt": "2026-11-13T14:27:05.588Z"
      }
    ]
  }
}
```

### note.list (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner lists template notes: A's note only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { templateNotes(take: 100) { id title body createdAt } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "templateNotes": [
      {
        "id": "<NOTE_B>",
        "title": "Note B ee06632b",
        "body": "private",
        "createdAt": "2026-11-13T14:27:09.033Z"
      }
    ]
  }
}
```

### note.by-id (A attacks B)

A's owner asks for B's template note by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { templateNote(id: $id) { id title body createdAt } }

variables: {
  "id": "<NOTE_B>"
}
```

**HTTP 200**

```json
{
  "data": {
    "templateNote": null
  }
}
```

### note.by-id (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner asks for B's template note by id: null. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { templateNote(id: $id) { id title body createdAt } }

variables: {
  "id": "<NOTE_A>"
}
```

**HTTP 200**

```json
{
  "data": {
    "templateNote": null
  }
}
```

### note.victim-channel (A attacks B)

A's owner lists template notes with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { templateNotes { id title body createdAt } }

variables: {}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "templateNotes"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### note.create-victim-channel (A attacks B)

A's owner creates a template note with B's store token: FORBIDDEN, B's notes untouched. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title } }

variables: {
  "input": {
    "title": "Planted",
    "body": "planted in B"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
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
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
