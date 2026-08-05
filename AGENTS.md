# Repository Guidelines

## Project Structure & Module Organization

This is a local, single-user Next.js App Router application. Pages and HTTP handlers live in `app/`; reusable UI belongs in `components/`, with workflow screens under `components/studio/`. Keep database, provider, media, prompt, and domain logic in `lib/`, and project/model options in `config/`. AI instructions live in `skills/<name>/SKILL.md`. Static assets belong in `public/` or `docs/images/`. Runtime SQLite data and generated media stay in ignored `data/`. Colocate tests with modules as `*.test.ts`.

## Build, Test, and Development Commands

- `npm install`: install the locked dependencies.
- `npm run dev`: start the local development server.
- `npm run db:init`: initialize SQLite.
- `npm run typecheck`: run strict TypeScript checks.
- `npm run lint`: apply the Next.js ESLint rules.
- `npm test`: run the Vitest suite once.
- `npm run build`: create the production build.
- `npm start`: serve an existing production build.

Run typecheck, lint, tests, and build before submitting code.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, and no semicolons. Prefer small typed functions and React function components. Use kebab-case filenames (`video-style-picker.tsx`), PascalCase components, and camelCase utilities. Prefer `@/` for root imports. API handlers export uppercase HTTP methods from `route.ts`. ESLint and strict TypeScript are authoritative.

## Testing Guidelines

Use Vitest. Add regressions for data loss, path safety, model constraints, state transitions, provider parsing, and Skill loading. There is no global coverage threshold; prioritize user data and core workflows. Never call real AI services in automated tests. SQLite tests must set `DATA_DIR` to a temporary directory and never touch the user's `data/studio.sqlite` or `data/media`. See `docs/dev/testing-strategy.md`.

## Commit & Pull Request Guidelines

Use the existing `feat:`, `fix:`, `docs:`, or `refactor:` prefixes and keep commits focused. Pull requests should explain what and why, list verification, link issues, and include before/after screenshots for UI changes. Highlight database, environment, or model-config effects.

## Security & Agent Scope

Copy `.env.example` to `.env.local`; never commit secrets, databases, generated media, or user content. This unauthenticated app must not be exposed directly to the internet. Treat `C:\AI\XuefengAI` as read-only reference code; modify only this repository.
