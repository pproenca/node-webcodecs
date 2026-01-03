# Task Packet: TODO-9.3

> **Feature:** WebCodecs Spec Compliance - Audio Sample Format
> **Assigned to:** Subagent 9.3
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that audio sample formats, buffer arrangement, magnitude, and channel ordering are correctly implemented per W3C spec section 9.3.

## Scope

### Files In Scope
- `lib/audio-data.ts` - AudioSampleFormat usage
- `lib/types.ts` - AudioSampleFormat type
- `test/golden/audio-data.test.ts` - Format tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native uses same formats

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 9.3:

// 9.3.1 Arrangement of audio buffer:
// - Interleaved: samples for all channels together [L0, R0, L1, R1, ...]
// - Planar: samples for each channel separate [L0, L1, ...], [R0, R1, ...]

// 9.3.2 Magnitude of audio samples:
// - u8: 0-255, 128 = silence
// - s16: -32768 to 32767, 0 = silence
// - s32: -2147483648 to 2147483647, 0 = silence
// - f32: -1.0 to 1.0, 0.0 = silence

// 9.3.3 Audio channel ordering:
// - mono: [M]
// - stereo: [L, R]
// - 5.1: [L, R, C, LFE, SL, SR]
// etc.

enum AudioSampleFormat {
  "u8",
  "s16",
  "s32",
  "f32",
  "u8-planar",
  "s16-planar",
  "s32-planar",
  "f32-planar"
};
```

### Outputs You Must Provide
```typescript
export type AudioSampleFormat =
  | 'u8'
  | 's16'
  | 's32'
  | 'f32'
  | 'u8-planar'
  | 's16-planar'
  | 's32-planar'
  | 'f32-planar';

// Helper functions:
function isInterleaved(format: AudioSampleFormat): boolean;
function isPlanar(format: AudioSampleFormat): boolean;
function bytesPerSample(format: AudioSampleFormat): number;
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Support all 8 sample formats
- Use correct byte sizes per format
- Follow spec channel ordering

### DO NOT
- Add formats not in spec
- Use different channel ordering

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All 8 formats defined
- [ ] Interleaved vs planar distinction correct
- [ ] Byte sizes correct (u8=1, s16=2, s32=4, f32=4)
- [ ] Channel ordering matches spec
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.3-audio-sample-format/` - Full spec
- `lib/audio-data.ts` - Current format usage

### Reference Only (Don't modify)
- FFmpeg sample format mappings

## Dependencies

### Waits For (Upstream)
- None (basic type)

### Blocks (Downstream)
- TODO-9.2: AudioData uses formats

### Can Run In Parallel With
- TODO-9.1, TODO-9.4

## Test Requirements

### Unit Tests Required
1. u8 format: 1 byte, interleaved
2. s16 format: 2 bytes, interleaved
3. s32 format: 4 bytes, interleaved
4. f32 format: 4 bytes, interleaved
5. u8-planar: 1 byte, planar
6. s16-planar: 2 bytes, planar
7. s32-planar: 4 bytes, planar
8. f32-planar: 4 bytes, planar

### Edge Cases to Test
1. Mono audio channel ordering
2. Stereo audio channel ordering
3. 5.1 channel ordering

### Error Cases to Test
1. Invalid format string → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.3.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.3.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
