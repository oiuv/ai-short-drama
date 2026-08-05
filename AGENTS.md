# Repository Guidelines

## Product Positioning & Non-Negotiable Scope

The product name is **雪风AI短剧工坊**. It is an open-source, local, single-user workstation that takes one story through the complete six-step film-production flow:

1. 剧本
2. 角色
3. 空镜场景
4. 道具
5. 分镜
6. 剪辑成片

The scope is the **爽剧创作 workflow from the XuefengAI film studio**, not the full commercial XuefengAI platform. Keep the whole six-step workflow usable end to end, but do not migrate unrelated tools or platform capabilities unless the user explicitly requests them.

Do not add user registration, login, accounts, permissions, points, billing, subscriptions, multi-user collaboration, organizations, admin consoles, OSS/CDN storage, cloud asset libraries, commercial task infrastructure, or other online-operation features. Do not add professional novel adaptation, general-purpose screenplay creation, or uploaded-personal-script workflows unless explicitly requested. The README should direct users who need those professional workflows to **有彩视界** at <https://youcai.art>.

Judge every proposed feature against this positioning before implementing it. Prefer the smallest change that strengthens the six-step local 爽剧 workflow. Do not build speculative abstractions for possible future SaaS use.

## Clean-Break Data & Refactoring Policy

This repository is not a continuously operated online service. Runtime application code has no backward-compatibility obligation for obsolete schemas, API shapes, stored-data formats, component contracts, prompt contracts, or implementations. When a requirement changes, refactor the canonical code directly to the new design.

- Never add legacy readers, dual-write paths, deprecated fields, compatibility adapters, version switches, or fallback branches to runtime application code merely to preserve an obsolete implementation.
- Update the canonical schema, types, APIs, tests, and call sites together. Delete obsolete paths instead of keeping two implementations.
- Preserve existing local data through explicit maintenance migrations when that can be done without deleting or overwriting user records. A migration is not a runtime compatibility layer: the application continues to know only the current schema.
- Store migrations under `scripts/migrations/`. Every migration filename and ID must begin with a 14-digit local timestamp in `YYYYMMDDHHmmss-description.ts` form, run in chronological order, and be registered explicitly.
- Every migration must be safe to run repeatedly, execute atomically in a transaction, inspect current state before changing it, and preserve existing rows and media references. Do not use destructive `DROP`, `TRUNCATE`, unconditional `DELETE`, or value-overwriting updates in a migration.
- Migrations have no automatic rollback/down path. If a change cannot be migrated safely, document that limitation and require a backed-up clean data directory instead of hiding destructive behavior in a script.
- Runtime startup and `db:init` must not auto-run maintenance migrations. Developers run `npm run db:migrate` explicitly while the application is stopped, then restart it.
- Do not confuse this policy with ordinary data safety: operations within the current schema must still avoid accidental loss of the user's current project, media, shots, or edit drafts. Add regression tests around destructive current-version operations.
- Migration tests must use a temporary `DATA_DIR`, run the same migration at least twice, and assert that existing data remains unchanged.

## XuefengAI Reference Rules

Treat `C:\AI\XuefengAI` as the read-only behavioral and data reference for the scoped 爽剧 film-studio workflow. Inspect it carefully before inventing different field meanings, generation states, step behavior, Skill rules, visual-style data, or bundled style assets. Copy only what belongs to the current product scope; do not copy commercial platform infrastructure along with a feature.

When this local project intentionally differs, preserve the local decision instead of blindly matching XuefengAI:

- no accounts, points, OSS, or SaaS operations;
- provider image inputs use Base64/data URLs and generated media is persisted locally;
- project state uses local SQLite and media files under ignored `data/`;
- the default LLM is `deepseek-v4-flash` for all current text/Skill calls, with the configured maximum output limit; do not copy XuefengAI's per-feature model routing;
- image generation uses Seedream 5.0 Lite, and storyboard video uses the Seedance 2.0 series.

Use the relevant official provider documentation under the XuefengAI reference project's `docs/official/` when adapting API contracts, especially where Base64/local storage differs from commercial URL/OSS flows.

## Skills & AI Contracts

Skills are standalone standardized prompt packages under `skills/<name>/SKILL.md`. Keep Skill frontmatter and instructions independent from application configuration: no model IDs, API keys, token limits, response-format flags, permissions, or environment-specific parameters inside a Skill. Runtime model selection and structured-response enforcement belong in the application/provider layer.

Preserve the professional Skill behavior required by the current workflow, including exact episode-range control, optional planned total episodes, continuation, targeted rewriting, asset separation, absolute episode references, and shot-ready output. When changing a Skill contract, update provider prompts, schemas, parsers, tests, and README documentation in the same change.

Do not add different LLM models for individual Skills unless the user explicitly changes the current model policy. Keep output token limits at the application's supported maximum rather than silently reducing them.

## Domain & UX Guardrails

- Use **空镜场景** consistently; do not reintroduce “无人场景”.
- Project creation offers only `16:9` and `9:16` ratios.
- Genres use the maintained preset list plus a custom option.
- Visual styles and their bundled assets follow the scoped XuefengAI film-studio source data.
- Chinese UI copy should be direct, readable, and consistent with a personal film-production workstation.
- Inputs must have explicit readable foreground, background, placeholder, caret, focus, and disabled states. Never rely on inherited colors that can produce white text on a white field.
- Avoid nested dialogs, dropdowns that expand the outer modal, and stacked inner/outer scrollbars. A modal should normally own one bounded scroll container.
- Make destructive actions explicit. Regeneration, rewriting, or deletion must state exactly which current-version data will be replaced or preserved.
- Keep the workflow focused on producing a complete film: generating shots is not the endpoint; the editing step must remain capable of producing the final playable/exportable result.

## Project Structure & Module Organization

This is a local, single-user Next.js App Router application. Pages and HTTP handlers live in `app/`; reusable UI belongs in `components/`, with workflow screens under `components/studio/`. Keep database, provider, media, prompt, and domain logic in `lib/`, and project/model options in `config/`. AI instructions live in `skills/<name>/SKILL.md`. Static assets belong in `public/` or `docs/images/`. Runtime SQLite data and generated media stay in ignored `data/`. Colocate tests with modules as `*.test.ts`.

## Build, Test, and Development Commands

- `npm install`: install the locked dependencies.
- `npm run dev`: start the local development server.
- `npm run db:init`: initialize SQLite.
- `npm run db:migrate`: explicitly run registered, timestamped, non-destructive SQLite migrations while the app is stopped.
- `npm run typecheck`: run strict TypeScript checks.
- `npm run lint`: apply the Next.js ESLint rules.
- `npm test`: run the Vitest suite once.
- `npm run build`: create the production build.
- `npm start`: serve an existing production build.

Run typecheck, lint, tests, and build before submitting code.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, and no semicolons. Prefer small typed functions and React function components. Use kebab-case filenames (`video-style-picker.tsx`), PascalCase components, and camelCase utilities. Prefer `@/` for root imports. API handlers export uppercase HTTP methods from `route.ts`. ESLint and strict TypeScript are authoritative.

## Testing Guidelines

Use Vitest. Add regressions for data loss, path safety, model constraints, state transitions, provider parsing, Skill loading, and the six-step workflow's cross-step invariants. There is no global coverage threshold; prioritize user data and core workflows. Never call real AI services in automated tests. SQLite tests must set `DATA_DIR` to a temporary directory and never touch the user's `data/studio.sqlite` or `data/media`. Tests should target the current canonical schema and behavior; do not add tests that preserve retired compatibility paths. See `docs/dev/testing-strategy.md`.

## Commit & Pull Request Guidelines

Use the existing `feat:`, `fix:`, `docs:`, or `refactor:` prefixes and keep commits focused. Pull requests should explain what and why, list verification, link issues, and include before/after screenshots for UI changes. Highlight database, environment, or model-config effects.

## Security & Agent Scope

Copy `.env.example` to `.env.local`; never commit secrets, databases, generated media, or user content. This unauthenticated app must not be exposed directly to the internet. Treat `C:\AI\XuefengAI` as read-only reference code; modify only this repository. Do not make real paid model calls, upload user media, publish deployments, or mutate external systems during development or automated verification unless the user explicitly authorizes that action.
