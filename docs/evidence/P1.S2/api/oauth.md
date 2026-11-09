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

### GET /auth/oauth/google/start: 302 to the mock provider, with state and PKCE (asserted, not shown); binding cookie set

```http
GET http://127.0.0.1:23101/auth/oauth/google/start

HTTP/1.1 302 Found
set-cookie: cod_oauth_binding=[REDACTED]; Max-Age=900; Path=/; Expires=Mon, 09 Nov 2026 07:44:32 GMT; HttpOnly; SameSite=Lax
content-type: text/plain; charset=utf-8

Found. Redirecting to http://127.0.0.1:23102/authorize?response_type=code&code_challenge_method=S256&client_id=evidence-google-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A23101%2Fauth%2Foauth%2Fgoogle%2Fcallback&scope=openid+email+profile&state=v1.9DLVckGV1pDUZKz0XoQDaedgCN_drRMUUkuKwcPYoMbwflumZt4qIPBZqdl7FcFn17V_Ak-DYbP5lSrMF0x6urMusmBLhOjH2MOSc2xd_FZ98VVxKhtoS4n1onYRQC2_0RCE0zFepeq_PvQa5F3zmoruObM9efpWj9SoXSIUiy7fqMsqIqclsfKNA7x72OSj_IUWrZncxa8W49AM4Jg_gGVjakPChJ1Swnv7wpPgC5PgPntTmQcCWd5wRwi3lK7biBUqpq3ds8G8H3DcUDUu9Br-J7V3K5Vv8lyx&code_challenge=sX2qcx4LBPDrXCcGU9rCm5tG7cwN6bw27eirAawJ4RI
```

### A forged callback with no binding cookie: back to the dashboard with an error code, no ticket (asserted)

```http
GET http://127.0.0.1:23101/auth/oauth/google/callback?state=forged&code=forged

HTTP/1.1 302 Found
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
  "timestamp": "2026-11-09T07:29:32.261Z",
  "path": "/auth/oauth/twitter/start"
}
```

