# k6 constant load: demo.localhost, 20/s for 60s

| Metric | Values |
|---|---|
| http_reqs | count 1202, rate 19.97/s |
| http_req_failed | 0.00 % |
| checks | 100.00 % |
| http_req_duration | med 33.0 ms, p(95) 84.1 ms, p(99) 196.2 ms, max 407.9 ms |
| server_errors | count 0, rate 0.00/s |
| iterations | count 1201, rate 19.95/s |

| Threshold | Expression | Verdict |
|---|---|---|
| server_errors | `count==0` | passed |
| checks | `rate>0.99` | passed |
| http_req_duration | `p(95)<1500` | passed |
| dropped_iterations | `count==0` | passed |
| http_req_failed | `rate<0.01` | passed |
