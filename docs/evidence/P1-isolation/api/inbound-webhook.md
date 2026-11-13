# Isolation: inbound webhook

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### webhook.cross-signed (A attacks B)

A, signing as a provider with A's secret, posts a webhook to B's store: 401, nothing stored for B. **Pass.**

```http
POST /webhooks/demo/b-ee06632b-1
x-demo-signature: sha256=412203e4252d5f80a5a4756f8b1620302c66acab32bfa8bacbc4b14487c0c0e1
x-demo-event-id: isolation-cross-signed


{"event":"isolation.cross-signed","store":"A1"}
```

**HTTP 401**

```json

```

### webhook.cross-signed (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A, signing as a provider with A's secret, posts a webhook to B's store: 401, nothing stored for B. **Pass.**

```http
POST /webhooks/demo/a-ee06632b-1
x-demo-signature: sha256=e98ec97abcccd6a1e3cbf64806c22181e2eff9119ba3a8409c3e4e1e18983d77
x-demo-event-id: isolation-cross-signed


{"event":"isolation.cross-signed","store":"A1"}
```

**HTTP 401**

```json

```
