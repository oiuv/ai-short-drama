# Repository Guidelines

## Product Positioning & Non-Negotiable Scope

**雪风AI短剧工坊** is an open-source, local, single-user workstation that takes one story through the complete film-production flow:

1. 剧本
2. 角色
3. 空镜场景
4. 道具
5. 分镜
6. 剪辑成片

The scope is the **爽剧创作 workflow from the XuefengAI film studio**, not the full commercial XuefengAI platform. Keep this six-step workflow usable end to end, but do not migrate unrelated tools or platform capabilities unless the user explicitly requests them.

Do not add user registration, login, accounts, permissions, points, billing, subscriptions, multi-user collaboration, organizations, admin consoles, OSS/CDN storage, cloud asset libraries, commercial task infrastructure, or other online-operation features. Do not add professional novel adaptation, general-purpose screenplay creation, or uploaded-personal-script workflows unless explicitly requested. The README should direct users who need those professional workflows to **有彩视界** at <https://youcai.art>.

Judge every proposed feature against this positioning. Prefer the smallest change that strengthens the six-step local 爽剧 workflow; do not build speculative abstractions for possible future SaaS use.

## Clean-Break Data & Refactoring Policy

This repository is not a continuously operated online service. Runtime application code has no backward-compatibility obligation for obsolete schemas, API shapes, stored-data formats, component contracts, prompt contracts, or implementations. When a requirement changes, refactor the canonical implementation directly.

- Never add legacy readers, dual-write paths, deprecated fields, compatibility adapters, version switches, or fallback branches merely to preserve an obsolete implementation.
- Update the canonical schema, types, APIs, tests, and call sites together. Delete obsolete paths instead of keeping parallel implementations.
- Preserve existing local data through explicit maintenance migrations when that can be done without deleting or overwriting user records. A migration is not a runtime compatibility layer.
- Store migrations under `scripts/migrations/`. Every migration filename and ID must begin with a 14-digit local timestamp in `YYYYMMDDHHmmss-description.ts` form, run in chronological order, and be registered explicitly.
- Every migration must be safe to run repeatedly, execute atomically in a transaction, inspect current state before changing it, and preserve existing rows and media references. Do not use destructive `DROP`, `TRUNCATE`, unconditional `DELETE`, or value-overwriting updates in a migration.
- Migrations have no automatic rollback/down path. If a change cannot be migrated safely, document that limitation and require a backed-up clean data directory.
- Runtime startup and `db:init` must not auto-run maintenance migrations. Run `npm run db:migrate` explicitly while the application is stopped, then restart it.
- Migration tests must use a temporary `DATA_DIR`, run the same migration at least twice, and assert that existing data remains unchanged.
- Only individual image and video version records use database soft deletion; default media-version reads must exclude those rows. Projects, episodes, entity descriptions, shots, and edit drafts are current-state text/workflow records and do not retain historical versions when deleted, regenerated, or rewritten.
- Persistent local images, videos, and exported films are never physically removed by application deletion or regeneration. Parent workflow records may be deleted normally; temporary working files may still be cleaned after their operation finishes.

## XuefengAI Reference Boundary

Treat `C:\AI\XuefengAI` as the read-only behavioral and data reference for the scoped 爽剧 film-studio workflow. Inspect it before inventing different field meanings, generation states, step behavior, Skill rules, visual-style data, or bundled style assets. Copy only what belongs to this product's scope.

XuefengAI is authoritative for the scoped workflow, professional Skill standards, prompt/output contracts, quality rules, and relevant product interactions. It is **not** automatically authoritative for this repository's provider, model ID, endpoint, token/context limits, thinking controls, streaming flags, timeouts, or other inference parameters. Select those values for the provider and model actually configured here and verify them against that provider's current official documentation.

Preserve these intentional local-project differences:

- no accounts, points, OSS, or SaaS operations;
- provider image inputs use Base64/data URLs and generated media is persisted locally;
- project state uses local SQLite and media files under ignored `data/`;
- the default LLM is `deepseek-v4-flash` for all current text/Skill calls, using the configured maximum output limit; do not copy XuefengAI's per-feature model routing;
- image generation uses Seedream 5.0 Lite, and storyboard video uses the Seedance 2.0 series.
- `drama-script` produces the episode scripts and their character looks, empty-shot scenes, and props in one generation, and the application stores those assets automatically. Do not add a separate asset-extraction step or a standalone `drama-cast-scene` runtime Skill.
- character voice consistency is text-only: keep `voiceDescription` and pass it into storyboard prompting, but do not add voice-sample uploads, generated voice samples, or audio-reference binding.
- editing and final export use the local FFmpeg pipeline. Do not migrate or add XuefengAI's WebGPU editor unless the user explicitly changes this decision.

Use provider documentation under the XuefengAI reference project's `docs/official/` only when it matches the provider and model used here; otherwise consult the current provider's official documentation. Provider changes must include mocked request-contract and response-parser tests for the exact current parameters.

## Skills & AI Contracts

Skills are standalone standardized prompt packages under `skills/<name>/SKILL.md`. Keep Skill frontmatter and instructions independent from application configuration: no model IDs, API keys, token limits, response-format flags, permissions, or environment-specific parameters inside a Skill. Runtime model selection and structured-response enforcement belong in the application/provider layer.

Preserve the professional Skill behavior required by this workflow, including exact episode-range control, optional planned total episodes, continuation, targeted rewriting, asset separation, absolute episode references, and shot-ready output. When changing a Skill contract, update provider prompts, schemas, parsers, tests, and README documentation in the same change.

Do not add different LLM models for individual Skills unless the user explicitly changes the model policy. Keep output token limits at the application's supported maximum rather than silently reducing them.

## Project-Specific Product Constraints

- Project creation offers only `16:9` and `9:16` ratios.
- Genres use the maintained preset list plus a custom option.
- Visual styles and their bundled assets follow the scoped XuefengAI film-studio source data.

## Verification & Safety

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before submitting code. Never call real AI services in automated tests. SQLite tests must use a temporary `DATA_DIR` and must never touch the user's `data/studio.sqlite` or `data/media`.

Never commit secrets, databases, generated media, or user content. This unauthenticated application must not be exposed directly to the internet. Treat `C:\AI\XuefengAI` as read-only; modify only this repository. Do not make real paid model calls, upload user media, publish deployments, or mutate external systems during development or automated verification unless the user explicitly authorizes it.
