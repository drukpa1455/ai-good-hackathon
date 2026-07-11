# AI for Good Hackathon

These rules specialize the shared global policy for this public repository.
Read `README.md` first for the current product map and local commands.

## Project truth

- Implemented code, tests, and `data/releases/demo-v1/manifest.json` outrank
  historical plans and handoffs for current behavior.
- `docs/frontend-design-handoff.md` owns intended product, interaction, and
  evidence semantics; current `web/` code and tests own what is implemented.
- `ops/digitalocean-demo-lease.md` owns cloud approval, revision, spend,
  public-window, verification, and teardown requirements. GitHub Deployments
  are not authoritative for externally managed DigitalOcean resources.
- Keep deterministic fixture, live DataSF, and model-generated claims visibly
  distinct. The model explains bounded evidence; it never becomes fact owner.

## Workflow and concurrency

- Every landing PR is issue-backed and closes its scoped issue.
- Use the issue worktree for installs, builds, tests, local servers, submodule or
  dependency initialization, and screenshot generation. Never run them from the
  shared root while another agent may be active.
- Preserve unrelated active worktrees and branches. Treat overlapping files as
  evidence to reconcile, not a stop condition, unless behavior or a contract
  changes.
- Keep disposable screenshots, Playwright output, rendered specs, and handoff
  artifacts under `tmp/<scope>/`; do not commit `web/dist`, `node_modules`,
  `.venv`, test results, or local runtime state.

## Ownership boundaries

- `backend/src/groundwork/` owns API contracts, graph validation, release reads,
  live DataSF orchestration, PostgreSQL, and Spaces boundaries.
- `functions/` is a bounded Function-to-app adapter; it does not own graph facts
  or model policy.
- `web/src/data/` owns the single `ContextClient` mock/HTTP boundary. Components
  do not call DataSF, inspect provider secrets, or fork fixture and API behavior.
- `web/src/contracts.ts` and backend contracts must remain compatible.
- `data/releases/` contains hash-checked public demo projections. Private source
  payloads, credentials, database rows, and provider artifacts never enter Git.

## Tooling and verification

- Python is 3.13 through `uv`; frontend tooling is Node 22 through npm and
  `web/package-lock.json`. Do not mix package managers.
- Start with focused checks. For a full local gate run backend Ruff and pytest,
  Function Ruff and unittest, then frontend lint, typecheck, Vitest, build, and
  Playwright as listed in `README.md`.
- Run build and Playwright serially when they share `web/dist`; concurrent
  writers can produce false 404 failures.
- Test mock and API modes when changing `ContextClient`, routing, contracts, or
  runtime configuration. Preserve accessibility and mobile regressions.

## Controlled systems

- DataSF network probes, PostgreSQL integration, Spaces access, DigitalOcean
  resources, Agent Platform, Functions deployment, public URLs, and paid model
  calls require the exact approval and bounds owned by the global policy and
  `ops/digitalocean-demo-lease.md`.
- Never infer a live deployment from tracked configuration or issue prose.
  Verify the approved SHA through the live health endpoint and controlled cloud
  ledger before making an operational claim.
