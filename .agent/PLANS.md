# Stabilize Async WebCodecs Worker Architecture and Add Regression Tests

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `.agent/PLANS.md` from the repository root and must be maintained in accordance with those requirements.

## Purpose / Big Picture

The goal is to eliminate hidden async and memory hazards in the Node.js addon by adopting a worker-owned codec architecture and by adding integration tests that expose the current flaws. After these changes, users can run the WebCodecs API without event-loop stalls, buffer corruption, or silent frame drops, and they can verify correct behavior via new tests that fail on the current implementation and pass after the refactor.

## Progress

- [ ] (2025-02-14 00:00Z) Draft baseline integration tests that demonstrate the current async/memory flaws in the existing implementation.
- [ ] (2025-02-14 00:00Z) Introduce shared worker and queue infrastructure that makes FFmpeg contexts worker-owned and TSFN calls safe.
- [ ] (2025-02-14 00:00Z) Migrate VideoEncoder/VideoDecoder to the worker-owned model and fix specific correctness gaps (keyframe forcing, frame writability, size mismatches).
- [ ] (2025-02-14 00:00Z) Validate behavior with targeted test runs and document results.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: Pending baseline tests.

## Decision Log

- Decision: Use the architecture patterns from `../node-webcodecs-spec` as the primary reference (worker-owned codec contexts, typed control message queue, SafeThreadSafeFunction wrapper).
  Rationale: That codebase already models WebCodecs processing order and TSFN lifecycle in a way that avoids the async hazards present here.
  Date/Author: 2025-02-14 / Codex

## Outcomes & Retrospective

Pending implementation.

## Context and Orientation

The current code in `src/video_encoder.cc`, `src/video_decoder.cc`, `src/async_encode_worker.cc`, and `src/async_decode_worker.cc` uses ad-hoc worker threads and raw `Napi::ThreadSafeFunction` calls. This results in event-loop blocking in `flush()`, unbounded TSFN queues, and race-prone FFmpeg usage. The `../node-webcodecs-spec` repository contains a more mature design with a worker thread that owns the codec context, a control message queue that enforces the WebCodecs processing model, and a `SafeThreadSafeFunction` wrapper that prevents calls after release. The plan will bring those patterns into this repository, then add tests to prove the issues and the fixes.

Key files in this repository:

- `src/video_encoder.cc` and `src/video_decoder.cc` define the JS-facing WebCodecs classes.
- `src/async_encode_worker.cc` and `src/async_decode_worker.cc` implement the current worker threads and TSFN calls.
- `src/common.h` and `src/common.cc` provide shared utilities and counters.
- `test/` contains Node.js tests using `node:test` and `tsx`.

Non-obvious terms used in this plan:

- Control message queue: a FIFO queue of typed messages (configure, decode/encode, flush, reset, close) processed by a worker thread so FFmpeg operations are serialized and ordering is deterministic.
- Worker-owned codec: the `AVCodecContext` is created, used, and destroyed only on the worker thread, removing the need for cross-thread mutex protection.
- Safe TSFN: a wrapper around `Napi::TypedThreadSafeFunction` that prevents use-after-release and forces callers to handle failed `Call()` attempts by cleaning up payloads.

## Plan of Work

First, add integration tests that make the current flaws observable. These will include: a flush test that detects event-loop blocking by measuring heartbeat jitter, a keyframe-forcing test that fails when async encode drops keyframe requests, and a size-mismatch test that detects buffer overruns by intentionally configuring mismatched frame sizes and asserting on deterministic outputs or safe error behavior. These tests will be added under `test/guardrails/` or `test/stress/` and will be marked as regression tests with clear names.

Second, introduce shared worker infrastructure modeled after `../node-webcodecs-spec`. Create `src/shared/safe_tsfn.h`, `src/shared/control_message_queue.h`, and `src/shared/codec_worker.h` in this repository, adapted to its layout. The queue will define message types for configure, encode/decode, flush, reset, and close. The worker base class will own the thread, and codec contexts will live only on that worker thread. The Safe TSFN wrapper will enforce correct TSFN lifecycle and provide `Call()` return values that require callers to clean up data when the TSFN is released or the queue is full.

Third, migrate `VideoDecoder` and `VideoEncoder` to the new model. The JS thread will enqueue messages and never block; flush will return a Promise that is resolved by a worker-thread TSFN callback. The encoder and decoder workers will own their FFmpeg contexts and perform `avcodec_send_*`/`avcodec_receive_*` only on the worker. Fix correctness gaps along the way by applying `av_frame_make_writable()` before writing frame buffers, honoring `keyFrame` flags in the encode path, and validating input size/format alignment for async encode so mismatches cause explicit errors rather than reads past bounds.

Finally, wire the new queue size tracking and ondequeue behavior so backpressure and queue metrics are accurate in async mode. Ensure tests cover both queue tracking and flush semantics.

## Concrete Steps

1. Add baseline tests that demonstrate the current behavior, keeping them deterministic and fast. Expected locations:

   - `test/guardrails/video-encoder-async-keyframe.test.ts`
   - `test/guardrails/video-encoder-async-size-mismatch.test.ts`
   - `test/guardrails/video-decoder-flush-eventloop.test.ts`

2. Add shared infrastructure files:

   - `src/shared/safe_tsfn.h`
   - `src/shared/control_message_queue.h`
   - `src/shared/codec_worker.h`

   These should be adapted from `../node-webcodecs-spec` with only the interfaces needed for video encode/decode first.

3. Refactor `src/video_encoder.cc` and `src/video_decoder.cc` to use the control message queue and worker base class. Replace `async_*_worker` usage with the new queue + worker ownership. Remove event-loop blocking in `flush()` by returning a promise resolved via TSFN.

4. Update or delete `src/async_encode_worker.*` and `src/async_decode_worker.*` depending on how much is replaced by the new design. If some logic is still useful (e.g., pixel conversion), move it into the worker class.

5. Fix correctness issues in the new worker implementations:

   - Ensure `av_frame_make_writable()` is called before writing to frame data buffers.
   - Propagate `keyFrame` requests into the encode path.
   - Validate input frame sizes against configured width/height before copying.

6. Run targeted tests and record outcomes in this plan.

Commands to run from the repo root (`/Users/pedroproenca/Documents/Projects/node-webcodecs`):

  npm run build
  npm run test:fast
  tsx --test test/guardrails/video-encoder-async-keyframe.test.ts
  tsx --test test/guardrails/video-encoder-async-size-mismatch.test.ts
  tsx --test test/guardrails/video-decoder-flush-eventloop.test.ts

If build or tests fail, fix iteratively and update the plan with the observed errors and resolutions.

## Validation and Acceptance

The change is accepted when:

- Running the new guardrail tests fails on the current implementation and passes after the refactor.
- `VideoEncoder.flush()` and `VideoDecoder.flush()` no longer block the JS event loop; the flush test must show heartbeat jitter within a small bound (for example, no single gap exceeding 50ms on a quiet machine).
- Keyframe forcing in async encode produces keyframes at the configured cadence (the test checks that the output has keyframes where requested).
- Size mismatch in async encode results in a clear error rather than undefined behavior.

## Idempotence and Recovery

All steps are additive and can be re-run safely. If a refactor step partially lands, revert only the files touched in that step or re-run the step to completion. When tests fail, keep the added tests intact and adjust implementation until they pass.

## Artifacts and Notes

Include concise examples of command output and failing/passing test logs as indented blocks here once they exist. For example:

  $ tsx --test test/guardrails/video-decoder-flush-eventloop.test.ts
  1..1
  # ...
  ok 1 - flush does not block the event loop

## Interfaces and Dependencies

The following new interfaces must exist after this plan:

- In `src/shared/safe_tsfn.h`, define a template `SafeThreadSafeFunction<Context, DataType, CallJs>` with `Init`, `Call`, `BlockingCall`, `Release`, and `Unref` methods, modeled after the behavior in `../node-webcodecs-spec/src/shared/safe_tsfn.h`.
- In `src/shared/control_message_queue.h`, define a `ControlMessageQueue` template with message types for configure, encode/decode, flush, reset, and close, and FIFO `Enqueue`/`Dequeue` semantics.
- In `src/shared/codec_worker.h`, define a `CodecWorker` base class that owns the worker thread, processes control messages, and exposes callbacks for output, error, flush completion, and queue size changes.
- In `src/video_encoder.cc` and `src/video_decoder.cc`, move codec operations onto worker subclasses so that the JS thread only enqueues messages and receives results via TSFN.

Plan updated on 2025-02-14 to establish the initial design and scope.
