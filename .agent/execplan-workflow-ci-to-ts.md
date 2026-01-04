# Rewrite Workflow Bash Blocks to TypeScript CI Scripts

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `.agent/PLANS.md` from the repository root and must be maintained in
accordance with those requirements.

## Purpose / Big Picture

Move the inline Bash logic in `.github/workflows/*.yml` into TypeScript scripts under
`scripts/ci/` so CI logic is easier to discover, reuse, and test. Preserve current
workflow behavior while adding unit tests that cover both happy and failure paths for
each new script entrypoint.

## Progress

- [x] (2025-02-14 00:00Z) Inventory all workflow Bash blocks and define script mapping.
- [ ] (2025-02-14 00:00Z) Implement TS scripts + shared helpers for CI workflows.
- [ ] (2025-02-14 00:00Z) Update workflows to call TS scripts with parity.
- [ ] (2025-02-14 00:00Z) Add unit tests covering happy + sad paths and record results.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: Pending workflow inventory.

## Decision Log

- Decision: Group workflow logic into a small set of CI script entrypoints with
  subcommands, backed by shared helpers for GitHub output/env file writing.
  Rationale: Reduces script sprawl while keeping commands discoverable and testable.
  Date/Author: 2025-02-14 / Codex

## Outcomes & Retrospective

Pending implementation.

## Context and Orientation

Workflows with multi-line Bash blocks:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/build-ffmpeg.yml`

Each workflow currently embeds operational logic in Bash run blocks. The goal is to
extract those blocks into TypeScript scripts under `scripts/ci/`, keeping behavior and
exit codes consistent while making logic testable via `node:test`.

## Plan of Work

First, enumerate each Bash block and map it to a TypeScript script/subcommand. Identify
shared utilities for running commands, writing GitHub outputs, and filesystem checks.

Second, implement scripts under `scripts/ci/` using the Google TypeScript style, keeping
side effects and exit codes aligned with current behavior. Update workflows to invoke
these scripts via `tsx`.

Finally, add unit tests for each script (happy + sad paths) and record test outcomes in
this plan. Confirm workflows still reference the same artifacts, outputs, and env vars.

## Concrete Steps

1. Inventory and mapping:
   - List every `run: |` block in workflows and decide script/subcommand mapping.
   - Identify common helpers for GitHub output/env and command execution.

2. Script implementation:
   - Add shared helpers (GitHub outputs/env, command runner abstraction).
   - Create workflow scripts with subcommands and parity behavior.
   - Update workflows to call `npx tsx scripts/ci/...` for each block.

3. Tests:
   - Add unit tests under `test/unit/` for each script entrypoint.
   - Cover success/failure paths (missing env, missing files, command failures).

4. Validation:
   - Run `npm run test:unit` locally (or note if not run).
   - Spot-check scripts with lightweight fixtures for file-based logic.

## Validation and Acceptance

The change is accepted when:

- No multi-line Bash blocks remain in `.github/workflows/*.yml` for CI logic.
- All extracted scripts exist under `scripts/ci/` and are invoked in workflows.
- Each script has unit tests covering happy and sad paths.
- Workflow behavior (outputs, artifacts, env vars) remains consistent.

## Idempotence and Recovery

Script extraction is additive. If a script fails, revert the workflow step and script
pair together or keep the Bash version temporarily while tests are repaired.

## Artifacts and Notes

Add command outputs and test results here once available.

## Interfaces and Dependencies

Expected helpers:

- `scripts/ci/github.ts`: GitHub output/env file helpers.
- `scripts/ci/runner.ts`: command runner abstraction over `scripts/shared/exec`.

Dependencies:

- `tsx` for script execution in workflows.
