# CLI Commands Contract

> Source of truth for the `orch` CLI surface area.
> Implementation: `packages/cli/src/index.ts`

## Commands

### `orch status`

Reports health, port mapping, and container status of all orchestra services.

| Flag | Description |
|------|-------------|
| _(none)_ | Queries OmniRoute, Qdrant, Redis, Ollama, n8n, Hermes |

---

### `orch llm <prompt>`

Routes a prompt to the best available LLM via OmniRoute.

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--model <name>` | `-m` | string | `auto` | Virtual model target (`auto`, `local`, `quality`) |
| `--system <instructions>` | `-s` | string | — | System prompt |
| `--stream` | — | flag | `false` | Stream tokens incrementally |

---

### `orch vector search <query>`

Embeds text and searches Qdrant vector store.

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--collection <name>` | `-c` | string | `default_collection` | Target collection |
| `--limit <count>` | `-l` | string | `5` | Max results |
| `--filter <json>` | `-f` | string | — | Qdrant filter JSON |
| `--min-score <threshold>` | — | string | `0` | Minimum similarity score (0–1). Results below threshold are excluded. |

---

### `orch vector upsert <text>`

Vectorizes text and indexes it in Qdrant.

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--id <id>` | — | string | **yes** | — | Unique integer or UUID identifier |
| `--collection <name>` | `-c` | string | no | `default_collection` | Target collection |
| `--payload <json>` | `-p` | string | no | `{ text }` | JSON payload merged with `{ text }` |

---

### `orch n8n list`

Lists all registered workflows in n8n. Requires `N8N_API_KEY` env var.

| Flag | Description |
|------|-------------|
| _(none)_ | Fetches all workflows with active/inactive status |

---

### `orch n8n trigger <workflowId>`

Triggers an n8n workflow via webhook.

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--payload <json>` | `-p` | string | `{}` | JSON data payload |

---

### `orch hermes chat <message>`

Send a message to the Hermes Agent runtime.

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--context <json>` | `-c` | string | `{}` | Session context data |

---

### `orch hermes skill list`

Lists all injected skills on the Hermes Agent.

| Flag | Description |
|------|-------------|
| _(none)_ | Returns active skill list |

---

### `orch hermes skill create`

Creates and injects a custom skill into Hermes.

| Flag | Short | Type | Required | Description |
|------|-------|------|----------|-------------|
| `--name <name>` | `-n` | string | **yes** | Skill name |
| `--desc <description>` | `-d` | string | **yes** | Skill description |
| `--file <filePath>` | `-f` | string | **yes** | Path to JS code file |

---

### `orch service restart <serviceName>`

Restarts a specific container service in the orchestra.

| Flag | Description |
|------|-------------|
| `<serviceName>` | Positional: `omniroute`, `qdrant`, `redis`, `ollama`, `n8n`, `hermes` |
