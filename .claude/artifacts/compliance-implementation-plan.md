# W3C WebCodecs Compliance - Implementation Plan

Based on the compliance audit, here is the prioritized implementation plan.

---

## Phase 1: Non-Breaking Fixes (Can ship immediately)

### Task 1.1: Add codecSaturated to VideoDecoder
**Files:**
- `src/video_decoder.h` - Already has `codec_saturated_` atomic
- `src/video_decoder.cc` - Add accessor method
- `lib/native-types.ts` - Add to interface
- `lib/index.ts` - Expose getter on VideoDecoder class

**Effort:** ~30 min

### Task 1.2: Add codecSaturated to AudioEncoder
**Files:**
- `src/audio_encoder.h` - Already has `codec_saturated_` atomic
- `src/audio_encoder.cc` - Add accessor method
- `lib/native-types.ts` - Add to interface
- `lib/index.ts` - Expose getter on AudioEncoder class

**Effort:** ~30 min

### Task 1.3: Add codecSaturated to AudioDecoder
**Files:**
- `src/audio_decoder.h` - Already has `codec_saturated_` atomic
- `src/audio_decoder.cc` - Add accessor method
- `lib/native-types.ts` - Add to interface
- `lib/index.ts` - Expose getter on AudioDecoder class

**Effort:** ~30 min

### Task 1.4: Improve Control Message Queue Usage
**Issue:** Some operations bypass the queue
**Files:**
- `lib/index.ts` - Review configure/encode/decode to use queue consistently

**Effort:** ~2 hours

---

## Phase 2: Breaking Changes (v2.0 release)

### Task 2.1: Remove EncodedVideoChunk.data property
**Current:** `readonly data: Buffer;` - Exposes internal buffer
**Spec:** Only `copyTo(destination)` method should be used

**Migration:**
```typescript
// Before (non-spec):
const data = chunk.data;

// After (spec-compliant):
const data = new Uint8Array(chunk.byteLength);
chunk.copyTo(data);
```

**Files:**
- `lib/index.ts:462-516` - Modify EncodedVideoChunk class
- `lib/native-types.ts:37` - Remove from interface
- `test/**/*.ts` - Update tests using `.data`
- Update CHANGELOG with migration guide

**Effort:** ~2 hours

### Task 2.2: Verify EncodedAudioChunk compliance
**Check:** Ensure no public `data` property exposed
**Status:** Appears compliant (uses `_native` internally)

**Files to verify:**
- `lib/index.ts:757-815` - EncodedAudioChunk class

**Effort:** ~15 min

---

## Phase 3: Enhancements (Future)

### Task 3.1: High bit-depth encoder input support
**Issue:** VideoEncoder cannot accept 10/12-bit input formats directly
**Solution:** Add swscale conversion in native layer

**Files:**
- `src/video_encoder.cc` - Add format detection and conversion

**Effort:** ~4 hours

### Task 3.2: Document Node.js limitations
**Create:** Clear documentation of browser vs Node.js differences

**Items:**
- CanvasImageSource constructor not available
- ArrayBuffer transfer semantics differences
- High bit-depth input limitations

**Effort:** ~1 hour

---

## Implementation Order

```
Week 1:
├── Task 1.1: VideoDecoder.codecSaturated
├── Task 1.2: AudioEncoder.codecSaturated
├── Task 1.3: AudioDecoder.codecSaturated
└── Task 1.4: Control queue consistency

Week 2 (v2.0 prep):
├── Task 2.1: Remove EncodedVideoChunk.data
├── Task 2.2: Verify EncodedAudioChunk
└── Migration guide + CHANGELOG

Future:
├── Task 3.1: High bit-depth support
└── Task 3.2: Documentation
```

---

## Quick Wins (Immediate)

These changes maintain backwards compatibility:

1. **codecSaturated** on all codecs - C++ already tracks this, just need to expose
2. **Better error messages** - Ensure all DOMException names match spec
3. **Queue size accuracy** - Verify queue sizes decrement correctly

---

## Testing Strategy

For each change:
1. Verify existing tests pass
2. Add spec compliance tests:
   - `test/golden/spec-compliance.test.ts`
3. Browser compatibility test (manual):
   - Same code should work in browser WebCodecs

---

## Risks

| Change | Risk | Mitigation |
|--------|------|------------|
| Remove `.data` | Breaking change | Major version bump, migration guide |
| Queue changes | Behavioral change | Extensive testing |
| codecSaturated | Low risk | Additive change |

---

## Success Criteria

After implementation:
- [ ] All codec classes expose `codecSaturated`
- [ ] EncodedVideoChunk has no `data` property (v2.0)
- [ ] All operations go through control message queue
- [ ] Code written for browser WebCodecs runs unchanged in node-webcodecs
- [ ] Compliance report shows 95%+ compliance
