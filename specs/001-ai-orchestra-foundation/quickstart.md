# Quickstart

## What is Hermes?

Hermes Agent is an AI runtime that provides persistent memory, self-improving skills, and multi-channel communication (Telegram, Discord, etc.). Think of it as the 'brain' that orchestrates conversations across platforms.

## 1. Environment Setup

```bash
cp infra/.env.example infra/.env
# Edit infra/.env with your API keys
```

## 2. Start Infrastructure

Start the minimal profile (OmniRoute + Qdrant + Redis):
```bash
docker compose -f infra/docker-compose.yml --profile minimal up -d
```

To start the full stack:
```bash
docker compose -f infra/docker-compose.yml --profile full up -d
```

## 3. Verify Health

Using the CLI:
```bash
npx orch status
```

## 4. Use via MCP

In Claude Code, add the MCP server:
```bash
claude mcp add orch npx --yes @undrestrator/mcp-server
```
