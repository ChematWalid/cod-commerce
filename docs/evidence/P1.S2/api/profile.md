# Profile and logo

The owner's own record only: no handler takes a user id. A real upload stores the logo on the active store's channel.

### accountProfile

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "accountProfile": {
      "firstName": "Api",
      "lastName": "Owner",
      "emailAddress": "api-a-new-1@evidence.example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": true
    }
  }
}
```

### updateAccountProfile: a local phone number is stored as E.164

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { firstName lastName phone emailAddress } }",
  "variables": {
    "input": {
      "firstName": "Amina",
      "phone": "0555123456"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateAccountProfile": {
      "firstName": "Amina",
      "lastName": "Owner",
      "phone": "+213555123456",
      "emailAddress": "api-a-new-1@evidence.example.test"
    }
  }
}
```

### GET /auth/profile

```http
GET http://127.0.0.1:23100/auth/profile
Authorization: Bearer [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "firstName": "Amina",
  "lastName": "Owner",
  "emailAddress": "api-a-new-1@evidence.example.test",
  "phone": "+213555123456",
  "avatarUrl": null,
  "emailVerified": true
}
```

### PATCH /auth/profile

```http
PATCH http://127.0.0.1:23100/auth/profile
Authorization: Bearer [REDACTED]

{
  "lastName": "Haddad"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "firstName": "Amina",
  "lastName": "Haddad",
  "emailAddress": "api-a-new-1@evidence.example.test",
  "phone": "+213555123456",
  "avatarUrl": null,
  "emailVerified": true
}
```

### accountProfile, anonymous: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }",
  "variables": {}
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; expires=Sat, 13 Nov 2027 18:30:27 GMT; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; expires=Sat, 13 Nov 2027 18:30:27 GMT; samesite=lax; httponly

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
        "accountProfile"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### GET /auth/profile, anonymous: 403

```http
GET http://127.0.0.1:23100/auth/profile

HTTP/1.1 403 Forbidden
vendure-auth-token: [REDACTED]
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; expires=Sat, 13 Nov 2027 18:30:28 GMT; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; expires=Sat, 13 Nov 2027 18:30:28 GMT; samesite=lax; httponly

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T12:30:28.143Z",
  "path": "/auth/profile"
}
```

### uploadBusinessLogo

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

(multipart: a 1x1 PNG as variables.file) mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "uploadBusinessLogo": {
      "assetId": "<ASSET_ID>"
    }
  }
}
```

