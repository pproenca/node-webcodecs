# AudioEncoder W3C WebCodecs Full Compliance Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-audioencoder-w3c-compliance.md` to implement task-by-task.

**Goal:** Achieve 100% W3C WebCodecs specification compliance for AudioEncoder interface, ensuring perfect one-to-one match with WebIDL so that browser code ports seamlessly.

**Architecture:** The implementation maintains the existing two-layer architecture (TypeScript API + C++ native bindings via NAPI). Changes focus on API surface alignment, error handling per spec, and bitrateMode support without architectural changes.

**Tech Stack:** TypeScript, C++17, node-addon-api (NAPI), FFmpeg (libavcodec, libswresample), Vitest

---

## Compliance Gap Analysis

### W3C WebIDL Reference

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioEncoder : EventTarget {
  constructor(AudioEncoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long encodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioEncoderConfig config);
  undefined encode(AudioData data);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioEncoderSupport> isConfigSupported(AudioEncoderConfig config);
};

dictionary AudioEncoderInit {
  required EncodedAudioChunkOutputCallback output;
  required WebCodecsErrorCallback error;
};

dictionary AudioEncoderConfig {
  required DOMString codec;
  required unsigned long sampleRate;
  required unsigned long numberOfChannels;
  unsigned long long bitrate;
  BitrateMode bitrateMode;  // "constant" | "variable"
};

enum BitrateMode { "constant", "variable" };

dictionary AudioEncoderSupport {
  boolean supported;
  AudioEncoderConfig config;
};
```

### Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Constructor | PARTIAL | Missing TypeError validation per W3C |
| `state` getter | COMPLIANT | Returns CodecState |
| `encodeQueueSize` getter | COMPLIANT | Returns unsigned long |
| `ondequeue` handler | COMPLIANT | Via CodecBase + EventTarget |
| `configure()` | NEEDS FIX | Should validate required fields, throw TypeError/InvalidStateError |
| `encode()` | NEEDS FIX | Should throw InvalidStateError if not configured/closed |
| `flush()` | NEEDS FIX | Should reject if unconfigured/closed per W3C |
| `reset()` | NEEDS FIX | W3C: should NOT throw on closed state (no-op) |
| `close()` | COMPLIANT | Sets state to closed |
| `isConfigSupported()` | NEEDS FIX | Missing bitrateMode normalization |
| `codecSaturated` getter | NON-STANDARD | Not in W3C spec (extension) |
| `bitrateMode` config | MISSING | Not implemented in configure() |
| EventTarget inheritance | COMPLIANT | Via CodecBase |

### Key Differences from Browser

1. **Error Types**: W3C spec requires specific DOMException types (TypeError, InvalidStateError, NotSupportedError)
2. **bitrateMode**: W3C spec includes this optional config field, currently not supported
3. **Opus-specific config**: W3C WebCodecs Registry defines Opus-specific fields in a separate `OpusEncoderConfig` dict
4. **codecSaturated**: Non-standard extension (useful but not in W3C spec)

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | TypeScript layer error handling (independent) |
| Group 2 | 3 | Native layer bitrateMode support |
| Group 3 | 4 | Comprehensive W3C compliance test suite |
| Group 4 | 5 | Code review |

---

### Task 1: Fix Constructor and configure() W3C Error Handling

**Files:**
- Modify: `lib/index.ts:852-896`
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-encoder.test.ts
import {describe, it, expect, beforeEach, afterEach} from 'vitest';

describe('AudioEncoder W3C Compliance', () => {
  describe('constructor()', () => {
    it('should throw TypeError when output callback is missing', () => {
      expect(() => {
        new AudioEncoder({
          error: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when error callback is missing', () => {
      expect(() => {
        new AudioEncoder({
          output: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when output is not a function', () => {
      expect(() => {
        new AudioEncoder({
          output: 'not a function',
          error: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when error is not a function', () => {
      expect(() => {
        new AudioEncoder({
          output: () => {},
          error: 'not a function',
        } as any);
      }).toThrow(TypeError);
    });

    it('should create encoder with valid callbacks', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder.state).toBe('unconfigured');
      expect(encoder.encodeQueueSize).toBe(0);
      encoder.close();
    });
  });

  describe('configure() W3C compliance', () => {
    let encoder: AudioEncoder;

    beforeEach(() => {
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (encoder.state !== 'closed') {
        encoder.close();
      }
    });

    it('should throw TypeError when codec is missing', () => {
      expect(() => {
        encoder.configure({
          sampleRate: 48000,
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when sampleRate is missing', () => {
      expect(() => {
        encoder.configure({
          codec: 'opus',
          numberOfChannels: 2,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw TypeError when numberOfChannels is missing', () => {
      expect(() => {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
        } as AudioEncoderConfig);
      }).toThrow(TypeError);
    });

    it('should throw InvalidStateError when encoder is closed', () => {
      encoder.close();

      try {
        encoder.configure({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
        });
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.name).toBe('InvalidStateError');
      }
    });

    it('should transition to configured state on valid config', () => {
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');
    });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "AudioEncoder W3C Compliance"
```

Expected: FAIL (TypeError not thrown for missing required fields, constructor allows missing callbacks)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts:852-896`:

```typescript
export class AudioEncoder extends CodecBase {
  private _native: NativeAudioEncoder;
  private _controlQueue: ControlMessageQueue;
  private _encodeQueueSize: number = 0;

  constructor(init: AudioEncoderInit) {
    super();

    // W3C spec: output and error callbacks are required
    if (!init || typeof init.output !== 'function') {
      throw new TypeError('output callback is required');
    }
    if (typeof init.error !== 'function') {
      throw new TypeError('error callback is required');
    }

    this._controlQueue = new ControlMessageQueue();
    this._controlQueue.setErrorHandler(init.error);

    const outputCallback: AudioEncoderOutputCallback = (chunk, metadata) => {
      // Decrement queue size when output received
      this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = Object.create(EncodedAudioChunk.prototype) as any;
      wrapper._native = chunk as unknown as NativeEncodedAudioChunk;
      init.output(wrapper as EncodedAudioChunk, metadata);

      // Fire ondequeue after output
      this._triggerDequeue();
    };

    this._native = new native.AudioEncoder({
      output: outputCallback,
      error: init.error,
    });
  }

  get state(): CodecState {
    return this._native.state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  get codecSaturated(): boolean {
    return this._native.codecSaturated;
  }

  configure(config: AudioEncoderConfig): void {
    // W3C spec: throw if closed
    if (this.state === 'closed') {
      throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // W3C spec: validate required fields with TypeError
    if (config.codec === undefined || config.codec === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member codec is undefined."
      );
    }
    if (config.sampleRate === undefined || config.sampleRate === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member sampleRate is undefined."
      );
    }
    if (config.numberOfChannels === undefined || config.numberOfChannels === null) {
      throw new TypeError(
        "Failed to execute 'configure' on 'AudioEncoder': required member numberOfChannels is undefined."
      );
    }

    // Configure synchronously to set state immediately per W3C spec
    this._native.configure(config);
  }

  // ... rest of methods unchanged
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "AudioEncoder W3C Compliance"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-encoder.test.ts
git commit -m "fix(audio-encoder): add W3C-compliant error handling for constructor and configure()"
```

---

### Task 2: Fix encode(), flush(), and reset() W3C Error Handling

**Files:**
- Modify: `lib/index.ts:897-926`
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-encoder.test.ts

describe('encode() W3C compliance', () => {
  it('should throw InvalidStateError when encoder is unconfigured', () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    try {
      encoder.encode(audioData);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.name).toBe('InvalidStateError');
    }

    audioData.close();
    encoder.close();
  });

  it('should throw InvalidStateError when encoder is closed', () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.close();

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(1024 * 2),
    });

    try {
      encoder.encode(audioData);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.name).toBe('InvalidStateError');
    }

    audioData.close();
  });
});

describe('flush() W3C compliance', () => {
  it('should reject with InvalidStateError when unconfigured', async () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    try {
      await encoder.flush();
      expect.fail('Should have rejected');
    } catch (e: any) {
      expect(e.name).toBe('InvalidStateError');
    }

    encoder.close();
  });

  it('should reject with InvalidStateError when closed', async () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.close();

    try {
      await encoder.flush();
      expect.fail('Should have rejected');
    } catch (e: any) {
      expect(e.name).toBe('InvalidStateError');
    }
  });
});

describe('reset() W3C compliance', () => {
  it('should NOT throw when encoder is closed (W3C spec: no-op)', () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.close();

    // W3C spec: reset() should be a no-op when closed, not throw
    expect(() => encoder.reset()).not.toThrow();
  });

  it('should transition to unconfigured state', () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
    });

    expect(encoder.state).toBe('configured');

    encoder.reset();

    expect(encoder.state).toBe('unconfigured');

    encoder.close();
  });

  it('should clear encodeQueueSize', async () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 960,
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(960 * 2),
    });

    encoder.encode(audioData);
    audioData.close();

    encoder.reset();

    expect(encoder.encodeQueueSize).toBe(0);

    encoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "encode() W3C compliance|flush() W3C compliance|reset() W3C compliance"
```

Expected: FAIL (encode doesn't throw InvalidStateError, flush doesn't reject, reset throws on closed)

**Step 3: Write minimal implementation** (2-5 min)

Modify `lib/index.ts:897-926`:

```typescript
encode(data: AudioData): void {
  // W3C spec: throw InvalidStateError if not configured
  if (this.state === 'unconfigured') {
    throw new DOMException('Encoder is not configured', 'InvalidStateError');
  }
  if (this.state === 'closed') {
    throw new DOMException('Encoder is closed', 'InvalidStateError');
  }

  this._encodeQueueSize++;
  // Call native encode directly - data must be valid at call time
  this._native.encode(data._nativeAudioData);
}

async flush(): Promise<void> {
  // W3C spec: reject if unconfigured or closed
  if (this.state === 'unconfigured') {
    return Promise.reject(
      new DOMException('Encoder is not configured', 'InvalidStateError'),
    );
  }
  if (this.state === 'closed') {
    return Promise.reject(
      new DOMException('Encoder is closed', 'InvalidStateError'),
    );
  }

  await this._controlQueue.flush();
  return this._native.flush();
}

reset(): void {
  // W3C spec: reset() is a no-op when closed (does NOT throw)
  if (this.state === 'closed') {
    return;
  }

  this._controlQueue.clear();
  this._encodeQueueSize = 0;
  this._native.reset();
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "encode() W3C compliance|flush() W3C compliance|reset() W3C compliance"
```

Expected: PASS (all tests green)

**Step 5: Commit** (30 sec)

```bash
git add lib/index.ts test/golden/audio-encoder.test.ts
git commit -m "fix(audio-encoder): align encode()/flush()/reset() error handling with W3C spec"
```

---

### Task 3: Add bitrateMode Support in Native Layer

**Files:**
- Modify: `lib/types.ts:612-618` (already has bitrateMode)
- Modify: `src/audio_encoder.cc:170-190`
- Modify: `src/audio_encoder.cc:643-655` (isConfigSupported)
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to test/golden/audio-encoder.test.ts

describe('bitrateMode support', () => {
  it('should support bitrateMode in isConfigSupported', async () => {
    const result = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
      bitrateMode: 'constant',
    });

    expect(result.supported).toBe(true);
    expect(result.config.bitrateMode).toBe('constant');
  });

  it('should support variable bitrateMode', async () => {
    const result = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
      bitrateMode: 'variable',
    });

    expect(result.supported).toBe(true);
    expect(result.config.bitrateMode).toBe('variable');
  });

  it('should accept bitrateMode in configure()', () => {
    const encoder = new AudioEncoder({
      output: () => {},
      error: () => {},
    });

    expect(() => {
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
        bitrateMode: 'constant',
      });
    }).not.toThrow();

    expect(encoder.state).toBe('configured');
    encoder.close();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "bitrateMode support"
```

Expected: FAIL (bitrateMode not echoed in isConfigSupported result)

**Step 3: Write minimal implementation** (2-5 min)

Modify `src/audio_encoder.cc:170-190` (in Configure):

```cpp
// Parse bitrate mode per W3C spec
std::string bitrate_mode = "variable";  // Default to VBR
if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
  bitrate_mode = config.Get("bitrateMode").As<Napi::String>().Utf8Value();
}

// Apply bitrate mode to codec context
if (bitrate_mode == "constant") {
  // CBR mode
  codec_context_->rc_min_rate = codec_context_->bit_rate;
  codec_context_->rc_max_rate = codec_context_->bit_rate;
  // For AAC, use global quality 0 to signal CBR
  if (codec_id == AV_CODEC_ID_AAC) {
    codec_context_->flags |= AV_CODEC_FLAG_QSCALE;
    codec_context_->global_quality = 0;
  }
} else {
  // VBR mode (default)
  // For Opus, VBR is default
  // For AAC, let encoder choose rate control
}
```

Modify `src/audio_encoder.cc:643-655` (in IsConfigSupported):

```cpp
// Copy bitrateMode if present
if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
  std::string bitrateMode = config.Get("bitrateMode").As<Napi::String>().Utf8Value();
  // Validate bitrateMode per W3C spec
  if (bitrateMode == "constant" || bitrateMode == "variable") {
    normalized_config.Set("bitrateMode", bitrateMode);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run test/golden/audio-encoder.test.ts -t "bitrateMode support"
```

Expected: PASS (all tests green)

**Step 5: Rebuild native module** (1 min)

```bash
npm run build:native
```

**Step 6: Commit** (30 sec)

```bash
git add src/audio_encoder.cc test/golden/audio-encoder.test.ts
git commit -m "feat(audio-encoder): add bitrateMode support per W3C spec"
```

---

### Task 4: Comprehensive W3C Compliance Test Suite

**Files:**
- Test: `test/golden/audio-encoder.test.ts`

**Step 1: Write comprehensive compliance tests** (5 min)

```typescript
// Add to test/golden/audio-encoder.test.ts

describe('W3C Interface Compliance', () => {
  describe('AudioEncoder interface', () => {
    it('should have all required properties per W3C spec', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Required properties per W3C WebCodecs spec
      expect(encoder).toHaveProperty('state');
      expect(encoder).toHaveProperty('encodeQueueSize');

      // State should be a string
      expect(typeof encoder.state).toBe('string');

      // encodeQueueSize should be a number
      expect(typeof encoder.encodeQueueSize).toBe('number');

      encoder.close();
    });

    it('should have all required methods per W3C spec', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Required methods per W3C WebCodecs spec
      expect(typeof encoder.configure).toBe('function');
      expect(typeof encoder.encode).toBe('function');
      expect(typeof encoder.flush).toBe('function');
      expect(typeof encoder.reset).toBe('function');
      expect(typeof encoder.close).toBe('function');

      encoder.close();
    });

    it('should have static isConfigSupported method', () => {
      expect(typeof AudioEncoder.isConfigSupported).toBe('function');
    });

    it('should have ondequeue callback property', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // ondequeue should exist and be settable
      expect('ondequeue' in encoder).toBe(true);
      expect(encoder.ondequeue).toBe(null);

      const handler = () => {};
      encoder.ondequeue = handler;
      expect(encoder.ondequeue).toBe(handler);

      encoder.close();
    });

    it('should extend EventTarget for dequeue event', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      // Per W3C spec, AudioEncoder extends EventTarget
      expect(typeof encoder.addEventListener).toBe('function');
      expect(typeof encoder.removeEventListener).toBe('function');
      expect(typeof encoder.dispatchEvent).toBe('function');

      encoder.close();
    });
  });

  describe('state machine', () => {
    it('should start in unconfigured state', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      expect(encoder.state).toBe('unconfigured');
      encoder.close();
    });

    it('should transition to configured after configure()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');

      encoder.close();
    });

    it('should transition back to unconfigured after reset()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');

      encoder.reset();
      expect(encoder.state).toBe('unconfigured');

      encoder.close();
    });

    it('should transition to closed after close()', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.close();
      expect(encoder.state).toBe('closed');
    });

    it('should allow reconfigure after reset', () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      encoder.reset();
      encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');

      encoder.close();
    });
  });

  describe('AudioEncoderConfig properties', () => {
    it('should echo core config properties in isConfigSupported result', async () => {
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      };

      const result = await AudioEncoder.isConfigSupported(config);
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe(config.codec);
      expect(result.config.sampleRate).toBe(config.sampleRate);
      expect(result.config.numberOfChannels).toBe(config.numberOfChannels);
      expect(result.config.bitrate).toBe(config.bitrate);
    });

    it('should return supported=false for unsupported codecs', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'invalid-codec-string',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(false);
    });
  });

  describe('Opus codec support', () => {
    it('should support opus codec string', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('opus');
    });
  });

  describe('AAC codec support', () => {
    it('should support mp4a.40.2 codec string (AAC-LC)', async () => {
      const result = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('mp4a.40.2');
    });
  });

  describe('dequeue event', () => {
    it('should fire dequeue event after output callback', async () => {
      let dequeueFired = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.addEventListener('dequeue', () => {
        dequeueFired = true;
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 960,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(960 * 2),
      });

      encoder.encode(audioData);
      await encoder.flush();
      audioData.close();

      // Give time for async events
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(dequeueFired).toBe(true);

      encoder.close();
    });

    it('should call ondequeue callback after output', async () => {
      let callbackCalled = false;

      const encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });

      encoder.ondequeue = () => {
        callbackCalled = true;
      };

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 960,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(960 * 2),
      });

      encoder.encode(audioData);
      await encoder.flush();
      audioData.close();

      // Give time for async callbacks
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callbackCalled).toBe(true);

      encoder.close();
    });
  });
});
```

**Step 2: Run all compliance tests** (1 min)

```bash
npx vitest run test/golden/audio-encoder.test.ts
```

Expected: PASS (all tests green)

**Step 3: Commit** (30 sec)

```bash
git add test/golden/audio-encoder.test.ts
git commit -m "test(audio-encoder): add comprehensive W3C compliance test suite"
```

---

### Task 5: Code Review

**Files:**
- All modified files from Tasks 1-4

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

Review the AudioEncoder interface against W3C WebIDL:

```
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioEncoder : EventTarget {
  constructor(AudioEncoderInit init);                    // COMPLIANT (after Task 1)
  readonly attribute CodecState state;                   // COMPLIANT
  readonly attribute unsigned long encodeQueueSize;      // COMPLIANT
  attribute EventHandler ondequeue;                      // COMPLIANT (via CodecBase)
  undefined configure(AudioEncoderConfig config);        // COMPLIANT (after Task 1)
  undefined encode(AudioData data);                      // COMPLIANT (after Task 2)
  Promise<undefined> flush();                            // COMPLIANT (after Task 2)
  undefined reset();                                     // COMPLIANT (after Task 2)
  undefined close();                                     // COMPLIANT
  static Promise<AudioEncoderSupport> isConfigSupported(AudioEncoderConfig config); // COMPLIANT
};
```

**Step 4: Address any issues found**

Fix any remaining issues discovered during review.

**Step 5: Final commit** (30 sec)

```bash
git add -A
git commit -m "chore: finalize AudioEncoder W3C compliance implementation"
```

---

## Summary of Changes

After completing all tasks:

1. **Constructor**: TypeError validation for missing/invalid output and error callbacks
2. **configure()**: TypeError for missing required fields, InvalidStateError when closed
3. **encode()**: InvalidStateError when not configured or closed
4. **flush()**: Rejects with InvalidStateError when unconfigured or closed
5. **reset()**: No longer throws when closed (W3C spec: no-op)
6. **bitrateMode**: Supported in configure() and isConfigSupported()
7. **Test Suite**: Comprehensive W3C compliance tests covering all methods and states

## Non-Standard Extensions (Documented)

The following properties are non-standard but retained for Node.js-specific use cases:

- `codecSaturated`: Useful for backpressure management (not in W3C spec)
- `opus` config object: Opus-specific config follows W3C WebCodecs Registry but uses nested object

## Not Addressed (Out of Scope)

- ArrayBuffer transfer semantics (Node.js limitation documented in CLAUDE.md)
- Opus-specific config should be top-level per W3C Registry (breaking change, defer)
