# ADR-0011: Hosting location, provider and regions

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-3 review; pending items stay listed as follow-ups
**Deciders**: architect (draft), user (account owner, decider)

Citation keys: [EH §n] = `docs/architecture/research/` hosting notes used by the draft; "verified" = checked against the official page on 2026-11-07 (URLs in Evidence).

## Context

- Buyers are mostly on mobile in Algeria. The draft assumed EU hosting (DigitalOcean FRA1 for Launch/Growth, Scaleway Paris as runner-up) with managed Postgres and Valkey.
- **Algerian Law 18-07** on personal-data protection (JORADP n° 34, 10 June 2018; consolidated by the ANPDP with Law 25-11 of 24 July 2025) applies to the buyer data we process (names, phones, addresses):
  - Art. 12: processing needs a prior declaration to, or authorisation from, the national authority (ANPDP).
  - **Art. 44: personal data may be transferred to a foreign state only with ANPDP authorisation, and only if that state ensures an adequate level of protection.**
  - Art. 45: derogations (consent, contract necessity, …).
  - Art. 67: an unlawful transfer carries 1–5 years' imprisonment and a 500 000–1 000 000 DA fine.
  - The ANPDP FAQ: processing that involves a transfer abroad goes through the authorisation track and may not start before authorisation.
- **Law 18-05 (e-commerce), Art. 8** (Ministry of Commerce summary): an e-commerce activity requires trade-register registration and "a website or web page hosted in Algeria with a `.com.dz` extension".
- **ARPCE cloud regime**: the cloud-provider specifications reported in 2018 cover IaaS, PaaS and SaaS, and require infrastructure and customer data in Algeria. Several providers publish their ARPCE authorisation numbers (Evidence).
- **DigitalOcean edition change**: from 15 Oct 2026 (new accounts) and 30 Nov 2026 (all accounts), new **Standard** Postgres clusters are limited to ≤ 4 GiB and cannot add standby or read-only nodes. HA needs **Advanced Edition, from $130/month**, with each standby billed at the primary's price (verified).
- **Hosting market in Algeria** (Evidence):
  - VPS/IaaS with root access and DZD pricing exists: Algérie Télécom, ICOSNET (Algiers + Oran), ISSAL, Octenium, HOSTARTS, ADEX (also S3-compatible storage and a VPC with a load balancer), AYRADE.
  - **No provider publicly offers managed PostgreSQL, managed Redis/Valkey or managed Kubernetes, and none documents an API or a Terraform/OpenTofu provider.**
  - There is no public hyperscaler region in Algeria.
- Cloudflare lists PoPs in Algiers, Annaba, Constantine and Oran (verified).

## Options

1. **EU managed hosting (DigitalOcean FRA1 / Scaleway fr-par), as drafted.** Cheapest operations (managed PG/Valkey, PITR). Under Art. 44 it needs ANPDP authorisation before processing starts, with criminal penalties otherwise. DO HA now costs ≥ $130/month (Advanced Edition).
2. **Algerian VPS hosting, self-run data tier (chosen).** Compliant by location. We run Postgres, Valkey, PgBouncer, object storage and backups ourselves on VPSs. Costs more operations effort; prices are in DZD with local payment.
3. **Hybrid: EU now, Algeria later.** Rejected by the user: the platform is designed for Algerian hosting from the start.

## Decision

1. **Production is hosted in Algeria** (user decision, 2026-11-07, because of Law 18-07 Art. 44). Every store of buyer personal data runs on servers located in Algeria: database, queues, object storage with exports and labels, backups and logs with personal data.
2. **Minimum deployable target = one Algerian VPS** running the whole stack with Docker Compose: the `api`, `worker`, `storefront` and `migrate` roles from one image (ADR 0013), plus Postgres 17, PgBouncer, Valkey and S3-compatible storage (MinIO). Backups (pgBackRest with WAL archiving for point-in-time restore) go to **a second Algerian provider**. P0.S2b's compose file is written so it runs unchanged on such a VPS; nothing in the architecture may require a managed service. The budget is not a constraint at this stage (user, 2026-11-07); the user's worst case is this single VPS.
3. **Growth topology, sized in P3.S5:** app node(s) plus a Postgres primary with an async streaming standby (scripted, rehearsed manual promotion; no Patroni for a 1–2 person team), Valkey on its own VM, and object storage and backups at a second provider. Load balancing via kamal-proxy/HAProxy with Cloudflare in front (ADR 0012).
4. **The provider is chosen in P3.S5** (user decision: defer). Candidates in order of verified transparency: ICOSNET (self-service, card payment in DZD, Algiers + Oran), ISSAL, Algérie Télécom, ADEX (S3 and VPC/LB). Selection method: a 1-month trial on the shortlist, measuring CPU steal, disk `fsync` latency (pgbench), and RTT from Djezzy, Mobilis, Ooredoo and AT fixed lines (spike G); **ARPCE cloud authorisation** checked; DZD invoicing. Kubernetes stays out (no managed offer; self-run K8s is out of scope for the team size); Scale runs on more VMs with Kamal.
5. **Domains**: the platform domain is a **`.com.dz`** (user decision, 2026-11-07); stores are at `<store>.<platform>.com.dz`. Merchants may connect their own domains, `.com.dz` included (ADR 0012).
6. **Cloudflare stays in front of everything** (user decision, 2026-11-07), including checkout and order tracking. Whether TLS termination at a foreign edge is a "transfer" under Art. 44 is part of the open legal question below. Only public assets live in R2; personal data is never stored at Cloudflare (ADR 0012).
7. **Third-party processors outside Algeria** (Sentry, Grafana Cloud, email/SMS providers, AI APIs): personal data is scrubbed before sending (ADR 0015 redaction rules); a processor that must receive buyer PII to work (e.g. an SMS gateway) is chosen in Algeria, or listed for the ANPDP authorisation in the legal item below.
8. **Open legal questions, parked by the user until later** (must be answered before production, P10). The roadmap gets a pre-production item:
   - (a) the Art. 12 declaration/authorisation for our processing, and whether Cloudflare edge TLS termination or EU SaaS processors count as Art. 44 transfers;
   - (b) whether our SaaS needs its own ARPCE cloud authorisation and an Algerian legal entity;
   - (c) how Law 18-05 Art. 8 (`.com.dz`, hosted in Algeria) applies to multi-tenant storefronts and merchants' custom domains.
9. **Fallback**: if ANPDP authorises transfers to the EU, or the law changes, Option 1 becomes available again (DigitalOcean facts in Evidence). Only `infra/` changes, because the architecture is identical.

## Consequences

### Positive
- Compliant data location from day one; no criminal exposure under Art. 67 for hosting.
- DZD billing with local payment (CIB/EDAHABIA at some providers) removes the "paying a foreign provider" problem.
- The single-VPS target keeps the worst case simple and cheap.

### Negative
- **We operate the data tier**: Postgres (backups, PITR, upgrades, failover), Valkey, MinIO and monitoring. Estimate: 2–4 engineer-weeks to set up and harden, then 2–4 hours/week, plus on-call. Restore drills become mandatory (monthly automated restore test).
- No provider API or Terraform: `infra/` (OpenTofu, P3.S5) shrinks to DNS/Cloudflare; servers are provisioned by hand or with Ansible/cloud-init and documented runbooks.
- Domestic routing: there is no verified operating IXP in Algeria (secondary sources say domestic traffic may transit Marseille/Valencia), so in-country hosting does not guarantee low latency. Spike G measures it.
- Annual baccalaureate-period internet disruptions in Algeria affect an origin in Algeria too.

### Risks
- **Single-VPS data loss or a long outage** at the minimum target. Mitigation: pgBackRest PITR to a second provider and rehearsed restores; standby from Growth.
- **Provider quality is unmeasured** (no published performance data or Tier certifications). Mitigation: the trial benchmark in P3.S5 before committing.
- **Regulatory scope** (ARPCE SaaS authorisation, `.com.dz`, CDN as transfer) is unresolved. Mitigation: the pre-production legal item; the architecture can move processors in-country without code changes.

## Evidence

Research 2026-11-07 (official pages first; "3P" = press or directory). No spike: spike G (latency from Algerian networks) is **pending** until before P10.S3, because no probe access was available in P0.S2a (user decision); the method is in Decision 4.

**Algerian providers** (prices DZD/month excluding VAT; VAT 19 %):

| Provider | Location | Offer (verified unless marked) | Price examples |
|---|---|---|---|
| Algérie Télécom | AT data centres (sites not named) | VPS with root SSH, anti-DDoS, 7-day backups; private network add-on; ordering via business contact | 1 vCPU/4 GB/50 GB SSD 2 500; 2/8/100 3 800; 2/16/200 5 000; 4/32/300 9 000; private network 2 500 per VPS |
| ICOSNET | Algiers (2019), Oran (2021) | VMware VPS with full root, snapshots, firewall; online cart, CIB/EDAHABIA payment; cloud authorisation 2020 | 1/4/80 5 500; 2/8/300 13 900; 4/12/500 23 900 |
| ISSAL | Oran (3P) | "FleXCompute" VPS, SSH; online cart | 2/4/100 2 500; 4/6/150 3 800; 6/8/200 4 800; SSD tier ≈ 2.5× |
| ADEX Cloud | Cyber Parc Sidi Abdellah (Algiers), "Tier II ready" | VPS, VPC with load balancer, **S3-compatible object storage**; ARPCE n° 11/PC/ARPCE (2020) | VPC "from 416 DA"; S3 "from 15 DA"; no full price list |
| Octenium | Algeria (DC not named) | VPS with root SSH, dedicated vCores | 1/2/60 2 900; 2/4/120 4 900; 4/8/300 6 900 |
| AYRADE, HOSTARTS, Djezzy Cloud, Deploily | various | VPS/IaaS without public specs, or not verifiable; Deploily claims multi-provider Kubernetes (unverified) | — |

None offers managed PostgreSQL, Redis/Valkey or Kubernetes; none documents an API or Terraform provider. Sources: algerietelecom.dz (hébergement entreprises), icosnet.com.dz/en/vps-en/, issal.dz/flexcompute/, adexcloud.dz (/products/s3, /products/virtual-private-cloud, /data-center), octenium.com/serveur-vps-algerie, ayrade.com, hostarts.dz.

**Rough Launch sketch from the research** (not a decision; the user set budget aside): 2 app VMs + PG primary/standby + Valkey + backup/MinIO + staging ≈ 24 700–28 400 DZD HT/month (≈ $220–253 at 133.56 DZD/USD, Banque d'Algérie rate of 9 June 2026; re-check the rate). The single-VPS minimum is a fraction of that.

**Law texts**: ANPDP consolidated Law 18-07 (anpdp.dz/ar/storage/2025/08/18-07-Edited.pdf): Arts. 12, 14(5), 39, 44, 45, 67; JORADP n° 34 of 10 June 2018; ANPDP FAQ on the authorisation track (portail.anpdp.dz). Law 18-05 Art. 8 summary on commerce.gov.dz. ARPCE: providers' own authorisation numbers (AYRADE 01/RM/ARPCE/2024, ADEX 11/PC/ARPCE). Reading of the texts only, not legal advice.

**Fallback facts (EU, verified 2026-11-07)**:
- DigitalOcean Managed PG: PgBouncer pools (transaction/session/statement, 21 pools, 22 backend connections on 1 GiB); PITR 7 days; Standard ≥ $15.15/month single node; **Standard edition limits from 30 Nov 2026** (≤ 4 GiB, no standby or read-only nodes on new clusters); Advanced from $130/month.
- DigitalOcean Managed Valkey: from $15/month; default eviction policy `noeviction` (configurable).
- Scaleway fr-par (public catalog API, monthly ≈ hourly × 730): PG DB-DEV-S ≈ €11.4 single / ≈ €21 HA (derived); Managed Redis™ from ≈ €35 (no Valkey); PLAY2-NANO ≈ €20.

Sources: docs.digitalocean.com/products/databases/postgresql/ (limits, pricing, connection pools, features), digitalocean.com/pricing/managed-databases, docs.digitalocean.com/products/databases/valkey/, api.scaleway.com product catalog.

**Connectivity**: Cloudflare PoPs in Algiers, Annaba, Constantine and Oran (cloudflare.com/network). IPv6 adoption in Algeria under 1 % (ISOC Pulse, 3P). Which ISPs reach the local PoPs, and domestic routing, are unverified (spike G).
