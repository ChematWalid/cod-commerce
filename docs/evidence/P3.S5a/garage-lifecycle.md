# Garage lifecycle rules (scripts/ops/garage-lifecycle-check.sh, 2026-11-27T18:29Z, commit 1099b109)

Throwaway Garage `dxflrs/garage:v2.5.0@sha256:677e5b758e4425a325b811c425c026bf35a4bf42f7ddbaa773de3f4fd779a5a5`, private bucket `cod-private`.
`GET /cod-private?lifecycle` after the PUT:

```text
GARAGE-LIFECYCLE-OK cod-private: uploads/ 7 d, exports/ 30 d, incomplete multipart 1 d
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<Rule>
<ID>expire-uploads</ID>
<Status>Enabled</Status>
<Filter>
<Prefix>uploads/</Prefix>
</Filter>
<Expiration>
<Days>7</Days>
</Expiration>
</Rule>
<Rule>
<ID>expire-exports</ID>
<Status>Enabled</Status>
<Filter>
<Prefix>exports/</Prefix>
</Filter>
<Expiration>
<Days>30</Days>
</Expiration>
</Rule>
<Rule>
<ID>abort-incomplete-multipart</ID>
<Status>Enabled</Status>
<Filter>
<Prefix>
</Prefix>
</Filter>
<AbortIncompleteMultipartUpload>
<DaysAfterInitiation>1</DaysAfterInitiation>
</AbortIncompleteMultipartUpload>
</Rule>
</LifecycleConfiguration>
```
