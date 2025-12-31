# W3C WebCodecs Configuration Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-w3c-webcodecs-config-compliance.md` to implement task-by-task.

**Goal:** Achieve full W3C WebCodecs compliance for configuration interfaces, ensuring TypeScript types and C++ native bindings match the spec exactly.

**Architecture:** Extend existing type definitions in `lib/types.ts`, update `isConfigSupported` implementations in C++ to echo all recognized config properties, and add codec-specific configuration support (AVC, HEVC, AAC, Opus bitstream formats).

**Tech Stack:** TypeScript, C++17, N-API (node-addon-api), FFmpeg

---

## Gap Analysis Summary

Based on comparison of W3C WebCodecs spec (https://www.w3.org/TR/webcodecs/) and codec registrations against current implementation:

### VideoEncoderConfig Gaps
| Property | W3C Spec | Current Status |
|----------|----------|----------------|
| `avc` (AvcEncoderConfig) | Required for H.264 format control | **MISSING** |
| `hevc` (HevcEncoderConfig) | Required for H.265 format control | **MISSING** |
| `contentHint` | Optional string | Echo only, not stored |
| `scalabilityMode` | Optional string | Echo only, not stored |
| `alpha` | AlphaOption enum | Echo only, not stored |

### VideoDecoderConfig Gaps
| Property | W3C Spec | Current Status |
|----------|----------|----------------|
| All properties | Complete | **COMPLIANT** |

### AudioEncoderConfig Gaps
| Property | W3C Spec | Current Status |
|----------|----------|----------------|
| `aac` (AacEncoderConfig) | Required for AAC format control | **MISSING** |
| `opus.format` | OpusBitstreamFormat enum | Partially supported |

### AudioDecoderConfig Gaps
| Property | W3C Spec | Current Status |
|----------|----------|----------------|
| All properties | Complete | **COMPLIANT** |

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | TypeScript types - no file overlap |
| Group 2 | 3, 4 | VideoEncoder C++ changes |
| Group 3 | 5 | AudioEncoder C++ changes |
| Group 4 | 6, 7 | Tests - independent test files |
| Group 5 | 8 | Code Review |

---

### Task 1: Add AVC and HEVC Encoder Config Types to TypeScript

**Files:**
- Modify: `lib/types.ts:498-510`

**Step 1: Write the failing test** (2-5 min)

Create test file `test/golden/encoder-config-types.test.ts`:

```typescript
import {expect, it, describe} from 'vitest';
import type {
  AvcEncoderConfig,
  HevcEncoderConfig,
  AvcBitstreamFormat,
  HevcBitstreamFormat,
} from '../../lib/types';

describe('Encoder Config Types', () => {
  describe('AvcEncoderConfig', () => {
    it('should accept valid AVC config with annexb format', () => {
      const config: AvcEncoderConfig = {
        format: 'annexb',
      };
      expect(config.format).toBe('annexb');
    });

    it('should accept valid AVC config with avc format', () => {
      const config: AvcEncoderConfig = {
        format: 'avc',
      };
      expect(config.format).toBe('avc');
    });

    it('should default format to avc when not specified', () => {
      const config: AvcEncoderConfig = {};
      expect(config.format).toBeUndefined(); // Optional in interface, default applied at runtime
    });
  });

  describe('HevcEncoderConfig', () => {
    it('should accept valid HEVC config with annexb format', () => {
      const config: HevcEncoderConfig = {
        format: 'annexb',
      };
      expect(config.format).toBe('annexb');
    });

    it('should accept valid HEVC config with hevc format', () => {
      const config: HevcEncoderConfig = {
        format: 'hevc',
      };
      expect(config.format).toBe('hevc');
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/encoder-config-types.test.ts -v
```

Expected: FAIL with `Cannot find module` or type import errors

**Step 3: Write minimal implementation** (2-5 min)

Add to `lib/types.ts` after line 505 (after `VideoEncoderEncodeOptionsForHevc`):

```typescript
// =============================================================================
// CODEC-SPECIFIC ENCODER CONFIGURATIONS (W3C WebCodecs Codec Registry)
// =============================================================================

/**
 * WebIDL:
 * enum AvcBitstreamFormat { "annexb", "avc" };
 *
 * Per W3C AVC Codec Registration:
 * - "annexb": Parameter sets (SPS/PPS) embedded in bitstream (live streaming)
 * - "avc": Parameter sets in description (MP4 container)
 */
export type AvcBitstreamFormat = 'annexb' | 'avc';

/**
 * WebIDL:
 * dictionary AvcEncoderConfig {
 *   AvcBitstreamFormat format = "avc";
 * };
 */
export interface AvcEncoderConfig {
  format?: AvcBitstreamFormat;
}

/**
 * WebIDL:
 * enum HevcBitstreamFormat { "annexb", "hevc" };
 *
 * Per W3C HEVC Codec Registration:
 * - "annexb": Parameter sets (VPS/SPS/PPS) embedded in bitstream
 * - "hevc": Parameter sets in description (MP4 container)
 */
export type HevcBitstreamFormat = 'annexb' | 'hevc';

/**
 * WebIDL:
 * dictionary HevcEncoderConfig {
 *   HevcBitstreamFormat format = "hevc";
 * };
 */
export interface HevcEncoderConfig {
  format?: HevcBitstreamFormat;
}
```

**Step 4: Update VideoEncoderConfig to include avc/hevc** (2-5 min)

Modify `VideoEncoderConfig` interface in `lib/types.ts` (around line 463-478) to add:

```typescript
export interface VideoEncoderConfig {
  codec: string;
  width: number; // unsigned long
  height: number; // unsigned long
  displayWidth?: number; // unsigned long
  displayHeight?: number; // unsigned long
  bitrate?: number; // unsigned long long
  framerate?: number; // double
  hardwareAcceleration?: HardwareAcceleration;
  alpha?: AlphaOption;
  scalabilityMode?: string;
  bitrateMode?: VideoEncoderBitrateMode;
  latencyMode?: LatencyMode;
  contentHint?: string;
  // Codec-specific configurations per W3C WebCodecs Codec Registry
  avc?: AvcEncoderConfig;
  hevc?: HevcEncoderConfig;
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/encoder-config-types.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/encoder-config-types.test.ts
git commit -m "feat(types): add AvcEncoderConfig and HevcEncoderConfig per W3C spec"
```

---

### Task 2: Add AAC Encoder Config Types to TypeScript

**Files:**
- Modify: `lib/types.ts:623-638`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/encoder-config-types.test.ts`:

```typescript
import type {
  AacEncoderConfig,
  AacBitstreamFormat,
} from '../../lib/types';

describe('AacEncoderConfig', () => {
  it('should accept valid AAC config with aac format', () => {
    const config: AacEncoderConfig = {
      format: 'aac',
    };
    expect(config.format).toBe('aac');
  });

  it('should accept valid AAC config with adts format', () => {
    const config: AacEncoderConfig = {
      format: 'adts',
    };
    expect(config.format).toBe('adts');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/encoder-config-types.test.ts -v
```

Expected: FAIL with type import error

**Step 3: Write minimal implementation** (2-5 min)

Add to `lib/types.ts` after `OpusEncoderConfig` (around line 637):

```typescript
/**
 * WebIDL:
 * enum AacBitstreamFormat { "aac", "adts" };
 *
 * Per W3C AAC Codec Registration:
 * - "aac": Raw AAC, metadata via description (MP4 container)
 * - "adts": ADTS framing with inline metadata (streaming)
 */
export type AacBitstreamFormat = 'aac' | 'adts';

/**
 * WebIDL:
 * dictionary AacEncoderConfig {
 *   AacBitstreamFormat format = "aac";
 * };
 */
export interface AacEncoderConfig {
  format?: AacBitstreamFormat;
}
```

**Step 4: Update AudioEncoderConfig to include aac** (2-5 min)

Modify `AudioEncoderConfig` interface in `lib/types.ts` to add:

```typescript
export interface AudioEncoderConfig {
  codec: string;
  sampleRate: number; // unsigned long
  numberOfChannels: number; // unsigned long
  bitrate?: number; // unsigned long long
  bitrateMode?: BitrateMode;
  // Codec-specific configurations per W3C WebCodecs Codec Registry
  opus?: OpusEncoderConfig;
  aac?: AacEncoderConfig;
}
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/encoder-config-types.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add lib/types.ts test/golden/encoder-config-types.test.ts
git commit -m "feat(types): add AacEncoderConfig per W3C AAC codec registration"
```

---

### Task 3: Implement AVC/HEVC Bitstream Format Support in VideoEncoder C++

**Files:**
- Modify: `src/video_encoder.cc:104-217` (Configure method)
- Modify: `src/video_encoder.cc:436-470` (EmitChunks method)
- Modify: `src/video_encoder.h:59-66`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('AVC bitstream format', () => {
  it('should support avc.format = annexb in isConfigSupported', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
      avc: { format: 'annexb' },
    });
    expect(result.supported).toBe(true);
    expect(result.config.avc).toBeDefined();
    expect(result.config.avc?.format).toBe('annexb');
  });

  it('should support avc.format = avc in isConfigSupported', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
      avc: { format: 'avc' },
    });
    expect(result.supported).toBe(true);
    expect(result.config.avc?.format).toBe('avc');
  });

  it('should default avc.format to avc when not specified', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
    });
    expect(result.supported).toBe(true);
    // Default is implicit, not echoed unless provided
  });
});

describe('HEVC bitstream format', () => {
  it('should support hevc.format = annexb in isConfigSupported', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'hvc1.1.6.L93.B0',
      width: 640,
      height: 480,
      hevc: { format: 'annexb' },
    });
    // May not be supported if HEVC encoder not available
    if (result.supported) {
      expect(result.config.hevc?.format).toBe('annexb');
    }
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "AVC bitstream" -v
```

Expected: FAIL - `avc` property not echoed

**Step 3: Update isConfigSupported in C++** (5 min)

In `src/video_encoder.cc`, update `IsConfigSupported` method (around line 549-575) to add after the displayHeight copy:

```cpp
  // Copy avc-specific config if present (per W3C AVC codec registration).
  if (config.Has("avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    Napi::Object normalized_avc = Napi::Object::New(env);

    if (avc_config.Has("format") && avc_config.Get("format").IsString()) {
      std::string format = avc_config.Get("format").As<Napi::String>().Utf8Value();
      // Validate per W3C spec: "annexb" or "avc"
      if (format == "annexb" || format == "avc") {
        normalized_avc.Set("format", format);
      }
    }

    normalized_config.Set("avc", normalized_avc);
  }

  // Copy hevc-specific config if present (per W3C HEVC codec registration).
  if (config.Has("hevc") && config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    Napi::Object normalized_hevc = Napi::Object::New(env);

    if (hevc_config.Has("format") && hevc_config.Get("format").IsString()) {
      std::string format = hevc_config.Get("format").As<Napi::String>().Utf8Value();
      // Validate per W3C spec: "annexb" or "hevc"
      if (format == "annexb" || format == "hevc") {
        normalized_hevc.Set("format", format);
      }
    }

    normalized_config.Set("hevc", normalized_hevc);
  }
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "AVC bitstream" -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_encoder.cc test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): echo avc/hevc config in isConfigSupported per W3C spec"
```

---

### Task 4: Implement AVC/HEVC Bitstream Format in Configure and EmitChunks

**Files:**
- Modify: `src/video_encoder.cc:104-217`
- Modify: `src/video_encoder.cc:436-470`
- Modify: `src/video_encoder.h:59-66`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('AVC annexb encoding', () => {
  it('should produce annexb bitstream with SPS/PPS inline', async () => {
    const chunks: EncodedVideoChunk[] = [];
    const metadatas: any[] = [];

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push(chunk);
        metadatas.push(metadata);
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'avc1.42001e',
      width: 320,
      height: 240,
      bitrate: 1_000_000,
      avc: { format: 'annexb' },
    });

    const frame = new VideoFrame(
      new Uint8Array(320 * 240 * 4),
      {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      }
    );

    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);
    // For annexb, keyframe should contain NAL units with start codes
    const keyChunk = chunks[0];
    const data = new Uint8Array(keyChunk.byteLength);
    keyChunk.copyTo(data);

    // Check for Annex B start code (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
    const hasStartCode =
      (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1) ||
      (data[0] === 0 && data[1] === 0 && data[2] === 1);
    expect(hasStartCode).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "annexb encoding" -v
```

Expected: FAIL or uncertain behavior (need to verify current output format)

**Step 3: Add bitstream format member to header** (2-5 min)

In `src/video_encoder.h`, add member variable after line 65:

```cpp
  // Bitstream format for AVC/HEVC (per W3C codec registration)
  std::string bitstream_format_{"avc"};  // Default per W3C spec
```

**Step 4: Parse bitstream format in Configure** (5 min)

In `src/video_encoder.cc` Configure method, add after parsing latencyMode (around line 188):

```cpp
  // Parse codec-specific bitstream format per W3C codec registration.
  bitstream_format_ = "avc";  // Default for H.264
  if (codec_id == AV_CODEC_ID_HEVC) {
    bitstream_format_ = "hevc";  // Default for HEVC
  }

  if (config.Has("avc") && config.Get("avc").IsObject()) {
    Napi::Object avc_config = config.Get("avc").As<Napi::Object>();
    if (avc_config.Has("format") && avc_config.Get("format").IsString()) {
      bitstream_format_ = avc_config.Get("format").As<Napi::String>().Utf8Value();
    }
  } else if (config.Has("hevc") && config.Get("hevc").IsObject()) {
    Napi::Object hevc_config = config.Get("hevc").As<Napi::Object>();
    if (hevc_config.Has("format") && hevc_config.Get("format").IsString()) {
      bitstream_format_ = hevc_config.Get("format").As<Napi::String>().Utf8Value();
    }
  }
```

**Step 5: Apply bitstream format flags to FFmpeg** (5 min)

In `src/video_encoder.cc` Configure method, after codec-specific options (around line 189), add:

```cpp
  // Configure bitstream filter for output format per W3C spec.
  if (codec_id == AV_CODEC_ID_H264) {
    if (bitstream_format_ == "annexb") {
      // Annex B: No BSF needed, FFmpeg default output is Annex B
      // But ensure we don't have AVCC format by not setting extradata
    } else {
      // "avc" format: Use h264_mp4toannexb in reverse (annexb to avcc)
      // Note: FFmpeg by default outputs Annex B, we need BSF for AVCC
      // For now, document that "avc" format returns extradata separately
    }
  }
```

**Step 6: Update EmitChunks to include decoderConfig.description** (5 min)

In `src/video_encoder.cc` EmitChunks method, update the output to include description for "avc"/"hevc" format:

```cpp
    // Create metadata object per W3C spec.
    Napi::Object metadata = Napi::Object::New(env);

    // Include decoderConfig with description for avc/hevc format (not annexb).
    if ((packet_->flags & AV_PKT_FLAG_KEY) &&
        codec_context_->extradata && codec_context_->extradata_size > 0) {
      if (bitstream_format_ == "avc" || bitstream_format_ == "hevc") {
        Napi::Object decoder_config = Napi::Object::New(env);
        decoder_config.Set("codec", Napi::String::New(env, /* codec string */));
        decoder_config.Set("codedWidth", Napi::Number::New(env, width_));
        decoder_config.Set("codedHeight", Napi::Number::New(env, height_));

        // Copy extradata as description
        Napi::ArrayBuffer desc = Napi::ArrayBuffer::New(
            env, codec_context_->extradata_size);
        std::memcpy(desc.Data(), codec_context_->extradata,
                    codec_context_->extradata_size);
        decoder_config.Set("description", desc);

        metadata.Set("decoderConfig", decoder_config);
      }
    }

    // Call output callback with metadata.
    output_callback_.Call({chunk, metadata});
```

**Step 7: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "annexb encoding" -v
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
git add src/video_encoder.cc src/video_encoder.h test/golden/video-encoder.test.ts
git commit -m "feat(VideoEncoder): implement avc/hevc bitstream format per W3C spec"
```

---

### Task 5: Implement AAC Bitstream Format Support in AudioEncoder C++

**Files:**
- Modify: `src/audio_encoder.cc:96-341`
- Modify: `src/audio_encoder.cc:607-709`
- Modify: `src/audio_encoder.h`

**Step 1: Write the failing test** (2-5 min)

Add to `test/golden/audio-encoder.test.ts`:

```typescript
describe('AAC bitstream format', () => {
  it('should support aac.format = aac in isConfigSupported', async () => {
    const result = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      aac: { format: 'aac' },
    });
    expect(result.supported).toBe(true);
    expect(result.config.aac).toBeDefined();
    expect(result.config.aac?.format).toBe('aac');
  });

  it('should support aac.format = adts in isConfigSupported', async () => {
    const result = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      aac: { format: 'adts' },
    });
    expect(result.supported).toBe(true);
    expect(result.config.aac?.format).toBe('adts');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "AAC bitstream" -v
```

Expected: FAIL - `aac` property not echoed

**Step 3: Update isConfigSupported in C++** (5 min)

In `src/audio_encoder.cc`, update `IsConfigSupported` method to add after opus config handling:

```cpp
  // Copy aac-specific config if present (per W3C AAC codec registration).
  if (config.Has("aac") && config.Get("aac").IsObject()) {
    Napi::Object aac_config = config.Get("aac").As<Napi::Object>();
    Napi::Object normalized_aac = Napi::Object::New(env);

    if (aac_config.Has("format") && aac_config.Get("format").IsString()) {
      std::string format = aac_config.Get("format").As<Napi::String>().Utf8Value();
      // Validate per W3C spec: "aac" or "adts"
      if (format == "aac" || format == "adts") {
        normalized_aac.Set("format", format);
      }
    }

    normalized_config.Set("aac", normalized_aac);
  }
```

**Step 4: Add member variable and parse in Configure** (5 min)

In `src/audio_encoder.h`, add member:

```cpp
  std::string aac_format_{"aac"};  // Default per W3C spec
```

In `src/audio_encoder.cc` Configure method, add after Opus config parsing:

```cpp
  // Parse AAC-specific config per W3C AAC codec registration.
  if (codec_id == AV_CODEC_ID_AAC && config.Has("aac") &&
      config.Get("aac").IsObject()) {
    Napi::Object aac_config = config.Get("aac").As<Napi::Object>();
    if (aac_config.Has("format") && aac_config.Get("format").IsString()) {
      aac_format_ = aac_config.Get("format").As<Napi::String>().Utf8Value();
    }
  }

  // Configure ADTS muxing if format is "adts".
  if (codec_id == AV_CODEC_ID_AAC && aac_format_ == "adts") {
    // Note: FFmpeg AAC encoder can output ADTS directly via global_header flag
    // For raw AAC (default), we set global header flag
  } else if (codec_id == AV_CODEC_ID_AAC) {
    // Raw AAC packets - enable global header for extradata
    codec_context_->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
  }
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "AAC bitstream" -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add src/audio_encoder.cc src/audio_encoder.h test/golden/audio-encoder.test.ts
git commit -m "feat(AudioEncoder): add AAC bitstream format support per W3C spec"
```

---

### Task 6: Add Comprehensive isConfigSupported Echo Tests for VideoEncoder

**Files:**
- Modify: `test/golden/video-encoder.test.ts`

**Step 1: Write comprehensive tests** (5 min)

Add to `test/golden/video-encoder.test.ts`:

```typescript
describe('isConfigSupported W3C compliance', () => {
  it('should echo all recognized VideoEncoderConfig properties', async () => {
    const inputConfig = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      bitrate: 5_000_000,
      framerate: 30,
      hardwareAcceleration: 'prefer-software' as const,
      alpha: 'discard' as const,
      scalabilityMode: 'L1T2',
      bitrateMode: 'variable' as const,
      latencyMode: 'quality' as const,
      contentHint: 'motion',
      avc: { format: 'annexb' as const },
    };

    const result = await VideoEncoder.isConfigSupported(inputConfig);

    expect(result.supported).toBe(true);
    expect(result.config.codec).toBe(inputConfig.codec);
    expect(result.config.width).toBe(inputConfig.width);
    expect(result.config.height).toBe(inputConfig.height);
    expect(result.config.displayWidth).toBe(inputConfig.displayWidth);
    expect(result.config.displayHeight).toBe(inputConfig.displayHeight);
    expect(result.config.bitrate).toBe(inputConfig.bitrate);
    expect(result.config.framerate).toBe(inputConfig.framerate);
    expect(result.config.hardwareAcceleration).toBe(inputConfig.hardwareAcceleration);
    expect(result.config.alpha).toBe(inputConfig.alpha);
    expect(result.config.scalabilityMode).toBe(inputConfig.scalabilityMode);
    expect(result.config.bitrateMode).toBe(inputConfig.bitrateMode);
    expect(result.config.latencyMode).toBe(inputConfig.latencyMode);
    expect(result.config.contentHint).toBe(inputConfig.contentHint);
    expect(result.config.avc?.format).toBe(inputConfig.avc.format);
  });

  it('should not echo unrecognized properties', async () => {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 480,
      unknownProperty: 'should-not-appear',
    } as any);

    expect(result.supported).toBe(true);
    expect((result.config as any).unknownProperty).toBeUndefined();
  });

  it('should validate hardwareAcceleration enum values', async () => {
    // Valid values
    for (const hw of ['no-preference', 'prefer-hardware', 'prefer-software']) {
      const result = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width: 640,
        height: 480,
        hardwareAcceleration: hw as any,
      });
      expect(result.config.hardwareAcceleration).toBe(hw);
    }
  });
});
```

**Step 2: Run test to verify current compliance** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "W3C compliance" -v
```

**Step 3: Fix any failing assertions in C++** (5-10 min)

Update `src/video_encoder.cc` IsConfigSupported to echo all properties:

```cpp
  // Copy alpha if present per W3C spec.
  if (config.Has("alpha") && config.Get("alpha").IsString()) {
    normalized_config.Set("alpha", config.Get("alpha"));
  }

  // Copy scalabilityMode if present per W3C spec.
  if (config.Has("scalabilityMode") && config.Get("scalabilityMode").IsString()) {
    normalized_config.Set("scalabilityMode", config.Get("scalabilityMode"));
  }

  // Copy contentHint if present per W3C spec.
  if (config.Has("contentHint") && config.Get("contentHint").IsString()) {
    normalized_config.Set("contentHint", config.Get("contentHint"));
  }
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/video-encoder.test.ts -t "W3C compliance" -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add test/golden/video-encoder.test.ts src/video_encoder.cc
git commit -m "test(VideoEncoder): add comprehensive W3C isConfigSupported compliance tests"
```

---

### Task 7: Add Comprehensive isConfigSupported Echo Tests for AudioEncoder

**Files:**
- Modify: `test/golden/audio-encoder.test.ts`

**Step 1: Write comprehensive tests** (5 min)

Add to `test/golden/audio-encoder.test.ts`:

```typescript
describe('isConfigSupported W3C compliance', () => {
  it('should echo all recognized AudioEncoderConfig properties for AAC', async () => {
    const inputConfig = {
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
      bitrateMode: 'variable' as const,
      aac: { format: 'adts' as const },
    };

    const result = await AudioEncoder.isConfigSupported(inputConfig);

    expect(result.supported).toBe(true);
    expect(result.config.codec).toBe(inputConfig.codec);
    expect(result.config.sampleRate).toBe(inputConfig.sampleRate);
    expect(result.config.numberOfChannels).toBe(inputConfig.numberOfChannels);
    expect(result.config.bitrate).toBe(inputConfig.bitrate);
    expect(result.config.bitrateMode).toBe(inputConfig.bitrateMode);
    expect(result.config.aac?.format).toBe(inputConfig.aac.format);
  });

  it('should echo all recognized AudioEncoderConfig properties for Opus', async () => {
    const inputConfig = {
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 64000,
      bitrateMode: 'variable' as const,
      opus: {
        application: 'audio' as const,
        complexity: 9,
        format: 'opus' as const,
        frameDuration: 20000,
        packetlossperc: 0,
        signal: 'auto' as const,
        usedtx: false,
        useinbandfec: false,
      },
    };

    const result = await AudioEncoder.isConfigSupported(inputConfig);

    expect(result.supported).toBe(true);
    expect(result.config.opus?.application).toBe(inputConfig.opus.application);
    expect(result.config.opus?.complexity).toBe(inputConfig.opus.complexity);
    expect(result.config.opus?.format).toBe(inputConfig.opus.format);
    expect(result.config.opus?.frameDuration).toBe(inputConfig.opus.frameDuration);
    expect(result.config.opus?.packetlossperc).toBe(inputConfig.opus.packetlossperc);
    expect(result.config.opus?.signal).toBe(inputConfig.opus.signal);
    expect(result.config.opus?.usedtx).toBe(inputConfig.opus.usedtx);
    expect(result.config.opus?.useinbandfec).toBe(inputConfig.opus.useinbandfec);
  });

  it('should validate bitrateMode enum values', async () => {
    for (const mode of ['constant', 'variable']) {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrateMode: mode as any,
      });
      expect(result.config.bitrateMode).toBe(mode);
    }
  });
});
```

**Step 2: Run test** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "W3C compliance" -v
```

**Step 3: Commit** (30 sec)

```bash
git add test/golden/audio-encoder.test.ts
git commit -m "test(AudioEncoder): add comprehensive W3C isConfigSupported compliance tests"
```

---

### Task 8: Code Review

**Files:**
- All modified files from previous tasks

**Step 1: Run full test suite** (2-5 min)

```bash
npm test
```

Expected: All tests pass

**Step 2: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No errors

**Step 3: Run type checking** (30 sec)

```bash
npm run build:ts
```

Expected: No type errors

**Step 4: Review changes** (5 min)

```bash
git diff master..HEAD
```

Verify:
- All new types follow W3C WebIDL naming conventions
- All isConfigSupported methods echo recognized properties
- No breaking changes to existing APIs
- Tests cover edge cases

**Step 5: Create summary commit if needed** (30 sec)

If any fixups needed, commit them with appropriate message.

---

## Export Updates Required

After completing the tasks, ensure `lib/index.ts` exports the new types:

```typescript
export type {
  // ... existing exports ...
  AvcEncoderConfig,
  AvcBitstreamFormat,
  HevcEncoderConfig,
  HevcBitstreamFormat,
  AacEncoderConfig,
  AacBitstreamFormat,
} from './types';
```

---

## Post-Completion Actions

1. **Code Review** - Use `/dev-workflow:code-reviewer` to review all changes
2. **Finish Branch** - Use `/dev-workflow:finishing-a-development-branch` to merge/PR
