# clai-helpers

CLI tool that treats `.claude/` as the single source of truth for AI-tool configuration and transpiles it into GitHub Copilot (`.github/`), Google Gemini (`.gemini/`), and other AI-tool file formats.

Write once in Claude format. Sync everywhere.

## Table of Contents

- [Quick Start](#quick-start)
- [Commands](#commands)
- [Fleet](#fleet)
- [Global Flags](#global-flags)
- [Protected Slots](#protected-slots)
- [Configuration](#configuration)
- [Transformers](#transformers)
- [Lock File](#lock-file)
- [CI Integration](#ci-integration)
- [Programmatic API](#programmatic-api)
- [Development](#development)

## Quick Start

### Prerequisites

- Node.js 20+
- npm (comes with Node)

### Bootstrap a project

```bash
npx clai-helpers init
```

This will:

1. Download the latest tagged release from the source repo
2. Copy `.claude/` files (commands, agents, persona, CLAUDE.md)
3. Generate `.github/prompts/`, `.github/instructions/`, `.github/copilot-instructions.md` for Copilot
4. Generate `.gemini/commands/`, `.gemini/agents/`, `GEMINI.md` for Gemini
5. Create `helpers-lock.json` — **commit this file** (same convention as `package-lock.json`; needed for `status --strict` and team-wide drift detection)
6. Append `.helpers/` to your `.gitignore` (staging dir used for atomic writes — must never be committed). Idempotent: existing entries are detected and not duplicated.

### Pin to a specific version

```bash
npx clai-helpers init --version v1.0.0
```

### Generate only specific targets

```bash
npx clai-helpers init --targets claude,copilot
```

### Update to latest

```bash
npx clai-helpers sync --upgrade
```

## Commands

### `helpers init`

Bootstrap a new project from the source repo.

```bash
helpers init [options]
```

| Flag                     | Type    | Default                     | Description                           |
| ------------------------ | ------- | --------------------------- | ------------------------------------- |
| `--source <url>`         | string  | `github:underundre/helpers` | Source repo URL                       |
| `--version <tag>`        | string  | latest tag                  | Pin to specific version tag           |
| `--ref <ref>`            | string  | --                          | Branch or SHA (overrides `--version`) |
| `--targets <list>`       | string  | `claude,copilot,gemini`     | Comma-separated target names          |
| `--source-config <path>` | string  | --                          | Local manifest override               |
| `--trust-custom`         | boolean | `false`                     | Pre-approve custom transformers       |

### `helpers regen`

Regenerate downstream targets **in-place** from the local `helpers.config.ts`. No network fetch, no lockfile. Intended for **upstream template repos** that maintain generated outputs alongside sources (like UnderUndre/ai itself) and need to refresh them after editing the `.claude/` tree.

```bash
helpers regen                   # all targets
helpers regen --targets copilot # only copilot
helpers regen --dry-run         # preview
```

Refuses to run if no `helpers.config.ts` is found in cwd. Consumer projects should use `sync` (or `init` for first setup) instead.

| Flag                     | Type    | Default | Description                                   |
| ------------------------ | ------- | ------- | --------------------------------------------- |
| `--targets <list>`       | string  | ALL     | Comma-separated target names                  |
| `--source-config <path>` | string  | --      | Override `helpers.config.ts` location         |
| `--trust-custom`         | boolean | false   | Pre-approve custom transformers               |

### `helpers sync`

Update an existing project from the source repo. Without `--upgrade`, heals drift only.

Refuses to run if cwd contains `helpers.config.ts` (upstream-template layout) — running `sync` there would overwrite local authoring work. Use `helpers regen` instead, or pass `--allow-self-sync` to override.

```bash
helpers sync [options]
```

| Flag                     | Type    | Default | Description                     |
| ------------------------ | ------- | ------- | ------------------------------- |
| `--upgrade`              | boolean | `false` | Move to latest version          |
| `--version <tag>`        | string  | --      | Move to specific version        |
| `--ref <ref>`            | string  | --      | Branch or SHA                   |
| `--source-config <path>` | string  | --      | Local manifest override         |
| `--trust-custom`         | boolean | `false` | Pre-approve custom transformers |

### `helpers status`

Show current state of all tracked files.

```bash
helpers status [options]
```

| Flag               | Type    | Default | Description                    |
| ------------------ | ------- | ------- | ------------------------------ |
| `--strict`         | boolean | `false` | Exit code 2 on drift (CI-safe) |
| `--targets <list>` | string  | all     | Filter to specific targets     |

Human output: table with columns path, kind, class, status, drift (y/n).

JSON output (`--json`): array of lock file entries with computed drift boolean.

### `helpers diff`

Preview what would change on the next sync.

```bash
helpers diff [path...]
```

| Flag               | Type   | Default | Description                |
| ------------------ | ------ | ------- | -------------------------- |
| `--targets <list>` | string | all     | Filter to specific targets |

### `helpers eject`

Untrack a file but keep it on disk. The file will no longer be managed by sync.

```bash
helpers eject <path> [options]
```

| Flag        | Type    | Default | Description                        |
| ----------- | ------- | ------- | ---------------------------------- |
| `--cascade` | boolean | `false` | Also untrack generated descendants |

### `helpers remove`

Delete a file from disk and untrack it. **Destructive** -- requires `--yes` or `--interactive`.

```bash
helpers remove <path>
```

### `helpers add-target`

Enable a new target and generate its files.

```bash
helpers add-target <name>
```

Example: `helpers add-target copilot`

### `helpers remove-target`

Delete all files for a target and untrack them. **Destructive** -- requires `--yes` or `--interactive`.

```bash
helpers remove-target <name>
```

### `helpers list-transformers`

List all available transformers (built-in and custom).

```bash
helpers list-transformers [--json]
```

### `helpers doctor`

Verify lock file integrity and file hashes on disk.

```bash
helpers doctor [--fix] [--clean]
```

| Flag      | Description                                                                        |
| --------- | ---------------------------------------------------------------------------------- |
| `--fix`   | Auto-correct safe issues (rebuild staging dir, recalculate hashes)                 |
| `--clean` | Delete leftover `.helpers_new` side-files from non-interactive conflict resolution |

### `helpers recover`

Recover from a crashed sync or init run. Exactly one of the three flags is required.

```bash
helpers recover <--resume | --rollback | --abandon>
```

| Flag         | Description                                                                      |
| ------------ | -------------------------------------------------------------------------------- |
| `--resume`   | Re-attempt from first incomplete journal entry                                   |
| `--rollback` | Restore backups, return to pre-sync state                                        |
| `--abandon`  | Delete journal + backups, leave files as-is. **Destructive** -- requires `--yes` |

## Fleet

Manage clai-helpers across multiple GitHub repos from a single machine. Fleet discovers all repos with `helpers-lock.json`, reports drift, and syncs them in bulk.

### Prerequisites

Fleet commands require a GitHub token. Auth resolution chain:

1. `--auth <token>` flag (if provided)
2. `GH_TOKEN` environment variable
3. `GIGET_AUTH` environment variable
4. `gh auth token` (GitHub CLI, if installed)

```bash
export GH_TOKEN=ghp_your_token_here
# or: gh auth login
```

### `helpers fleet list`

Discover all GitHub repos with clai-helpers installed and display their status.

```bash
helpers fleet list [options]
```

| Flag         | Type    | Default | Description                      |
| ------------ | ------- | ------- | -------------------------------- |
| `--filter`   | string  | --      | Glob pattern to filter repos     |
| `--json`     | boolean | `false` | Output as JSON                   |
| `--no-color` | boolean | `false` | Disable colored output           |
| `--verbose`  | boolean | `false` | Extended logging                 |

Running `helpers fleet` without a subcommand delegates to `fleet list`.

### `helpers fleet sync`

Sync clai-helpers across selected GitHub repos. Three modes available:

```bash
helpers fleet sync [options]
```

| Flag             | Type    | Default | Description                                  |
| ---------------- | ------- | ------- | -------------------------------------------- |
| `--all`          | boolean | `false` | Sync all active repos                        |
| `--repo <name>`  | string  | --      | Sync specific repo(s). Repeatable            |
| `--filter <pat>` | string  | --      | Sync repos matching glob pattern             |
| `--mode`         | string  | `pr`    | Sync mode: `pr`, `push`, or `patch`          |
| `--patch-output` | string  | `./.fleet-patches` | Output directory for patch files    |
| `--yes`          | boolean | `false` | Auto-confirm (non-interactive)               |
| `--dry-run`      | boolean | `false` | Preview without making changes               |

Selection flags (`--all`, `--repo`, `--filter`) are mutually exclusive. In interactive mode (TTY), a picker UI is shown when no selection flag is provided.

#### Sync modes

| Mode    | Description                                                        |
| ------- | ------------------------------------------------------------------ |
| `pr`    | Create a pull request per repo (default). Safe for protected branches. |
| `push`  | Commit and push directly to the default branch. Requires `--yes` in non-interactive. |
| `patch` | Generate `.patch` files to disk. No git operations. Useful for review. |

#### Examples

```bash
# PR mode (default) — create a PR for a single repo
helpers fleet sync --repo owner/repo --mode pr

# Push mode — sync all repos, auto-confirm
helpers fleet sync --all --mode push --yes

# Patch mode — generate patches for all repos
helpers fleet sync --all --mode patch --patch-output ./.fleet-patches

# Dry run — preview what would change
helpers fleet sync --all --mode pr --dry-run
```

### `helpers fleet add-org`

Add a GitHub organization to the fleet discovery scope.

```bash
helpers fleet add-org <org>
```

### `helpers fleet remove-org`

Remove a GitHub organization from the fleet discovery scope.

```bash
helpers fleet remove-org <org>
```

### Common errors

| Error                              | Likely cause                                       | Fix                                                                  |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `auth required: ...`               | No token in env or `gh auth`                       | `export GH_TOKEN=...` or `gh auth login`                            |
| `github/rate-limited`              | >5000 API calls/h hit                              | Wait until reset (printed in error message)                         |
| `git/push-rejected (branch protection)` | Branch protection requires reviewers          | Use `--mode pr` instead of `--mode push`                            |
| `lockfile/malformed`               | A repo's `helpers-lock.json` is broken             | Open the repo, fix manually, re-run                                 |
| `config/malformed`                 | Typo in `~/.config/clai-helpers/fleet.json`        | Error message names the field; fix and re-run                       |

For deeper documentation, see [`specs/003-fleet-sync/quickstart.md`](../../specs/003-fleet-sync/quickstart.md).

## Global Flags

These flags work with every command:

| Flag                | Type    | Default                 | Description                                                       |
| ------------------- | ------- | ----------------------- | ----------------------------------------------------------------- |
| `--dry-run`         | boolean | `false`                 | Print plan, write nothing. Exit 0.                                |
| `--offline`         | boolean | `false`                 | No network. Use giget cache.                                      |
| `--non-interactive` | boolean | `true`                  | Never prompt. CI-safe.                                            |
| `--interactive`     | boolean | `false`                 | Prompt on conflicts. Mutually exclusive with `--non-interactive`. |
| `--yes`             | boolean | `false`                 | Auto-confirm destructive operations.                              |
| `--no-color`        | boolean | respects `NO_COLOR` env | Disable color output.                                             |
| `--json`            | boolean | `false`                 | Output JSON instead of human-readable.                            |
| `--verbose`         | boolean | `false`                 | Extended logging.                                                 |

## Exit Codes

| Code   | Meaning                                            |
| ------ | -------------------------------------------------- |
| `0`    | Success                                            |
| `1`    | Usage error (bad flags, unknown target)            |
| `2`    | Drift or conflicts detected (non-interactive mode) |
| `3`    | Stale journal -- run `helpers recover`             |
| `4`    | Untrusted custom transformer                       |
| `5`    | Lock file schema mismatch                          |
| `>=10` | Internal error                                     |

## Protected Slots

Protected Slots let you inject project-specific content into managed files that survives across syncs.

### Syntax

Wrap your custom content with slot markers:

```md
# Some managed section (updated on sync)

<!-- HELPERS:CUSTOM START -->
Your project-specific content here.
This block is preserved across every sync.
<!-- HELPERS:CUSTOM END -->

# Another managed section (also updated on sync)
```

### How it works

1. On `sync`, the tool computes a **canonical hash** of each file with slot bodies replaced by a placeholder. This means changes inside slots never count as drift.
2. A separate **slots hash** tracks the slot content itself, so `status` can report slot changes independently.
3. Slot markers are literal HTML comments. They must appear on their own lines.

### Rules

- Slot markers must be paired: every `START` needs a matching `END`.
- Slot content is never overwritten by sync.
- Slot content IS included when copying source files to disk -- only the hash comparison ignores it.
- You can have multiple slots per file.

## Configuration

The source repo provides a `helpers.config.ts` (or `.js`, `.mjs`, `.json`) at its root. This is the manifest that defines what gets synced and how.

### Example

```ts
import { defineHelpersConfig } from "clai-helpers";

export default defineHelpersConfig({
  version: 1,

  sources: [
    "commands/**/*.md",
    "agents/**/*.md",
    "skills/**/*.md",
    "CLAUDE.md",
    "settings.json",
  ],

  targets: {
    claude: {
      pipelines: [
        {
          transformer: "identity",
          match: "**/*",
          output: ".claude/{{relativePath}}",
        },
        {
          transformer: "identity",
          match: "CLAUDE.md",
          output: "CLAUDE.md",
          class: "core",
        },
        {
          transformer: "identity",
          match: "settings.json",
          output: ".claude/settings.json",
          class: "config", // written only on init, never overwritten
        },
      ],
    },

    copilot: {
      pipelines: [
        {
          transformer: "claude-to-copilot-prompt",
          match: "commands/**/*.md",
          output: ".github/prompts/{{name}}.prompt.md",
        },
        {
          transformer: "claude-to-copilot-instructions",
          match: "agents/**/*.md",
          output: ".github/instructions/{{name}}.instructions.md",
        },
        {
          transformer: "claude-to-copilot-root-instructions",
          match: "CLAUDE.md",
          output: ".github/copilot-instructions.md",
        },
      ],
    },

    gemini: {
      pipelines: [
        {
          transformer: "claude-to-gemini-command",
          match: "commands/**/*.md",
          output: ".gemini/commands/{{name}}.toml",
        },
        {
          transformer: "claude-to-gemini-agent",
          match: "agents/**/*.md",
          output: ".gemini/agents/{{name}}.md",
        },
        {
          transformer: "claude-to-gemini-root",
          match: "CLAUDE.md",
          output: "GEMINI.md",
        },
      ],
    },
  },
});
```

### Template variables

| Variable           | Expands to                                                                 | Example                                                        |
| ------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `{{name}}`         | Filename stem (no extension)                                               | `commit` from `.claude/commands/commit.md`                     |
| `{{relativePath}}` | Full source path verbatim                                                  | `.claude/commands/commit.md`                                   |
| `{{subpath}}`      | Source path minus the match's non-wildcard prefix (re-root a subtree)      | `commit.md` (match `.claude/commands/**/*`, source as above)   |
| `{{ext}}`          | Original extension with dot                                                | `.md`                                                          |

Use `{{subpath}}` when you want to **move** a directory tree to a new root while preserving the relative structure underneath. E.g. `{ match: ".claude/agents/**/*", output: ".agent/agents/{{subpath}}" }` turns `.claude/agents/x/y.md` into `.agent/agents/x/y.md` — not `.agent/agents/.claude/agents/x/y.md` (which is what `{{relativePath}}` would produce).

### File classes

| Class    | Behavior                                                       |
| -------- | -------------------------------------------------------------- |
| `core`   | Written on init, updated on every sync. Default.               |
| `config` | Written on init only. Never overwritten by sync.               |
| `binary` | Treated as opaque bytes. No slot parsing, no header injection. |

### Local overrides

Use `--source-config` to layer a local config on top of the source manifest:

```bash
helpers sync --source-config ./helpers.local.config.ts
```

Local additions win. The source manifest provides defaults. This lets you add custom targets (e.g., Cursor) or override pipelines without forking the source repo.

## Transformers

### Built-in transformers

| Name                                  | Source match       | Output                                          |
| ------------------------------------- | ------------------ | ----------------------------------------------- |
| `identity`                            | Any                | Same path (used for `.claude/` copy)            |
| `claude-to-copilot-prompt`            | `commands/**/*.md` | `.github/prompts/{{name}}.prompt.md`            |
| `claude-to-copilot-instructions`      | `agents/**/*.md`   | `.github/instructions/{{name}}.instructions.md` |
| `claude-to-copilot-root-instructions` | `CLAUDE.md`        | `.github/copilot-instructions.md`               |
| `claude-to-gemini-command`            | `commands/**/*.md` | `.gemini/commands/{{name}}.toml`                |
| `claude-to-gemini-agent`              | `agents/**/*.md`   | `.gemini/agents/{{name}}.md`                    |
| `claude-to-gemini-root`               | `CLAUDE.md`        | `GEMINI.md`                                     |

### Writing a custom transformer

A custom transformer is a `.ts` or `.js` file that exports a default function matching the `TransformerFn` signature:

```ts
import type { TransformerFn, ParsedFile, RenderedFile, TransformContext } from "clai-helpers";
import { FileKind } from "clai-helpers";

const transform: TransformerFn = (source: ParsedFile, ctx: TransformContext): RenderedFile | null => {
  // Skip files that don't apply
  if (source.extension !== ".md") return null;

  return {
    targetPath: `.cursor/prompts/${source.sourcePath}`,
    content: source.body,
    kind: FileKind.Generated,
    fromSource: source.sourcePath,
    transformer: "my-cursor-transformer",
  };
};

export default transform;
```

#### Input: `ParsedFile`

| Field         | Type                                     | Description                                         |
| ------------- | ---------------------------------------- | --------------------------------------------------- |
| `sourcePath`  | string                                   | Relative to `.claude/` (e.g., `commands/commit.md`) |
| `content`     | string                                   | Raw file content (UTF-8, LF-normalized)             |
| `frontmatter` | `Record<string, unknown>` or `undefined` | Parsed YAML frontmatter                             |
| `body`        | string                                   | Content after frontmatter delimiter                 |
| `extension`   | string                                   | File extension including dot (e.g., `.md`)          |

#### Input: `TransformContext`

| Field          | Type            | Description                           |
| -------------- | --------------- | ------------------------------------- |
| `sourceCommit` | string          | Full SHA of the source repo commit    |
| `toolVersion`  | string          | Package version (e.g., `0.1.0`)       |
| `targetName`   | string          | Target name this transformer runs for |
| `config`       | `HelpersConfig` | Full resolved manifest                |

#### Output: `RenderedFile`

| Field         | Type                 | Description                                           |
| ------------- | -------------------- | ----------------------------------------------------- |
| `targetPath`  | string               | Output path relative to project root                  |
| `content`     | string               | Full rendered content including auto-generated header |
| `kind`        | `FileKind.Generated` | Always `Generated` for transformer outputs            |
| `fromSource`  | string               | Source file path this was generated from              |
| `transformer` | string               | Transformer name for provenance tracking              |

#### Return semantics

| Return value     | Meaning                               |
| ---------------- | ------------------------------------- |
| `RenderedFile`   | One output file                       |
| `RenderedFile[]` | Multiple output files from one source |
| `null`           | Skip this source (no output)          |
| Throws           | Abort the entire sync                 |

#### Rules

- Must be a **pure function**: no side effects, no network calls, no filesystem access.
- Return `null` to skip -- do not throw for non-applicable sources.
- Custom transformers are subject to the **trust model**: their hash is pinned in the lock file. If the file changes, trust is revoked until re-approved.

### Referencing a custom transformer

In your manifest, use the file path instead of a built-in name:

```ts
{
  transformer: "./transformers/my-cursor.ts",
  match: "commands/**/*.md",
  output: ".cursor/prompts/{{name}}.md",
}
```

On first use, the CLI will prompt for trust approval (or use `--trust-custom` to pre-approve).

## Lock File

`helpers-lock.json` lives at the project root and tracks every managed file. **Commit this file to git.**

### What it tracks

- **Source metadata**: repo URL, ref, resolved commit SHA
- **Active targets**: which targets are enabled
- **Trusted transformers**: hash-pinned custom transformers
- **File entries**: path, kind (source/generated), class, hashes, status

### Hash types

| Hash           | Applied to              | Purpose                                                                                                                   |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Canonical hash | Source files            | Content hash with slot bodies replaced by placeholders. Detects upstream changes without false positives from slot edits. |
| Slots hash     | Source files with slots | Hash of concatenated slot bodies. Tracks local customizations.                                                            |
| Rendered hash  | Generated files         | Hash of full output including auto-generated header. Detects manual edits to generated files.                             |

### Drift detection

| File kind       | Drift condition                                         |
| --------------- | ------------------------------------------------------- |
| Source (core)   | Local canonical hash differs from source canonical hash |
| Source (config) | Never drifts -- config files are init-only              |
| Generated       | Local rendered hash differs from expected rendered hash |
| Ejected         | Not checked                                             |

## CI Integration

Use `helpers status --strict` in your CI pipeline to catch drift:

```yaml
# GitHub Actions example
- name: Check AI config drift
  run: npx clai-helpers status --strict
```

Exit code `2` means someone manually edited a managed file. The tool is non-interactive by default, so it works in CI without any extra flags.

For JSON output in CI scripts:

```bash
npx clai-helpers status --strict --json
```

### Recommended workflow

1. Developers run `helpers sync --upgrade` locally when updating
2. CI runs `helpers status --strict` to ensure generated files are committed
3. If drift is detected, the developer re-runs `helpers sync` and commits the result

## Programmatic API

The package exports types and utilities for custom transformer authoring and programmatic use:

```ts
import {
  // Config helper
  defineHelpersConfig,

  // Enums
  FileKind,
  FileClass,
  FileStatus,
  ExitCode,
} from "clai-helpers";

import type {
  // Config types
  HelpersConfig,
  TargetConfig,
  TransformerPipeline,

  // Transformer types
  TransformerFn,
  ParsedFile,
  RenderedFile,
  TransformContext,
} from "clai-helpers";
```

## Development

### Setup

```bash
git clone https://github.com/underundre/ai.git
cd ai/packages/cli
npm install
```

### Scripts

| Command                    | Description                 |
| -------------------------- | --------------------------- |
| `npm run build`            | Compile TypeScript          |
| `npm run dev`              | Watch mode compilation      |
| `npm test`                 | Run all tests (vitest)      |
| `npm run test:unit`        | Unit tests only             |
| `npm run test:integration` | Integration tests only      |
| `npm run test:watch`       | Watch mode tests            |
| `npm run validate`         | Type-check without emitting |

### Project structure

```
packages/cli/
  bin/helpers.mjs          # npx entry point
  src/
    index.ts               # Public API exports
    cli.ts                 # CLI entry (citty setup, subcommand routing)
    cli/                   # Command handlers (one per command)
    core/                  # Business logic (fetch, lock, slots, hash, journal, etc.)
    transformers/          # Built-in transformer implementations + registry
    types/                 # TypeScript type definitions
  tests/
    unit/                  # Unit tests
    integration/           # Integration tests
    fixtures/              # Test fixtures (source repo sim, golden outputs)
```

### Tech stack

- **TypeScript 5.x** -- strict mode, ESM
- **citty** -- CLI framework with typed args and subcommands
- **giget** -- git repo fetch with caching
- **c12** -- TypeScript config loader with layering
- **consola** -- logging with `NO_COLOR` support
- **pathe** -- cross-platform path handling
- **defu** -- deep defaults for config merging
- **vitest** -- test runner

## License

MIT
