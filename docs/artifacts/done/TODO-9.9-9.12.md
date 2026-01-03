# Task Packet: TODO-9.9-9.12

> **Feature:** WebCodecs Spec Compliance - VideoColorSpace and Color Enums
> **Assigned to:** Subagent 9.9-9.12
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify VideoColorSpace interface and color-related enums (primaries, transfer, matrix) per W3C spec sections 9.9-9.12.

## Scope

### Files In Scope
- `lib/video-frame.ts` - VideoColorSpace implementation
- `lib/types.ts` - Color enum types
- `test/golden/video-frame.test.ts` - ColorSpace tests

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native uses same enums

## Interface Contract

### Inputs You Will Receive
```typescript
// 9.9 VideoColorSpace Interface
interface VideoColorSpace {
  constructor(init?: VideoColorSpaceInit);
  readonly attribute VideoColorPrimaries? primaries;
  readonly attribute VideoTransferCharacteristics? transfer;
  readonly attribute VideoMatrixCoefficients? matrix;
  readonly attribute boolean? fullRange;
  VideoColorSpaceInit toJSON();
};

dictionary VideoColorSpaceInit {
  VideoColorPrimaries? primaries = null;
  VideoTransferCharacteristics? transfer = null;
  VideoMatrixCoefficients? matrix = null;
  boolean? fullRange = null;
};

// 9.10 VideoColorPrimaries
enum VideoColorPrimaries {
  "bt709", "bt470bg", "smpte170m", "bt2020", "smpte432"
};

// 9.11 VideoTransferCharacteristics
enum VideoTransferCharacteristics {
  "bt709", "smpte170m", "iec61966-2-1", "linear", "pq", "hlg"
};

// 9.12 VideoMatrixCoefficients
enum VideoMatrixCoefficients {
  "rgb", "bt709", "bt470bg", "smpte170m", "bt2020-ncl"
};
```

### Outputs You Must Provide
```typescript
export type VideoColorPrimaries =
  | 'bt709'      // BT.709, sRGB
  | 'bt470bg'    // BT.470 System B/G
  | 'smpte170m'  // SMPTE 170M
  | 'bt2020'     // BT.2020
  | 'smpte432';  // Display P3

export type VideoTransferCharacteristics =
  | 'bt709'        // BT.709
  | 'smpte170m'    // SMPTE 170M
  | 'iec61966-2-1' // sRGB
  | 'linear'       // Linear
  | 'pq'           // PQ (HDR)
  | 'hlg';         // HLG (HDR)

export type VideoMatrixCoefficients =
  | 'rgb'        // Identity (RGB)
  | 'bt709'      // BT.709
  | 'bt470bg'    // BT.470 System B/G
  | 'smpte170m'  // SMPTE 170M
  | 'bt2020-ncl'; // BT.2020 NCL

export interface VideoColorSpaceInit {
  primaries?: VideoColorPrimaries | null;
  transfer?: VideoTransferCharacteristics | null;
  matrix?: VideoMatrixCoefficients | null;
  fullRange?: boolean | null;
}

export class VideoColorSpace {
  constructor(init?: VideoColorSpaceInit);

  readonly primaries: VideoColorPrimaries | null;
  readonly transfer: VideoTransferCharacteristics | null;
  readonly matrix: VideoMatrixCoefficients | null;
  readonly fullRange: boolean | null;

  toJSON(): VideoColorSpaceInit;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- All enum values per spec
- Nullable properties (can be unknown)
- toJSON() returns valid init object
- Support HDR color spaces (pq, hlg)

### DO NOT
- Add enum values not in spec
- Make properties non-nullable when spec says nullable

## Success Criteria
- [ ] All tests pass
- [ ] Type check passes
- [ ] All color primaries values
- [ ] All transfer characteristics values
- [ ] All matrix coefficients values
- [ ] fullRange can be true, false, or null
- [ ] toJSON() serializes correctly
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/9-raw-media-interfaces/9.9-video-color-space-interface/` - Full spec
- `docs/specs/9-raw-media-interfaces/9.10-video-color-primaries.md`
- `docs/specs/9-raw-media-interfaces/9.11-video-transfer-characteristics.md`
- `docs/specs/9-raw-media-interfaces/9.12-video-matrix-coefficients.md`
- `lib/video-frame.ts` - Current implementation

### Reference Only (Don't modify)
- ITU-R BT.709, BT.2020 specs

## Dependencies

### Waits For (Upstream)
- TODO-1: Definitions (sRGB, Display P3, REC709)

### Blocks (Downstream)
- TODO-9.4: VideoFrame.colorSpace

### Can Run In Parallel With
- TODO-9.5-9.8

## Test Requirements

### Unit Tests Required
1. VideoColorSpace constructor with no args
2. VideoColorSpace with full init
3. primaries accepts all 5 values
4. transfer accepts all 6 values
5. matrix accepts all 5 values
6. fullRange true/false/null
7. toJSON() returns correct object
8. sRGB color space matches spec definition
9. Display P3 color space matches spec definition
10. REC709 color space matches spec definition

### Edge Cases to Test
1. All properties null (unknown color space)
2. Partial init (some null, some not)
3. HDR color spaces (pq, hlg transfer)

### Error Cases to Test
1. Invalid primaries value → TypeError
2. Invalid transfer value → TypeError
3. Invalid matrix value → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-9.9-9.12.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-9.9-9.12.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
