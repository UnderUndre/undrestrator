# Feature Specification: AI Orchestra Foundation

**Feature Branch**: `001-ai-orchestra-foundation`  
**Created**: 2026-05-22  
**Status**: Specified  
**Input**: User description: "Open-source multi-service AI orchestra foundation with MCP server and CLI tool — orchestrate from any AI wrapper. Services: OmniRoute (LLM gateway), Hermes Agent (AI runtime), Qdrant (vector DB), n8n (integrations), Ollama (local inference), Redis (cache/queue). Reusable across undrestrator and ai-digital-twins projects."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Docker Compose One-Command Launch (Priority: P0)

A developer clones the repository, copies `.env.example` to `.env`, fills in API keys, and runs `docker compose up`. All services start in the correct order with health checks. The developer can immediately send an LLM request through OmniRoute and get a response routed to the best available provider.

**Why this priority**: Without a working multi-service stack, nothing else functions. This is the foundation.

**Independent Test**: Run `docker compose up -d`, wait for all health checks to pass, then `curl http://localhost:20128/v1/chat/completions` with a test prompt. Verify response arrives from a configured provider.

**Acceptance Scenarios**:

1. **Given** a fresh clone with `.env` configured, **When** `docker compose up -d` is run, **Then** all 6 core services (OmniRoute, Hermes Agent, Qdrant, Redis, Ollama, n8n) reach healthy state within 120 seconds
2. **Given** all services are healthy, **When** a chat completion request is sent to OmniRoute at `:20128/v1/chat/completions`, **Then** a valid response is returned with provider metadata
3. **Given** Ollama is running, **When** OmniRoute receives a request for a local model, **Then** the request is routed to Ollama and the response is streamed back

---

### User Story 2 - MCP Server for AI Wrapper Orchestration (Priority: P0)

Any AI wrapper (Claude Code, Gemini CLI, Cursor, Windsurf, Codex, Trae, etc.) connects to the orchestra's MCP server and gains access to orchestration tools: start/stop services, check health, query Qdrant, trigger n8n workflows, manage Hermes Agent skills, and route LLM requests through OmniRoute.

**Why this priority**: MCP is the universal integration protocol. Without it, the orchestra is just a Docker Compose file — not an orchestration platform.

**Independent Test**: Configure Claude Code (or any MCP-compatible client) to connect to the MCP server via stdio transport. Verify that `orch_health`, `orch_llm_route`, `orch_vector_search`, `orch_workflow_trigger` tools are available and functional. For HTTP transport, verify API key authentication works.

**Acceptance Scenarios**:

1. **Given** the MCP server is running, **When** an AI wrapper connects via stdio transport, **Then** it receives a tool list with ≥10 orchestration tools
2. **Given** the MCP server is connected, **When** the AI wrapper calls `orch_health`, **Then** it receives status of all services (healthy/unhealthy/stopped)
3. **Given** the MCP server is connected, **When** the AI wrapper calls `orch_llm_route` with a prompt, **Then** the request is routed through OmniRoute and the response is returned
4. **Given** the MCP HTTP transport is running, **When** a request is sent without `Authorization` header, **Then** it returns 401 Unauthorized
5. **Given** the MCP HTTP transport is running, **When** a request is sent with valid `Authorization: Bearer <key>`, **Then** it succeeds

---

### User Story 3 - CLI Tool for Direct Orchestration (Priority: P1)

A developer uses the `orch` CLI to manage the orchestra directly: `orch status` shows all services, `orch llm "prompt"` sends a request through OmniRoute, `orch vector search "query"` searches Qdrant, `orch hermes skill list` manages Hermes skills, `orch n8n trigger <workflow>` triggers n8n workflows.

**Why this priority**: CLI provides direct access for developers who don't use MCP-compatible AI wrappers, and serves as the reference implementation for MCP tools.

**Independent Test**: Run `orch status` and verify all services are listed with their health status. Run `orch llm "Hello"` and verify a response is returned.

**Acceptance Scenarios**:

1. **Given** the orchestra is running, **When** `orch status` is executed, **Then** a table of all services with name, status, port, and uptime is displayed
2. **Given** OmniRoute is healthy, **When** `orch llm "What is 2+2?"` is executed, **Then** the LLM response is printed to stdout
3. **Given** Qdrant has indexed data, **When** `orch vector search "authentication"` is executed, **Then** relevant results are returned with scores

---

### User Story 4 - Hermes Agent as AI Runtime (Priority: P1)

Hermes Agent runs as a Docker service, connected to OmniRoute for LLM routing. It provides persistent memory, self-improving skills, sub-agent orchestration via ACP, and multi-channel gateway (Telegram, Discord, Slack, WhatsApp, Signal, Email). The developer configures Hermes to use OmniRoute as its LLM backend.

**Why this priority**: Hermes Agent is the "brain" of the orchestra — it provides the agent runtime that both undrestrator (coding orchestration) and ai-digital-twins (business assistants) need.

**Independent Test**: Send a message to Hermes via its API server, verify it routes through OmniRoute, and verify the response includes memory context from previous interactions.

**Acceptance Scenarios**:

1. **Given** Hermes Agent is running with `base_url` pointing to OmniRoute, **When** a chat message is sent via API, **Then** the response is generated using OmniRoute-routed LLM
2. **Given** Hermes has persistent memory enabled, **When** a follow-up message references a previous conversation, **Then** Hermes recalls the context
3. **Given** Hermes gateway is configured for Telegram, **When** a user sends a message via Telegram, **Then** Hermes responds through the same channel

---

### User Story 5 - Reusable Infrastructure Client SDK (Priority: P2)

Both undrestrator and ai-digital-twins import `@undrestrator/infra-client` — a thin TypeScript SDK that provides typed clients for OmniRoute (LLM), Qdrant (vector), Redis (queue/cache), n8n (workflow triggers), and Hermes (agent API). The SDK handles connection configuration, health checks, and error handling.

**Why this priority**: The SDK is the glue that makes the orchestra reusable across projects. Without it, each project writes its own integration code.

**Independent Test**: Import `createLLMClient()` from the SDK, send a request, verify it routes through OmniRoute. Import `createVectorStore()`, upsert and query vectors in Qdrant.

**Acceptance Scenarios**:

1. **Given** the SDK is installed as a dependency, **When** `createLLMClient()` is called with default config, **Then** it connects to OmniRoute at the configured base URL
2. **Given** the SDK is configured, **When** `createVectorStore({ collection: 'test' })` is called, **Then** it connects to Qdrant and can upsert/query vectors
3. **Given** the SDK is configured, **When** `createQueue({ name: 'tasks' })` is called, **Then** it connects to Redis and can enqueue/dequeue jobs

---

### User Story 6 - Profile-Based Service Selection (Priority: P2)

The orchestra supports Docker Compose profiles for different use cases: `minimal` (OmniRoute + Qdrant + Redis), `coding` (+ Ollama + Hermes), `business` (+ n8n + Hermes with gateway), `full` (all services). A developer selects a profile based on their needs.

**Why this priority**: Not every project needs all services. Profiles reduce resource usage and complexity.

**Independent Test**: Run `docker compose --profile minimal up -d`, verify only OmniRoute, Qdrant, and Redis start. Run `docker compose --profile full up -d`, verify all services start.

**Acceptance Scenarios**:

1. **Given** profile `minimal` is selected, **When** `docker compose --profile minimal up -d` is run, **Then** only OmniRoute, Qdrant, and Redis start
2. **Given** profile `full` is selected, **When** `docker compose --profile full up -d` is run, **Then** all 6+ services start
3. **Given** profile `coding` is selected, **When** services start, **Then** Ollama auto-pulls configured models (Hermes 3, nomic-embed-text)

---

### Edge Cases

- What happens when OmniRoute is healthy but all configured LLM providers are down? → Circuit breaker activates, returns 503 with retry-after header
- What happens when Qdrant runs out of disk space? → Health check fails, MCP/CLI report unhealthy, Hermes falls back to non-RAG mode
- What happens when Hermes Agent crashes mid-conversation? → Gateway reconnects automatically, conversation state is persisted in `~/.hermes`
- What happens when n8n workflow execution fails? → Error is logged, MCP tool returns error details, retry is available via CLI
- What happens when Ollama model download is interrupted? → Ollama resumes download on next startup, OmniRoute falls back to cloud providers
- What happens when Redis is unavailable? → BullMQ queues fail gracefully, OmniRoute continues without rate-limiting cache
- What happens when two projects (undrestrator + ai-digital-twins) share the same Qdrant instance? → Collection-level isolation via SDK's `collection` parameter

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Docker Compose configuration that starts all services (OmniRoute, Hermes Agent, Qdrant, n8n, Ollama, Redis) with a single `docker compose up` command
- **FR-002**: System MUST expose an MCP server with two transports: stdio (local) and HTTP/SSE (remote). HTTP transport MUST require API key authentication via `ORCH_MCP_API_KEY` environment variable
- **FR-003**: System MUST provide a CLI (`orch`) with subcommands for service management, LLM routing, vector search, workflow triggering, and Hermes skill management
- **FR-003B**: CLI MUST support optional parameters: `orch vector --filter "type=auth" --limit 10 --min-score 0.85`. Document in `contracts/cli-commands.md`
- **FR-004**: OmniRoute MUST serve as the unified LLM gateway, routing requests to configured providers (local Ollama + cloud APIs) with automatic fallback
- **FR-005**: Hermes Agent MUST use OmniRoute as its LLM backend via configurable `base_url`
- **FR-006**: Hermes Agent MUST provide multi-channel gateway (Telegram, Discord, Slack, WhatsApp, Signal, Email) configurable via environment variables
- **FR-007**: System MUST provide a TypeScript SDK (`@undrestrator/infra-client`) with typed clients for all services
- **FR-007B**: SDK MUST support semantic versioning with backward-compatible APIs. Document breaking changes in `CHANGELOG.md` and provide migration guide. Consider major version bump for significant API changes
- **FR-008**: System MUST support Docker Compose profiles (`minimal`, `coding`, `business`, `full`) for selective service startup
- **FR-008B**: Support at least one additional profile: `rag` (Qdrant + OmniRoute only). Document in `infra/README.md`
- **FR-009**: All services MUST have health check endpoints, and the MCP/CLI MUST aggregate health status
- **FR-010**: Qdrant MUST support collection-level isolation for multi-project usage
- **FR-010B**: Support collection aliases via SDK: `createVectorStore({ collection: 'shared-auth', alias: 'undrestrator-auth' })`. Document in `contracts/sdk-interfaces.ts`
- **FR-011**: System MUST include `.env.example` with documented configuration for all services
- **FR-012**: MCP server MUST expose tools: `orch_health`, `orch_llm_route`, `orch_llm_stream`, `orch_vector_upsert`, `orch_vector_search`, `orch_workflow_trigger`, `orch_workflow_list`, `orch_hermes_chat`, `orch_hermes_skills`, `orch_service_restart`
- **FR-013**: OmniRoute MUST be integrated via its Docker Compose configuration (based on `OmniRoute/docker-compose.tls.yml`), included into the orchestra's main `docker-compose.yml` using Compose `include` directive or merged services
- **FR-014**: Hermes Agent MUST be included as a Docker image built from the NousResearch/hermes-agent repository
- **FR-014B**: Ollama MUST read model list from `.env` (e.g., `OLLAMA_MODELS="hermes3,nomic-embed-text"`). Default to minimal set if not configured. Document in `infra/.env.example`
- **FR-015**: System MUST support hybrid LLM routing: local models (Ollama) for cheap tasks, cloud APIs for complex tasks, with configurable routing rules in OmniRoute
- **FR-016**: n8n MUST be accessible for workflow automation with pre-configured connections to OmniRoute and Qdrant, AND include 3-5 pre-built workflow templates (RAG agent, webhook relay, scheduled task, web search agent) importable on first launch
- **FR-017**: MCP server HTTP transport MUST validate `Authorization: Bearer <ORCH_MCP_API_KEY>` header on every request. stdio transport MUST NOT require authentication (inherits OS-level access control)
- **FR-017B**: Run MCP server container as a non-root user and mount `.env` read-only. Document that stdio auth is "implicit trust" — suitable for local dev, not shared environments
- **FR-018**: MCP/CLI MUST expose `orch_circuit_breaker` tool to manually reset all service connections. Document auto-recovery: MCP should retry with exponential backoff (max 5 min) before returning error

### Key Entities

- **Service**: A Docker container in the orchestra (name, image, port, health_url, profile, status)
- **LLMRoute**: A routing rule in OmniRoute (provider, model, priority, fallback_chain, cost_limit)
- **VectorCollection**: A Qdrant collection (name, dimension, distance_metric, project_owner)
- **HermesSkill**: A skill in Hermes Agent (name, description, trigger, auto_created, last_used)
- **Workflow**: An n8n workflow (id, name, trigger_type, webhook_url, active)
- **OrchTool**: An MCP tool exposed by the orchestra (name, description, input_schema, handler)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `docker compose up -d` brings all services to healthy state within 120 seconds on a machine with 16GB RAM
- **SC-002**: MCP server exposes ≥10 functional tools that pass integration tests
- **SC-003**: CLI `orch status` returns accurate health for all services within 2 seconds
- **SC-004**: LLM request through OmniRoute completes in <50ms overhead (excluding provider latency)
- **SC-005**: SDK `createLLMClient()` + `createVectorStore()` pass unit tests with mocked services
- **SC-006**: Hermes Agent successfully routes LLM requests through OmniRoute (verified by Langfuse trace or OmniRoute logs)
- **SC-007**: Profile `minimal` uses <2GB RAM; profile `full` uses <8GB RAM (excluding LLM model memory)
- **SC-008**: The same Docker Compose stack is successfully used by both undrestrator and ai-digital-twins projects (verified by integration test in each)
