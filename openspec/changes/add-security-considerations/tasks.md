## 1. Input Validation Layer (TypeScript)

- [ ] 1.1 Audit existing validation in `lib/video-encoder.ts`, `lib/video-decoder.ts`, `lib/audio-encoder.ts`, `lib/audio-decoder.ts`
- [ ] 1.2 Create `lib/validation.ts` with centralized validation helpers for:
  - Codec string format validation (prevent injection)
  - Dimension bounds checking (width, height > 0, < platform max)
  - Buffer size validation (match expected size for dimensions × format)
  - Timestamp range validation
- [ ] 1.3 Add validation at `VideoFrame` constructor for buffer/dimension consistency
- [ ] 1.4 Add validation at `AudioData` constructor for buffer/channel/sample consistency
- [ ] 1.5 Add validation at encoder/decoder `configure()` methods

## 2. Resource Safety (C++)

- [ ] 2.1 Audit all `src/*.cc` files for raw `av_*_alloc/free` calls (should be zero)
- [ ] 2.2 Add static analysis rule to `lint:cpp` to flag raw FFmpeg allocations
- [ ] 2.3 Document RAII usage patterns in `src/ffmpeg_raii.h` header comments
- [ ] 2.4 Ensure all async workers properly release resources on error paths

## 3. Fuzz Testing

- [ ] 3.1 Expand `test/guardrails/fuzzer.ts` with:
  - Random codec string fuzzing
  - Boundary dimension testing (0, 1, MAX_INT, negative)
  - Malformed buffer contents (all zeros, all 0xFF, random)
  - Truncated buffers
- [ ] 3.2 Create `test/guardrails/decoder-fuzzer.ts` for decoder input fuzzing
- [ ] 3.3 Create `test/guardrails/config-fuzzer.ts` for configuration dictionary fuzzing
- [ ] 3.4 Add npm script `test:fuzz` to run all fuzz tests
- [ ] 3.5 Integrate fuzz tests into CI (run on PR)

## 4. Native Safety Tests

- [ ] 4.1 Expand `test/native/stress/test_memory_leaks.cpp` with ASan validation
- [ ] 4.2 Add UBSan checks to `npm run test:native:sanitize`
- [ ] 4.3 Create `test/native/security/test_input_bounds.cpp` for C++ layer bounds checking

## 5. Error Boundary Guarantees

- [ ] 5.1 Document guaranteed error types in JSDoc for all public methods
- [ ] 5.2 Ensure all C++ entry points catch exceptions and convert to DOMException
- [ ] 5.3 Add integration test verifying no native crash on any guardrail test

## 6. Security Documentation

- [ ] 6.1 Add "Security" section to README.md explaining:
  - Input validation guarantees
  - RAII memory safety
  - Recommended deployment practices (resource limits, sandboxing)
- [ ] 6.2 Update CLAUDE.md with security review checklist items

## 7. Privacy Guidance Documentation

- [ ] 7.1 Add "Privacy Considerations" section to README.md explaining:
  - Codec fingerprinting risks (per W3C Section 13)
  - How `isConfigSupported()` probing can build codec feature profiles
  - Hardware acceleration detection as fingerprinting vector
- [ ] 7.2 Document mitigation strategies for embedders:
  - Rate-limiting capability queries in multi-tenant contexts
  - Returning baseline capabilities for untrusted callers
  - Monitoring for exhaustive codec probing patterns
- [ ] 7.3 Add JSDoc `@remarks` to `isConfigSupported()` methods noting fingerprinting implications

## 8. Best Practices Documentation (W3C Section 14)

- [ ] 8.1 Add "Best Practices" section to README.md covering:
  - Worker thread recommendations for realtime media
  - Main thread contention risks
  - Target frame rate considerations
- [ ] 8.2 Add JSDoc `@remarks` to encoder/decoder classes recommending worker usage for realtime processing
- [ ] 8.3 Create example in `examples/` demonstrating worker thread media pipeline
