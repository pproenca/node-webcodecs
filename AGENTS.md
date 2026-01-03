# Repository Guidelines

# ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.

## Project Structure & Module Organization

- `src/` holds the C++17 N-API addon sources (`*.cc`, `*.h`) and FFmpeg bindings.
- `lib/` contains the TypeScript layer that wraps native classes for spec compliance.
- `dist/` is compiled output used by consumers.
- `test/` has tests grouped by purpose: `golden/`, `unit/`, `stress/`, `contracts/`, `guardrails/`, plus `fixtures/`.
- `docs/` and `examples/` provide specification references and usage samples.
- `packages/` contains platform-specific packages for prebuilt binaries.

## Build, Test, and Development Commands

- `npm run build` builds the native addon and TypeScript.
- `npm run build:native` builds only the C++ addon; `npm run build:ts` builds only TS.
- `npm run rebuild` cleans and rebuilds everything.
- `npm run check` runs the full CI-equivalent suite (lint + tests).
- `npm test` runs core tests plus guardrails.
- `npm run test:fast` runs golden + unit tests (no guardrails), useful for iteration.

## Coding Style & Naming Conventions

- C++ follows Google C++ Style Guide via `cpplint` (`npm run lint:cpp`).
- TypeScript uses Biome for linting (`npm run lint:ts`) and follows Google TS style conventions.
- Markdown formatting is checked with Prettier (`npm run lint:md`).
- Test files use `*.test.ts` naming (for example, `test/unit/video-frame.test.ts`).

## Testing Guidelines

- Tests use Node’s built-in runner (`node:test`) with `tsx` and `test/setup.ts` to inject WebCodecs globals.
- Targeted runs: `tsx --test test/golden/video-encoder.test.ts`.
- Coverage: `npm run test:coverage` enforces minimum thresholds (lines 70%, branches 60%, functions 70%).

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits: `type(scope): summary` (examples: `fix(encoder): ...`, `chore: ...`).
- PRs should include a clear description, testing performed, and link relevant issues.
- If behavior changes, add or update tests in the appropriate `test/` folder.

## Configuration & Environment Notes

- FFmpeg 5.0+ is required for source builds; set `FFMPEG_ROOT` when linking local builds.
- Platform prebuilds are resolved first; local development falls back to `node-gyp-build`.
