# Implementation Plan: AI Orchestra Foundation

**Branch**: `001-ai-orchestra-foundation` | **Date**: 2026-05-22 | **Spec**: specs/001-ai-orchestra-foundation/spec.md
**Input**: Feature specification from `/specs/001-ai-orchestra-foundation/spec.md`

## Summary

Build an open-source multi-service AI orchestra foundation with an MCP server and a CLI tool (`orch`). This foundation will orchestrate AI models (via OmniRoute/Ollama), provide vector DB capabilities (Qdrant), automation (n8n), caching/queues (Redis), and an AI runtime (Hermes Agent). It includes a robust SDK (`@undrestrator/infra-client`) making it reusable across both `undrestrator` and `ai-digital-twins` projects.

## Technical Context

**Language/Version**: TypeScript, Node.js  
**Primary Dependencies**: Docker, @modelcontextprotocol/sdk, OmniRoute, Qdrant, n8n, Ollama, Redis, Hermes Agent  
**Storage**: Qdrant (vector storage), Redis (key-value, queues)  
**Testing**: Jest, Playwright (for CLI integration), Supertest (for MCP API)  
**Target Platform**: Linux Server, macOS/Windows (via Docker Desktop)  
**Project Type**: Multi-service Infrastructure, CLI tool, MCP server, Node.js SDK  
**Performance Goals**: Steady-state routing overhead <50ms after services are healthy. Cold start (Ollama model load) may take 120-360s depending on model size. <120s Docker startup time.  
**Constraints**: Must support Docker Compose profiles (`minimal`, `coding`, `business`, `full`), requires API key auth for HTTP MCP, must support both stdio and HTTP/SSE MCP transports.  
**Scale/Scope**: Local developer workstation scaling up to small-scale deployment (profile-dependent).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I-IV (AI Management/SemVer)**: N/A for this infrastructure layer.
- **Principle VI (Cross-AI Review Gate)**: Acknowledged. `/speckit.implement` will require `analyze.md` PASS and 2 external reviews.
- **Principle VII (Artifact Versioning)**: Snapshot stages will be taken during planning and tasking.
- **Principle VIII (Living Spec)**: `specs/main/architecture.md` will be created and updated to document this new architecture foundation.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-orchestra-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-tools.md
│   ├── cli-commands.md
│   └── sdk-interfaces.ts
└── tasks.md
```

### Source Code (repository root)

```text
infra/
├── docker-compose.yml
├── .env.example
├── omniroute/
└── hermes/

packages/
├── cli/                 # The 'orch' CLI
│   ├── src/
│   └── package.json
├── mcp-server/          # The MCP Server
│   ├── src/
│   └── package.json
└── infra-client/        # @undrestrator/infra-client SDK
    ├── src/
    └── package.json
```

**Structure Decision**: A monorepo-style layout with `packages/` for Node.js modules and `infra/` for Docker Compose configs ensures clear separation between the runtime services and the programmatic interfaces.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Multiple transports (stdio/HTTP) for MCP | Required by AI wrappers and external services | stdio only is insufficient for remote AI wrappers; HTTP only breaks local CLIs |
| Docker Compose profiles | Needs to scale from simple RAG to full agent workflows | A single monolithic compose file would consume too much RAM (32GB+) |
