# Security Memory

## ORCH_MCP_API_KEY Management

- **Derivation**: Derive key using `openssl rand -base64 32`
- **Rotation**: Rotate every 90 days
- **Storage**: Store in HashiCorp Vault or AWS Secrets Manager for production.
- **Pattern**: Document `ORCH_MCP_API_KEY=derived_from_secret:<vault_id>` pattern.
