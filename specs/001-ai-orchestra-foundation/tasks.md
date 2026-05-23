# Tasks: AI Orchestra Foundation

## Phase 1: Infrastructure Setup
- `[x]` TASK-1.1: `[SETUP]` Create `infra/docker-compose.yml` with OmniRoute, Qdrant, and Redis (minimal profile). Includes hybrid LLM routing config for OmniRoute.
  <!-- EVIDENCE: infra/docker-compose.yml — redis, qdrant, omniroute services with minimal profile. All have healthchecks. 183 lines. -->
- `[x]` TASK-1.2: `[SETUP]` Add n8n and Hermes Agent to Docker Compose (coding and business profiles). Configure Hermes multi-channel gateway.
  <!-- EVIDENCE: infra/docker-compose.yml — n8n, n8n-import, hermes services with coding/business/full profiles. Hermes env includes gateway channel tokens. -->
- `[x]` TASK-1.3: `[SETUP]` Add Ollama and configure GPU support (coding profile).
  <!-- EVIDENCE: infra/docker-compose.yml — ollama service with coding/full profile, GPU deploy config. NOTE: Ollama model auto-pull NOT implemented (see TASK-6.5). -->
- `[x]` TASK-1.4: `[SETUP]` Create `infra/.env.example` with required configurations and health checks for all services.
  <!-- EVIDENCE: infra/.env.example — 51 lines, all ports/secrets/tokens/models documented. -->
- `[x]` TASK-1.5: `[SETUP]` Import 3-5 pre-built n8n workflow templates into n8n seed directory.
  <!-- EVIDENCE: infra/n8n/seed/workflows.json — 3 workflows (RAG Agent, Webhook Relay, Scheduled Health Check). PARTIAL: 3 of "3-5", missing web search agent template. See TASK-6.6. -->

## Phase 2: Client SDK (`@undrestrator/infra-client`)
- `[x]` TASK-2.1: `[FE]` Initialize `packages/infra-client` with TypeScript configuration and build scripts.
  <!-- EVIDENCE: packages/infra-client/package.json — v0.1.0, deps: ioredis, bullmq. ESM exports. -->
- `[x]` TASK-2.2: `[BE]` Implement `createLLMClient` (OmniRoute API wrapper).
  <!-- EVIDENCE: packages/infra-client/src/index.ts — createLLMClient with chat/streaming/fetch. TESTED: tests/integration/infra-client.test.ts -->
- `[x]` TASK-2.3: `[BE]` Implement `createVectorStore` (Qdrant API wrapper).
  <!-- EVIDENCE: packages/infra-client/src/index.ts — createVectorStore with init/upsert/search. TESTED: tests/integration/infra-client.test.ts -->
- `[x]` TASK-2.4: `[BE]` Implement Queue and Hermes client wrappers.
  <!-- EVIDENCE: packages/infra-client/src/index.ts — createQueue (BullMQ), createHermesClient (chat/getSkills/createSkill). TESTED: tests/integration/infra-client.test.ts -->

## Phase 3: MCP Server (`packages/mcp-server`)
- `[x]` TASK-3.1: `[BE]` Initialize `packages/mcp-server` using `@modelcontextprotocol/sdk`.
  <!-- EVIDENCE: packages/mcp-server/package.json — @modelcontextprotocol/sdk dep, bin=mcp-server. -->
- `[x]` TASK-3.2: `[BE]` Implement stdio and HTTP/SSE transports with API key auth.
  <!-- EVIDENCE: packages/mcp-server/src/index.ts — dual transport, Bearer auth on HTTP, rate limiting. TESTED: tests/integration/mcp-server.test.ts -->
- `[x]` TASK-3.3: `[BE]` Implement `orch_health` and `orch_service_restart` tools.
  <!-- EVIDENCE: packages/mcp-server/src/index.ts — both tools implemented with Docker exec + health aggregation. -->
- `[x]` TASK-3.4: `[BE]` Implement `orch_llm_route` and `orch_vector_search` tools using the infra-client SDK.
  <!-- EVIDENCE: packages/mcp-server/src/index.ts — both tools delegate to infra-client. NOTE: orch_llm_stream NOT implemented (see TASK-6.3). -->
- `[x]` TASK-3.5: `[BE]` Implement n8n workflow and Hermes chat MCP tools.
  <!-- EVIDENCE: packages/mcp-server/src/index.ts — orch_workflow_list, orch_workflow_trigger, orch_hermes_chat, orch_hermes_skills. NOTE: orch_circuit_breaker also implemented (manual reset only). -->

## Phase 4: CLI Tool (`packages/cli`)
- `[x]` TASK-4.1: `[BE]` Initialize `packages/cli` using Commander.js or similar.
  <!-- EVIDENCE: packages/cli/package.json — commander dep, bin=orch. packages/cli/src/index.ts — Commander program. -->
- `[x]` TASK-4.2: `[BE]` Implement `orch status` command to report service health.
  <!-- EVIDENCE: packages/cli/src/index.ts — status command with Docker container list + API health checks. -->
- `[x]` TASK-4.3: `[BE]` Implement `orch llm` and `orch vector` commands.
  <!-- EVIDENCE: packages/cli/src/index.ts — llm (prompt + streaming), vector (search/upsert with deterministic embedding fallback). NOTE: FR-003B --filter/--limit/--min-score NOT implemented (see TASK-6.2). -->
- `[x]` TASK-4.4: `[BE]` Implement `orch n8n` and `orch hermes` subcommands.
  <!-- EVIDENCE: packages/cli/src/index.ts — n8n (list/trigger), hermes (chat/skill list/create), service restart. -->

## Phase 5: Verification & E2E
- `[x]` TASK-5.1: `[E2E]` Write integration tests for infra-client SDK using mocked services.
  <!-- EVIDENCE: tests/integration/infra-client.test.ts — 323 lines, tests all 4 clients (LLM, vector, queue, Hermes) with mocks. -->
- `[x]` TASK-5.2: `[E2E]` Write Playwright/Supertest integration tests for MCP server HTTP transport.
  <!-- EVIDENCE: tests/integration/mcp-server.test.ts — 128 lines, execa-based server start, 401/200 auth tests for /sse and /messages. NOTE: Uses execa not Supertest but functionally equivalent. -->
- `[ ]` TASK-5.3: `[E2E]` Verify Docker Compose profiles start successfully locally.
  <!-- NO EVIDENCE: No automated test found. Manual verification needed. -->

## Phase 6: Observability & Monitoring
- `[ ]` TASK-6.1: `[SETUP]` Add Langfuse service to docker-compose.yml (profile: `full`, `business`). Configure OmniRoute trace export to Langfuse endpoint.
- `[ ]` TASK-6.2: `[BE]` Implement FR-003B — CLI optional params (`--filter`, `--limit`, `--min-score`) on `orch vector search`. Create `contracts/cli-commands.md` documenting all CLI commands and params.
- `[ ]` TASK-6.3: `[BE]` Implement `orch_llm_stream` MCP tool (SSE streaming via OmniRoute). Listed in FR-012 spec but missing from implementation.
- `[ ]` TASK-6.4: `[BE]` Create `contracts/sdk-interfaces.ts` with typed interfaces for all SDK methods. Implement FR-010B collection aliases in SDK.
- `[ ]` TASK-6.5: `[SETUP]` Implement Ollama model auto-pull: init container or entrypoint script that reads `OLLAMA_MODELS` env and runs `ollama pull` for each model before marking healthy.
- `[ ]` TASK-6.6: `[SETUP]` Add 2 more n8n workflow templates (web search agent, scheduled retry with error handling) to reach 5 total.
- `[ ]` TASK-6.7: `[BE]` Implement circuit breaker auto-retry with exponential backoff (max 5 min) per FR-018. Add `orch_circuit_breaker` status field showing retry state.
- `[ ]` TASK-6.8: `[SETUP]` Add `rag` profile to docker-compose.yml (OmniRoute + Qdrant only, per FR-008B). Document in `infra/README.md`.
- `[ ]` TASK-6.9: `[SETUP]` Add OmniRoute routing rules seed config file. Provide default routing: local models for cheap tasks, cloud APIs for complex tasks.
- `[ ]` TASK-6.10: `[BE]` Write `CHANGELOG.md` for SDK. Document semver policy (FR-007B).

## Phase 7: Multi-Tenant Hardening
- `[ ]` TASK-7.1: `[BE]` Design tenant context propagation: middleware that injects `X-Tenant-ID` header across all service calls (SDK → OmniRoute, Qdrant, n8n, Hermes).
- `[ ]` TASK-7.2: `[BE]` Implement Qdrant per-tenant auto-namespacing: SDK automatically prefixes collection names with `{tenant_id}_`. Add `listCollections()` with tenant filter.
- `[ ]` TASK-7.3: `[BE]` Implement n8n workflow isolation: per-tenant n8n credentials and workflow tags. MCP/CLI tools scope workflows by tenant.
- `[ ]` TASK-7.4: `[BE]` Make architectural decision + implement: Hermes per-tenant (separate container per tenant) OR shared Hermes with routing layer (tenant context in prompt/system). Document decision as ADR.
- `[ ]` TASK-7.5: `[BE]` Add per-tenant rate limiting at OmniRoute level. Quota config in env or config file. Return 429 when exceeded.
- `[ ]` TASK-7.6: `[BE]` Add per-tenant cost tracking: tag every OmniRoute request with `tenant_id`, export to Langfuse per-tenant project. Add `orch cost report --tenant <id>` CLI command.

## Phase 8: Auth and Security
- `[ ]` TASK-8.1: `[SETUP]` Deploy Authentik or Zitadel as identity provider in docker-compose.yml. Configure as SSO front-door.
- `[ ]` TASK-8.2: `[SETUP]` Wire SSO into OmniRoute dashboard (OIDC), n8n (OIDC), Hermes gateway (OIDC token validation).
- `[ ]` TASK-8.3: `[BE]` Implement API key vault: central key management service or secret rotation via Authentik/Zitadel.
- `[ ]` TASK-8.4: `[SETUP]` Integrate SOPS or Doppler for secrets encryption. Encrypt `.env` values at rest.
- `[ ]` TASK-8.5: `[SETUP]` Add MCP server container hardening: non-root user, read-only `.env` mount, no new privileges (FR-017B).
- `[ ]` TASK-8.6: `[BE]` Add audit logging middleware: structured log for every API call with tenant, user, action, resource, timestamp. Output to stdout + Loki.

## Phase 9: Production Ops
- `[ ]` TASK-9.1: `[SETUP]` Deploy Traefik reverse proxy in docker-compose.yml. Auto-TLS via Let's Encrypt. Route labels on all services. Replace direct port exposure.
- `[ ]` TASK-9.2: `[SETUP]` Create backup/restore scripts per Docker volume: `infra/scripts/backup.sh` (qdrant snapshot API, redis SAVE, n8n export, tar for hermes/omniroute). `infra/scripts/restore.sh` counterpart.
- `[ ]` TASK-9.3: `[SETUP]` Add Prometheus + Grafana to docker-compose.yml. Scrape: OmniRoute metrics, Qdrant metrics, Redis exporter, cAdvisor, node exporter. Import pre-built Grafana dashboards.
- `[ ]` TASK-9.4: `[SETUP]` Add Loki + Promtail for log aggregation. Structured JSON logs from all services → Loki. Grafana explore tab for searching.
- `[ ]` TASK-9.5: `[SETUP]` Create GitHub Actions CI workflow: lint (ESLint/Prettier), unit tests (vitest), integration tests (vitest), docker compose smoke test (start minimal profile, run health checks, tear down).
- `[ ]` TASK-9.6: `[BE]` Implement healthcheck dashboard: simple web UI (or Grafana panel) showing all service statuses, uptime, last health check time. Accessible at orchestra root URL.

## Phase 10: Documentation
- `[ ]` TASK-10.1: `[DOCS]` Write deployment runbook: prerequisites, `.env` setup, profile selection, first-start verification, common troubleshooting.
- `[ ]` TASK-10.2: `[DOCS]` Write contributor guide: repo structure, dev setup, testing, PR process, coding standards.
- `[ ]` TASK-10.3: `[DOCS]` Create ADR folder (`docs/adr/`): record architectural decisions (MCP transport choice, Redis shared, Hermes tenant strategy, auth provider choice).
- `[ ]` TASK-10.4: `[DOCS]` Write tenant onboarding script (`infra/scripts/tenant-onboard.sh`): creates Qdrant collections, n8n credentials, Hermes config, OmniRoute routing rules for a new tenant.
- `[ ]` TASK-10.5: `[DOCS]` Verify all SC-001..SC-008 success criteria with automated benchmarks. Write results to `specs/001-ai-orchestra-foundation/verification.md`.

## Dependency Graph

```text
# Phase 1
TASK-1.1
TASK-1.1 → TASK-1.2
TASK-1.1 → TASK-1.3
TASK-1.1 → TASK-1.4
TASK-1.2 → TASK-1.5

# Phase 2
TASK-2.1
TASK-2.1 → TASK-2.2
TASK-2.1 → TASK-2.3
TASK-2.1 → TASK-2.4

# Phase 3
TASK-3.1
TASK-3.1 → TASK-3.2
TASK-3.2 + TASK-2.2 + TASK-2.3 + TASK-2.4 → TASK-3.3
TASK-3.3 → TASK-3.4
TASK-3.4 → TASK-3.5

# Phase 4
TASK-4.1
TASK-4.1 → TASK-4.2
TASK-4.2 + TASK-2.2 + TASK-2.3 → TASK-4.3
TASK-4.3 + TASK-2.4 → TASK-4.4

# Phase 5
TASK-2.4 → TASK-5.1
TASK-3.5 → TASK-5.2
TASK-1.4 → TASK-5.3

# Phase 6 (new)
TASK-5.3 → TASK-6.1
TASK-4.3 → TASK-6.2
TASK-3.4 → TASK-6.3
TASK-2.3 → TASK-6.4
TASK-1.3 → TASK-6.5
TASK-1.5 → TASK-6.6
TASK-3.5 → TASK-6.7
TASK-1.1 → TASK-6.8
TASK-1.1 → TASK-6.9
TASK-2.1 → TASK-6.10

# Phase 7 (new)
TASK-6.1 → TASK-7.1
TASK-6.4 + TASK-7.1 → TASK-7.2
TASK-7.1 → TASK-7.3
TASK-7.1 → TASK-7.4
TASK-6.9 → TASK-7.5
TASK-6.1 + TASK-7.1 → TASK-7.6

# Phase 8 (new)
TASK-7.1 → TASK-8.1
TASK-8.1 → TASK-8.2
TASK-8.1 → TASK-8.3
TASK-8.1 → TASK-8.4
TASK-3.2 → TASK-8.5
TASK-8.1 → TASK-8.6

# Phase 9 (new)
TASK-6.1 → TASK-9.1
TASK-1.4 → TASK-9.2
TASK-6.1 → TASK-9.3
TASK-6.1 → TASK-9.4
TASK-5.2 → TASK-9.5
TASK-9.3 → TASK-9.6

# Phase 10 (new)
TASK-9.5 → TASK-10.1
TASK-9.5 → TASK-10.2
TASK-7.4 → TASK-10.3
TASK-7.2 + TASK-8.2 → TASK-10.4
TASK-5.3 + TASK-9.5 → TASK-10.5
```

## Parallel Lanes

| Lane | Agents | Critical Path | Blocks |
|------|--------|---------------|--------|
| Infrastructure | `[SETUP]` | Phase 1, 6.5-6.9, 9.1-9.4 | Everything |
| SDK Development | `[FE]`, `[BE]` | Phase 2, 6.4, 6.10 | MCP & CLI |
| MCP & CLI | `[BE]` | Phase 3, 4, 6.2-6.3, 6.7 | Testing |
| QA & Testing | `[E2E]` | Phase 5, 10.5 | Final Release |
| Multi-Tenant | `[BE]` | Phase 7 | Phase 8, 10.4 |
| Security | `[SETUP]`, `[BE]` | Phase 8 | Phase 10.4 |
| Production Ops | `[SETUP]`, `[BE]` | Phase 9 | Phase 10 |
| Docs | `[DOCS]` | Phase 10 | Release |

## Agent Summary

| Agent | Task Count | Primary Responsibilities |
|-------|------------|--------------------------|
| `[SETUP]` | 13 | Docker Compose, env, profiles, backups, proxy, monitoring |
| `[FE]` | 1 | TypeScript SDK initialization |
| `[BE]` | 26 | SDK logic, MCP Server, CLI, multi-tenant, auth, circuit breaker |
| `[E2E]` | 4 | Integration, E2E, verification benchmarks |
| `[DOCS]` | 5 | Runbook, contributor guide, ADR, onboarding, verification |
