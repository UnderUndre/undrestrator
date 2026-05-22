# Data Model

## Infrastructure Entities

### Service
Represents a running Docker container.
- `name`: string (e.g., "omniroute")
- `image`: string
- `port`: number
- `health_url`: string
- `profile`: 'minimal' | 'coding' | 'business' | 'full'
- `status`: 'healthy' | 'unhealthy' | 'stopped'

### LLMRoute
Routing rules for OmniRoute.
- `provider`: 'ollama' | 'openai' | 'anthropic' | etc
- `model`: string
- `priority`: number
- `fallback_chain`: string[]
- `cost_limit`: number

### VectorCollection
Qdrant collection configuration.
- `name`: string
- `dimension`: number
- `distance_metric`: 'Cosine' | 'Euclid' | 'Dot'
- `project_owner`: string

### HermesSkill
Skills available to Hermes Agent.
- `name`: string
- `description`: string
- `trigger`: string
- `auto_created`: boolean
- `last_used`: timestamp

### Workflow
n8n automation workflows.
- `id`: string
- `name`: string
- `trigger_type`: string
- `webhook_url`: string
- `active`: boolean

### OrchTool
An MCP tool exposed by the server.
- `name`: string
- `description`: string
- `input_schema`: JSONSchema
- `handler`: function
