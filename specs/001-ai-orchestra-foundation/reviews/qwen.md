## SpecKit Review: 001-ai-orchestra-foundation

**Reviewer**: `claude`  
**Reviewed at**: 2026-05-22T13:41:48+03:00  
**Commit**: HEAD

---

### Summary

The AI Orchestra Foundation spec is **well-structured and comprehensive**, covering the essential components of a multi-service orchestration platform. The architecture follows sensible patterns (Docker Compose profiles, MCP for integration, SDK for reuse). However, several **hidden assumptions and edge cases are missing** that could cause issues in production or during integration with undrestrator/ai-digital-twins projects.

---

### Findings

| ID | Severity | Area | Finding | Recommendation |
|----|----------|------|---------|----------------|
| F1 | **CRITICAL** | Security | `infra/.env.example` references `ORCH_MCP_API_KEY` but no derivation/rotation strategy is specified. If compromised, attacker gains full MCP access to all services. | Add `.specify/memory/security.md` entry: derive key from `openssl rand -base64 32`, rotate every 90 days, store in HashiCorp Vault or AWS Secrets Manager for production. Document `ORCH_MCP_API_KEY=derived_from_secret:<vault_id>` pattern. |
| F2 | **CRITICAL** | Security | FR-017 states stdio transport "inherits OS-level access control" — but what if the container runs as root? A compromised host process could read all service secrets via `/proc/<pid>/environ`. | Add `FR-017B`: Run MCP server container with `--user 1000:1000` (non-root) and mount `.env` read-only. Document that stdio auth is "implicit trust" — suitable for local dev, not shared environments. |
| F3 | **HIGH** | Failure mode | No circuit breaker or fallback specified when **all 6 services are down simultaneously**. OmniRoute has its own fallback chain (FR-004), but what about the orchestra as a whole? | Add `FR-018`: MCP/CLI MUST expose `orch_circuit_breaker` tool to manually reset all service connections. Document auto-recovery: MCP should retry with exponential backoff (max 5 min) before returning error. |
| F4 | **HIGH** | Edge case | User Story 1 mentions "all 6 core services" but FR-008 lists only 4 profiles (`minimal`, `coding`, `business`, `full`). What about a `rag` profile for ai-digital-twins that needs Qdrant + OmniRoute without Hermes/n8n? | Add `FR-008B`: Support at least one additional profile: `rag` (Qdrant + OmniRoute only). Document in `infra/README.md`. |
| F5 | **HIGH** | Data model | `VectorCollection.project_owner` exists but no mechanism for **cross-project sharing**. If undrestrator and ai-digital-twins need to share embeddings, how? | Add `FR-010B`: Support collection aliases via SDK: `createVectorStore({ collection: 'shared-auth', alias: 'undrestrator-auth' })`. Document in `contracts/sdk-interfaces.ts`. |
| F6 | **MEDIUM** | Hidden assumption | User Story 5 assumes both projects use the **same version** of `@undrestrator/infra-client`. What happens if undrestrator upgrades to v2.0 while ai-digital-twins is on v1.x? | Add `FR-007B`: SDK MUST support semantic versioning with backward-compatible APIs. Document breaking changes in `CHANGELOG.md` and provide migration guide. Consider major version bump for significant API changes. |
| F7 | **MEDIUM** | Performance | FR-004 mentions "<500ms routing overhead" but doesn't specify **what's included**: is this cold-start time, or steady-state? Ollama model loading alone can take 30s+. | Clarify: "Steady-state routing overhead <500ms after services are healthy. Cold start (Ollama model load) may take 120-360s depending on model size." Add to `plan.md` Technical Context. |
| F8 | **MEDIUM** | Edge case | User Story 6 mentions "Ollama auto-pulls configured models" but doesn't specify **which models**. If the user has limited disk space, this could fill it up. | Add `FR-014B`: Ollama MUST read model list from `.env` (e.g., `OLLAMA_MODELS="hermes3,nomic-embed-text"`). Default to minimal set if not configured. Document in `infra/.env.example`. |
| F9 | **LOW** | Stakeholder clarity | "Hermes Agent" is mentioned frequently but never defined for non-technical readers. What does it actually *do*? | Add a "What is Hermes?" section to `quickstart.md`: "Hermes Agent is an AI runtime that provides persistent memory, self-improving skills, and multi-channel communication (Telegram, Discord, etc.). Think of it as the 'brain' that orchestrates conversations across platforms." |
| F10 | **LOW** | Edge case | User Story 3 mentions `orch vector search "authentication"` but doesn't specify **search parameters**: filters, limit, offset, min_score. | Add `FR-003B`: CLI MUST support optional parameters: `orch vector --filter "type=auth" --limit 10 --min-score 0.85`. Document in `contracts/cli-commands.md`. |

---

### Alternative Approaches Considered

| Finding | Author's Approach | Alternative | Trade-off |
|---------|------------------|-------------|-----------|
| F4 (Profiles) | Extend existing profiles list | Add separate `rag` profile | **Author's**: Simpler mental model, fewer options to remember. **Alternative**: More flexible for specialized use cases like RAG-only setups. |
| F5 (Cross-project sharing) | Collection aliases via SDK | Shared namespace with project-scoped collections | **Author's**: Cleaner API (`createVectorStore({ alias: 'shared' })`). **Alternative**: Easier to debug ("show all undrestrator-* collections"). |

---

### VERDICT

```yaml
verdict: MEDIUM
reviewer: claude
reviewed_at: 2026-05-22T13:41:48+03:00
commit: HEAD
critical_count: 2
high_count: 4
medium_count: 4
low_count: 2
```

**Rationale**: Two CRITICAL findings (security) and four HIGH findings (failure modes, edge cases) should be addressed before `/speckit.implement`. The core architecture is sound, but the security assumptions around MCP auth and service failure recovery need explicit handling.

---

### Top-3 Findings by Severity

1. **F2 (CRITICAL)**: Stdio transport OS-level access assumption — needs `--user` flag documentation for production safety
2. **F4 (HIGH)**: Missing `rag` profile for ai-digital-twins use case
3. **F5 (HIGH)**: Cross-project Qdrant sharing mechanism undefined

---

**Gate reminder**: `/speckit.implement` requires this review to be **PASS** (or overridden with `--override-gate <reason>` per Principle VI). Consider addressing F1-F4 before implementation, or document the override rationale clearly.