# Isolation: inbound webhook

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### webhook.cross-signed (A attacks B)

A, signing as a provider with A's secret, posts a webhook to B's store: 401, nothing stored for B. **Pass.**

```http
POST /webhooks/demo/b-b8b7305f-1
x-demo-signature: sha256=23f39eb45196f01e240cac8ec0b4e0f697a3edc3ba9c8c7f7d180715a68b7255
x-demo-event-id: isolation-cross-signed


{"event":"isolation.cross-signed","store":"A1"}
```

**HTTP 401**

```json

```

### webhook.cross-signed (B attacks A)

A, signing as a provider with A's secret, posts a webhook to B's store: 401, nothing stored for B. **Pass.**

```http
POST /webhooks/demo/a-b8b7305f-1
x-demo-signature: sha256=3617a041f0d15a851c047691c3b631f893eaf314a91cd0b5a85e0f1fed17b7e9
x-demo-event-id: isolation-cross-signed


{"event":"isolation.cross-signed","store":"A1"}
```

**HTTP 401**

```json

```
