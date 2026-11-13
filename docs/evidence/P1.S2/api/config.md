# Public configuration, flag off

Anonymous. With AUTH_OAUTH_ENABLED off the provider routes do not exist.

### GET /auth/config

```http
GET http://127.0.0.1:23100/auth/config

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "oauthEnabled": false,
  "oauthProviders": [],
  "challengeUrl": null,
  "platformDomain": "localhost"
}
```

### authPublicConfig

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "query { authPublicConfig { oauthEnabled oauthProviders challengeUrl platformDomain } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "authPublicConfig": {
      "oauthEnabled": false,
      "oauthProviders": [],
      "challengeUrl": null,
      "platformDomain": "localhost"
    }
  }
}
```

### GET /auth/oauth/google/start with the flag off: 404

```http
GET http://127.0.0.1:23100/auth/oauth/google/start

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-13T12:29:03.020Z",
  "path": "/auth/oauth/google/start"
}
```

