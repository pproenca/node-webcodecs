# Handoff Artifact: TODO-10.3-10.5

**Task:** ImageDecoder Options and Result Interfaces (W3C Spec Sections 10.3-10.5)
**Completed:** 2026-01-03
**Status:** COMPLETE

## Spec Section → Implementation Mapping

| Spec Section | Spec Requirement | Implementation Location |
|--------------|------------------|------------------------|
| 10.3 step 1 | type must be valid image MIME type | Native layer validation |
| 10.3 step 2 | ReadableStream must not be disturbed/locked | `lib/image-decoder.ts:59-63` (stream consumption) |
| 10.3 step 3 | BufferSource must not be detached/empty | `lib/image-decoder.ts:68-74` |
| **10.3 step 4** | **desiredWidth exists AND desiredHeight does NOT exist → INVALID** | **`lib/image-decoder.ts:40-44`** |
| **10.3 step 5** | **desiredHeight exists AND desiredWidth does NOT exist → INVALID** | **`lib/image-decoder.ts:45-49`** |
| 10.3 transfer | ArrayBuffers in transfer sequence are detached | `lib/image-decoder.ts:77-79` |
| 10.4 frameIndex | default 0 | `lib/types.ts:855-857` |
| 10.4 completeFramesOnly | default true | `lib/types.ts:856` |
| 10.5 image | VideoFrame | `lib/image-decoder.ts:240-250` |
| 10.5 complete | boolean indicating full detail | `lib/image-decoder.ts:248` |

## Test Coverage Table

| Test Case | Test File | Status |
|-----------|-----------|--------|
| ImageDecoderInit with ArrayBuffer data | `image-decoder.test.ts` | ✅ Pass |
| ImageDecoderInit with ReadableStream data | `image-decoder-stream.test.ts` | ✅ Pass |
| type required | `image-decoder.test.ts:286-292` | ✅ Pass |
| colorSpaceConversion defaults to "default" | `image-decoder-options.test.ts:23-31` | ✅ Pass |
| colorSpaceConversion "none" accepted | `image-decoder-options.test.ts:33-43` | ✅ Pass |
| preferAnimation option accepted | `image-decoder-options.test.ts:108-107` | ✅ Pass |
| frameIndex defaults to 0 | `image-decoder-types.test.ts:29-36` | ✅ Pass |
| completeFramesOnly defaults to true | `image-decoder-types.test.ts:29-36` | ✅ Pass |
| ImageDecodeResult.image is VideoFrame | `image-decoder.test.ts:441-449` | ✅ Pass |
| ImageDecodeResult.complete is boolean | `image-decoder.test.ts:443` | ✅ Pass |
| **desiredWidth without desiredHeight → TypeError** | `image-decoder-options.test.ts:77-90` | ✅ Pass |
| **desiredHeight without desiredWidth → TypeError** | `image-decoder-options.test.ts:92-105` | ✅ Pass |
| Both desiredWidth and desiredHeight together | `image-decoder-options.test.ts:52-63` | ✅ Pass |
| Neither desiredWidth nor desiredHeight | `image-decoder-options.test.ts:65-75` | ✅ Pass |
| Missing data → TypeError | `image-decoder.test.ts:294-300` | ✅ Pass |
| frameIndex beyond track length → RangeError | `image-decoder.test.ts:591-600` | ✅ Pass |

## Inputs NOT Tested But Should Work

Based on the spec, the following edge cases are supported by the implementation but not explicitly tested:

1. `desiredWidth: 0, desiredHeight: 0` - Valid (both present, zero dimensions handled by native)
2. `desiredWidth: Number.MAX_SAFE_INTEGER, desiredHeight: Number.MAX_SAFE_INTEGER` - Valid (within unsigned long range)
3. `colorSpaceConversion: undefined` (defaults to "default")
4. `preferAnimation: undefined` (defaults to false per spec note)
5. `completeFramesOnly: false` with progressive images
6. Multiple frames decoded from animated GIF with different frameIndex values

## Key Implementation Notes

### desiredWidth/desiredHeight Mutual Dependency (Critical Fix)

**Before:** The implementation allowed `desiredWidth` without `desiredHeight` and vice versa.

**After:** Strict validation per W3C spec 10.3 steps 4-5:
```typescript
// Spec 10.3 step 4: If desiredWidth exists and desiredHeight does not exist, return false.
// Spec 10.3 step 5: If desiredHeight exists and desiredWidth does not exist, return false.
const hasDesiredWidth = init.desiredWidth !== undefined;
const hasDesiredHeight = init.desiredHeight !== undefined;
if (hasDesiredWidth && !hasDesiredHeight) {
  throw new TypeError(
    'desiredHeight is required when desiredWidth is specified (W3C ImageDecoderInit validation step 4)',
  );
}
if (hasDesiredHeight && !hasDesiredWidth) {
  throw new TypeError(
    'desiredWidth is required when desiredHeight is specified (W3C ImageDecoderInit validation step 5)',
  );
}
```

This uses `!== undefined` rather than truthiness to correctly handle `0` as a valid dimension value.

## Completion Checklist

- [x] Tests written (RED)
- [x] Tests fail as expected
- [x] Implementation complete (GREEN)
- [x] All tests pass
- [x] Refactored if needed (BLUE)
- [x] No TypeScript errors
- [x] No lint errors
- [x] Artifact handoff document created

## Files Modified

1. `lib/image-decoder.ts` - Added desiredWidth/desiredHeight validation (lines 36-49)
2. `test/golden/image-decoder-options.test.ts` - Fixed tests to match spec (lines 46-106)
