# Delivery quote to Alger-Centre: 777 DZD from the commune override

Store A1's default pricing option overrides Alger-Centre's home price; the quote reads that commune row and says so (`source: 'commune'`, D3125). The store comes from the caller's scope, never from the request.

- Call: `ShippingQuoteService.quote(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "provinceCode": "16",
  "townOns": 1601,
  "stopdesk": false,
  "items": [
    {
      "productId": "21",
      "quantity": 1
    }
  ]
}
```

## Output

```json
{
  "baseFee": 777,
  "overweightFee": 0,
  "totalFee": 777,
  "resolved": true,
  "speed": "standard",
  "offeredSpeeds": [
    "standard"
  ],
  "freeShipping": false,
  "waivedFee": 0,
  "source": "commune"
}
```
