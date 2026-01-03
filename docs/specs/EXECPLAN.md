# Close WebCodecs Spec Gaps (Node 20, macOS/Linux, No WPT)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

The goal is to prove that this Node.js WebCodecs implementation behaves like the W3C WebCodecs spec, with every spec section either validated by tests or explicitly documented as not applicable. After completing this plan, a contributor can read the spec checklist, run the test suite, and see that each spec section is either proven by tests or explained in documentation.

This plan targets Node.js 20.x on macOS and Linux. Deviations from the spec are allowed only when Node or the runtime cannot support the behavior; those deviations must be explicit, documented, and covered by tests that prove the chosen behavior.

## Progress

- [x] (2026-01-03T14:48Z) Read `docs/specs/TODO.md` and mapped the current implementation surface in `lib/` and `src/`.
- [x] (2026-01-03T15:06Z) Created `docs/specs/STATUS.md` spec coverage inventory (no TODO checkbox changes yet).
- [ ] Implement missing spec behaviors (or explicit deviations) for core WebCodecs interfaces.
- [ ] Implement processing model semantics and resource reclamation behavior suitable for large-scale server use.
- [ ] Add tests that prove each spec section or explicitly mark it as not applicable.
- [ ] Run the full test suite and capture proof artifacts.

## Surprises & Discoveries

No surprises recorded yet.

## Decision Log

- Decision: Use WebCodecsError subclasses instead of DOMException for all spec error cases.
  Rationale: The runtime is server-side Node.js 20.x and we want a single consistent error taxonomy even when DOMException is unavailable.
  Date/Author: 2026-01-03, Codex.

- Decision: Do not integrate WPT/WebCodecs tests for this phase; use internal tests plus explicit documentation of not-applicable sections.
  Rationale: The spec has already been crawled locally; this phase focuses on strict traceability using repository-controlled tests.
  Date/Author: 2026-01-03, Codex.

- Decision: Document Security/Privacy requirements and implement runtime safeguards where practical, but do not invent privacy budget features without explicit user approval.
  Rationale: The spec allows UAs to implement privacy budgets, but a server library should avoid arbitrary gating without explicit product requirements.
  Date/Author: 2026-01-03, Codex.

## Outcomes & Retrospective

No outcomes recorded yet.

## Context and Orientation

This repository implements W3C WebCodecs for Node.js using a TypeScript wrapper in `lib/` and a C++ N-API addon in `src/`. The spec text lives in `docs/specs/` and is indexed by `docs/specs/TODO.md`. Tests are in `test/` and use Node’s built-in test runner via `tsx`.

Key modules:

The JS/TS API surface is in `lib/audio-decoder.ts`, `lib/video-decoder.ts`, `lib/audio-encoder.ts`, `lib/video-encoder.ts`, `lib/audio-data.ts`, `lib/video-frame.ts`, `lib/encoded-chunks.ts`, `lib/image-decoder.ts`, and `lib/types.ts`.

The native behavior is implemented in `src/audio_decoder.cc`, `src/video_decoder.cc`, `src/audio_encoder.cc`, `src/video_encoder.cc`, `src/audio_data.cc`, `src/video_frame.cc`, `src/encoded_audio_chunk.cc`, `src/encoded_video_chunk.cc`, and `src/image_decoder.cc`.

The spec “processing model” is represented by `lib/control-message-queue.ts`, but must be wired into codec operations to match the W3C behavior.

“Spec section” means one of the checkboxes in `docs/specs/TODO.md`. “Proof” means a test that exercises the behavior or an explicit “not applicable” entry in the documentation that explains why the spec text cannot be implemented in Node.js 20.x.

## Plan of Work

This plan is iterative and recursive. For each spec section, we will determine the current behavior, write tests that prove the required behavior, implement missing logic or document deviations, and only then mark the section as complete. The loop repeats until every spec section is validated or documented.

### Milestone 1: Spec Coverage Inventory

Create `docs/specs/STATUS.md` containing a short entry for every section in `docs/specs/TODO.md`. Each entry must state one of: implemented, partial, or not applicable. For partial or not applicable, include a brief explanation and a pointer to the relevant file(s). Update `docs/specs/TODO.md` checkboxes only after tests or documentation prove compliance.

At the end of this milestone, a reader can scan `docs/specs/STATUS.md` and understand the compliance status of every spec section without reading code.

### Milestone 2: Core Interface Parity and Error Semantics

Align API behavior with the spec for all core interfaces (AudioDecoder, VideoDecoder, AudioEncoder, VideoEncoder, EncodedAudioChunk, EncodedVideoChunk, AudioData, VideoFrame, ImageDecoder, ImageTrackList, ImageTrack). For each behavior, ensure that errors are thrown as WebCodecsError subclasses, not DOMException, and that tests assert the error types and messages.

Specific areas to verify and fix include:

The exact shape and validation of configuration objects (`isConfigSupported`, `configure`, `encode`, `decode`, `flush`, `reset`, `close`).

Required field validation and range checks that should throw `TypeError`, `RangeError`, or a WebCodecsError subtype depending on the spec rule.

Behavior of `copyTo`, `allocationSize`, `clone`, and `close` for AudioData and VideoFrame, including buffer size checks and closed-state behavior.

ImageDecoder options handling (`colorSpaceConversion`, `premultiplyAlpha`, `desiredWidth`, `desiredHeight`, `preferAnimation`, `completeFramesOnly`) with explicit errors when unsupported.

### Milestone 3: Processing Model and Resource Reclamation

Implement the W3C processing model by actually enqueuing codec operations in `lib/control-message-queue.ts`. Each codec must enqueue configure, encode, decode, reset, and flush operations. `flush()` must wait for both the control queue and the native output queue to drain. Error handling must propagate through WebCodecsError subclasses.

Strengthen resource reclamation for large-scale server use. Add reclamation hooks for VideoFrame and AudioData (similar to Encoded*Chunk FinalizationRegistry) and ensure that ResourceManager can reclaim inactive codecs deterministically (manual call or optional timer). Provide tests that prove reclamation does not close active, foreground codecs.

### Milestone 4: Security and Privacy Considerations

Review `docs/specs/12-security-considerations.md` and `docs/specs/13-privacy-considerations.md`. Implement practical mitigations where feasible (for example, backpressure enforcement and explicit erroring on unsupported formats to avoid silent downgrades). Document any spec guidance that does not apply to a server-side library, and add tests that prove the chosen behavior for security-sensitive operations such as `isConfigSupported` probing and backpressure limits.

### Milestone 5: Tests and Proof Artifacts

Add tests to `test/` that map to spec sections. Each new test must demonstrate the behavior required by a specific spec section and must fail before the implementation change and pass after. Where a section is not applicable, add a short documentation entry in `docs/specs/STATUS.md` and a test that asserts the documented behavior (for example, an explicit error or a no-op).

At the end of this milestone, running the test suite must serve as the “proof” that the library matches the spec or has explicitly documented deviations.

## Concrete Steps

All commands should be run in `/Users/pedroproenca/Documents/Projects/node-webcodecs`.

1) Build the spec coverage inventory.
    - Create `docs/specs/STATUS.md` and fill it out by reading `docs/specs/TODO.md` plus the relevant code.
    - Update `docs/specs/TODO.md` checkboxes only when a section is proven by tests or documented as not applicable.

2) Add or update tests for each spec section as you verify behavior.
    - Use `tsx --test test/<area>/<file>.test.ts` for targeted runs.
    - Keep tests small and focused on the behavior required by the spec text.

3) Implement missing behavior or explicit deviations in `lib/` and `src/` as required by failing tests.
    - Use WebCodecsError subclasses for spec error semantics.
    - For options that cannot be implemented, return a specific error and document the deviation in `docs/specs/STATUS.md`.

4) Run the full suite and capture proof artifacts.
    - `npm run test:fast`

Example output to record in this plan once tests are added:
    ok 1 - VideoEncoder configure rejects missing codec (spec 6.5)
    ok 2 - ImageDecoder completeFramesOnly rejects incomplete frame (spec 10.2.4)

## Validation and Acceptance

Acceptance requires all of the following:

Every section in `docs/specs/TODO.md` is either checked because tests prove compliance, or explicitly marked not applicable in `docs/specs/STATUS.md` with a clear explanation and a test that asserts the documented behavior.

`npm run test:fast` passes on Node.js 20.x on both macOS and Linux.

Security and privacy considerations are either implemented (with tests) or explicitly documented as not applicable for a server-side library.

## Idempotence and Recovery

All steps are additive and safe to re-run. If a change fails midway, revert only the files touched in that step and re-apply the change. Avoid destructive git commands.

## Artifacts and Notes

Add short test outputs or relevant diffs here as milestones are completed, for example:

    npm run test:fast
    ok 54 - AudioData copyTo enforces buffer size

## Interfaces and Dependencies

The following must exist by the end of the plan:

In `lib/errors.ts`, WebCodecsError subclasses must be used to represent spec error cases in place of DOMException.

In `lib/audio-decoder.ts`, `lib/video-decoder.ts`, `lib/audio-encoder.ts`, and `lib/video-encoder.ts`, all error paths must use WebCodecsError subclasses and tests must assert those types.

In `lib/control-message-queue.ts`, codec operations must enqueue and flush control messages to match the processing model.

In `docs/specs/STATUS.md`, every spec section must have a status and a justification if not implemented.

At the bottom of this document, add a short note whenever this plan is revised, describing what changed and why.

Plan change log entry (append below as revisions happen):

    2026-01-03: Initial plan created for Node 20.x, macOS/Linux, internal tests only.
    2026-01-03: Completed Milestone 1 inventory and added `docs/specs/STATUS.md`.
