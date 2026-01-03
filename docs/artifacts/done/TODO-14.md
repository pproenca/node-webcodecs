# Task Packet: TODO-14

> **Feature:** WebCodecs Spec Compliance - Best Practices for Authors
> **Assigned to:** Subagent 14
> **Priority:** 3
> **Estimated complexity:** LOW

## Objective
Verify that best practices from W3C spec section 14 are documented and supported.

## Scope

### Files In Scope
- `README.md` - User documentation
- `docs/` - Additional documentation
- `examples/` - Example code (if exists)

### Files Out of Scope (DO NOT MODIFY)
- `lib/*.ts` - Implementation (already covered)
- `src/*.cc` - Native implementation

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 14:
// Best practices for WebCodecs users:

// 1. Always close() resources
// - VideoFrame.close() when done
// - AudioData.close() when done
// - Codec.close() when done
// - Prevents resource leaks

// 2. Handle errors gracefully
// - Use error callback
// - Handle promise rejections
// - Don't assume success

// 3. Check support before use
// - isConfigSupported() before configure()
// - Handle unsupported codecs gracefully

// 4. Process output promptly
// - Don't accumulate VideoFrames
// - close() frames after processing

// 5. Use appropriate queue sizes
// - Monitor encodeQueueSize/decodeQueueSize
// - Back-pressure if queue grows

// 6. Configure codec appropriately
// - Match config to actual media
// - Use hardware acceleration when appropriate
```

### Outputs You Must Provide
```typescript
// Documentation and examples showing:

// 1. Proper resource cleanup
const frame = await decoder.decode(chunk);
try {
  // Process frame
} finally {
  frame.close();
}

// 2. Error handling
const decoder = new VideoDecoder({
  output: (frame) => { /* ... */ },
  error: (e) => console.error('Decode error:', e)
});

// 3. Support checking
const support = await VideoEncoder.isConfigSupported(config);
if (!support.supported) {
  throw new Error('Codec not supported');
}

// 4. Queue monitoring
if (encoder.encodeQueueSize > 10) {
  // Wait for some to complete
  await new Promise(r => encoder.ondequeue = r);
}
```

## Constraints

### DO
- Document all best practices
- Provide working examples
- Explain why each practice matters

### DO NOT
- Add implementation changes here
- Skip any best practice

## Success Criteria
- [ ] All best practices documented
- [ ] Examples provided for each
- [ ] README updated
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/14-best-practices-for-authors-using-webcodecs.md` - Best practices spec
- `README.md` - Current documentation

### Reference Only (Don't modify)
- MDN WebCodecs documentation

## Dependencies

### Waits For (Upstream)
- All implementation TODOs (need working code to demonstrate)

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-11, TODO-12, TODO-13

## Test Requirements

### Unit Tests Required
1. (Best practices are documentation, no direct tests)
2. Examples in docs should be runnable (lint check)

### Edge Cases to Test
1. (N/A)

### Error Cases to Test
1. (N/A)

## Completion Checklist
- [ ] All best practices documented
- [ ] Examples provided
- [ ] README updated
- [ ] Examples lint-clean
- [ ] Artifact handoff created at `.claude/artifacts/TODO-14.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-14.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
