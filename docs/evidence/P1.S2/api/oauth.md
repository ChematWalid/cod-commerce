# OAuth with the flag on, against a mock provider

A second api process with AUTH_OAUTH_ENABLED=true; the provider is a local mock, no real provider is contacted. Cookies, state and codes are not shown.

### GET /auth/config: both providers offered

```http
GET http://127.0.0.1:23101/auth/config

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "oauthEnabled": true,
  "oauthProviders": [
    "google",
    "facebook"
  ],
  "challengeUrl": null,
  "platformDomain": "localhost"
}
```

### GET /auth/oauth/google/start: 302 to the mock provider, with PKCE; state and challenge are placeholders; binding cookie set

```http
GET http://127.0.0.1:23101/auth/oauth/google/start

HTTP/1.1 302 Found
set-cookie: cod_oauth_binding=[REDACTED]; Max-Age=900; Path=/; Expires=Fri, 13 Nov 2026 12:45:36 GMT; HttpOnly; SameSite=Lax
location: http://127.0.0.1:23102/authorize?response_type=code&code_challenge_method=S256&client_id=evidence-google-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A23101%2Fauth%2Foauth%2Fgoogle%2Fcallback&scope=openid+email+profile&state=<OAUTH_STATE>&code_challenge=<OAUTH_CODE_CHALLENGE>
content-type: text/plain; charset=utf-8

Found. Redirecting to http://127.0.0.1:23102/authorize?response_type=code&code_challenge_method=S256&client_id=evidence-google-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A23101%2Fauth%2Foauth%2Fgoogle%2Fcallback&scope=openid+email+profile&state=<OAUTH_STATE>&code_challenge=<OAUTH_CODE_CHALLENGE>
```

### A forged callback with no binding cookie: back to the dashboard with an error code, no ticket (asserted)

```http
GET http://127.0.0.1:23101/auth/oauth/google/callback?state=forged&code=forged

HTTP/1.1 302 Found
location: http://127.0.0.1:23101/dashboard/oauth-complete?error=auth.oauth-failed
content-type: text/plain; charset=utf-8

Found. Redirecting to http://127.0.0.1:23101/dashboard/oauth-complete?error=auth.oauth-failed
```

### An unknown provider: 404

```http
GET http://127.0.0.1:23101/auth/oauth/twitter/start

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-13T12:30:36.294Z",
  "path": "/auth/oauth/twitter/start"
}
```

### The callback of the browser that started the flow: a new identity goes to registration with a ticket

```http
GET http://127.0.0.1:23101/auth/oauth/google/callback?state=<OAUTH_STATE>&code=<OAUTH_CODE>
Cookie: [REDACTED]

HTTP/1.1 302 Found
location: http://127.0.0.1:23101/dashboard/register?ticket=<OAUTH_TICKET>
content-type: text/plain; charset=utf-8

Found. Redirecting to http://127.0.0.1:23101/dashboard/register?ticket=<OAUTH_TICKET>
```

### POST /auth/oauth/ticket: what the ticket holds, for its own browser; spends nothing

```http
POST http://127.0.0.1:23101/auth/oauth/ticket
Cookie: [REDACTED]

{
  "ticket": "<OAUTH_TICKET>"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "provider": "google",
  "email": "oauth-owner-1@evidence.example.test",
  "emailVerified": true,
  "firstName": "Oauth",
  "lastName": "Merchant"
}
```

### POST /auth/oauth/ticket from a browser without the binding cookie: refused

```http
POST http://127.0.0.1:23101/auth/oauth/ticket

{
  "ticket": "<OAUTH_TICKET>"
}

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8

{
  "statusCode": 400,
  "code": "auth.invalid-token",
  "message": "This link is invalid or has expired",
  "path": "/auth/oauth/ticket"
}
```

