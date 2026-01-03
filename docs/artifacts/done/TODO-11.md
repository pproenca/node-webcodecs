# Task Packet: TODO-11

> **Feature:** WebCodecs Spec Compliance - Resource Reclamation
> **Assigned to:** Subagent 11
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that resource reclamation for inactive codecs is correctly implemented per W3C spec section 11.

## Scope

### Files In Scope
- `lib/resource-manager.ts` - Resource reclamation singleton
- `lib/codec-base.ts` - Codec activity tracking
- `lib/video-frame.ts` - Frame resource tracking
- `lib/audio-data.ts` - Audio resource tracking
- `test/stress/` - Resource reclamation tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native resource management (uses same concepts)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 11:
// - Codecs consume system resources (GPU, memory, hardware handles)
// - User Agent MAY reclaim resources from inactive codecs
// - Inactive = no operations for implementation-defined period
// - Reclaimed codec transitions to "closed" state
// - VideoFrame/AudioData that are not close()'d consume resources
// - User Agent MAY reclaim unclosed frames after period
```

### Outputs You Must Provide
```typescript
// ResourceManager singleton:
export class ResourceManager {
  // Track active codec instances
  registerCodec(codec: CodecBase): void;
  unregisterCodec(codec: CodecBase): void;

  // Track active VideoFrame/AudioData
  registerResource(resource: VideoFrame | AudioData): void;
  unregisterResource(resource: VideoFrame | AudioData): void;

  // Activity tracking
  markActive(codec: CodecBase): void;

  // Reclamation (called by timer or pressure)
  reclaimInactive(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Track last activity time per codec
- Reclaim after 10+ seconds of inactivity (configurable)
- Fire error callback on reclamation
- Log warning for unclosed resources

### DO NOT
- Reclaim active codecs
- Reclaim resources in use
- Crash on reclamation

## Success Criteria
- [ ] All tests pass
- [ ] Inactive codecs reclaimed after timeout
- [ ] Reclaimed codec transitions to "closed"
- [ ] error callback fired on reclamation
- [ ] Active codecs not reclaimed
- [ ] Unclosed resources warned
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/11-resource-reclamation.md` - Full spec
- `lib/resource-manager.ts` - Current implementation

### Reference Only (Don't modify)
- Browser resource pressure APIs

## Dependencies

### Waits For (Upstream)
- TODO-3.6, TODO-4.6, TODO-5.6, TODO-6.6: Close algorithms
- TODO-9.1: Memory model

### Blocks (Downstream)
- None

### Can Run In Parallel With
- TODO-12, TODO-13, TODO-14

## Test Requirements

### Unit Tests Required
1. ResourceManager tracks registered codecs
2. Active codec not reclaimed
3. Inactive codec reclaimed after timeout
4. Reclaimed codec state is "closed"
5. error callback fired on reclamation
6. Unclosed VideoFrame logged/warned
7. Unclosed AudioData logged/warned

### Edge Cases to Test
1. Multiple inactive codecs reclaimed
2. Codec becomes active just before reclamation
3. Memory pressure triggers early reclamation

### Error Cases to Test
1. Reclamation during encode/decode (wait for completion)
2. Reclamation of already closed codec (no-op)

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Stress tests pass
- [ ] Artifact handoff created at `.claude/artifacts/TODO-11.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-11.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
