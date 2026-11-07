# cod-commerce

Multi-store cash-on-delivery commerce SaaS for Algeria, built as plugins on [Vendure](https://vendure.io) (published `@vendure/*` packages) with a multi-tenant Next.js storefront. `cod-commerce` is a working name until the product name is decided (ADR 0007).

## Where to start
- Roadmap (phases, sessions, dependencies): [docs/roadmap/README.md](docs/roadmap/README.md)
- Git & GitHub rules: [docs/roadmap/CONTRIBUTING.md](docs/roadmap/CONTRIBUTING.md)
- Architecture & tech stack: [docs/architecture/README.md](docs/architecture/README.md)

## Working with Claude Code
Every session follows [CLAUDE.md](CLAUDE.md): plan first and save it under `docs/roadmap/plans/`, small Conventional Commits, no AI attribution, a handoff note and one PR per session.

## One-time setup after cloning
```bash
git config core.hooksPath .githooks
```
This enables the local hooks that block AI attribution in commit messages and direct pushes to `main`.

Package manager, Node version and scripts are defined in session P0.S2b.
