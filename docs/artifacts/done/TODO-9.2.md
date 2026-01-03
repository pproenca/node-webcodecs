# Task Packet: TODO-9.2

> **Feature:** WebCodecs Spec Compliance - AudioData Interface
> **Assigned to:** Subagent 9.2
> **Priority:** 2
> **Estimated complexity:** HIGH

## Objective
Verify that AudioData interface is correctly implemented per W3C spec section 9.2 (9.2.1-9.2.7).

## Scope

### Files In Scope
- `lib/audio-data.ts` - AudioData implementation
- `src/audio_data.cc` - Native AudioData
- `test/golden/audio-data.test.ts` - AudioData tests

### Files Out of Scope (DO NOT MODIFY)
- `lib/audio-encoder.ts` - Uses AudioData (handled by TODO-5.x)
- `lib/audio-decoder.ts` - Produces AudioData (handled by TODO-3.x)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 9.2:

// 9.2.1 Internal Slots:
// [[resource reference]], [[sample format]], [[sample rate]],
// [[number of frames]], [[number of channels]], [[timestamp]],
// [[duration]], [[data]]

// 9.2.2 Constructor:
constructor(init: AudioDataInit);

// 9.2.3 Attributes:
readonly attribute AudioSampleFormat? format;
readonly attribute float sampleRate;
readonly attribute unsigned long numberOfFrames;
readonly attribute unsigned long numberOfChannels;
readonly attribute unsigned long long duration;
readonly attribute long long timestamp;

// 9.2.4 Methods:
unsigned long allocationSize(options: AudioDataCopyToOptions);
void copyTo(destination: BufferSource, options: AudioDataCopyToOptions);
AudioData clone();
void close();

// 9.2.5 Algorithms
// 9.2.6 Transfer and Serialization
// 9.2.7 AudioDataCopyToOptions
```

### Outputs You Must Provide
```typescript
export type AudioSampleFormat = 'u8' | 'u8-planar' | 's16' | 's16-planar' |
  's32' | 's32-planar' | 'f32' | 'f32-planar';

export interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: ArrayBuffer | ArrayBufferView;
}

export interface AudioDataCopyToOptions {
  planeIndex: number;
  frameOffset?: number;
  frameCount?: number;
  format?: AudioSampleFormat;
}

export class AudioData {
  constructor(init: AudioDataInit);

  readonly format: AudioSampleFormat | null;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;

  allocationSize(options: AudioDataCopyToOptions): number;
  copyTo(destination: ArrayBuffer | ArrayBufferView, options: AudioDataCopyToOptions): void;
  clone(): AudioData;
  close(): void;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Support all AudioSampleFormat values
- duration in microseconds = (numberOfFrames / sampleRate) * 1000000
- Support format conversion in copyTo
- Support planar ↔ interleaved conversion

### DO NOT
- Allow operations after close()
- Leak audio buffers

## Success Criteria
- [ ] All tests pass
- [ ] Constructor validates init
- [ ] All sample formats supported
- [ ] duration calculated correctly
- [ ] copyTo copies audio data
- [ ] copyTo converts format if requested
- [ ] clone() works per memory model
- [ ] close() releases resources
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.2-audiodata-interface/` - Full spec
- `lib/audio-data.ts` - Current implementation

### Reference Only (Don't modify)
- `lib/video-frame.ts` - Similar pattern for video

## Dependencies

### Waits For (Upstream)
- TODO-9.1: Memory model
- TODO-9.3: Audio sample format

### Blocks (Downstream)
- TODO-5.x: AudioEncoder.encode() takes AudioData
- TODO-3.x: AudioDecoder outputs AudioData

### Can Run In Parallel With
- TODO-9.4 (VideoFrame)

## Test Requirements

### Unit Tests Required
1. Constructor with valid init succeeds
2. format is readonly
3. sampleRate is readonly
4. numberOfFrames is readonly
5. numberOfChannels is readonly
6. duration calculated correctly
7. allocationSize returns correct size
8. copyTo copies data
9. copyTo converts format
10. clone() works
11. close() works

### Edge Cases to Test
1. Planar vs interleaved formats
2. Format conversion (s16 → f32)
3. Partial copy (frameOffset, frameCount)

### Error Cases to Test
1. Invalid format → TypeError
2. copyTo after close → InvalidStateError
3. copyTo with small buffer → RangeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
