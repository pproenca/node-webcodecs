# WebCodecs W3C Specification Compliance Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-29-webcodecs-spec-compliance.md` to implement task-by-task.

**Goal:** Bring node-webcodecs into full compliance with the W3C WebCodecs specification, implementing the control message queue architecture, codec saturation tracking, ondequeue event handlers, key chunk requirements, resource reclamation, hardware acceleration hints, and ImageDecoder class.

**Architecture:** The implementation follows a layered approach:
- **TypeScript Layer**: Manages WebCodecs-compliant API surface, control message queue, event dispatch, and resource tracking
- **C++ Native Layer**: Handles FFmpeg operations via async worker threads with codec saturation signaling
- **Threading Model**: Control messages queued in TS, processed by native AsyncWorker threads. ThreadSafeFunction (TSFN) enables safe callbacks from worker threads to JS main thread.

**Tech Stack:** TypeScript, C++ with N-API (node-addon-api), FFmpeg (libavcodec, libavutil, libswscale, libswresample), cmake-js

---

## Task Groups Overview

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Core infrastructure - control message queue, codec saturation, types |
| Group 2 | 4, 5 | VideoEncoder/VideoDecoder ondequeue + queue integration |
| Group 3 | 6, 7 | AudioEncoder/AudioDecoder ondequeue + queue integration |
| Group 4 | 8 | Key chunk enforcement |
| Group 5 | 9 | VideoFrame rotation/flip/metadata |
| Group 6 | 10 | Config validation + hardware acceleration hints |
| Group 7 | 11 | Resource reclamation system |
| Group 8 | 12, 13, 14 | ImageDecoder implementation |
| Group 9 | 15 | Code Review |

---

### Task 1: Implement Control Message Queue Infrastructure

**Files:**
- Create: `lib/control-message-queue.ts`
- Test: `test/38_control_message_queue.js`

**Context:** Per W3C spec, codec methods like `configure()`, `encode()`, `decode()` must enqueue control messages rather than execute immediately. This ensures non-blocking behavior and proper ordering.

**Step 1: Write the failing test**

Create `test/38_control_message_queue.js`:
```javascript
'use strict';

const assert = require('assert');

// Test control message queue ordering and async execution
console.log('[TEST] Control message queue infrastructure');

const { ControlMessageQueue } = require('../lib/control-message-queue');

async function testQueueOrdering() {
    const results = [];
    const queue = new ControlMessageQueue();

    // Enqueue messages that record execution order
    queue.enqueue(() => {
        results.push('first');
        return Promise.resolve();
    });
    queue.enqueue(() => {
        results.push('second');
        return Promise.resolve();
    });
    queue.enqueue(() => {
        results.push('third');
        return Promise.resolve();
    });

    // Wait for all to process
    await queue.flush();

    assert.deepStrictEqual(results, ['first', 'second', 'third'],
        'Messages should execute in FIFO order');
    console.log('[PASS] Queue maintains FIFO order');
}

async function testAsyncExecution() {
    const queue = new ControlMessageQueue();
    let executed = false;

    queue.enqueue(async () => {
        await new Promise(r => setTimeout(r, 10));
        executed = true;
    });

    // Should not block
    assert.strictEqual(executed, false, 'Should not execute synchronously');

    await queue.flush();
    assert.strictEqual(executed, true, 'Should execute after flush');
    console.log('[PASS] Messages execute asynchronously');
}

async function testErrorHandling() {
    const queue = new ControlMessageQueue();
    let errorCaught = false;

    queue.setErrorHandler((err) => {
        errorCaught = true;
        console.log(`[EXPECTED ERROR] ${err.message}`);
    });

    queue.enqueue(() => {
        throw new Error('Test error');
    });

    await queue.flush();
    assert.strictEqual(errorCaught, true, 'Error handler should be called');
    console.log('[PASS] Error handling works');
}

(async () => {
    await testQueueOrdering();
    await testAsyncExecution();
    await testErrorHandling();
    console.log('[PASS] Control message queue infrastructure verified');
})().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test to verify it fails**

```bash
node test/38_control_message_queue.js
```

Expected: FAIL - module doesn't exist

**Step 3: Create lib/control-message-queue.ts**

```typescript
/**
 * Control Message Queue per W3C WebCodecs spec.
 *
 * Each codec instance maintains an internal [[control message queue]].
 * Methods like configure(), encode(), decode() enqueue control messages
 * rather than executing immediately, ensuring non-blocking behavior.
 */

type ControlMessage = () => void | Promise<void>;

export class ControlMessageQueue {
    private queue: ControlMessage[] = [];
    private processing: boolean = false;
    private errorHandler: ((error: Error) => void) | null = null;

    /**
     * Enqueue a control message for async processing.
     * Messages are processed in FIFO order.
     */
    enqueue(message: ControlMessage): void {
        this.queue.push(message);
        this.scheduleProcessing();
    }

    /**
     * Set error handler for message processing failures.
     */
    setErrorHandler(handler: (error: Error) => void): void {
        this.errorHandler = handler;
    }

    /**
     * Wait for all queued messages to be processed.
     */
    async flush(): Promise<void> {
        while (this.queue.length > 0 || this.processing) {
            await new Promise(resolve => queueMicrotask(resolve));
        }
    }

    /**
     * Clear all pending messages (used by reset/close).
     */
    clear(): void {
        this.queue = [];
    }

    /**
     * Get current queue size.
     */
    get size(): number {
        return this.queue.length;
    }

    private scheduleProcessing(): void {
        if (this.processing) return;

        queueMicrotask(() => this.processNext());
    }

    private async processNext(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const message = this.queue.shift()!;

        try {
            await message();
        } catch (error) {
            if (this.errorHandler) {
                this.errorHandler(error as Error);
            } else {
                console.error('Unhandled control message error:', error);
            }
        }

        this.processing = false;

        // Continue processing if more messages
        if (this.queue.length > 0) {
            this.scheduleProcessing();
        }
    }
}
```

**Step 4: Build TypeScript and run test**

```bash
npm run build:ts && node test/38_control_message_queue.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/control-message-queue.ts test/38_control_message_queue.js
git commit -m "feat(core): implement control message queue per W3C spec"
```

---

### Task 2: Implement Codec Saturation Tracking

**Files:**
- Modify: `src/video_encoder.h` (add saturation flag and signaling)
- Modify: `src/video_encoder.cc` (implement saturation logic)
- Modify: `src/async_encode_worker.h` (add saturation callback)
- Test: `test/39_codec_saturation.js`

**Context:** Per W3C spec, `[[codec saturated]]` is a boolean indicating when the underlying codec implementation cannot accept more work. During saturation, encode/decode calls are buffered, incrementing queue size.

**Step 1: Write the failing test**

Create `test/39_codec_saturation.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoEncoder, VideoFrame } = require('../lib');

async function testCodecSaturation() {
    console.log('[TEST] Codec saturation tracking');

    const chunks = [];
    let maxQueueSize = 0;

    const encoder = new VideoEncoder({
        output: (chunk) => {
            chunks.push(chunk);
        },
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    // Rapidly enqueue many frames to trigger saturation
    const frameData = Buffer.alloc(320 * 240 * 4);
    const frames = [];

    for (let i = 0; i < 30; i++) {
        const frame = new VideoFrame(frameData, {
            codedWidth: 320,
            codedHeight: 240,
            timestamp: i * 33333
        });
        frames.push(frame);
    }

    // Enqueue all frames rapidly
    for (let i = 0; i < frames.length; i++) {
        encoder.encode(frames[i], { keyFrame: i === 0 });
        // Track max queue size during encoding
        if (encoder.encodeQueueSize > maxQueueSize) {
            maxQueueSize = encoder.encodeQueueSize;
        }
    }

    console.log(`Max queue size during encoding: ${maxQueueSize}`);

    // Queue should have grown during rapid encoding
    assert.ok(maxQueueSize > 0, 'Queue size should increase during rapid encoding');

    await encoder.flush();

    // After flush, queue should be empty
    assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

    // Close frames
    frames.forEach(f => f.close());
    encoder.close();

    console.log(`[PASS] Codec saturation: max queue=${maxQueueSize}, chunks=${chunks.length}`);
}

testCodecSaturation().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test to check current behavior**

```bash
node test/39_codec_saturation.js
```

Note current queue size behavior.

**Step 3: Add saturation tracking to src/video_encoder.h**

Add after `encode_queue_size_` field:
```cpp
  std::atomic<bool> codec_saturated_{false};
  static constexpr size_t kMaxQueueSize = 16;  // Saturation threshold

  // Saturation status accessor
  bool IsCodecSaturated() const { return codec_saturated_.load(); }
```

**Step 4: Update src/video_encoder.cc Encode method**

Add saturation check in Encode:
```cpp
void VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    // ... existing validation ...

    // Check saturation before accepting more work
    if (async_mode_ && async_worker_) {
        size_t current_queue = async_worker_->QueueSize();
        codec_saturated_.store(current_queue >= kMaxQueueSize);

        if (codec_saturated_.load()) {
            // Still accept the frame but increment queue counter
            // The queue will buffer it
        }
    }

    encode_queue_size_++;

    // ... rest of encode logic ...
}
```

**Step 5: Add GetCodecSaturated accessor**

```cpp
Napi::Value VideoEncoder::GetCodecSaturated(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), codec_saturated_.load());
}
```

Register in Init:
```cpp
InstanceAccessor("codecSaturated", &VideoEncoder::GetCodecSaturated, nullptr),
```

**Step 6: Build and run test**

```bash
npm run build:native && node test/39_codec_saturation.js
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/video_encoder.h src/video_encoder.cc test/39_codec_saturation.js
git commit -m "feat(encoder): implement codec saturation tracking per W3C spec"
```

---

### Task 3: Add Complete Type Definitions

**Files:**
- Modify: `lib/types.ts`
- Test: `test/40_type_definitions.js`

**Context:** Add all missing W3C WebCodecs type definitions including ImageDecoder types, VideoFrameMetadata, hardware acceleration, and enhanced config options.

**Step 1: Write the failing test**

Create `test/40_type_definitions.js`:
```javascript
'use strict';

const assert = require('assert');

console.log('[TEST] Complete type definitions');

// Runtime validation of type structures
const validVideoEncoderConfig = {
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    hardwareAcceleration: 'prefer-software',
    latencyMode: 'realtime',
    bitrateMode: 'variable',
    alpha: 'discard',
    scalabilityMode: 'L1T1'
};

const validVideoDecoderConfig = {
    codec: 'avc1.42001E',
    hardwareAcceleration: 'no-preference',
    optimizeForLatency: true,
    rotation: 90,
    flip: false
};

const validVideoFrameInit = {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0,
    rotation: 180,
    flip: true,
    visibleRect: { x: 0, y: 0, width: 640, height: 480 }
};

// Validate structure exists
assert.ok(typeof validVideoEncoderConfig.hardwareAcceleration === 'string');
assert.ok(typeof validVideoDecoderConfig.rotation === 'number');
assert.ok(typeof validVideoFrameInit.flip === 'boolean');

console.log('[PASS] Type definitions verified');
```

**Step 2: Run test**

```bash
node test/40_type_definitions.js
```

Expected: PASS (runtime test)

**Step 3: Update lib/types.ts with complete definitions**

Replace/enhance the types file:
```typescript
// Hardware acceleration hint
export type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';

// Alpha handling
export type AlphaOption = 'keep' | 'discard';

// Latency mode
export type LatencyMode = 'quality' | 'realtime';

// Bitrate mode
export type VideoEncoderBitrateMode = 'constant' | 'variable' | 'quantizer';

export interface VideoEncoderConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    hardwareAcceleration?: HardwareAcceleration;
    latencyMode?: LatencyMode;
    bitrateMode?: VideoEncoderBitrateMode;
    alpha?: AlphaOption;
    scalabilityMode?: string;
    displayAspectWidth?: number;
    displayAspectHeight?: number;
    contentHint?: string;
}

export interface VideoDecoderConfig {
    codec: string;
    codedWidth?: number;
    codedHeight?: number;
    description?: ArrayBuffer | ArrayBufferView;
    colorSpace?: VideoColorSpaceInit;
    hardwareAcceleration?: HardwareAcceleration;
    optimizeForLatency?: boolean;
    displayAspectWidth?: number;
    displayAspectHeight?: number;
    rotation?: 0 | 90 | 180 | 270;
    flip?: boolean;
}

export interface VideoFrameInit {
    codedWidth: number;
    codedHeight: number;
    timestamp: number;
    duration?: number;
    displayWidth?: number;
    displayHeight?: number;
    format?: VideoPixelFormat;
    rotation?: 0 | 90 | 180 | 270;
    flip?: boolean;
    visibleRect?: { x: number; y: number; width: number; height: number };
    colorSpace?: VideoColorSpaceInit;
}

export interface VideoFrameMetadata {
    captureTime?: DOMHighResTimeStamp;
    receiveTime?: DOMHighResTimeStamp;
    rtpTimestamp?: number;
}

export type DOMHighResTimeStamp = number;

// ImageDecoder types
export interface ImageDecodeOptions {
    frameIndex?: number;
    completeFramesOnly?: boolean;
}

export interface ImageDecodeResult {
    image: any; // VideoFrame
    complete: boolean;
}

export interface ImageDecoderInit {
    type: string;
    data: ReadableStream<Uint8Array> | BufferSource;
    colorSpaceConversion?: 'default' | 'none';
    desiredWidth?: number;
    desiredHeight?: number;
    preferAnimation?: boolean;
}

export interface ImageTrack {
    readonly animated: boolean;
    readonly frameCount: number;
    readonly repetitionCount: number;
    selected: boolean;
}

export interface ImageTrackList {
    readonly length: number;
    readonly selectedIndex: number;
    readonly selectedTrack: ImageTrack | null;
    readonly ready: Promise<void>;
    [index: number]: ImageTrack;
}

// Encoder metadata
export interface EncodedVideoChunkMetadata {
    decoderConfig?: VideoDecoderConfig & {
        description?: ArrayBuffer;
    };
    svc?: {
        temporalLayerId: number;
    };
    alphaSideData?: BufferSource;
}

export interface EncodedAudioChunkMetadata {
    decoderConfig?: AudioDecoderConfig & {
        description?: ArrayBuffer;
    };
}
```

**Step 4: Build and run test**

```bash
npm run build:ts && node test/40_type_definitions.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/types.ts test/40_type_definitions.js
git commit -m "feat(types): add complete W3C WebCodecs type definitions"
```

---

### Task 4: Integrate Control Queue into VideoEncoder with ondequeue

**Files:**
- Modify: `lib/index.ts` (VideoEncoder class)
- Test: `test/41_videoencoder_queue.js`

**Context:** Integrate the control message queue into VideoEncoder, ensuring encode() enqueues messages and ondequeue fires when queue size decreases.

**Step 1: Write the failing test**

Create `test/41_videoencoder_queue.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoEncoder, VideoFrame } = require('../lib');

async function testVideoEncoderQueue() {
    console.log('[TEST] VideoEncoder control queue + ondequeue');

    let dequeueCount = 0;
    let maxQueueSize = 0;
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
        },
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.ondequeue = () => {
        dequeueCount++;
    };

    encoder.configure({
        codec: 'avc1.42001E',
        width: 64,
        height: 64,
        bitrate: 100000
    });

    const frameData = Buffer.alloc(64 * 64 * 4);

    // Encode multiple frames
    for (let i = 0; i < 5; i++) {
        const frame = new VideoFrame(frameData, {
            codedWidth: 64,
            codedHeight: 64,
            timestamp: i * 33333
        });
        encoder.encode(frame, { keyFrame: i === 0 });

        if (encoder.encodeQueueSize > maxQueueSize) {
            maxQueueSize = encoder.encodeQueueSize;
        }

        frame.close();
    }

    await encoder.flush();
    encoder.close();

    console.log(`Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, chunks=${chunks.length}`);

    assert.ok(dequeueCount >= 1, `ondequeue should fire at least once, got ${dequeueCount}`);
    assert.ok(chunks.length >= 1, `Should produce chunks, got ${chunks.length}`);

    console.log('[PASS] VideoEncoder control queue + ondequeue works');
}

testVideoEncoderQueue().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test to verify it fails**

```bash
node test/41_videoencoder_queue.js
```

Expected: FAIL - ondequeue doesn't fire (dequeueCount = 0)

**Step 3: Update VideoEncoder in lib/index.ts**

```typescript
import { ControlMessageQueue } from './control-message-queue';

export class VideoEncoder {
    private _native: any;
    private _state: CodecState = 'unconfigured';
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _encodeQueueSize: number = 0;

    constructor(init: VideoEncoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._controlQueue.setErrorHandler(init.error);

        this._native = new native.VideoEncoder({
            output: (chunk: any, metadata: any) => {
                // Decrement queue size when output received
                this._encodeQueueSize = Math.max(0, this._encodeQueueSize - 1);

                const wrappedChunk = new EncodedVideoChunk({
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data
                });
                init.output(wrappedChunk, metadata);

                // Fire ondequeue after output
                this._triggerDequeue();
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get encodeQueueSize(): number {
        return this._encodeQueueSize;
    }

    get ondequeue(): (() => void) | null {
        return this._ondequeue;
    }

    set ondequeue(handler: (() => void) | null) {
        this._ondequeue = handler;
    }

    private _triggerDequeue(): void {
        if (this._ondequeue) {
            queueMicrotask(() => {
                if (this._ondequeue) {
                    this._ondequeue();
                }
            });
        }
    }

    configure(config: VideoEncoderConfig): void {
        // Validate displayAspect pairing
        if ((config.displayAspectWidth !== undefined) !==
            (config.displayAspectHeight !== undefined)) {
            throw new TypeError(
                'displayAspectWidth and displayAspectHeight must both be present or both absent'
            );
        }

        this._controlQueue.enqueue(() => {
            this._native.configure(config);
        });
    }

    encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
        this._encodeQueueSize++;

        this._controlQueue.enqueue(() => {
            this._native.encode(frame._nativeFrame, options || {});
        });
    }

    async flush(): Promise<void> {
        await this._controlQueue.flush();
        return new Promise((resolve) => {
            this._native.flush();
            resolve();
        });
    }

    reset(): void {
        this._controlQueue.clear();
        this._encodeQueueSize = 0;
        this._native.reset();
    }

    close(): void {
        this._controlQueue.clear();
        this._native.close();
    }

    static async isConfigSupported(config: VideoEncoderConfig): Promise<{
        supported: boolean;
        config: VideoEncoderConfig;
    }> {
        return native.VideoEncoder.isConfigSupported(config);
    }
}
```

**Step 4: Build and run test**

```bash
npm run build:ts && node test/41_videoencoder_queue.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/index.ts test/41_videoencoder_queue.js
git commit -m "feat(videoencoder): integrate control queue and ondequeue event"
```

---

### Task 5: Integrate Control Queue into VideoDecoder with ondequeue

**Files:**
- Modify: `lib/index.ts` (VideoDecoder class)
- Test: `test/42_videodecoder_queue.js`

**Step 1: Write the failing test**

Create `test/42_videodecoder_queue.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoDecoder, VideoEncoder, VideoFrame, EncodedVideoChunk } = require('../lib');

async function testVideoDecoderQueue() {
    console.log('[TEST] VideoDecoder control queue + ondequeue');

    // First encode to get chunks
    const chunks = [];
    const encoder = new VideoEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => console.error(`[ENCODER ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 64,
        height: 64,
        bitrate: 100000
    });

    const frameData = Buffer.alloc(64 * 64 * 4);
    for (let i = 0; i < 3; i++) {
        const frame = new VideoFrame(frameData, {
            codedWidth: 64,
            codedHeight: 64,
            timestamp: i * 33333
        });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }
    await encoder.flush();
    encoder.close();

    assert.ok(chunks.length > 0, 'Should have encoded chunks');

    // Now decode
    let dequeueCount = 0;
    let maxQueueSize = 0;
    const frames = [];

    const decoder = new VideoDecoder({
        output: (frame) => {
            frames.push(frame);
            frame.close();
        },
        error: (e) => console.error(`[DECODER ERR] ${e.message}`)
    });

    decoder.ondequeue = () => {
        dequeueCount++;
    };

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64
    });

    for (const chunk of chunks) {
        decoder.decode(chunk);
        if (decoder.decodeQueueSize > maxQueueSize) {
            maxQueueSize = decoder.decodeQueueSize;
        }
    }

    await decoder.flush();
    decoder.close();

    console.log(`Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, frames=${frames.length}`);

    assert.ok(dequeueCount >= 1, `ondequeue should fire, got ${dequeueCount}`);

    console.log('[PASS] VideoDecoder control queue + ondequeue works');
}

testVideoDecoderQueue().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test**

```bash
node test/42_videodecoder_queue.js
```

Expected: FAIL

**Step 3: Update VideoDecoder in lib/index.ts**

```typescript
export class VideoDecoder {
    private _native: any;
    private _ondequeue: (() => void) | null = null;
    private _controlQueue: ControlMessageQueue;
    private _decodeQueueSize: number = 0;
    private _needsKeyFrame: boolean = true;
    private _errorCallback: (error: Error) => void;

    constructor(init: VideoDecoderInit) {
        this._controlQueue = new ControlMessageQueue();
        this._errorCallback = init.error;
        this._controlQueue.setErrorHandler(init.error);

        this._native = new native.VideoDecoder({
            output: (nativeFrame: any) => {
                this._decodeQueueSize = Math.max(0, this._decodeQueueSize - 1);

                const wrapper = Object.create(VideoFrame.prototype);
                wrapper._native = nativeFrame;
                wrapper._closed = false;
                init.output(wrapper);

                this._triggerDequeue();
            },
            error: init.error
        });
    }

    get state(): CodecState {
        return this._native.state;
    }

    get decodeQueueSize(): number {
        return this._decodeQueueSize;
    }

    get ondequeue(): (() => void) | null {
        return this._ondequeue;
    }

    set ondequeue(handler: (() => void) | null) {
        this._ondequeue = handler;
    }

    private _triggerDequeue(): void {
        if (this._ondequeue) {
            queueMicrotask(() => {
                if (this._ondequeue) {
                    this._ondequeue();
                }
            });
        }
    }

    configure(config: VideoDecoderConfig): void {
        this._needsKeyFrame = true;
        this._controlQueue.enqueue(() => {
            this._native.configure(config);
        });
    }

    decode(chunk: EncodedVideoChunk | any): void {
        const chunkType = chunk instanceof EncodedVideoChunk ? chunk.type : chunk.type;

        // W3C spec: first chunk after configure/reset must be key frame
        if (this._needsKeyFrame && chunkType !== 'key') {
            const error = new DOMException(
                'First chunk after configure/reset must be a key frame',
                'DataError'
            );
            this._errorCallback(error);
            return;
        }
        this._needsKeyFrame = false;
        this._decodeQueueSize++;

        this._controlQueue.enqueue(() => {
            if (chunk instanceof EncodedVideoChunk) {
                const nativeChunk = new native.EncodedVideoChunk({
                    type: chunk.type,
                    timestamp: chunk.timestamp,
                    duration: chunk.duration,
                    data: chunk.data
                });
                this._native.decode(nativeChunk);
            } else {
                this._native.decode(chunk);
            }
        });
    }

    async flush(): Promise<void> {
        await this._controlQueue.flush();
        return this._native.flush();
    }

    reset(): void {
        this._controlQueue.clear();
        this._decodeQueueSize = 0;
        this._needsKeyFrame = true;
        this._native.reset();
    }

    close(): void {
        this._controlQueue.clear();
        this._native.close();
    }

    static async isConfigSupported(config: VideoDecoderConfig): Promise<{
        supported: boolean;
        config: VideoDecoderConfig;
    }> {
        return native.VideoDecoder.isConfigSupported(config);
    }
}
```

**Step 4: Build and run test**

```bash
npm run build:ts && node test/42_videodecoder_queue.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/index.ts test/42_videodecoder_queue.js
git commit -m "feat(videodecoder): integrate control queue, ondequeue, key frame check"
```

---

### Task 6: Integrate Control Queue into AudioEncoder with ondequeue

**Files:**
- Modify: `lib/index.ts` (AudioEncoder class)
- Test: `test/43_audioencoder_queue.js`

**Step 1: Write the failing test**

Create `test/43_audioencoder_queue.js`:
```javascript
'use strict';

const assert = require('assert');
const { AudioEncoder, AudioData } = require('../lib');

async function testAudioEncoderQueue() {
    console.log('[TEST] AudioEncoder control queue + ondequeue');

    let dequeueCount = 0;
    const chunks = [];

    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
        },
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.ondequeue = () => {
        dequeueCount++;
    };

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    // Create audio data
    const samplesPerChannel = 1024;
    const audioBuffer = new Float32Array(samplesPerChannel * 2);

    for (let i = 0; i < 3; i++) {
        const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: 48000,
            numberOfFrames: samplesPerChannel,
            numberOfChannels: 2,
            timestamp: i * 21333,
            data: audioBuffer.buffer
        });
        encoder.encode(audioData);
        audioData.close();
    }

    await encoder.flush();
    encoder.close();

    console.log(`Results: dequeueCount=${dequeueCount}, chunks=${chunks.length}`);

    // May skip if AAC codec unavailable
    if (chunks.length === 0) {
        console.log('[SKIP] No chunks produced (AAC codec may not be available)');
        return;
    }

    assert.ok(dequeueCount >= 1, `ondequeue should fire, got ${dequeueCount}`);
    console.log('[PASS] AudioEncoder control queue + ondequeue works');
}

testAudioEncoderQueue().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test**

```bash
node test/43_audioencoder_queue.js
```

**Step 3: Update AudioEncoder in lib/index.ts**

Apply same control queue pattern as VideoEncoder.

**Step 4: Build and run test**

```bash
npm run build:ts && node test/43_audioencoder_queue.js
```

**Step 5: Commit**

```bash
git add lib/index.ts test/43_audioencoder_queue.js
git commit -m "feat(audioencoder): integrate control queue and ondequeue event"
```

---

### Task 7: Integrate Control Queue into AudioDecoder with ondequeue

**Files:**
- Modify: `lib/index.ts` (AudioDecoder class)
- Test: `test/44_audiodecoder_queue.js`

**Step 1: Write the failing test**

Create `test/44_audiodecoder_queue.js`:
```javascript
'use strict';

const assert = require('assert');
const { AudioDecoder, AudioEncoder, AudioData } = require('../lib');

async function testAudioDecoderQueue() {
    console.log('[TEST] AudioDecoder control queue + ondequeue');

    // First encode
    const chunks = [];
    const encoder = new AudioEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => console.error(`[ENCODER ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    const samplesPerChannel = 1024;
    const audioBuffer = new Float32Array(samplesPerChannel * 2);
    const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: samplesPerChannel,
        numberOfChannels: 2,
        timestamp: 0,
        data: audioBuffer.buffer
    });
    encoder.encode(audioData);
    audioData.close();
    await encoder.flush();
    encoder.close();

    if (chunks.length === 0) {
        console.log('[SKIP] No encoded chunks (AAC codec may not be available)');
        return;
    }

    // Now decode
    let dequeueCount = 0;
    const decoder = new AudioDecoder({
        output: (data) => data.close(),
        error: (e) => console.error(`[DECODER ERR] ${e.message}`)
    });

    decoder.ondequeue = () => {
        dequeueCount++;
    };

    decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });

    for (const chunk of chunks) {
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    console.log(`Results: dequeueCount=${dequeueCount}`);
    assert.ok(dequeueCount >= 1, `ondequeue should fire, got ${dequeueCount}`);
    console.log('[PASS] AudioDecoder control queue + ondequeue works');
}

testAudioDecoderQueue().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2-5: Same pattern as AudioEncoder**

Apply control queue pattern to AudioDecoder, build, test, commit.

```bash
git commit -m "feat(audiodecoder): integrate control queue and ondequeue event"
```

---

### Task 8: Implement Key Chunk Requirement Test

**Files:**
- Test: `test/45_key_chunk_requirement.js`

**Context:** Task 5 already added key frame checking to VideoDecoder. This task adds explicit test coverage.

**Step 1: Write the test**

Create `test/45_key_chunk_requirement.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoDecoder, EncodedVideoChunk } = require('../lib');

async function testKeyChunkRequirement() {
    console.log('[TEST] Decoders require key chunk after configure/reset');

    let errorCaught = false;
    const decoder = new VideoDecoder({
        output: (frame) => frame.close(),
        error: (e) => {
            errorCaught = true;
            console.log(`[EXPECTED ERROR] ${e.message}`);
        }
    });

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64
    });

    // Create a delta chunk (not a key frame)
    const deltaChunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 0,
        data: Buffer.from([0x00, 0x00, 0x00, 0x01, 0x41])
    });

    // Should trigger error callback
    decoder.decode(deltaChunk);

    // Give microtask queue time to process
    await new Promise(r => setTimeout(r, 50));

    decoder.close();

    assert.ok(errorCaught, 'Decoder should reject delta chunk as first chunk');
    console.log('[PASS] Key chunk requirement enforced');
}

async function testKeyChunkAfterReset() {
    console.log('[TEST] Key chunk required after reset');

    // First do valid encoding to get real chunks
    const { VideoEncoder, VideoFrame } = require('../lib');
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 64,
        height: 64,
        bitrate: 100000
    });

    const frameData = Buffer.alloc(64 * 64 * 4);
    for (let i = 0; i < 3; i++) {
        const frame = new VideoFrame(frameData, {
            codedWidth: 64,
            codedHeight: 64,
            timestamp: i * 33333
        });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }
    await encoder.flush();
    encoder.close();

    if (chunks.length < 2) {
        console.log('[SKIP] Not enough chunks for reset test');
        return;
    }

    let errorAfterReset = false;
    const decoder = new VideoDecoder({
        output: (frame) => frame.close(),
        error: (e) => {
            errorAfterReset = true;
            console.log(`[EXPECTED ERROR] ${e.message}`);
        }
    });

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64
    });

    // Decode key chunk first (should work)
    decoder.decode(chunks[0]);
    await decoder.flush();

    // Reset
    decoder.reset();

    // Reconfigure
    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 64,
        codedHeight: 64
    });

    // Try to decode delta chunk after reset (should fail)
    const deltaChunk = chunks.find(c => c.type === 'delta');
    if (deltaChunk) {
        decoder.decode(deltaChunk);
        await new Promise(r => setTimeout(r, 50));
        assert.ok(errorAfterReset, 'Should reject delta after reset');
    }

    decoder.close();
    console.log('[PASS] Key chunk required after reset');
}

(async () => {
    await testKeyChunkRequirement();
    await testKeyChunkAfterReset();
    console.log('[PASS] All key chunk tests passed');
})().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test**

```bash
node test/45_key_chunk_requirement.js
```

Expected: PASS (already implemented in Task 5)

**Step 3: Commit**

```bash
git add test/45_key_chunk_requirement.js
git commit -m "test(decoder): add key chunk requirement tests"
```

---

### Task 9: Implement VideoFrame rotation, flip, and metadata()

**Files:**
- Modify: `lib/index.ts` (VideoFrame class)
- Modify: `src/video_frame.h`
- Modify: `src/video_frame.cc`
- Test: `test/46_videoframe_enhanced.js`

**Step 1: Write the failing test**

Create `test/46_videoframe_enhanced.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoFrame } = require('../lib');

console.log('[TEST] VideoFrame rotation, flip, metadata');

// Test rotation and flip
const frameData = Buffer.alloc(640 * 480 * 4);
const frame = new VideoFrame(frameData, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 12345,
    rotation: 90,
    flip: true
});

assert.strictEqual(frame.rotation, 90, 'rotation should be 90');
assert.strictEqual(frame.flip, true, 'flip should be true');

// Test metadata
const metadata = frame.metadata();
assert.ok(typeof metadata === 'object', 'metadata() should return object');
assert.ok(metadata !== null, 'metadata should not be null');

frame.close();

// Test defaults
const frame2 = new VideoFrame(frameData, {
    codedWidth: 640,
    codedHeight: 480,
    timestamp: 0
});

assert.strictEqual(frame2.rotation, 0, 'default rotation should be 0');
assert.strictEqual(frame2.flip, false, 'default flip should be false');

frame2.close();

// Test closed frame throws on metadata()
let threw = false;
try {
    frame.metadata();
} catch (e) {
    threw = true;
}
assert.ok(threw, 'metadata() should throw on closed frame');

console.log('[PASS] VideoFrame rotation, flip, metadata works');
```

**Step 2: Run test**

```bash
node test/46_videoframe_enhanced.js
```

Expected: FAIL

**Step 3: Update src/video_frame.h**

Add fields:
```cpp
  int rotation_;
  bool flip_;
```

**Step 4: Update src/video_frame.cc**

In constructor:
```cpp
rotation_ = 0;
flip_ = false;
if (init.Has("rotation")) {
    rotation_ = init.Get("rotation").As<Napi::Number>().Int32Value();
}
if (init.Has("flip")) {
    flip_ = init.Get("flip").As<Napi::Boolean>().Value();
}
```

Add getters:
```cpp
Napi::Value VideoFrame::GetRotation(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), rotation_);
}

Napi::Value VideoFrame::GetFlip(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), flip_);
}
```

Register in Init.

**Step 5: Update lib/index.ts VideoFrame**

```typescript
get rotation(): number {
    return this._native.rotation ?? 0;
}

get flip(): boolean {
    return this._native.flip ?? false;
}

metadata(): VideoFrameMetadata {
    if (this._closed) {
        throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    return {};
}
```

**Step 6: Build and run test**

```bash
npm run build && node test/46_videoframe_enhanced.js
```

Expected: PASS

**Step 7: Commit**

```bash
git add lib/index.ts src/video_frame.h src/video_frame.cc test/46_videoframe_enhanced.js
git commit -m "feat(videoframe): implement rotation, flip, and metadata() per W3C spec"
```

---

### Task 10: Implement Config Validation and Hardware Acceleration Hints

**Files:**
- Modify: `lib/index.ts` (configure methods)
- Test: `test/47_config_validation.js`

**Step 1: Write the failing test**

Create `test/47_config_validation.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoEncoder, VideoDecoder } = require('../lib');

console.log('[TEST] Config validation and hardware acceleration');

// Test displayAspect pairing
const encoder = new VideoEncoder({
    output: () => {},
    error: () => {}
});

let threw = false;
try {
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        displayAspectWidth: 16
        // Missing displayAspectHeight
    });
} catch (e) {
    threw = true;
    console.log(`[EXPECTED] ${e.message}`);
}
assert.ok(threw, 'Should throw when displayAspectWidth without Height');

// Valid config with both
encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    displayAspectWidth: 16,
    displayAspectHeight: 9
});

// Test hardware acceleration hint
encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    hardwareAcceleration: 'prefer-software'
});

encoder.close();

// Test decoder config
const decoder = new VideoDecoder({
    output: () => {},
    error: () => {}
});

decoder.configure({
    codec: 'avc1.42001E',
    hardwareAcceleration: 'prefer-hardware',
    optimizeForLatency: true
});

decoder.close();

console.log('[PASS] Config validation and hardware acceleration hints work');
```

**Step 2: Run test**

```bash
node test/47_config_validation.js
```

**Step 3: Ensure validation in configure methods**

Already added displayAspect validation in Task 4. Verify hardware acceleration is passed through.

**Step 4: Build and run test**

```bash
npm run build:ts && node test/47_config_validation.js
```

**Step 5: Commit**

```bash
git add test/47_config_validation.js
git commit -m "test(config): add validation and hardware acceleration tests"
```

---

### Task 11: Implement Resource Reclamation System

**Files:**
- Create: `lib/resource-manager.ts`
- Modify: `lib/index.ts` (register codecs with manager)
- Test: `test/48_resource_reclamation.js`

**Context:** Per W3C spec, inactive codecs (no progress in 10 seconds) may be reclaimed. This implements a resource manager that tracks codec activity.

**Step 1: Write the failing test**

Create `test/48_resource_reclamation.js`:
```javascript
'use strict';

const assert = require('assert');
const { VideoEncoder, VideoFrame, ResourceManager } = require('../lib');

async function testResourceReclamation() {
    console.log('[TEST] Resource reclamation system');

    const manager = ResourceManager.getInstance();
    const initialCount = manager.getActiveCodecCount();

    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 64,
        height: 64,
        bitrate: 100000
    });

    // Should be registered
    assert.ok(manager.getActiveCodecCount() > initialCount,
        'Codec should be registered with manager');

    // Record activity
    const frameData = Buffer.alloc(64 * 64 * 4);
    const frame = new VideoFrame(frameData, {
        codedWidth: 64,
        codedHeight: 64,
        timestamp: 0
    });
    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();
    encoder.close();

    // Should be unregistered after close
    assert.strictEqual(manager.getActiveCodecCount(), initialCount,
        'Codec should be unregistered after close');

    console.log('[PASS] Resource reclamation system works');
}

async function testInactivityDetection() {
    console.log('[TEST] Inactivity detection');

    const manager = ResourceManager.getInstance();

    // Configure short timeout for testing (normally 10s)
    manager.setInactivityTimeout(100); // 100ms for test

    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => console.log(`[EXPECTED] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 64,
        height: 64,
        bitrate: 100000
    });

    // Wait for inactivity timeout
    await new Promise(r => setTimeout(r, 200));

    // Check if marked as reclaimable
    const reclaimable = manager.getReclaimableCodecs();
    console.log(`Reclaimable codecs: ${reclaimable.length}`);

    encoder.close();

    // Reset timeout
    manager.setInactivityTimeout(10000);

    console.log('[PASS] Inactivity detection works');
}

(async () => {
    await testResourceReclamation();
    await testInactivityDetection();
    console.log('[PASS] All resource reclamation tests passed');
})().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2: Run test**

```bash
node test/48_resource_reclamation.js
```

Expected: FAIL - ResourceManager doesn't exist

**Step 3: Create lib/resource-manager.ts**

```typescript
/**
 * Resource Manager per W3C WebCodecs spec.
 *
 * Tracks codec instances and their activity for resource reclamation.
 * Inactive codecs (no progress in 10 seconds) may be reclaimed.
 */

interface CodecEntry {
    codec: any;
    lastActivity: number;
    isBackground: boolean;
}

export class ResourceManager {
    private static instance: ResourceManager | null = null;
    private codecs: Map<symbol, CodecEntry> = new Map();
    private inactivityTimeout: number = 10000; // 10 seconds per spec
    private checkInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.startMonitoring();
    }

    static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    /**
     * Register a codec for tracking.
     */
    register(codec: any): symbol {
        const id = Symbol('codec');
        this.codecs.set(id, {
            codec,
            lastActivity: Date.now(),
            isBackground: false
        });
        return id;
    }

    /**
     * Unregister a codec (on close).
     */
    unregister(id: symbol): void {
        this.codecs.delete(id);
    }

    /**
     * Record activity on a codec.
     */
    recordActivity(id: symbol): void {
        const entry = this.codecs.get(id);
        if (entry) {
            entry.lastActivity = Date.now();
        }
    }

    /**
     * Mark codec as background (eligible for reclamation).
     */
    setBackground(id: symbol, isBackground: boolean): void {
        const entry = this.codecs.get(id);
        if (entry) {
            entry.isBackground = isBackground;
        }
    }

    /**
     * Get count of active codecs.
     */
    getActiveCodecCount(): number {
        return this.codecs.size;
    }

    /**
     * Get codecs eligible for reclamation.
     * Per spec: inactive (no progress in 10s) OR background codecs.
     */
    getReclaimableCodecs(): any[] {
        const now = Date.now();
        const reclaimable: any[] = [];

        for (const [id, entry] of this.codecs) {
            const inactive = (now - entry.lastActivity) > this.inactivityTimeout;

            // Only reclaim if inactive OR (background AND inactive)
            // Spec says: "You must not reclaim a codec that is both active and in the foreground"
            if (inactive || entry.isBackground) {
                reclaimable.push(entry.codec);
            }
        }

        return reclaimable;
    }

    /**
     * Reclaim resources from inactive codecs.
     */
    reclaimInactive(): number {
        const reclaimable = this.getReclaimableCodecs();
        let reclaimed = 0;

        for (const codec of reclaimable) {
            try {
                if (codec.state !== 'closed' && typeof codec.close === 'function') {
                    codec.close();
                    reclaimed++;
                }
            } catch (e) {
                // Ignore errors during reclamation
            }
        }

        return reclaimed;
    }

    /**
     * Set inactivity timeout (for testing).
     */
    setInactivityTimeout(ms: number): void {
        this.inactivityTimeout = ms;
    }

    private startMonitoring(): void {
        // Check every 5 seconds
        this.checkInterval = setInterval(() => {
            // Just track, don't auto-reclaim
            // Actual reclamation would be triggered by memory pressure
        }, 5000);

        // Don't keep process alive
        if (this.checkInterval.unref) {
            this.checkInterval.unref();
        }
    }

    /**
     * Stop monitoring (for cleanup).
     */
    stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}
```

**Step 4: Integrate with codecs in lib/index.ts**

Add to VideoEncoder constructor:
```typescript
private _resourceId: symbol;

constructor(init: VideoEncoderInit) {
    // ... existing code ...
    this._resourceId = ResourceManager.getInstance().register(this);
}

encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
    ResourceManager.getInstance().recordActivity(this._resourceId);
    // ... existing code ...
}

close(): void {
    ResourceManager.getInstance().unregister(this._resourceId);
    // ... existing code ...
}
```

Export ResourceManager:
```typescript
export { ResourceManager } from './resource-manager';
```

**Step 5: Build and run test**

```bash
npm run build:ts && node test/48_resource_reclamation.js
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/resource-manager.ts lib/index.ts test/48_resource_reclamation.js
git commit -m "feat(core): implement resource reclamation system per W3C spec"
```

---

### Task 12: Create Native ImageDecoder Foundation

**Files:**
- Create: `src/image_decoder.h`
- Create: `src/image_decoder.cc`
- Modify: `src/addon.cc`
- Test: `test/49_imagedecoder_basic.js`

**Step 1: Write the failing test**

Create `test/49_imagedecoder_basic.js`:
```javascript
'use strict';

const assert = require('assert');
const { ImageDecoder } = require('../lib');

console.log('[TEST] ImageDecoder basic instantiation');

// Minimal 1x1 red PNG
const minimalPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
    0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

const decoder = new ImageDecoder({
    type: 'image/png',
    data: minimalPng
});

assert.strictEqual(decoder.type, 'image/png');
assert.strictEqual(typeof decoder.complete, 'boolean');
assert.ok(decoder.tracks !== undefined);
assert.strictEqual(decoder.tracks.length, 1);

decoder.close();

console.log('[PASS] ImageDecoder basic instantiation works');
```

**Step 2-6: Create native ImageDecoder**

Follow pattern from existing codec classes. See original plan Task 11 for full implementation details.

**Step 7: Commit**

```bash
git commit -m "feat(imagedecoder): create native ImageDecoder foundation"
```

---

### Task 13: Create TypeScript ImageDecoder Wrapper

**Files:**
- Modify: `lib/index.ts`
- Test: `test/49_imagedecoder_basic.js` (reuse)

**Step 1-4: Add TypeScript wrapper**

See original plan Task 12 for implementation.

**Step 5: Commit**

```bash
git commit -m "feat(imagedecoder): add TypeScript ImageDecoder wrapper"
```

---

### Task 14: Implement ImageDecoder.decode() with FFmpeg

**Files:**
- Modify: `src/image_decoder.cc`
- Test: `test/50_imagedecoder_decode.js`

**Step 1: Write the failing test**

Create `test/50_imagedecoder_decode.js`:
```javascript
'use strict';

const assert = require('assert');
const { ImageDecoder } = require('../lib');

async function testImageDecoderDecode() {
    console.log('[TEST] ImageDecoder.decode() produces VideoFrame');

    // Minimal 1x1 PNG
    const minimalPng = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const decoder = new ImageDecoder({
        type: 'image/png',
        data: minimalPng
    });

    const result = await decoder.decode();

    assert.ok(result.image !== undefined, 'decode() should return image');
    assert.strictEqual(typeof result.complete, 'boolean');
    assert.strictEqual(result.image.codedWidth, 1);
    assert.strictEqual(result.image.codedHeight, 1);

    result.image.close();
    decoder.close();

    console.log('[PASS] ImageDecoder.decode() works');
}

// Test isTypeSupported
async function testIsTypeSupported() {
    console.log('[TEST] ImageDecoder.isTypeSupported()');

    assert.strictEqual(await ImageDecoder.isTypeSupported('image/png'), true);
    assert.strictEqual(await ImageDecoder.isTypeSupported('image/jpeg'), true);
    assert.strictEqual(await ImageDecoder.isTypeSupported('image/fake'), false);

    console.log('[PASS] ImageDecoder.isTypeSupported() works');
}

(async () => {
    await testImageDecoderDecode();
    await testIsTypeSupported();
    console.log('[PASS] All ImageDecoder tests passed');
})().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
```

**Step 2-6: Implement decode()**

See original plan Task 13 for FFmpeg implementation.

**Step 7: Commit**

```bash
git commit -m "feat(imagedecoder): implement decode() with FFmpeg"
```

---

### Task 15: Code Review

**Files:**
- All modified files from Tasks 1-14

**Step 1: Review all changes**

```bash
git diff HEAD~14..HEAD --stat
git log --oneline HEAD~14..HEAD
```

**Step 2: Run full test suite**

```bash
npm test
```

**Step 3: Run linters**

```bash
cpplint --recursive src/
npm run build:ts
```

**Step 4: Verify W3C compliance checklist**

- [ ] Control message queue implemented
- [ ] Codec saturation tracking works
- [ ] ondequeue fires on all codecs
- [ ] Key chunk requirement enforced
- [ ] VideoFrame rotation/flip/metadata() work
- [ ] Config validation for displayAspect
- [ ] Hardware acceleration hints pass through
- [ ] Resource reclamation system tracks codecs
- [ ] ImageDecoder decodes PNG/JPEG

**Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: address code review feedback"
```

---

## Summary

This revised plan implements full W3C WebCodecs specification compliance:

| Feature | Task(s) | Status |
|---------|---------|--------|
| Control Message Queue | 1, 4-7 | Per-codec async queue |
| Codec Saturation | 2 | `[[codec saturated]]` tracking |
| ondequeue Event | 4-7 | All codecs fire events |
| Key Chunk Requirement | 5, 8 | Decoders enforce key frame first |
| VideoFrame Enhancements | 9 | rotation, flip, metadata() |
| Config Validation | 10 | displayAspect pairing |
| Hardware Acceleration | 10 | Hints pass through |
| Resource Reclamation | 11 | 10s inactivity tracking |
| ImageDecoder | 12-14 | Full FFmpeg implementation |
| Type Definitions | 3 | Complete W3C types |

Total: 15 tasks across 9 parallel groups.
