# Task Packet: TODO-7.5-7.8

> **Feature:** WebCodecs Spec Compliance - Codec Config Types
> **Assigned to:** Subagent 7.5-7.8
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that all four codec config types (AudioDecoderConfig, VideoDecoderConfig, AudioEncoderConfig, VideoEncoderConfig) are correctly defined per W3C spec sections 7.5-7.8.

## Scope

### Files In Scope
- `lib/types.ts` - Type definitions
- `test/golden/*.test.ts` - Config validation tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native implementations (use types)

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec sections 7.5-7.8:

// 7.5 AudioDecoderConfig
dictionary AudioDecoderConfig {
  required DOMString codec;
  required unsigned long sampleRate;
  required unsigned long numberOfChannels;
  BufferSource description;
};

// 7.6 VideoDecoderConfig
dictionary VideoDecoderConfig {
  required DOMString codec;
  BufferSource description;
  unsigned long codedWidth;
  unsigned long codedHeight;
  unsigned long displayAspectWidth;
  unsigned long displayAspectHeight;
  VideoColorSpaceInit colorSpace;
  HardwareAcceleration hardwareAcceleration = "no-preference";
  boolean optimizeForLatency;
};

// 7.7 AudioEncoderConfig
dictionary AudioEncoderConfig {
  required DOMString codec;
  unsigned long sampleRate;
  unsigned long numberOfChannels;
  unsigned long long bitrate;
  BitrateMode bitrateMode = "variable";
};

// 7.8 VideoEncoderConfig
dictionary VideoEncoderConfig {
  required DOMString codec;
  required unsigned long width;
  required unsigned long height;
  unsigned long displayWidth;
  unsigned long displayHeight;
  unsigned long long bitrate;
  double framerate;
  HardwareAcceleration hardwareAcceleration = "no-preference";
  AlphaOption alpha = "discard";
  DOMString scalabilityMode;
  VideoEncoderBitrateMode bitrateMode = "variable";
  LatencyMode latencyMode = "quality";
  DOMString contentHint;
};
```

### Outputs You Must Provide
```typescript
export interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: ArrayBuffer;
}

export interface VideoDecoderConfig {
  codec: string;
  description?: ArrayBuffer;
  codedWidth?: number;
  codedHeight?: number;
  displayAspectWidth?: number;
  displayAspectHeight?: number;
  colorSpace?: VideoColorSpaceInit;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
}

export interface AudioEncoderConfig {
  codec: string;
  sampleRate?: number;
  numberOfChannels?: number;
  bitrate?: number;
  bitrateMode?: BitrateMode;
}

export interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  displayWidth?: number;
  displayHeight?: number;
  bitrate?: number;
  framerate?: number;
  hardwareAcceleration?: HardwareAcceleration;
  alpha?: AlphaOption;
  scalabilityMode?: string;
  bitrateMode?: VideoEncoderBitrateMode;
  latencyMode?: LatencyMode;
  contentHint?: string;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Mark required fields as required in TypeScript
- Use correct default values per spec
- Export all enum types (HardwareAcceleration, BitrateMode, etc.)

### DO NOT
- Add fields not in spec
- Change required/optional status

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All four config types exported
- [ ] Required fields enforced
- [ ] Default values correct
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.5-audiodecoderconfig.md` - AudioDecoderConfig
- `docs/specs/7-configurations/7.6-videodecoderconfig.md` - VideoDecoderConfig
- `docs/specs/7-configurations/7.7-audioencoderconfig.md` - AudioEncoderConfig
- `docs/specs/7-configurations/7.8-videoencoderconfig.md` - VideoEncoderConfig
- `lib/types.ts` - Current definitions

### Reference Only (Don't modify)
- Browser WebCodecs TypeScript definitions

## Dependencies

### Waits For (Upstream)
- TODO-7.4: Codec string parsing

### Blocks (Downstream)
- TODO-3.5, TODO-4.5, TODO-5.5, TODO-6.5: Methods use these configs

### Can Run In Parallel With
- TODO-7.9, TODO-7.10, TODO-7.11

## Test Requirements

### Unit Tests Required
1. AudioDecoderConfig requires codec, sampleRate, numberOfChannels
2. VideoDecoderConfig requires codec only
3. AudioEncoderConfig requires codec only
4. VideoEncoderConfig requires codec, width, height
5. Optional fields accepted when provided
6. description is ArrayBuffer type

### Edge Cases to Test
1. Config with all optional fields
2. Config with only required fields
3. VideoEncoderConfig with scalabilityMode

### Error Cases to Test
1. Missing required field → TypeError
2. Wrong type for field → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.5-7.8.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.5-7.8.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
