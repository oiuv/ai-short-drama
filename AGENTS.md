# Repository Guidelines

## Product Scope

雪风AI短剧工坊 is an open-source, local, single-user workstation for the complete 爽剧 workflow: 剧本 → 角色 → 空镜场景 → 道具 → 分镜 → 剪辑成片. Keep this six-step path usable end to end. Do not add accounts, permissions, points, billing, collaboration, admin tools, OSS/CDN storage, commercial task infrastructure, professional novel adaptation, general screenplay tools, audio generation, or H3 support unless explicitly requested. Direct users needing the broader platform to [有彩视界](https://youcai.art).

Treat `C:\AI\XuefengAI` as a read-only reference for scoped workflow behavior, Skills, prompts, data meanings, and UX. Do not copy its SaaS infrastructure or provider settings. This project uses local SQLite/Base64 media, `deepseek-v4-flash`, Seedream 5.0 Lite, and Seedance 2.0; verify provider parameters against current official documentation.

## Structure & Conventions

Next.js pages and routes live in `app/`; reusable UI in `components/` (workflow screens in `components/studio/`); database, providers, prompts, media, and domain logic in `lib/`; options in `config/`; AI packages in `skills/<name>/SKILL.md`; migrations in `scripts/migrations/`; assets in `public/` or `docs/images/`. Runtime data stays in ignored `data/`. Colocate tests as `*.test.ts`.

Use TypeScript, two-space indentation, single quotes, and no semicolons. Prefer typed small functions, PascalCase components, camelCase utilities, kebab-case filenames, and `@/` imports. Use “空镜场景” consistently. Inputs need explicit readable states; avoid nested dialogs and double scrollbars. Confirm destructive changes and state exactly what is preserved or removed.

## Data, Skills & Testing

Refactor the canonical schema directly; do not add runtime legacy readers or dual writes. Preserve user data with explicit, timestamped, idempotent, atomic migrations registered under `scripts/migrations/`. Never auto-run maintenance migrations. Run `npm run db:migrate` only while the app is stopped and after backup.

Skills must remain provider-independent. Contract changes require matching schema, parser, prompt, test, and documentation updates. Never call paid AI services in tests. SQLite tests must use a temporary `DATA_DIR`. Prioritize data-loss, state-transition, path-safety, provider-contract, and six-step cross-stage regressions; see `docs/dev/testing-strategy.md`.

## Commands & Contributions

Use `npm run dev`, `npm run db:init`, `npm run db:migrate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm start`. Before handoff, run typecheck, lint, tests, and build. Use focused `feat:`, `fix:`, `docs:`, or `refactor:` commits. PRs should explain purpose, verification, migration/config effects, linked issues, and include screenshots for UI changes. Never commit secrets, databases, generated media, or user content; do not expose this unauthenticated app publicly.
