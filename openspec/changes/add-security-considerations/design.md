## Context

Node.js WebCodecs operates in a different threat model than browser WebCodecs:

| Aspect | Browser | Node.js |
|--------|---------|---------|
| Process isolation | Codec in sandbox | Same process |
| Input source | User-controlled media | Untrusted network input at scale |
| Crash impact | Tab crash | Server crash, DoS |
| Attacker goal | Browser escape | Server compromise, DoS |

The W3C spec (Section 12) recommends fuzzing and process isolation. Since Node.js cannot provide process isolation for FFmpeg, we must implement defense-in-depth through rigorous input validation and memory safety.

## Goals

1. **No crashes from malformed input** — Any input to public APIs must produce either valid output or a catchable exception (DOMException/TypeError)
2. **No memory leaks** — All FFmpeg resources freed via RAII, even on error paths
3. **Validation before native calls** — TypeScript layer rejects invalid input before it reaches C++
4. **Fuzz test coverage** — All codec entry points covered by automated fuzz testing

## Non-Goals

1. **Browser-style privacy budgets** — Server-side doesn't need automatic query throttling, but guidance is provided for embedders
2. **Hardware acceleration security** — Out of scope; trust platform VideoToolbox/VA-API
3. **Side-channel attacks** — Timing attacks on codecs are not in scope

## Decisions

### Decision 1: Two-Layer Validation

Validate at both TypeScript and C++ layers:

```
User Input → TypeScript Validation → C++ Bounds Check → FFmpeg
              (throws TypeError)      (throws DOMException)
```

**Rationale:** TypeScript catches programmer errors early with clear messages. C++ layer is defense-in-depth against any bypass.

**Alternative considered:** Validate only in C++ — rejected because error messages are harder to debug and validation logic harder to maintain.

### Decision 2: Centralized Validation Module

Create `lib/validation.ts` with reusable validators:

```typescript
export function validateDimensions(width: number, height: number): void;
export function validateCodecString(codec: string): void;
export function validateBufferSize(buffer: ArrayBuffer, expected: number): void;
export function validateTimestamp(timestamp: number): void;
```

**Rationale:** Prevents duplication across VideoEncoder, AudioEncoder, etc. Single point of audit.

**Alternative considered:** Inline validation in each class — rejected due to duplication risk.

### Decision 3: RAII-Only FFmpeg Resources

All FFmpeg pointers MUST use RAII wrappers from `src/ffmpeg_raii.h`. No raw `av_*_alloc()` calls permitted.

```cpp
// CORRECT
ffmpeg::AVFramePtr frame(av_frame_alloc());

// FORBIDDEN - triggers lint error
AVFrame* frame = av_frame_alloc();
```

**Rationale:** Eliminates leak categories entirely. Enforced by cpplint custom rule.

### Decision 4: Fuzz Test Strategy

Fuzz tests in `test/guardrails/` use deterministic random seeds for reproducibility:

```typescript
const FUZZ_ITERATIONS = 1000;
const SEED = 0x12345678;

for (let i = 0; i < FUZZ_ITERATIONS; i++) {
  const input = generateFuzzInput(seed + i);
  // Must not crash, may throw
}
```

**Rationale:** Deterministic seeds allow reproduction of failures. 1000 iterations balance coverage vs CI time.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Validation overhead on hot path | Only validate at entry points, not per-frame internal ops |
| False positive lint on legitimate raw pointers | Allowlist specific cases with `// NOLINTNEXTLINE` |
| Fuzz tests slow CI | Run subset in PR, full suite nightly |

## Migration Plan

1. Add validation module without changing existing behavior
2. Add fuzz tests that pass with current implementation
3. Enable stricter validation incrementally
4. Add lint rule for raw FFmpeg allocations

No breaking changes — existing valid inputs remain valid.

### Decision 5: Privacy Guidance for Embedders

While server-side Node.js doesn't require browser-style privacy budgets, documentation SHALL inform embedders (Electron apps, multi-tenant servers) about fingerprinting risks.

**Documented risks:**
- Codec feature profiles from `isConfigSupported()` probing
- Hardware acceleration detection via capability queries
- Unique profiles from custom-assembled hardware or outdated software

**Recommended mitigations for embedders:**
- Rate-limit capability queries in multi-tenant contexts
- Consider returning baseline capabilities for untrusted contexts
- Monitor for exhaustive codec probing patterns

**Rationale:** Electron apps and multi-tenant servers face browser-like privacy concerns. Documentation enables informed decisions without imposing overhead on pure server-side use cases.

### Decision 6: Worker Thread Best Practices

Per W3C Section 14, documentation SHALL recommend running media pipelines in worker threads to avoid main thread contention.

**Documented guidance:**
- Realtime media processing SHOULD occur in worker contexts
- Main thread contention degrades user experience unpredictably
- Target frame rates and device class determine acceptable main thread usage

**Rationale:** This is non-normative guidance that improves end-user experience without requiring code changes.

## Open Questions

1. Should validation limits be configurable (e.g., max dimension)?
   - Current answer: No, use spec-defined limits
2. Should we add rate limiting for `isConfigSupported()` probing?
   - Current answer: No, but document mitigation strategies for embedders who need it
3. Should we expose a capability baseline for privacy-sensitive contexts?
   - Current answer: No, embedders can implement this themselves; document the pattern
