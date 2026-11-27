# P3.S5a: OpenTelemetry metrics dump (collector debug exporter)

Recorded 2026-11-27T17:13Z by `scripts/evidence/P3.S5a-otel.sh` from the live collector of
docker-compose.yml (project `cod-p3s5a-otel`, ops profile). Synthetic data only.

## Platform gauges (over OTLP from the observability preload)

The resource and the `cod-platform` scope of the export, as the debug exporter printed them.

```text
-> service.name: Str(cod-worker)
-> service.namespace: Str(cod)
-> deployment.environment.name: Str(development)
InstrumentationScope cod-platform 
-> Name: outbox_pending
-> Unit: {event}
Value: 3.000000
-> Name: outbox_oldest_age_seconds
-> Unit: s
Value: 42.000000
-> Name: scheduler_task_last_success_age_seconds
-> Unit: s
-> task: Str(outbox-sweeper)
Value: 61.000000
-> Name: queue_pool_jobs
-> Unit: {job}
-> pool: Str(critical)
-> state: Str(waiting)
Value: 3.000000
-> pool: Str(critical)
-> state: Str(active)
Value: 0.000000
-> pool: Str(critical)
-> state: Str(failed)
Value: 0.000000
-> pool: Str(critical)
-> state: Str(delayed)
Value: 0.000000
-> pool: Str(bulk)
-> state: Str(waiting)
Value: 0.000000
-> pool: Str(bulk)
-> state: Str(active)
Value: 0.000000
-> pool: Str(bulk)
-> state: Str(failed)
Value: 0.000000
-> pool: Str(bulk)
-> state: Str(delayed)
Value: 1.000000
-> Name: queue_jobs
-> Unit: {job}
-> pool: Str(critical)
-> queue: Str(dispatch)
-> state: Str(waiting)
Value: 2.000000
-> pool: Str(critical)
-> queue: Str(notifications)
-> state: Str(waiting)
Value: 1.000000
-> pool: Str(bulk)
-> queue: Str(capi)
-> state: Str(delayed)
Value: 1.000000
-> Name: queue_oldest_waiting_age_seconds
-> Unit: s
-> pool: Str(critical)
-> queue: Str(dispatch)
Value: 0.000000
-> pool: Str(critical)
-> queue: Str(notifications)
Value: 0.000000
-> Name: intake_spool_length
-> Unit: {order}
Value: 0.000000
```

## Valkey and Postgres receivers (metric names seen)

```text
Name: postgresql.backends
Name: postgresql.bgwriter.buffers.allocated
Name: postgresql.bgwriter.buffers.writes
Name: postgresql.bgwriter.checkpoint.count
Name: postgresql.bgwriter.duration
Name: postgresql.bgwriter.maxwritten
Name: postgresql.commits
Name: postgresql.connection.max
Name: postgresql.database.count
Name: postgresql.db_size
Name: postgresql.rollbacks
Name: postgresql.table.count
Name: redis.clients.blocked
Name: redis.clients.connected
Name: redis.clients.max_input_buffer
Name: redis.clients.max_output_buffer
Name: redis.commands
Name: redis.commands.processed
Name: redis.connections.received
Name: redis.connections.rejected
Name: redis.cpu.time
Name: redis.keys.evicted
Name: redis.keys.expired
Name: redis.keyspace.hits
Name: redis.keyspace.misses
Name: redis.latest_fork
Name: redis.memory.fragmentation_ratio
Name: redis.memory.lua
Name: redis.memory.peak
Name: redis.memory.rss
Name: redis.memory.used
Name: redis.net.input
Name: redis.net.output
Name: redis.rdb.changes_since_last_save
Name: redis.replication.backlog_first_byte_offset
Name: redis.replication.offset
Name: redis.slaves.connected
Name: redis.uptime
```
