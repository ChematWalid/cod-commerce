# k6 flash sale: demo.localhost, peak 50/s

**PENDING:** the intake route answered 405; order intake lands with P3.S4, so no submit was sent and the intake thresholds saw no sample.

| Metric | Values |
|---|---|
| http_reqs | count 1, rate 0.03/s |
| http_req_failed | 100.00 % |
| http_req_duration | med 3.8 ms, p(95) 3.8 ms, p(99) 3.8 ms, max 3.8 ms |
| server_errors | count 0, rate 0.00/s |
| intake_duration | med 0.0 ms, p(95) 0.0 ms, p(99) 0.0 ms, max 0.0 ms |
| intake_unexpected | count 0, rate 0.00/s |
| iterations | count 1249, rate 41.63/s |

| Threshold | Expression | Verdict |
|---|---|---|
| intake_duration | `p(95)<2000` | passed |
| intake_unexpected | `count==0` | passed |
| server_errors | `count==0` | passed |
