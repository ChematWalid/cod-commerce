# The internal-only guard

`/shop-api`, `/store/*` and `/_internal/*` answer only signed requests (HMAC over method, path with query, body, store, client address and country, within 60 seconds), on every host; a refusal is a 404 with an empty body (D111, D112). Signatures are shown as [REDACTED].

### Unsigned POST /shop-api, Host api.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api
Host: api.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api?x=1, Host api.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api?x=1
Host: api.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve?host=demo.localhost, Host api.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /STORE/resolve?host=demo.localhost, Host api.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/STORE/resolve?host=demo.localhost
Host: api.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve/?host=demo.localhost, Host api.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve/?host=demo.localhost
Host: api.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal, Host api.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal
Host: api.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal/revalidate, Host api.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal/revalidate
Host: api.localhost

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api, Host app.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api
Host: app.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api?x=1, Host app.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api?x=1
Host: app.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve?host=demo.localhost, Host app.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: app.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /STORE/resolve?host=demo.localhost, Host app.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/STORE/resolve?host=demo.localhost
Host: app.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve/?host=demo.localhost, Host app.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve/?host=demo.localhost
Host: app.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal, Host app.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal
Host: app.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal/revalidate, Host app.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal/revalidate
Host: app.localhost

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api, Host demo.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api
Host: demo.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api?x=1, Host demo.localhost: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api?x=1
Host: demo.localhost
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve?host=demo.localhost, Host demo.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: demo.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /STORE/resolve?host=demo.localhost, Host demo.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/STORE/resolve?host=demo.localhost
Host: demo.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve/?host=demo.localhost, Host demo.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve/?host=demo.localhost
Host: demo.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal, Host demo.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal
Host: demo.localhost

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal/revalidate, Host demo.localhost: 404, empty body

```http
GET http://127.0.0.1:23100/_internal/revalidate
Host: demo.localhost

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api, Host evil.example: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api
Host: evil.example
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned POST /shop-api?x=1, Host evil.example: 404, empty body

```http
POST http://127.0.0.1:23100/shop-api?x=1
Host: evil.example
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve?host=demo.localhost, Host evil.example: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: evil.example

HTTP/1.1 404 Not Found

```

### Unsigned GET /STORE/resolve?host=demo.localhost, Host evil.example: 404, empty body

```http
GET http://127.0.0.1:23100/STORE/resolve?host=demo.localhost
Host: evil.example

HTTP/1.1 404 Not Found

```

### Unsigned GET /store/resolve/?host=demo.localhost, Host evil.example: 404, empty body

```http
GET http://127.0.0.1:23100/store/resolve/?host=demo.localhost
Host: evil.example

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal, Host evil.example: 404, empty body

```http
GET http://127.0.0.1:23100/_internal
Host: evil.example

HTTP/1.1 404 Not Found

```

### Unsigned GET /_internal/revalidate, Host evil.example: 404, empty body

```http
GET http://127.0.0.1:23100/_internal/revalidate
Host: evil.example

HTTP/1.1 404 Not Found

```

### Signed GET /store/resolve for demo.localhost: 200 (the signature covers the full path)

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_DEMO>",
  "storeId": "<STORE_DEMO>",
  "name": "Demo Store",
  "language": "ar",
  "logo": null,
  "primaryHost": "demo.localhost",
  "status": "active"
}
```

### Signed POST /shop-api { activeChannel { code } }: 200

```http
POST http://127.0.0.1:23100/shop-api
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
Content-Type: application/json

{
  "query": "{ activeChannel { code } }"
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activeChannel": {
      "code": "__default_channel__"
    }
  }
}
```

### Signed with x-store-id: 200

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_DEMO>",
  "storeId": "<STORE_DEMO>",
  "name": "Demo Store",
  "language": "ar",
  "logo": null,
  "primaryHost": "demo.localhost",
  "status": "active"
}
```

### The same signature with a changed x-store-id: 404

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>0

HTTP/1.1 404 Not Found

```

### The same signature with one more query parameter: 404

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost&x=1
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found

```

### A signed GET sent as a POST: 404

```http
POST http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found

```

### A signed body replaced by another: 404

```http
POST http://127.0.0.1:23100/shop-api
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
Content-Type: application/json

{
  "query": "mutation { logout { success } }"
}

HTTP/1.1 404 Not Found

```

### A signature 61 seconds old: 404

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found

```

### A signature 59 seconds old: 200

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_DEMO>",
  "storeId": "<STORE_DEMO>",
  "name": "Demo Store",
  "language": "ar",
  "logo": null,
  "primaryHost": "demo.localhost",
  "status": "active"
}
```

### A signed body of 101 KB: 413

```http
POST http://127.0.0.1:23100/shop-api
Host: api.localhost
x-internal-kid: k2
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
Content-Type: application/json

(about 101 KB of JSON, not shown)

HTTP/1.1 413 Payload Too Large

```

### Unsigned GET /stores/subdomain-availability, Host api.localhost: 200 (public)

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=free-name
Host: api.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "free-name",
  "status": "available",
  "reason": null,
  "reasonCode": null
}
```

### Unsigned GET /stores/subdomain-availability, Host app.localhost: 200 (public)

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=free-name
Host: app.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "free-name",
  "status": "available",
  "reason": null,
  "reasonCode": null
}
```

### Unsigned GET /stores/subdomain-availability, Host demo.localhost: 200 (public)

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=free-name
Host: demo.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "free-name",
  "status": "available",
  "reason": null,
  "reasonCode": null
}
```

### Unsigned GET /stores/subdomain-availability, Host evil.example: 200 (public)

```http
GET http://127.0.0.1:23100/stores/subdomain-availability?subdomain=free-name
Host: evil.example

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "subdomain": "free-name",
  "status": "available",
  "reason": null,
  "reasonCode": null
}
```

### The storefront at demo.localhost renders the demo store through the signed client (only the <title> is shown)

```http
GET http://127.0.0.1:23001/
Host: demo.localhost

HTTP/1.1 200 OK
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8

<!DOCTYPE html><html data-dpl-id="e28176b" lang="ar" dir="rtl"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/1pvie6fduep3q.js?dpl=e28176b"/><script src="/_next/static/chunks/3_xnpfkoee8gs.js?dpl=e28176b" async=""></script><script src="/_next/static/chunks/1ek1o9-2xh69l.js?dpl=e28176b" async=""></script><script src="/_next/static/chunks/turbopack-2u1d16houkiyo.js?dpl=e28176b" async=""></script><script src="/_next/static/chunks/0whvkrb958y89.js?dpl=e28176b" async=""></script><script src="/_next/static/chunks/3et6rqk0qh-ry.js?dpl=e28176b" async=""></script><meta name="next-size-adjust" content=""/><script src="/_next/static/chunks/0cz1d0mv5g_q7.js?dpl=e28176b" noModule=""></script></head><body><div hidden=""><!--$--><!--/$--></div><!--&--><!--&--><!--&--><!--&--><main class="stub-page"><!--$?--><template id="B:0"></template><!--/$--></main><!--$--><!--/$--><!--/&--><!--/&--><!--/&--><!--/&--><script>requestAnimationFrame(function(){$RT=performance.now()});</script><script src="/_next/static/chunks/1pvie6fduep3q.js?dpl=e28176b" id="_R_" async=""></script><script>(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push({"otherChunks":["static/chunks/1pvie6fduep3q.js","static/chunks/3_xnpfkoee8gs.js","static/chunks/1ek1o9-2xh69l.js"],"runtimeModuleIds":[9220]});</script><script>(self.__next_f=self.__next_f||[]).push([0])</script><script>self.__next_f.push([1,"1:\"$Sreact.fragment\"\n2:\"/_next/static/chunks/0whvkrb958y89.js?dpl=e28176b\"\n3:I[95879,[\"$2\"],\"default\"]\n4:I[66344,[\"$2\"],\"default\"]\nb:\"$Sreact.suspense\"\nd:I[96527,[\"$2\"],\"OutletBoundary\"]\n10:\"ViewportBoundary\"\n11:I[96527,[\"$2\"],\"$10\"]\n13:\"MetadataBoundary\"\n14:I[96527,[\"$2\"],\"$13\"]\n17:I[1362,[\"$2\"],\"default\",1]\n:HL[\"/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b\",\"style\"]\n5:X\n7:X\nf:X\na:[[\"children\",{\"s\":\"__PAGE__\",\"h\":16546,\"d\":{\"r\":[\"$\",\"$1\",\"c\",{\"children\":[[\"$\",\"main\",null,{\"className\":\"stub-page\",\"children\":[\"$\",\"$b\",null,{\"fallback\":null,\"children\":\"$Lc\"}]}],[[\"$\",\"script\",\"script-0\",{\"src\":\"/_next/static/chunks/3et6rqk0qh-ry.js?dpl=e28176b\",\"async\":true,\"nonce\":\"$undefined\"}]],[\"$\",\"$Ld\",null,{\"children\":[\"$\",\"$b\",null,{\"name\":\"Next.MetadataOutlet\",\"children\":\"$@e\"}]}]]}],\"p\":false,\"v\":\"$f\"}}]]\n9:[[\"children\",{\"s\":{\"n\":\"locale\",\"t\":\"d\",\"k\":\"ar\",\"s\":[]},\"h\":16482,\"d\":{\"r\":[\"$\",\"$1\",\"c\",{\"children\":[null,[\"$\",\"$L3\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L4\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$7\"},\"c\":\"$Qa\"}]]\n8:[[\"children\",{\"s\":{\"n\":\"storeId\",\"t\":\"d\",\"k\":\"<STORE_DEMO>\",\"s\":[]},\"h\":16482,\"d\":{\"r\":[\"$\",\"$1\",\"c\",{\"children\":[null,[\"$\",\"$L3\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L4\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$7\"},\"c\":\"$Q9\"}]]\n6:[[\"children\",{\"s\":\"%5Ft\",\"h\":16482,\"d\":{\"r\":[\"$\",\"$1\",\"c\",{\"children\":[null,[\"$\",\"$L3\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L4\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$7\"},\"c\":\"$Q8\"}]]\n16:X\n18:X\n19:X\n1c:R\n0:{\"P\":null,\"c\":[\"\",\"\"],\"q\":\"\",\"i\":false,\"t\":{\"t\":{\"s\":\"\",\"h\":16466,\"d\":{\"r\":[\"$\",\"$1\",\"c\",{\"children\":[[[\"$\",\"link\",\"0\",{\"rel\":\"stylesheet\",\"href\":\"/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b\",\"precedence\":\"next\",\"crossOrigin\":\"$undefined\",\"nonce\":\"$undefined\"}],[\"$\",\"script\",\"script-0\",{\"src\":\"/_next/static/chunks/0whvkrb958y89.js?dpl=e28176b\",\"async\":true,\"nonce\":\"$undefined\"}]],[\"$\",\"html\",null,{\"lang\":\"ar\",\"dir\":\"rtl\",\"children\":[\"$\",\"body\",null,{\"children\":[\"$\",\"$L3\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L4\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":[[\"$\",\"main\",null,{\"data-testid\":\"not-found\",\"className\":\"stub-page\",\"children\":[\"$\",\"div\",null,{\"children\":[[\"$\",\"h1\",\"ar\",{\"lang\":\"ar\",\"dir\":\"rtl\",\"children\":\"الصفحة غير موجودة\"}],[\"$\",\"h1\",\"fr\",{\"lang\":\"fr\",\"dir\":\"ltr\",\"children\":\"Page introuvable\"}],[\"$\",\"h1\",\"en\",{\"lang\":\"en\",\"dir\":\"ltr\",\"children\":\"Page not found\"}]]}]}],[]],\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]}]}]]}],\"p\":false,\"v\":\"$5\"},\"c\":\"$Q6\"},\"h\":{\"r\":[\"$\",\"$1\",\"h\",{\"children\":[null,[\"$\",\"$L11\",null,{\"children\":\"$L12\"}],[\"$\",\"$L14\",null,{\"children\":[[\"$\",\"div\",null,{\"hidden\":true,\"children\":[\"$\",\"$b\",null,{\"name\":\"Next.Metadata\",\"children\":\"$L15\"}]}],null]}],[\"$\",\"meta\",null,{\"name\":\"next-size-adjust\",\"content\":\"\"}]]}],\"p\":false,\"v\":\"$16\"}},\"m\":\"$undefined\",\"G\":[\"$17\",[[\"$\",\"link\",\"0\",{\"rel\":\"stylesheet\",\"href\":\"/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b\",\"precedence\":\"next\",\"crossOrigin\":\"$undefined\",\"nonce\":\"$undefined\"}]]],\"S\":true,\"r\":\"$18\",\"s\":\"$19\",\"a\":\"$@1a\",\"l\":\"$@1b\",\"p\":\"$1c\",\"d\":\"$undefined\"}\n7:C\n19:300\n12:[[\"$\",\"meta\",\"0\",{\"charSet\":\"utf-8\"}],[\"$\",\"meta\",\"1\",{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1\"}]]\ne:null\n15:[]\n19:C\n16:C\n18:C\nf:C\n5:C\n1d:\"/_next/static/chunks/3et6rqk0qh-ry.js?dpl=e28176b\"\n1e:\"StoreDocumentLang\"\n1f:I[73830,[\"$2\",\"$1d\"],\"$1e\"]\nc:[[\"$\",\"$L1f\",null,{\"locale\":\"ar\"}],\"$L20\"]\n1b:4038\n1a:4015\n"])</script><script>self.__next_f.push([1,"20:[\"$\",\"h1\",null,{\"data-testid\":\"store-name\",\"children\":\"Demo Store\"}]\n"])</script><script src="/_next/static/chunks/0cz1d0mv5g_q7.js?dpl=e28176b" noModule=""></script><div hidden id="S:0"><h1 data-testid="store-name">Demo Store</h1></div><script>$RB=[];$RV=function(a){$RT=performance.now();for(var b=0;b<a.length;b+=2){var c=a[b],e=a[b+1];null!==e.parentNode&&e.parentNode.removeChild(e);var f=c.parentNode;if(f){var g=c.previousSibling,h=0;do{if(c&&8===c.nodeType){var d=c.data;if("/$"===d||"/&"===d)if(0===h)break;else h--;else"$"!==d&&"$?"!==d&&"$~"!==d&&"$!"!==d&&"&"!==d||h++}d=c.nextSibling;f.removeChild(c);c=d}while(c);for(;e.firstChild;)f.insertBefore(e.firstChild,c);g.data="$";g._reactRetry&&requestAnimationFrame(g._reactRetry)}}a.length=0};
$RC=function(a,b){if(b=document.getElementById(b))(a=document.getElementById(a))?(a.previousSibling.data="$~",$RB.push(a,b),2===$RB.length&&("number"!==typeof $RT?requestAnimationFrame($RV.bind(null,$RB)):(a=performance.now(),setTimeout($RV.bind(null,$RB),2300>a&&2E3<a?2300-a:$RT+300-a)))):b.parentNode.removeChild(b)};$RC("B:0","S:0")</script><script>self.__next_f.push([1,"1c:o1,#1c:o83c,2:\"$Sreact.fragment\"\n3:\"/_next/static/chunks/0whvkrb958y89.js?dpl=e28176b\"\n4:I[95879,[\"$3\"],\"default\"]\n5:I[66344,[\"$3\"],\"default\"]\nc:\"$Sreact.suspense\"\ne:I[96527,[\"$3\"],\"OutletBoundary\"]\n11:\"ViewportBoundary\"\n12:I[96527,[\"$3\"],\"$11\"]\n14:\"MetadataBoundary\"\n15:I[96527,[\"$3\"],\"$14\"]\n:HL[\"/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b\",\"style\"]\n1:X\n6:X\n8:X\n10:X\nb:[[\"children\",{\"s\":\"__PAGE__\",\"h\":16546,\"d\":{\"r\":[\"$\",\"$2\",\"c\",{\"children\":[[\"$\",\"main\",null,{\"className\":\"stub-page\",\"children\":[\"$\",\"$c\",null,{\"fallback\":null,\"children\":\"$Ld\"}]}],[[\"$\",\"script\",\"script-0\",{\"src\":\"/_next/static/chunks/3et6rqk0qh-ry.js?dpl=e28176b\",\"async\":true,\"nonce\":\"$undefined\"}]],[\"$\",\"$Le\",null,{\"children\":[\"$\",\"$c\",null,{\"name\":\"Next.MetadataOutlet\",\"children\":\"$@f\"}]}]]}],\"p\":false,\"v\":\"$10\"}}]]\na:[[\"children\",{\"s\":{\"n\":\"locale\",\"t\":\"d\",\"k\":\"ar\",\"s\":[]},\"h\":16482,\"d\":{\"r\":[\"$\",\"$2\",\"c\",{\"children\":[null,[\"$\",\"$L4\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L5\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$8\"},\"c\":\"$Qb\"}]]\n9:[[\"children\",{\"s\":{\"n\":\"storeId\",\"t\":\"d\",\"k\":\"<STORE_DEMO>\",\"s\":[]},\"h\":16482,\"d\":{\"r\":[\"$\",\"$2\",\"c\",{\"children\":[null,[\"$\",\"$L4\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L5\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$8\"},\"c\":\"$Qa\"}]]\n7:[[\"children\",{\"s\":\"%5Ft\",\"h\":16482,\"d\":{\"r\":[\"$\",\"$2\",\"c\",{\"children\":[null,[\"$\",\"$L4\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L5\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]]}],\"p\":false,\"v\":\"$8\"},\"c\":\"$Q9\"}]]\n17:X\n18:X\n1c:o5b1,0:{\"q\":\"\",\"i\":false,\"S\":true,\"r\":\"$1\",\"t\":{\"t\":{\"s\":\"\",\"h\":16466,\"d\":{\"r\":[\"$\",\"$2\",\"c\",{\"children\":[[[\"$\",\"link\",\"0\",{\"rel\":\"stylesheet\",\"href\":\"/_next/static/chunks/3uyl8xv4d9xya.css?dpl=e28176b\",\"precedence\":\"next\",\"crossOrigin\":\"$undefined\",\"nonce\":\"$undefined\"}],[\"$\",\"script\",\"script-0\",{\"src\":\"/_next/static/chunks/0whvkrb958y89.js?dpl=e28176b\",\"async\":true,\"nonce\":\"$undefined\"}]],[\"$\",\"html\",null,{\"lang\":\"ar\",\"dir\":\"rtl\",\"children\":[\"$\",\"body\",null,{\"children\":[\"$\",\"$L4\",null,{\"parallelRouterKey\":\"children\",\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L5\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":[[\"$\",\"main\",null,{\"data-testid\":\"not-found\",\"className\":\"stub-page\",\"children\":[\"$\",\"div\",null,{\"children\":[[\"$\",\"h1\",\"ar\",{\"lang\":\"ar\",\"dir\":\"rtl\",\"children\":\"الصفحة غير موجودة\"}],[\"$\",\"h1\",\"fr\",{\"lang\":\"fr\",\"dir\":\"ltr\",\"children\":\"Page introuvable\"}],[\"$\",\"h1\",\"en\",{\"lang\":\"en\",\"dir\":\"ltr\",\"children\":\"Page not found\"}]]}]}],[]],\"forbidden\":\"$undefined\",\"unauthorized\":\"$undefined\"}]}]}]]}],\"p\":false,\"v\":\"$6\"},\"c\":\"$Q7\"},\"h\":{\"r\":[\"$\",\"$2\",\"h\",{\"children\":[null,[\"$\",\"$L12\",\"NesvwA9sOH_3RegcypDi4v\",{\"children\":\"$L13\"}],[\"$\",\"$L15\",\"NesvwA9sOH_3RegcypDi4m\",{\"children\":[[\"$\",\"div\",null,{\"hidden\":true,\"children\":[\"$\",\"$c\",null,{\"name\":\"Next.Metadata\",\"children\":\"$L16\"}]}],null]}]]}],\"p\":false,\"v\":\"$17\"}},\"s\":\"$18\",\"a\":\"$@19\",\"w\":\"$@1a\"}\n1c:o8a,8:C\n18:300\n13:[[\"$\",\"meta\",\"0\",{\"charSet\":\"utf-8\"}],[\"$\",\"meta\",\"1\",{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1\"}]]\n1c:od,f:null\n16:[]\n1c:o23,17:0\n10:0\n10:T7,storeId10:T6,locale1c:o9a,1b:\"/_next/static/chunks/3et6rqk0qh-ry.js?dpl=e28176b\"\n1c:\"StoreDocumentLang\"\n1d:I[73830,[\"$3\",\"$1b\"],\"$1c\"]\nd:[[\"$\",\"$L1d\",null,{\"locale\":\"ar\"}],\"$L1e\"]\n1c:o7,18:300\n1c:o48,1e:[\"$\",\"h1\",null,{\"data-testid\":\"store-name\",\"children\":\"Demo Store\"}]\n1c:o11,1a:false\n19:3716\n1c:o17,18:C\n17:C\n1:C\n10:C\n6:C\n1c:C\n"])</script></body></html>
```

