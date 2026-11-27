# k6 smoke: demo.localhost

| Metric | Values |
|---|---|
| http_reqs | count 16, rate 16.45/s |
| http_req_failed | 0.00 % |
| checks | 100.00 % |
| http_req_duration | med 40.0 ms, p(95) 170.9 ms, p(99) 243.0 ms, max 261.1 ms |
| server_errors | count 0, rate 0.00/s |
| iterations | count 3, rate 3.08/s |

| Threshold | Expression | Verdict |
|---|---|---|
| http_req_failed | `rate==0` | passed |
| server_errors | `count==0` | passed |
| checks | `rate==1` | passed |
| http_req_duration | `p(95)<2000` | passed |
