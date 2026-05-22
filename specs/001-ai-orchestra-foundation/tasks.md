# Tasks: AI Orchestra Foundation

## Phase 1: Infrastructure Setup
- `[ ]` TASK-1.1: `[SETUP]` Create `infra/docker-compose.yml` with OmniRoute, Qdrant, and Redis (minimal profile). Includes hybrid LLM routing config for OmniRoute.
- `[ ]` TASK-1.2: `[SETUP]` Add n8n and Hermes Agent to Docker Compose (coding and business profiles). Configure Hermes multi-channel gateway.
- `[ ]` TASK-1.3: `[SETUP]` Add Ollama and configure GPU support (coding profile).
- `[ ]` TASK-1.4: `[SETUP]` Create `infra/.env.example` with required configurations and health checks for all services.
- `[ ]` TASK-1.5: `[SETUP]` Import 3-5 pre-built n8n workflow templates into n8n seed directory.

## Phase 2: Client SDK (`@undrestrator/infra-client`)
- `[ ]` TASK-2.1: `[FE]` Initialize `packages/infra-client` with TypeScript configuration and build scripts.
- `[ ]` TASK-2.2: `[BE]` Implement `createLLMClient` (OmniRoute API wrapper).
- `[ ]` TASK-2.3: `[BE]` Implement `createVectorStore` (Qdrant API wrapper).
- `[ ]` TASK-2.4: `[BE]` Implement Queue and Hermes client wrappers.

## Phase 3: MCP Server (`packages/mcp-server`)
- `[ ]` TASK-3.1: `[BE]` Initialize `packages/mcp-server` using `@modelcontextprotocol/sdk`.
- `[ ]` TASK-3.2: `[BE]` Implement stdio and HTTP/SSE transports with API key auth.
- `[ ]` TASK-3.3: `[BE]` Implement `orch_health` and `orch_service_restart` tools.
- `[ ]` TASK-3.4: `[BE]` Implement `orch_llm_route` and `orch_vector_search` tools using the infra-client SDK.
- `[ ]` TASK-3.5: `[BE]` Implement n8n workflow and Hermes chat MCP tools.

## Phase 4: CLI Tool (`packages/cli`)
- `[ ]` TASK-4.1: `[BE]` Initialize `packages/cli` using Commander.js or similar.
- `[ ]` TASK-4.2: `[BE]` Implement `orch status` command to report service health.
- `[ ]` TASK-4.3: `[BE]` Implement `orch llm` and `orch vector` commands.
- `[ ]` TASK-4.4: `[BE]` Implement `orch n8n` and `orch hermes` subcommands.

## Phase 5: Verification & E2E
- `[ ]` TASK-5.1: `[E2E]` Write integration tests for infra-client SDK using mocked services.
- `[ ]` TASK-5.2: `[E2E]` Write Playwright/Supertest integration tests for MCP server HTTP transport.
- `[ ]` TASK-5.3: `[E2E]` Verify Docker Compose profiles start successfully locally.

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
```

## Parallel Lanes

| Lane | Agents | Critical Path | Blocks |
|------|--------|---------------|--------|
| Infrastructure | `[SETUP]` | Phase 1 Setup | Testing |
| SDK Development | `[FE]`, `[BE]` | Phase 2 Tasks | MCP & CLI |
| MCP & CLI | `[BE]` | Phase 3 & 4 Tasks | Testing |
| QA & Testing | `[E2E]` | Phase 5 Tasks | Final Release |

## Agent Summary

| Agent | Task Count | Primary Responsibilities |
|-------|------------|--------------------------|
| `[SETUP]` | 5 | Docker Compose, env setup, profiles |
| `[FE]` | 1 | TypeScript SDK initialization |
| `[BE]` | 12 | SDK Logic, MCP Server, CLI tool |
| `[E2E]` | 3 | Integration and E2E testing |
