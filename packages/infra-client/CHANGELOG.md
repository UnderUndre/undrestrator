# Changelog

All notable changes to `@undrestrator/infra-client` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-22

### Added
- `createLLMClient()` — OmniRoute chat completions and streaming via OpenAI-compatible API
- `createVectorStore()` — Qdrant collection management with auto-init, upsert, and search
- `createQueue()` — BullMQ-backed job queue with Redis
- `createHermesClient()` — Hermes Agent chat and skill management API
- Collection alias support via `createVectorStore({ alias })` config option
- Deterministic embedding fallback in CLI for offline testing

### Breaking Changes
None. This is the initial release.

## Semver Policy

- **PATCH** (0.1.x): Bug fixes, performance improvements, non-breaking internal changes
- **MINOR** (0.x.0): New features, new exported functions, backward-compatible API additions
- **MAJOR** (x.0.0): Breaking changes to exported function signatures or config interfaces

### Breaking Change Migration Guide
When a major version bump occurs, a migration guide will be added here with specific upgrade instructions.
