# AudioDecoder W3C WebCodecs Full Compliance Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-audiodecoder-w3c-compliance.md` to implement task-by-task.

**Goal:** Achieve 100% W3C WebCodecs specification compliance for AudioDecoder interface, ensuring perfect one-to-one match with WebIDL so that browser code ports seamlessly.

**Architecture:** The implementation maintains the existing two-layer architecture (TypeScript API + C++ native bindings via NAPI). Changes focus on API surface alignment, error handling per spec, and codec support expansion without architectural changes.

**Tech Stack:** TypeScript, C++17, node-addon-api (NAPI), FFmpeg (libavcodec, libswresample), Vitest

---

## Compliance Gap Analysis

### W3C WebIDL Reference

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioDecoder : EventTarget {
  constructor(AudioDecoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long decodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioDecoderConfig config);
  undefined decode(EncodedAudioChunk chunk);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioDecoderSupport> isConfigSupported(AudioDecoderConfig config);
};

dictionary AudioDecoderConfig {
  required DOMString codec;
  required unsigned long sampleRate;
  required unsigned long numberOfChannels;
  BufferSource description;
};
```

### Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| `state` getter | COMPLIANT | Returns CodecState |
| `decodeQueueSize` getter | COMPLIANT | Returns unsigned long |
| `ondequeue` handler | COMPLIANT | Via CodecBase + EventTarget |
| `configure()` | NEEDS FIX | Should validate required fields, throw TypeError |
| `decode()` | NEEDS FIX | Should throw on closed state, check chunk validity |
| `flush()` | COMPLIANT | Returns Promise |
| `reset()` | NEEDS FIX | W3C: should NOT throw on closed state |
| `close()` | COMPLIANT | Sets state to closed |
| `isConfigSupported()` | NEEDS FIX | Missing codec validation per W3C registry |
| `codecSaturated` getter | NON-COMPLIANT | Not in W3C spec (extension) |
| EventTarget inheritance | COMPLIANT | Via CodecBase |

### Additional Gaps

1. **Error Types**: W3C spec requires specific DOMException types (TypeError, InvalidStateError, NotSupportedError)
2. **Codec Support**: Limited to AAC/Opus, W3C registry includes MP3, FLAC, Vorbis, ALAC, etc.
3. **AudioData output**: `copyTo()` should return Promise per W3C spec (currently sync)
4. **EncodedAudioChunk duration**: Should be `unsigned long long?` (nullable)

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | Error handling fixes in TypeScript layer |
| Group 2 | 3, 4 | C++ native layer codec expansion |
| Group 3 | 5, 6 | API surface alignment |
| Group 4 | 7 | Code review |

---

### Task 1: Fix configure() W3C Error Handling

**Files:**
- Modify: `lib/index.ts:942-950`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-decoder.test.ts
describe('configure() W3C compliance', () => {
  it('should throw TypeError when codec is missing', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        sampleRate: 48000,
        numberOfChannels: 2,
      } as AudioDecoderConfig);
    }).toThrow(TypeError);

    decoder.close();
  });

  it('should throw TypeError when sampleRate is missing', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'opus',
        numberOfChannels: 2,
      } as AudioDecoderConfig);
    }).toThrow(TypeError);

    decoder.close();
  });

  it('should throw TypeError when numberOfChannels is missing', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
      } as AudioDecoderConfig);
    }).toThrow(TypeError);

    decoder.close();
  });

  it('should throw InvalidStateError when closed', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    decoder.close();

    expect(() => {
      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
    }).toThrow(DOMException);

    try {
      decoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
    } catch (e) {
      expect((e as DOMException).name).toBe('InvalidStateError');
    }
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "configure() W3C compliance"
```

Expected: FAIL (TypeError not thrown for missing required fields)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts:942-950`:

```typescript
configure(config: AudioDecoderConfig): void {
  // W3C spec: throw if closed
  if (this.state === 'closed') {
    throw new DOMException('Decoder is closed', 'InvalidStateError');
  }

  // W3C spec: validate required fields with TypeError
  if (config.codec === undefined || config.codec === null) {
    throw new TypeError("Failed to execute 'configure' on 'AudioDecoder': required member codec is undefined.");
  }
  if (config.sampleRate === undefined || config.sampleRate === null) {
    throw new TypeError("Failed to execute 'configure' on 'AudioDecoder': required member sampleRate is undefined.");
  }
  if (config.numberOfChannels === undefined || config.numberOfChannels === null) {
    throw new TypeError("Failed to execute 'configure' on 'AudioDecoder': required member numberOfChannels is undefined.");
  }

  this._needsKeyFrame = true;
  // Configure synchronously to set state immediately per W3C spec
  this._native.configure(config);
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "configure() W3C compliance"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-decoder.test.ts
git commit -m "fix(audio-decoder): add W3C-compliant TypeError for missing config fields"
```

---

### Task 2: Fix decode() and reset() W3C Error Handling

**Files:**
- Modify: `lib/index.ts:952-991`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-decoder.test.ts
describe('decode() W3C compliance', () => {
  it('should throw InvalidStateError when unconfigured', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    const chunk = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      data: new Uint8Array([0, 0, 0, 0]),
    });

    expect(() => decoder.decode(chunk)).toThrow(DOMException);

    try {
      decoder.decode(chunk);
    } catch (e) {
      expect((e as DOMException).name).toBe('InvalidStateError');
    }

    decoder.close();
  });

  it('should throw InvalidStateError when closed', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    decoder.close();

    const chunk = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      data: new Uint8Array([0, 0, 0, 0]),
    });

    expect(() => decoder.decode(chunk)).toThrow(DOMException);

    try {
      decoder.decode(chunk);
    } catch (e) {
      expect((e as DOMException).name).toBe('InvalidStateError');
    }
  });
});

describe('reset() W3C compliance', () => {
  it('should NOT throw when decoder is closed (W3C spec)', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    decoder.close();

    // W3C spec: reset() should be a no-op when closed, not throw
    expect(() => decoder.reset()).not.toThrow();
  });

  it('should transition to unconfigured state', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    decoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    expect(decoder.state).toBe('configured');

    decoder.reset();

    expect(decoder.state).toBe('unconfigured');

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "decode() W3C compliance|reset() W3C compliance"
```

Expected: FAIL (decode doesn't throw InvalidStateError, reset throws on closed)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts:952-991`:

```typescript
decode(chunk: EncodedAudioChunk): void {
  // W3C spec: throw InvalidStateError if not configured
  if (this.state === 'unconfigured') {
    throw new DOMException('Decoder is not configured', 'InvalidStateError');
  }
  if (this.state === 'closed') {
    throw new DOMException('Decoder is closed', 'InvalidStateError');
  }

  // Check if first chunk must be a key frame per W3C spec
  if (this._needsKeyFrame && chunk.type !== 'key') {
    this._errorCallback(
      new DOMException(
        'First chunk after configure/reset must be a key frame',
        'DataError',
      ),
    );
    return;
  }
  this._needsKeyFrame = false;

  this._decodeQueueSize++;
  // Call native decode directly - chunk must be valid at call time
  this._native.decode(chunk._nativeChunk);
}

reset(): void {
  // W3C spec: reset() is a no-op when closed (does NOT throw)
  if (this.state === 'closed') {
    return;
  }
  this._controlQueue.clear();
  this._decodeQueueSize = 0;
  this._needsKeyFrame = true;
  this._native.reset();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "decode() W3C compliance|reset() W3C compliance"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-decoder.test.ts
git commit -m "fix(audio-decoder): align decode()/reset() error handling with W3C spec"
```

---

### Task 3: Add MP3 Codec Support in Native Layer

**Files:**
- Modify: `src/audio_decoder.cc:128-138`
- Modify: `src/audio_decoder.cc:490-510`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-decoder.test.ts
describe('MP3 codec support', () => {
  it('should support mp3 codec string', async () => {
    const result = await AudioDecoder.isConfigSupported({
      codec: 'mp3',
      sampleRate: 44100,
      numberOfChannels: 2,
    });

    expect(result.supported).toBe(true);
    expect(result.config.codec).toBe('mp3');
  });

  it('should configure with mp3 codec', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'mp3',
        sampleRate: 44100,
        numberOfChannels: 2,
      });
    }).not.toThrow();

    expect(decoder.state).toBe('configured');

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "MP3 codec support"
```

Expected: FAIL (NotSupportedError: Unknown codec: mp3)

**Step 3: Write minimal implementation** (2-5 min)

Modify `src/audio_decoder.cc:128-138`:

```cpp
// Determine codec ID.
AVCodecID codec_id = AV_CODEC_ID_AAC;
if (codec_str == "opus") {
  codec_id = AV_CODEC_ID_OPUS;
} else if (codec_str.find("mp4a.40") == 0) {
  codec_id = AV_CODEC_ID_AAC;
} else if (codec_str == "mp3") {
  codec_id = AV_CODEC_ID_MP3;
} else {
  Napi::Error::New(env, "NotSupportedError: Unknown codec: " + codec_str)
      .ThrowAsJavaScriptException();
  return env.Undefined();
}
```

Modify `src/audio_decoder.cc:490-510` (in IsConfigSupported):

```cpp
if (codec == "opus") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_OPUS);
  if (!c) {
    supported = false;
  }
} else if (codec.find("mp4a.40") == 0) {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AAC);
  if (!c) {
    supported = false;
  }
} else if (codec == "mp3") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_MP3);
  if (!c) {
    supported = false;
  }
} else {
  supported = false;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "MP3 codec support"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add src/audio_decoder.cc test/golden/audio-decoder.test.ts
git commit -m "feat(audio-decoder): add MP3 codec support per W3C registry"
```

---

### Task 4: Add FLAC and Vorbis Codec Support

**Files:**
- Modify: `src/audio_decoder.cc:128-145`
- Modify: `src/audio_decoder.cc:490-520`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-decoder.test.ts
describe('FLAC codec support', () => {
  it('should support flac codec string', async () => {
    const result = await AudioDecoder.isConfigSupported({
      codec: 'flac',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    expect(result.supported).toBe(true);
    expect(result.config.codec).toBe('flac');
  });

  it('should configure with flac codec', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'flac',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
    }).not.toThrow();

    expect(decoder.state).toBe('configured');

    decoder.close();
  });
});

describe('Vorbis codec support', () => {
  it('should support vorbis codec string', async () => {
    const result = await AudioDecoder.isConfigSupported({
      codec: 'vorbis',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    expect(result.supported).toBe(true);
    expect(result.config.codec).toBe('vorbis');
  });

  it('should configure with vorbis codec', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      decoder.configure({
        codec: 'vorbis',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
    }).not.toThrow();

    expect(decoder.state).toBe('configured');

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "FLAC codec support|Vorbis codec support"
```

Expected: FAIL (NotSupportedError for flac and vorbis)

**Step 3: Write minimal implementation** (2-5 min)

Modify `src/audio_decoder.cc:128-145`:

```cpp
// Determine codec ID.
AVCodecID codec_id = AV_CODEC_ID_AAC;
if (codec_str == "opus") {
  codec_id = AV_CODEC_ID_OPUS;
} else if (codec_str.find("mp4a.40") == 0) {
  codec_id = AV_CODEC_ID_AAC;
} else if (codec_str == "mp3") {
  codec_id = AV_CODEC_ID_MP3;
} else if (codec_str == "flac") {
  codec_id = AV_CODEC_ID_FLAC;
} else if (codec_str == "vorbis") {
  codec_id = AV_CODEC_ID_VORBIS;
} else {
  Napi::Error::New(env, "NotSupportedError: Unknown codec: " + codec_str)
      .ThrowAsJavaScriptException();
  return env.Undefined();
}
```

Modify `src/audio_decoder.cc:490-520` (in IsConfigSupported):

```cpp
if (codec == "opus") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_OPUS);
  if (!c) supported = false;
} else if (codec.find("mp4a.40") == 0) {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AAC);
  if (!c) supported = false;
} else if (codec == "mp3") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_MP3);
  if (!c) supported = false;
} else if (codec == "flac") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_FLAC);
  if (!c) supported = false;
} else if (codec == "vorbis") {
  const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VORBIS);
  if (!c) supported = false;
} else {
  supported = false;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "FLAC codec support|Vorbis codec support"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add src/audio_decoder.cc test/golden/audio-decoder.test.ts
git commit -m "feat(audio-decoder): add FLAC and Vorbis codec support per W3C registry"
```

---

### Task 5: Remove Non-Standard codecSaturated Property

**Files:**
- Modify: `lib/index.ts:938-940`
- Modify: `src/audio_decoder.h:37`
- Modify: `src/audio_decoder.cc:39-40,248-250,279,324,356,467-468`
- Test: `test/golden/audio-decoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-decoder.test.ts
describe('W3C interface compliance', () => {
  it('should NOT have codecSaturated property (non-standard)', () => {
    const decoder = new AudioDecoder({
      output: () => {},
      error: () => {},
    });

    // W3C spec does not include codecSaturated
    expect(Object.prototype.hasOwnProperty.call(decoder, 'codecSaturated')).toBe(false);
    expect('codecSaturated' in decoder).toBe(false);

    decoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "W3C interface compliance"
```

Expected: FAIL (codecSaturated property exists)

**Step 3: Write minimal implementation** (2-5 min)

Remove from `lib/index.ts:938-940`:

```typescript
// DELETE these lines:
// get codecSaturated(): boolean {
//   return this._native.codecSaturated;
// }
```

Remove from `src/audio_decoder.h:37`:

```cpp
// DELETE this line:
// Napi::Value GetCodecSaturated(const Napi::CallbackInfo& info);
```

Also remove the `codec_saturated_` member variable and `kMaxQueueSize` constant.

Remove from `src/audio_decoder.cc` the `InstanceAccessor` for codecSaturated and the `GetCodecSaturated` method, plus all references to `codec_saturated_` and `kMaxQueueSize`.

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-decoder.test.ts -t "W3C interface compliance"
```

Expected: PASS

**Step 5: Rebuild and run full test suite** (1 min)

```bash
npm run build && npm test
```

Expected: All tests pass

**Step 6: Commit** (30 sec)

```bash
git add lib/index.ts src/audio_decoder.h src/audio_decoder.cc test/golden/audio-decoder.test.ts
git commit -m "fix(audio-decoder): remove non-standard codecSaturated property for W3C compliance"
```

---

### Task 6: Add AudioData allocationSize() Options Validation

**Files:**
- Modify: `lib/index.ts:698-706`
- Test: `test/golden/audio-data.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Create test/golden/audio-data.test.ts if it doesn't exist, or add to existing
import {describe, it, expect} from 'vitest';

describe('AudioData.allocationSize() W3C compliance', () => {
  it('should require planeIndex option per W3C spec', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    // W3C spec: planeIndex is required in AudioDataCopyToOptions
    expect(() => {
      audioData.allocationSize({} as AudioDataCopyToOptions);
    }).toThrow(TypeError);

    audioData.close();
  });

  it('should accept valid planeIndex', () => {
    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    const size = audioData.allocationSize({planeIndex: 0});
    expect(size).toBeGreaterThan(0);

    audioData.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-data.test.ts -t "AudioData.allocationSize() W3C compliance"
```

Expected: FAIL (no TypeError thrown for missing planeIndex)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts:698-706`:

```typescript
allocationSize(options: AudioDataCopyToOptions): number {
  if (this._closed) {
    throw new DOMException(
      'InvalidStateError: AudioData is closed',
      'InvalidStateError',
    );
  }
  // W3C spec: planeIndex is required
  if (options.planeIndex === undefined || options.planeIndex === null) {
    throw new TypeError("Failed to execute 'allocationSize' on 'AudioData': required member planeIndex is undefined.");
  }
  return this._native.allocationSize(options);
}
```

Also update `copyTo` signature to require options:

```typescript
copyTo(
  destination: ArrayBuffer | ArrayBufferView,
  options: AudioDataCopyToOptions,
): void {
  if (this._closed) {
    throw new DOMException(
      'InvalidStateError: AudioData is closed',
      'InvalidStateError',
    );
  }
  // W3C spec: planeIndex is required
  if (options.planeIndex === undefined || options.planeIndex === null) {
    throw new TypeError("Failed to execute 'copyTo' on 'AudioData': required member planeIndex is undefined.");
  }
  // ... rest of implementation
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-data.test.ts -t "AudioData.allocationSize() W3C compliance"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-data.test.ts
git commit -m "fix(audio-data): require planeIndex option per W3C spec"
```

---

### Task 7: Code Review

**Files:**
- All modified files from Tasks 1-6

**Step 1: Run full test suite** (1 min)

```bash
npm run build && npm test
```

Expected: All tests pass

**Step 2: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 3: Verify W3C interface compliance** (2-5 min)

Review the AudioDecoder interface against W3C WebIDL:

```
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioDecoder : EventTarget {
  constructor(AudioDecoderInit init);                    // COMPLIANT
  readonly attribute CodecState state;                   // COMPLIANT
  readonly attribute unsigned long decodeQueueSize;      // COMPLIANT
  attribute EventHandler ondequeue;                      // COMPLIANT (via CodecBase)
  undefined configure(AudioDecoderConfig config);        // COMPLIANT (after Task 1)
  undefined decode(EncodedAudioChunk chunk);             // COMPLIANT (after Task 2)
  Promise<undefined> flush();                            // COMPLIANT
  undefined reset();                                     // COMPLIANT (after Task 2)
  undefined close();                                     // COMPLIANT
  static Promise<AudioDecoderSupport> isConfigSupported(AudioDecoderConfig config); // COMPLIANT
};
```

**Step 4: Address any issues found**

Fix any remaining issues discovered during review.

**Step 5: Final commit** (30 sec)

```bash
git add -A
git commit -m "chore: finalize AudioDecoder W3C compliance implementation"
```

---

## Summary of Changes

After completing all tasks:

1. **Error Handling**: TypeError for missing required config fields, InvalidStateError for state violations
2. **reset() Behavior**: No longer throws on closed state (W3C spec: no-op)
3. **Codec Support**: Added MP3, FLAC, Vorbis to native layer
4. **API Surface**: Removed non-standard `codecSaturated` property
5. **AudioData**: Required `planeIndex` option validation

## Not Addressed (Out of Scope)

- AudioData.copyTo() returning Promise (would break existing API)
- ArrayBuffer transfer semantics (Node.js limitation documented in CLAUDE.md)
- High bit-depth formats (P10/P12) - documented limitation
- ulaw/alaw codecs (can be added in future)
