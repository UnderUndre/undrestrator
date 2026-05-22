# Research: AI Orchestra Foundation

## Tech Stack & Best Practices

- **Decision**: Use `docker compose` with `profiles` feature (`minimal`, `coding`, `business`, `full`).
- **Rationale**: Keeps local developer experience fast while scaling to production needs. Avoids memory bloat for users who only need LLM routing.
- **Alternatives considered**: Kubernetes (too heavy for local dev/foundation target), separate compose files (hard to maintain shared networks).

- **Decision**: Build the MCP server using `@modelcontextprotocol/sdk` supporting both stdio and SSE/HTTP.
- **Rationale**: stdio is standard for Cursor/Claude Code; SSE is needed for remote orchestration. 
- **Alternatives considered**: FastMCP (Python) - but the rest of the stack (CLI, SDK) is TypeScript.

- **Decision**: Shared Redis for both rate limiting (OmniRoute) and queues (n8n/Hermes).
- **Rationale**: Simplifies the stack.
- **Alternatives considered**: Dedicated Redis instances (overkill).
