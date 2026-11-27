# P3.S5a: slow-query report (pg_stat_statements)

Recorded 2026-11-27T17:13Z by `scripts/ops/slow-queries.sh --ensure --limit 5` against the evidence
Postgres (fresh volume: the init script created the extension; --ensure is a no-op on it).

```text
 total_ms | calls | mean_ms | pct  | rows |                                                                              query                                                                               
----------+-------+---------+------+------+------------------------------------------------------------------------------------------------------------------------------------------------------------------
     91.2 |     2 |   45.58 | 94.4 |    0 | CREATE EXTENSION IF NOT EXISTS pg_stat_statements
      3.0 |     5 |    0.60 |  3.1 |    0 | WITH overloaded_funcs AS ( SELECT funcname FROM pg_stat_user_functions s GROUP BY s.funcname HAVING COUNT(*) > $1 ) SELECT s.schemaname, CASE WHEN o.funcname IS
      0.9 |     5 |    0.19 |  1.0 |    0 | SELECT schemaname, relname, indexrelname, pg_relation_size(indexrelid) AS index_size, idx_scan FROM pg_stat_user_indexes
      0.8 |     5 |    0.16 |  0.8 |    0 | SELECT schemaname as schema, relname AS table, coalesce(heap_blks_read, $1) AS heap_read, coalesce(heap_blks_hit, $2) AS heap_hit, coalesce(idx_blks_read, $3) A
      0.7 |     5 |    0.13 |  0.7 |    0 | SELECT schemaname as schema, relname AS table, n_live_tup AS live, n_dead_tup AS dead, n_tup_ins AS ins, n_tup_upd AS upd, n_tup_del AS del, n_tup_hot_upd AS ho
(5 rows)

```
