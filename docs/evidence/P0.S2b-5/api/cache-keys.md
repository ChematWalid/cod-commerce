# Storefront cache keys

The keys in Valkey after the requests of `host-routing.md` and the screenshots, read with `valkey-cli` in the `valkey` container. Entries are namespaced by the deployment id (`next:7f32c7f:isr:` and `next:7f32c7f:uc:`); the tag indexes (`next:tag:`) are shared by every deployment. Sorted; runs of 32 or more hex digits replaced by `<hash>`.

## `valkey-cli --scan --pattern 'next:*'`

```text
next:7f32c7f:isr:/route-cache/APP_PAGE/<hash>/$/_not-found
next:7f32c7f:isr:/route-cache/APP_PAGE/<hash>/$/_t/[storeId]/[locale]
next:7f32c7f:uc:["<hash>",[{"storeId":"demo"}],["7f32c7f"]]
next:7f32c7f:uc:["<hash>",[{"storeId":"second"}],["7f32c7f"]]
next:tag:_N_T_/_not-found
next:tag:_N_T_/_not-found/layout
next:tag:_N_T_/_not-found/page
next:tag:_N_T_/_t/[storeId]/[locale]/layout
next:tag:_N_T_/_t/[storeId]/[locale]/page
next:tag:_N_T_/_t/[storeId]/layout
next:tag:_N_T_/_t/layout
next:tag:_N_T_/layout
```

## TTLs

The script fails unless both are above 0 and at most 21600 seconds (6 h, `CACHE_ENTRY_MAX_TTL_SECONDS`): the cache shares a `noeviction` Valkey with BullMQ. The value counts down, so it is not printed.

- `TTL next:7f32c7f:uc:["<hash>",[{"storeId":"demo"}],["7f32c7f"]]`: 1..21600
- `TTL next:tag:_N_T_/_not-found`: 1..21600
