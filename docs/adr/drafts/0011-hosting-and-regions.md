# ADR-0011: Hosting provider and regions

**Date**: 2026-11-07
**Status**: Proposed (new; prices are estimates as of 2026-11-07, re-verify before provisioning)
**Deciders**: architect (draft), user (account owner)

## Context

- Buyers are mostly on mobile in Algeria. The nearest cloud regions are in the EU (Paris, Frankfurt). Marseille has colocation only, no Scaleway/OVH/Hetzner cloud region [EH §5].
- No published Algiers RTT figures exist. Unsourced estimates: Paris 45–70 ms, Frankfurt 60–90 ms on fixed lines [EH §5]. Cloudflare has an Algiers PoP [EH §3], so TLS termination and cached HTML are local and only uncached API calls travel to the origin.
- The MVP budget is under ~$150/month. The team is small, so managed Postgres (with PITR) and Redis are preferred, and there is no self-run Kubernetes before Scale (README assumptions).
- Verified prices [EH §4]: DigitalOcean (FRA) droplets $24 (2 vCPU/4 GB), $48 (4/8), $96 (8/16); LB from $12; managed Postgres from $15.15; managed Valkey from $15. Hetzner CPX32 €35.99 (4/8) with no managed DB. Scaleway Paris managed PG DB-DEV-S + HA ≈ €21/mo and DB-GP-XS + HA ≈ €206/mo, with read replicas [3P], but compute prices were not retrieved.

## Options

| Option | Latency to DZ | Managed PG / Redis | Price confidence | Scale path | Verdict |
|---|---|---|---|---|---|
| **DigitalOcean FRA1** | Frankfurt (est. +15–20 ms vs Paris) | PG with standby and read-only nodes, built-in PgBouncer pools [BK, verify], Valkey [V] | High (droplets, LB, PG entry, Valkey verified) | DOKS managed K8s, bigger PG, cross-region read-only nodes [BK] | **Chosen for Launch/Growth** |
| Scaleway fr-par (Paris) | Closest region | PG HA + replicas [3P], Managed Redis exists [?] | Low (compute and Redis prices not retrieved) | Kapsule managed K8s | Runner-up; switch under the gate below |
| Hetzner (FSN/NBG/HEL) | Germany/Finland, no Paris | None (self-run PG + pgBackRest) | High | Self-run | Rejected: violates the "managed services" constraint |
| OVHcloud (GRA/SBG/Paris) | Close | Managed PG ≈ $51 Essential [3P] | Low | Managed K8s | Not chosen: price and features unverified |
| Vercel (storefront) + managed DB elsewhere | No regional presence near DZ [EH §2, ?] | n/a | Usage-based | n/a | Rejected for cost at spike profile and split control plane |
| AWS eu-west-3 (Paris) | Close | RDS/Aurora with PITR + replicas | Not retrieved | Full | Reserved as the Scale-tier DB target if DO limits are hit |

## Decision

1. **Launch and Growth on DigitalOcean FRA1** in one VPC: droplets for compute (Kamal-deployed containers, ADR 0013), DO Load Balancer, DO Managed PostgreSQL 17, DO Managed Valkey. Cloudflare sits in front of everything (ADR 0012). Assets live in Cloudflare R2 (zero egress) [EH §6].
2. **Scale on DOKS** (managed Kubernetes, HPA/KEDA) in FRA1. The database stays on DO Managed PG while it fits (vertical plus read-only nodes). **Gate**: if the primary needs more than 16 vCPU/64 GB, replica lag exceeds 30 s p95, or PITR/restore exceeds the RTO, migrate the data tier and compute together to AWS eu-west-3 (RDS/Aurora PG) or Scaleway fr-par. Cutover by logical replication. Compute moves with the DB, because Vendure is chatty and cross-provider DB latency is not acceptable.
3. **Latency gate for choosing Paris instead (before P10.S3 provisioning)**: measure RTT from Algerian mobile networks (Djezzy, Mobilis, Ooredoo) and Algérie Télécom fixed lines to DO FRA1 and Scaleway fr-par (Globalping/RIPE Atlas probes in DZ or volunteer devices, plus Cloudflare Web Analytics RUM on staging). **If Paris beats Frankfurt by ≥ 25 ms p50 and a verified Scaleway Launch bill stays within $150/month, switch the primary to Scaleway fr-par.** The architecture is identical (containers, managed PG/Redis, Cloudflare, R2), so only `infra/` changes.
4. **Environments**: `prod` (FRA1), `staging` (FRA1, smaller, persistent from P3.S5), local docker compose. No multi-region active-active before Scale.
5. **Data residency**: the data processed includes Algerian buyers' personal data (names, phones, addresses). Hosting outside Algeria may require a declaration or authorisation under Algerian Law 18-07 on personal-data protection (national authority ANPDP) [BK, legal advice required]. This is an **open question for the user** before production. If local hosting becomes mandatory, the same container architecture targets an Algerian provider, but managed-service availability there is unknown [?].

## Consequences

### Positive
- Every Launch line item has a verified or near-verified price (infrastructure.md: ≈ $133–140/month; the managed PG plan price is still [BK]).
- One provider console for compute, LB, PG, Valkey and later K8s. Built-in connection pools.
- A clear numeric gate decides Paris vs Frankfurt, instead of a guess.

### Negative
- Frankfurt likely adds 15–20 ms RTT to uncached calls (quote, intake) compared with Paris (estimate).
- DO's managed PG has upper size limits, so the migration gate at Scale is real work.

### Risks
- **Paying a foreign provider from Algeria** (cards and FX) may be impractical without a foreign entity or card. Open question.
- **Pricing changes.** Every cost is re-verified at provisioning (P3.S5/P10.S3).
