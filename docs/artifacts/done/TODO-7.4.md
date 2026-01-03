# Task Packet: TODO-7.4

> **Feature:** WebCodecs Spec Compliance - Codec String Parsing
> **Assigned to:** Subagent 7.4
> **Priority:** 2
> **Estimated complexity:** MEDIUM

## Objective
Verify that codec strings are correctly parsed and validated per W3C spec section 7.4.

## Scope

### Files In Scope
- `lib/types.ts` - Codec string types
- `src/*.cc` - Native codec string parsing
- `test/golden/*.test.ts` - Codec string tests

### Files Out of Scope (DO NOT MODIFY)
- None

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 7.4 and codec registrations:
// Video codecs:
// - avc1.PPCCLL (H.264) e.g., avc1.42001e, avc1.4d001e, avc1.64001e
// - hvc1.* or hev1.* (H.265/HEVC)
// - vp09.PP.LL.DD (VP9) e.g., vp09.00.10.08
// - av01.P.LLT.DD (AV1) e.g., av01.0.04M.08

// Audio codecs:
// - mp4a.40.2 (AAC-LC), mp4a.40.5 (HE-AAC)
// - opus
// - mp3
// - flac
// - vorbis
```

### Outputs You Must Provide
```typescript
// Codec string validation functions:
function isValidCodecString(codec: string): boolean;
function parseVideoCodecString(codec: string): VideoCodecInfo | null;
function parseAudioCodecString(codec: string): AudioCodecInfo | null;

interface VideoCodecInfo {
  codec: 'avc' | 'hevc' | 'vp9' | 'av1';
  profile?: string;
  level?: string;
}

interface AudioCodecInfo {
  codec: 'aac' | 'opus' | 'mp3' | 'flac' | 'vorbis';
  objectType?: string;
}
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Parse all profile/level info from codec strings
- Validate format matches spec

### DO NOT
- Accept malformed codec strings
- Invent codec string formats

## Success Criteria
- [ ] All tests pass
- [ ] avc1.42001e parsed correctly (Baseline 3.0)
- [ ] avc1.4d001e parsed correctly (Main 3.0)
- [ ] avc1.64001e parsed correctly (High 3.0)
- [ ] vp09.00.10.08 parsed correctly
- [ ] mp4a.40.2 parsed correctly
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.4-codec-string.md` - Codec string spec
- RFC 6381 for codec MIME parameters

### Reference Only (Don't modify)
- Browser codec string implementations

## Dependencies

### Waits For (Upstream)
- None

### Blocks (Downstream)
- TODO-7.5, TODO-7.6, TODO-7.7, TODO-7.8: Config types use codec strings

### Can Run In Parallel With
- TODO-7.1, TODO-7.2, TODO-7.3

## Test Requirements

### Unit Tests Required
1. avc1.42001e is valid
2. avc1.4d001e is valid
3. avc1.64001e is valid
4. hvc1.1.6.L93.B0 is valid
5. vp09.00.10.08 is valid
6. av01.0.04M.08 is valid
7. mp4a.40.2 is valid
8. opus is valid
9. "invalid" is invalid

### Edge Cases to Test
1. avc1 without profile/level
2. Case sensitivity (spec defines case rules)

### Error Cases to Test
1. Empty string → invalid
2. Numeric only → invalid
3. Unknown codec → invalid

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.4.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.4.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
