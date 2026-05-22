# Architecture

## 1. Core Principles
- Modular, multi-profile setup (minimal, coding, business, full).
- Typed client SDKs for uniform access across tools.
- OmniRoute serves as the unified LLM gateway.

## 2. Path Layout
| Path | Purpose |
|------|---------|
| `infra/` | Docker compose and environment configurations |
| `packages/cli/` | Developer orchestrator CLI tool (`orch`) |
| `packages/mcp-server/` | Exposes orchestration to AI wrappers |
| `packages/infra-client/` | Reusable client SDK |

## 3. Technologies
- **Docker Compose**: Orchestration and profiles
- **Qdrant**: Vector storage
- **n8n**: Workflow automation
- **Redis**: Rate limiting and queueing
- **Ollama**: Local inference
- **Hermes Agent**: Autonomous runtime
- **OmniRoute**: LLM Gateway API

## 4. SpecKit Integration
| Feature Slug | Description |
|--------------|-------------|
| `specs/001-ai-orchestra-foundation/` | Multi-service AI orchestra foundation with MCP and CLI |
