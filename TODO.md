# WebCodecs Implementation TODO

## Gap Analysis vs W3C WebCodecs Specification

This document tracks all identified gaps between this implementation and the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/).

**Last Updated:** 2025-12-30
**Total Gaps Identified:** 48 (47 original + 1 discovered via testing)
**Test Verification:** `test/99_spec_verification.js` provides proof of functionality

---

## Priority Legend

- 🔴 **CRITICAL** - Breaks spec compliance, data loss, or major functionality missing
- 🟠 **HIGH** - Important features missing, affects common use cases
- 🟡 **MEDIUM** - Missing options, incomplete support, edge cases
- 🟢 **LOW** - Optimizations, convenience features, rare use cases

---

## 1. VideoEncoder Gaps

### 🔴 1.1 Missing Metadata Emission (TEST VERIFIED)
**File:** `src/video_encoder.cc:383-393`, `lib/index.ts:210-226`

**Test Evidence:** `test/99_spec_verification.js` test 1.1 fails - "Metadata should be emitted"

**W3C Requirement:** `EncodedVideoChunkOutputCallback` must receive `EncodedVideoChunkMetadata` containing:
- `decoderConfig` with codec `description` (SPS/PPS for H.264, VPS/SPS/PPS for HEVC)
- `temporalLayerId` for SVC/temporal scalability
- `alphaSideData` when encoding with alpha

**Current State:** Only emits basic chunk. Metadata is always null/empty. Verified by test.

**Fix Required:**
```cpp
// On first keyframe, emit decoder config with extradata
if (packet_->flags & AV_PKT_FLAG_KEY && !description_emitted_) {
    // Extract and emit codec_context_->extradata
    description_emitted_ = true;
}
```

- [ ] Extract extradata after first keyframe
- [ ] Populate decoderConfig.description
- [ ] Track temporalLayerId for SVC streams
- [ ] Handle alphaSideData for YUVA formats

---

### 🟠 1.2 Missing `alpha` Config Support
**File:** `src/video_encoder.cc`, `lib/types.ts:22`

**W3C Requirement:** `VideoEncoderConfig.alpha: "keep" | "discard"` controls alpha channel preservation.

**Current State:** Config field exists in types but is ignored in native encoder.

**Fix Required:**
- [ ] Parse `alpha` config option
- [ ] Use `AV_PIX_FMT_YUVA420P` when `alpha: "keep"`
- [ ] Emit `alphaSideData` in metadata

---

### 🟠 1.3 Missing `scalabilityMode` Support
**File:** `src/video_encoder.cc`

**W3C Requirement:** `scalabilityMode` enables temporal/spatial layer encoding (e.g., "L1T2", "L1T3", "L3T3").

**Current State:** Not implemented.

**Fix Required:**
- [ ] Parse scalabilityMode string
- [ ] Configure VP9/AV1 temporal layers via `av_opt_set()`
- [ ] Track and emit `temporalLayerId` per chunk

---

### 🔴 1.4 VP9 Encoding Not Actually Working (TEST VERIFIED)
**File:** `src/video_encoder.cc:127-131`

**Test Evidence:** `test/99_spec_verification.js` test 1.2 fails - VP9 codec string accepted but outputs H.264 NAL units.

**W3C Requirement:** When configured with VP9 codec string, should output VP9 bitstream.

**Current State:** `configure()` always uses `AV_CODEC_ID_H264` regardless of codec string. The codec string parsing in `isConfigSupported()` is not used in `configure()`.

**Proof:**
```javascript
// Configure with VP9
encoder.configure({ codec: 'vp09.00.10.08', ... });
// Output starts with 0x00 0x00 0x00/0x01 (H.264 NAL start codes)
// Should be VP9 frame header, not H.264
```

**Fix Required:**
- [ ] Parse codec string in configure() to select encoder
- [ ] Map vp09.* to AV_CODEC_ID_VP9
- [ ] Map av01.* to AV_CODEC_ID_AV1
- [ ] Apply codec-specific options

---

### 🟡 1.5 Missing `contentHint` Handling
**File:** `src/video_encoder.cc`

**W3C Requirement:** `contentHint: "detail" | "text" | "motion"` optimizes encoding for content type.

**Current State:** Not implemented.

**Fix Required:**
- [ ] Parse contentHint config
- [ ] Map to encoder presets:
  - `detail`/`text` → higher quality, preserve edges
  - `motion` → optimize for movement, accept artifacts

---

### 🟡 1.5 Missing `displayAspectWidth/Height` in Metadata
**File:** `src/video_encoder.cc`

**W3C Requirement:** Display aspect ratio should be preserved in output metadata for decoder consumption.

**Current State:** Config accepts values but they're not propagated to output.

- [ ] Store displayAspect in encoder state
- [ ] Include in decoderConfig metadata

---

### 🔴 1.6 Encoder Only Creates H.264
**File:** `src/video_encoder.cc:127-131`

**W3C Requirement:** Should support codecs based on codec string.

**Current State:** `configure()` always uses `AV_CODEC_ID_H264` regardless of codec string. VP8/VP9/AV1 parsing exists in `isConfigSupported()` but not in `configure()`.

**Fix Required:**
- [ ] Parse codec string in configure() same as isConfigSupported()
- [ ] Select appropriate encoder (VP8, VP9, AV1, H.264)
- [ ] Apply codec-specific options

---

## 2. VideoDecoder Gaps

### 🔴 2.1 Missing Color Space Propagation (TEST VERIFIED)
**File:** `src/video_decoder.cc:531-534`

**Test Evidence:** `test/99_spec_verification.js` test 2.2 fails - "colorSpace: {}" (empty object)

**W3C Requirement:** Decoded `VideoFrame.colorSpace` must reflect the source video's color properties.

**Current State:** Color space info from FFmpeg frame is discarded. VideoFrame.colorSpace returns empty `{}`.

**FFmpeg provides:**
```cpp
frame->color_primaries    // → VideoColorSpace.primaries
frame->color_trc          // → VideoColorSpace.transfer
frame->colorspace         // → VideoColorSpace.matrix
frame->color_range        // → VideoColorSpace.fullRange
```

**Fix Required:**
- [ ] Map FFmpeg color enums to W3C enums
- [ ] Pass color space to VideoFrame::CreateInstance()
- [ ] Store in VideoFrame native object

---

### 🔴 2.2 Missing `visibleRect` Support
**File:** `src/video_frame.cc`, `lib/index.ts:110-113`

**W3C Requirement:** `visibleRect` defines the visible region within `codedRect` (for cropping).

**Current State:** Always equals `codedRect`, ignoring FFmpeg's crop info.

**FFmpeg provides:**
```cpp
frame->crop_top, frame->crop_bottom
frame->crop_left, frame->crop_right
```

**Fix Required:**
- [ ] Extract crop values from decoded frame
- [ ] Calculate visibleRect from crops
- [ ] Store and expose via VideoFrame

---

### 🔴 2.3 Output Not in Presentation Order
**File:** `src/video_decoder.cc`

**W3C Requirement:** "Outputs must be in presentation order."

**Current State:** Frames emitted in decode order. B-frames cause out-of-order output.

**Fix Required:**
- [ ] Buffer decoded frames
- [ ] Reorder by PTS before emission
- [ ] Handle flush correctly with reordering

---

### 🟠 2.4 Missing Duration Calculation
**File:** `src/video_decoder.cc:531-534`

**W3C Requirement:** Output VideoFrame should have accurate `duration`.

**Current State:** Duration not set on decoded frames.

**Fix Required:**
- [ ] Calculate duration from frame timing or packet duration
- [ ] Use `frame->duration` (FFmpeg 5.1+) when available
- [ ] Fall back to `(next_pts - current_pts) * time_base`

---

### ✅ 2.5 `decodeQueueSize` Works (TEST VERIFIED)
**File:** `src/video_decoder.cc:265-268`, `src/async_decode_worker.cc`

**Test Evidence:** `test/99_spec_verification.js` test 2.1 passes - Queue shows 2 after 5 decodes

**Status:** Actually works via async worker queue tracking.

**Note:** The TODO comment in source code is outdated - the async worker properly tracks queue size.

---

### 🟠 2.6 Missing HEVC/H.265 Support
**File:** `src/video_decoder.cc:151-163`

**W3C Requirement:** HEVC is a core WebCodecs codec.

**Current State:** Codec strings "hev1.*" and "hvc1.*" not parsed.

**Fix Required:**
- [ ] Add HEVC codec string parsing
- [ ] Map to `AV_CODEC_ID_HEVC`
- [ ] Handle HEVC-specific extradata

---

## 3. AudioEncoder Gaps

### 🟡 3.1 Missing `flushInterval` Config
**File:** `lib/types.ts`, `src/audio_encoder.cc`

**W3C Requirement:** `flushInterval` triggers automatic flush after N encode calls.

**Current State:** Not implemented.

- [ ] Parse flushInterval from config
- [ ] Track encode count
- [ ] Auto-flush when interval reached

---

### ✅ 3.2 Opus Encoder Options (IMPLEMENTED + TEST VERIFIED)
**File:** `src/audio_encoder.cc:188-265`

**Test Evidence:** `test/99_spec_verification.js` tests 3.1 and 3.2 pass
- Test 3.1: frameDuration produces expected 20000us chunks
- Test 3.2: Both complexity levels (0 and 10) produce output

**Status:** Most Opus options are implemented and working:
- [x] `application` → `av_opt_set(priv_data, "application", ...)`
- [x] `complexity` → `av_opt_set_int(..., "compression_level", ...)` ✓ TEST VERIFIED
- [x] `packetlossperc` → `av_opt_set_int(..., "packet_loss", ...)`
- [x] `useinbandfec` → `av_opt_set_int(..., "fec", ...)`
- [x] `usedtx` → `av_opt_set_int(..., "dtx", ...)`
- [x] `frameDuration` → `av_opt_set_double(..., "frame_duration", ...)` ✓ TEST VERIFIED
- [ ] `signal` → Not mapped (FFmpeg libopus wrapper limitation)

---

### 🟡 3.3 Missing AAC Profile Selection
**File:** `src/audio_encoder.cc`

**W3C Requirement:** Codec string "mp4a.40.XX" indicates AAC profile.

**Current State:** Always uses default AAC-LC.

**Fix Required:**
- [ ] Parse profile from codec string (mp4a.40.2=LC, mp4a.40.5=HE-AAC, mp4a.40.29=HE-AACv2)
- [ ] Configure FFmpeg encoder profile accordingly

---

### 🟠 3.4 Missing Audio Metadata Emission
**File:** `src/audio_encoder.cc`

**W3C Requirement:** First chunk should include `EncodedAudioChunkMetadata.decoderConfig`.

**Current State:** Metadata not emitted.

**Fix Required:**
- [ ] Extract AudioSpecificConfig for AAC
- [ ] Extract OpusHead for Opus
- [ ] Emit with first encoded chunk

---

## 4. AudioDecoder Gaps

### 🟠 4.1 Limited Codec Support
**File:** `src/audio_decoder.cc:127-136`

**W3C Requirement:** Support common audio codecs.

**Current State:** Only AAC and Opus.

**Missing:**
- [ ] MP3 (`"mp3"`)
- [ ] FLAC (`"flac"`)
- [ ] Vorbis (`"vorbis"`)
- [ ] PCM variants (`"pcm-*"`)

---

### 🟡 4.2 Incorrect Default Codec Behavior
**File:** `src/audio_decoder.cc:121`

**W3C Requirement:** `codec` is required field.

**Current State:** Defaults to AAC if not specified.

**Fix Required:**
- [ ] Throw TypeError if codec not provided

---

### 🟡 4.3 Missing Planar Audio Format Support
**File:** `src/audio_decoder.cc:386`

**W3C Requirement:** Support planar formats (f32-planar, s16-planar, etc.)

**Current State:** Always converts to f32 interleaved.

**Fix Required:**
- [ ] Accept format preference in config or copyTo
- [ ] Support planar output formats
- [ ] Configure swresample accordingly

---

## 5. VideoFrame Gaps

### 🔴 5.1 Missing `duration` Property Storage (TEST VERIFIED - CRITICAL)
**File:** `src/video_frame.h`, `src/video_frame.cc`

**Test Evidence:** `test/99_spec_verification.js` test 4.3 fails - "Original frame duration: undefined"

**W3C Requirement:** `duration` should be stored and retrievable.

**Current State:** `duration` is NOT parsed or stored in the native VideoFrame constructor at all!

**Root Cause:** In `src/video_frame.cc:166-198`, the constructor parses `codedWidth`, `codedHeight`, `timestamp`, `displayWidth`, `displayHeight`, `format`, `rotation`, `flip` - but completely ignores `duration`. There is no `duration_` member variable.

**Proof:**
```javascript
const frame = new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0,
    duration: 33333  // <-- IGNORED!
});
console.log(frame.duration);  // undefined
```

**Fix Required:**
- [ ] Add `int64_t duration_` member to `VideoFrame` class in header
- [ ] Parse `duration` from options in constructor
- [ ] Add `GetDuration` accessor method
- [ ] Register "duration" in `InstanceAccessor` list in Init()
- [ ] Ensure round-trip preservation through encode/decode

---

### 🟡 5.2 Incomplete `copyTo` rect Parameter (TEST VERIFIED)
**File:** `src/video_frame.cc:493-564`

**Test Evidence:** `test/99_spec_verification.js` test 4.2 fails - "copyTo rect parameter not supported"

**W3C Requirement:** `VideoFrameCopyToOptions.rect` should crop output.

**Current State:** rect parameter ignored, throws "Destination buffer too small" because it expects full frame size.

**Fix Required:**
- [ ] Parse rect from options
- [ ] Apply cropping during copy
- [ ] Validate rect within visibleRect bounds

---

### 🟡 5.3 Missing `layout` Parameter in copyTo
**File:** `src/video_frame.cc`

**W3C Requirement:** Custom plane layout via `options.layout`.

**Current State:** Layout auto-calculated, custom layout ignored.

- [ ] Accept layout array
- [ ] Use provided offsets/strides

---

### 🟡 5.4 Missing NV21 Pixel Format
**File:** `lib/types.ts:108`

**W3C Requirement:** Support `"NV21"` (V/U reversed from NV12).

**Current State:** Only NV12 supported.

- [ ] Add NV21 to PixelFormat enum
- [ ] Map to AV_PIX_FMT_NV21
- [ ] Handle in conversion functions

---

### 🟡 5.5 Missing Stride Alignment Handling
**File:** `src/video_frame.cc:85-120`

**W3C Requirement:** Handle aligned plane strides.

**Current State:** Assumes densely packed planes.

**Fix Required:**
- [ ] Accept stride information
- [ ] Handle 16/32/64-byte aligned strides
- [ ] Adjust allocation size calculations

---

## 6. AudioData Gaps

### 🟡 6.1 Missing `transfer` Array Handling
**File:** `lib/index.ts:466-483`

**W3C Requirement:** `transfer` array enables zero-copy construction by detaching source buffers.

**Current State:** Ignored.

- [ ] Process transfer array
- [ ] Detach transferred ArrayBuffers

---

### 🟡 6.2 Duration Calculation Verification
**File:** Native vs TypeScript

**W3C Requirement:** `duration = numberOfFrames / sampleRate * 1_000_000` (microseconds).

- [ ] Verify native calculation matches spec
- [ ] Ensure consistency between layers

---

## 7. EncodedChunk Gaps

### 🟡 7.1 EncodedVideoChunk Mutability
**File:** `lib/index.ts:308-341`

**W3C Requirement:** Chunks are immutable.

**Current State:** `data` exposes mutable Buffer.

**Fix Required:**
- [ ] Return frozen/readonly view
- [ ] Or copy on access

---

### 🟡 7.2 Missing Structured Clone Support
**File:** Both chunk classes

**W3C Requirement:** Chunks are Transferable.

**Current State:** Not implemented for Node.js.

- [ ] Implement custom serialize/deserialize
- [ ] Support worker transfer

---

## 8. ImageDecoder Gaps

### 🟠 8.1 No ReadableStream Support
**File:** `src/image_decoder.cc`

**W3C Requirement:** `data` can be `ReadableStream<Uint8Array>` for progressive decoding.

**Current State:** Only Buffer/TypedArray.

- [ ] Accept ReadableStream
- [ ] Implement progressive buffering
- [ ] Decode as data arrives

---

### 🟠 8.2 Missing Animation Support
**File:** `src/image_decoder.cc`

**W3C Requirement:** GIF/WebP/APNG animations need multi-frame handling.

**Current State:** Only decodes first frame.

**Fix Required:**
- [ ] Use `av_read_frame()` loop for animated formats
- [ ] Track frame count accurately
- [ ] Implement `decode({frameIndex: N})`
- [ ] Read `repetitionCount` from metadata

---

### 🟡 8.3 Missing `preferAnimation` Config
**File:** `src/image_decoder.cc`

**W3C Requirement:** Select animated vs static track.

- [ ] Parse preferAnimation
- [ ] Affect track selection

---

### 🟡 8.4 Missing `colorSpaceConversion` Config
**File:** `src/image_decoder.cc`

**W3C Requirement:** `"none"` preserves original color space.

**Current State:** Always converts to sRGB.

- [ ] Parse colorSpaceConversion
- [ ] Skip sws_scale when "none"

---

### ✅ 8.5 `isTypeSupported` Return Type (TEST VERIFIED)
**File:** `src/image_decoder.cc:341-357`

**Test Evidence:** `test/99_spec_verification.js` test 5.1 passes - returns Promise

**W3C Requirement:** Returns `Promise<boolean>`.

**Status:** Now returns Promise correctly.

---

## 9. FFmpeg Usage Issues

### 🔴 9.1 Thread Safety Concerns
**File:** All codec files

**Issue:** Codec contexts accessed from multiple threads without synchronization.

**Fix Required:**
- [ ] Add mutex protection for codec_context_
- [ ] Or ensure single-thread access pattern

---

### 🟠 9.2 Memory Leak: Extradata
**File:** `src/video_decoder.cc:191-198`, `src/audio_decoder.cc:187-207`

**Issue:** extradata allocated with av_malloc() may leak.

**Fix Required:**
- [ ] Call `av_freep(&codec_context_->extradata)` before freeing context
- [ ] Or let FFmpeg manage via proper API

---

### 🟠 9.3 Packet Data Lifetime
**File:** `src/video_decoder.cc:292-294`

**Issue:** packet_->data points to chunk data that may be freed.

**Fix Required:**
- [ ] Copy packet data
- [ ] Or use av_packet_ref()

---

### 🟡 9.4 Missing avcodec_flush_buffers
**File:** `src/video_decoder.cc`, `src/audio_decoder.cc`

**Issue:** reset() should flush buffers without destroying context.

- [ ] Call avcodec_flush_buffers() on reset
- [ ] Allows reconfigure without realloc

---

### 🟡 9.5 SwsContext Resolution Change
**File:** `src/video_decoder.cc:504-516`

**Issue:** sws_context_ not recreated on resolution change.

- [ ] Check dimensions before reuse
- [ ] Recreate if dimensions differ

---

### 🟡 9.6 Deprecated AVPacket Pattern
**File:** Multiple files

**Issue:** Direct packet_->data assignment is deprecated.

- [ ] Use av_packet_from_data() or av_packet_ref()

---

## 10. Spec Compliance Issues

### 🟠 10.1 State Machine Violations
**File:** `lib/index.ts`

**W3C Requirement:** Proper state checks and error types.

**Issues:**
- [ ] encode() should throw if frame.closed
- [ ] decode() should throw if chunk detached
- [ ] Use InvalidStateError consistently

---

### 🟠 10.2 Error Type Mismatches
**File:** Throughout

**W3C Requirement:** Specific DOMException types.

**Fix Required:**
- [ ] NotSupportedError for unsupported configs
- [ ] InvalidStateError for wrong state
- [ ] DataError for bad input
- [ ] EncodingError for codec failures

---

### 🟡 10.3 Missing EventTarget Inheritance
**File:** `lib/index.ts`

**W3C Requirement:** Codecs extend EventTarget.

**Current State:** Plain classes.

- [ ] Extend EventTarget
- [ ] Support addEventListener for dequeue

---

### 🟡 10.4 Dequeue Event Timing
**File:** `lib/index.ts` - `_triggerDequeue()`

**W3C Requirement:** Fire when queueSize decreases.

**Current State:** Fires after output callback.

- [ ] Fire on queue decrease, not output

---

### 🟠 10.5 `flush()` Promise Semantics
**File:** Multiple files

**W3C Requirement:** Resolve after all outputs emitted.

**Current State:** Resolves immediately after native call.

**Fix Required:**
- [ ] Track pending outputs
- [ ] Resolve only when all emitted

---

## 11. Missing W3C Enum Values

### 🟡 11.1 VideoTransferCharacteristics
**File:** `lib/types.ts:120`

**Missing:**
- [ ] `"gamma22curve"`
- [ ] `"gamma28curve"`
- [ ] `"smpte240m"`
- [ ] `"log"`
- [ ] `"logSqrt"`
- [ ] `"iec61966-2-4"`
- [ ] `"bt1361e"`
- [ ] `"bt2020-10bit"`
- [ ] `"bt2020-12bit"`

---

### 🟡 11.2 VideoColorPrimaries
**File:** `lib/types.ts:117`

**Missing:**
- [ ] `"film"`

---

### 🟡 11.3 VideoMatrixCoefficients
**File:** `lib/types.ts:123`

**Missing:**
- [ ] `"fcc"`
- [ ] `"smpte240m"`
- [ ] `"ycgco"`
- [ ] `"bt2020-cl"`

---

## 12. Performance Issues

### 🟢 12.1 Unnecessary Data Copies
**File:** `lib/index.ts:143-168`

**Issue:** Multiple copies in copyTo path.

- [ ] Use SharedArrayBuffer where possible
- [ ] Direct memory views

---

### 🟢 12.2 No Hardware Acceleration
**File:** All encoder/decoder files

**Issue:** `hardwareAcceleration` config ignored.

**Fix Required:**
- [ ] Implement VAAPI (Linux)
- [ ] Implement VideoToolbox (macOS)
- [ ] Implement NVENC/NVDEC (NVIDIA)
- [ ] Implement QSV (Intel)

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 7 | 0 fixed (5 test-verified broken) |
| 🟠 HIGH | 14 | 0 fixed (decodeQueueSize works ✓) |
| 🟡 MEDIUM | 21 | 0 fixed (1 actually works ✓) |
| 🟢 LOW | 4 | 0 fixed |
| ✅ VERIFIED WORKING | 4 | Opus options, queues, isTypeSupported |
| **Total** | **48** | **4 verified working, 44 remaining** |

### Test-Verified Findings (from `test/99_spec_verification.js`):

**BROKEN (Confirmed by Tests):**
1. 🔴 VP9 encoding - codec string ignored, always H.264
2. 🔴 Metadata emission - null/undefined, no decoderConfig.description
3. 🔴 ColorSpace propagation - returns empty `{}`
4. 🔴 VideoFrame.duration - not parsed or stored at all
5. 🟡 copyTo rect parameter - throws "buffer too small"
6. 🟡 Animated GIF - only frame 0 decoded

**WORKING (Confirmed by Tests):**
1. ✅ encodeQueueSize/decodeQueueSize - properly tracks via async worker
2. ✅ Opus frameDuration - produces correct 20000us chunks
3. ✅ Opus complexity - both levels work
4. ✅ copyTo format conversion - I420 output correct
5. ✅ ImageDecoder.isTypeSupported - returns Promise

---

## References

- [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)
- [W3C WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg libavcodec API](https://ffmpeg.org/doxygen/trunk/group__lavc__decoding.html)
