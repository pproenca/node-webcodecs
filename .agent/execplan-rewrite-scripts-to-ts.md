# Rewrite Shell and JavaScript Scripts to TypeScript With Tests

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `.agent/PLANS.md` from the repository root and must be maintained in
accordance with those requirements.

## Purpose / Big Picture

Rewrite all operational Bash and JavaScript scripts to TypeScript so they are typed,
testable, and consistent with the Google TypeScript style used in the repo. Ensure that
every script has automated tests covering core behavior, and that builds/tests remain
reliable across platforms and user install paths.

## Progress

- [x] (2026-02-14 00:00Z) Inventory script scope and classify generated/third-party files.
- [x] (2026-02-14 00:00Z) Design the TS runtime strategy (compile vs tsx) with a
      compatibility plan for node-gyp entrypoints.
- [x] (2026-02-14 00:00Z) Convert Bash scripts to TS CLIs with parity and tests.
- [x] (2026-02-14 00:00Z) Convert JS scripts to TS, update call sites, and add tests.
- [ ] (2026-02-14 00:00Z) Verify end-to-end builds/tests and document outcomes.

## Surprises & Discoveries

- Observation: Leak scripts referenced a missing `test/guardrails/memory_sentinel.js`.
  Evidence: Added `test/guardrails/memory_sentinel.ts` and updated leak scripts.

## Decision Log

- Decision: Exclude generated assets under `docs/api/assets/` from conversion.
  Rationale: These are generated outputs (Typedoc) and should not be hand-edited.
  Date/Author: 2026-02-14 / Codex

- Decision: Keep `gyp/ffmpeg-paths.js` as a compiled JS artifact generated from TS.
  Rationale: `binding.gyp` calls `node gyp/ffmpeg-paths.js` before TS compilation; a
  JS artifact avoids adding runtime TS loaders to user builds.
  Date/Author: 2026-02-14 / Codex

- Decision: Convert story and example scripts to TS and run with `tsx`.
  Rationale: Keeps dev workflows in TS without requiring consumers to compile scripts.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

Pending implementation.

## Context and Orientation

Current scripting surface:

- Bash scripts: `scripts/setup-ffmpeg.sh`, `test/leak/leak.sh`, `test/leak/leaks-macos.sh`.
- JS/Node scripts: `gyp/ffmpeg-paths.js`, `scripts/*.js|*.cjs|*.mjs`,
  `test/guardrails/*.js`, `test/contracts/**/*.js`, `examples/**/*.js`, and
  `test/golden/integration/*.mjs`.

Node-gyp currently depends on `gyp/ffmpeg-paths.js` for resolving FFmpeg link flags.
The repo already uses `tsx` for tests, but build scripts run with plain `node`.

## Plan of Work

First, decide the target scope and exclusions (generated assets, third-party bundles),
then define a TS execution strategy for scripts. For scripts executed during installs
or node-gyp, compile TS to JS and keep the JS entrypoint paths stable. For developer-
only scripts, prefer `tsx` execution to keep iteration fast.

Second, create a scripts-specific TS config and shared utilities (argument parsing,
logging, process execution, filesystem helpers) to avoid duplicated error handling and
to enable unit testing with fakes.

Third, convert Bash scripts to TS CLI tools with parity in flags, outputs, and exit
codes. Convert JS scripts to TS, update invocations in `package.json`, CI workflows,
and docs, and ensure `binding.gyp` still resolves FFmpeg paths without requiring TS
loaders at runtime.

Finally, add tests for each script using `node:test` and `tsx` with fixtures. Validate
critical behaviors (argument parsing, command execution, file system effects, and
platform detection) and run targeted test suites for coverage.

## Concrete Steps

1. Inventory and scope:
   - Enumerate all `.sh`, `.js`, `.cjs`, and `.mjs` files and classify as
     operational scripts vs generated assets.
   - Confirm whether examples and contracts are in scope for conversion.

2. Runtime strategy:
   - Add `tsconfig.scripts.json` to compile TS scripts to JS artifacts where needed.
   - Decide which scripts run via `tsx` and which run via compiled JS.
   - Update `package.json` scripts and CI entrypoints accordingly.

3. Shared utilities:
   - Add `scripts/shared/exec.ts`, `scripts/shared/fs.ts`, and
     `scripts/shared/args.ts` for process and IO abstractions.
   - Design utilities for dependency injection in tests.

4. Convert Bash scripts:
   - Rewrite `scripts/setup-ffmpeg.sh` to `scripts/setup-ffmpeg.ts`.
   - Rewrite leak-test shells to TS equivalents under `test/leak/`.
   - Update docs and usage hints.

5. Convert JS scripts:
   - Convert `gyp/ffmpeg-paths.js` to TS and emit JS into `gyp/ffmpeg-paths.js`.
   - Convert `scripts/*.js|*.cjs|*.mjs` to TS with typed APIs.
   - Convert guardrail scripts and contract helpers to TS where used by tests.
   - Convert example scripts to TS and adjust docs to point to `.ts` files.

6. Tests:
   - Add `test/unit/scripts/*.test.ts` covering each script entrypoint.
   - Use fixture directories and stubbed exec functions for predictable results.
   - Add smoke tests that run key scripts (setup-ffmpeg, check-macos-abi) in CI.

7. Validation:
   - `npm run build`, `npm run test:fast`, targeted script tests.
   - Confirm `node-gyp` uses the compiled `gyp/ffmpeg-paths.js` without loaders.

## Validation and Acceptance

The change is accepted when:

- No Bash scripts remain for operational workflows (except generated assets).
- All JS scripts are replaced with TS sources and compiled JS outputs where required.
- Every script entrypoint has unit tests; critical scripts have integration tests.
- `npm run build` and `npm test` succeed on macOS and Linux.
- `binding.gyp` resolves FFmpeg paths without requiring `tsx` or other TS loaders.

## Idempotence and Recovery

Steps are additive and can be re-run safely. If a script conversion fails, revert the
script and its tests together, or keep a JS shim until the TS implementation is stable.

## Artifacts and Notes

Add command outputs and test results here once available.

## Interfaces and Dependencies

Expected new/updated interfaces:

- `scripts/shared/exec.ts`: `ExecResult`, `runCommand`, `runCommandOrThrow`.
- `scripts/shared/args.ts`: typed parsers for positional/flag inputs.
- `scripts/shared/fs.ts`: safe file operations with explicit errors.

Dependencies:

- `tsx` for test execution (already in devDependencies).
- `tsconfig.scripts.json` for compiling script TS to JS artifacts.
