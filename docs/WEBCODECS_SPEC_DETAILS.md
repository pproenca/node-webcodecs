# WebCodecs Specification: Implementation Details

This document contains normative implementation details extracted from the W3C WebCodecs specification that are critical for correct implementation.

---

## 1. Error Handling

### 1.1 DOMException Types

The WebCodecs API uses specific DOMException types for different error conditions:

| Exception Type | When to Throw |
|----------------|---------------|
| `TypeError` | Invalid configuration object, detached AudioData/VideoFrame, wrong argument types |
| `InvalidStateError` | Operations on closed codec, encode/decode when unconfigured, configure when closed |
| `DataError` | Non-key chunk when key frame required, malformed codec data |
| `NotSupportedError` | Unsupported codec configuration |
| `EncodingError` | Codec processing failures during encode/decode |
| `AbortError` | User-initiated reset/close during pending operations |
| `QuotaExceededError` | Resource limits exceeded (memory, handles) |

### 1.2 Error Handling Implementation

```typescript
// Example error throwing patterns
function configure(config: VideoEncoderConfig): void {
    // TypeError: Invalid config
    if (!config || typeof config !== 'object') {
        throw new TypeError('Invalid config object');
    }
    if (!config.codec || typeof config.codec !== 'string') {
        throw new TypeError('codec must be a string');
    }
    if (!config.width || config.width <= 0) {
        throw new TypeError('width must be a positive integer');
    }
    if (!config.height || config.height <= 0) {
        throw new TypeError('height must be a positive integer');
    }

    // InvalidStateError: Wrong state
    if (this.state === 'closed') {
        throw new DOMException('Encoder is closed', 'InvalidStateError');
    }

    // NotSupportedError: Unsupported config
    if (!isCodecSupported(config.codec)) {
        throw new DOMException(`Codec ${config.codec} is not supported`, 'NotSupportedError');
    }
}

function encode(frame: VideoFrame): void {
    // InvalidStateError: Not configured
    if (this.state !== 'configured') {
        throw new DOMException('Encoder is not configured', 'InvalidStateError');
    }

    // TypeError: Detached frame
    if (frame._detached) {
        throw new TypeError('VideoFrame is detached');
    }
}
```

---

## 2. State Machine

### 2.1 State Transitions

```
                    ┌──────────────────────┐
                    │                      │
                    ▼                      │
┌─────────────┐  configure()  ┌─────────────┐
│ unconfigured │─────────────▶│ configured  │
└─────────────┘               └─────────────┘
       ▲                             │
       │         reset()             │
       └─────────────────────────────┤
                                     │
       ┌─────────────────────────────┤
       │         close()             │
       ▼                             ▼
┌─────────────┐               ┌─────────────┐
│   closed    │◀──────────────│   closed    │
└─────────────┘   close()     └─────────────┘
```

### 2.2 Valid Operations by State

| State | configure() | encode/decode() | flush() | reset() | close() |
|-------|-------------|-----------------|---------|---------|---------|
| unconfigured | ✅ | ❌ InvalidStateError | ❌ InvalidStateError | ✅ (no-op) | ✅ |
| configured | ✅ (reconfigure) | ✅ | ✅ | ✅ | ✅ |
| closed | ❌ InvalidStateError | ❌ InvalidStateError | ❌ InvalidStateError | ❌ InvalidStateError | ✅ (no-op) |

### 2.3 State Implementation

```typescript
type CodecState = 'unconfigured' | 'configured' | 'closed';

class VideoEncoder {
    private _state: CodecState = 'unconfigured';

    get state(): CodecState {
        return this._state;
    }

    configure(config: VideoEncoderConfig): void {
        if (this._state === 'closed') {
            throw new DOMException('Cannot configure closed encoder', 'InvalidStateError');
        }
        // ... configuration logic ...
        this._state = 'configured';
    }

    reset(): void {
        if (this._state === 'closed') {
            throw new DOMException('Cannot reset closed encoder', 'InvalidStateError');
        }
        // ... cleanup logic ...
        this._state = 'unconfigured';
    }

    close(): void {
        if (this._state === 'closed') {
            return; // Idempotent
        }
        // ... cleanup logic ...
        this._state = 'closed';
    }
}
```

---

## 3. Queue Processing Model

### 3.1 Control Message Queue

The WebCodecs API processes operations through a control message queue:

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Message Queue                     │
├─────────────────────────────────────────────────────────────┤
│ configure() │ encode() │ encode() │ flush() │ encode() │ ...│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Process in Order     │
              │  (FIFO)               │
              └───────────────────────┘
```

### 3.2 Codec Saturation

When the codec work queue is full (implementation-specific limit), new encode/decode calls are queued:

```typescript
class VideoEncoder {
    private _encodeQueueSize: number = 0;
    private _maxQueueSize: number = 16; // Implementation-specific

    get encodeQueueSize(): number {
        return this._encodeQueueSize;
    }

    encode(frame: VideoFrame): void {
        // Frame is queued, encodeQueueSize increases
        this._encodeQueueSize++;

        // Internally, when processed:
        // this._encodeQueueSize--;
        // this.dispatchEvent(new Event('dequeue'));
    }
}
```

### 3.3 Queue Blocking

The `[[message queue blocked]]` internal slot pauses queue processing:

```typescript
// Simplified queue processing model
async function processQueue(): Promise<void> {
    while (this._queue.length > 0 && !this._queueBlocked) {
        const message = this._queue.shift();

        if (message.type === 'encode') {
            this._queueBlocked = true;
            await this._codecWorker.encode(message.frame);
            this._queueBlocked = false;
            // Fire 'dequeue' event when work completes
            this._encodeQueueSize--;
            this.dispatchEvent(new Event('dequeue'));
        }
        // ... other message types
    }
}
```

---

## 4. Memory Management

### 4.1 Resource Reference Model

VideoFrame and AudioData hold references to underlying resources:

```typescript
class VideoFrame {
    private _resourceReference: ArrayBuffer | null;
    private _detached: boolean = false;

    close(): void {
        if (this._detached) return;

        // Release resource reference
        this._resourceReference = null;
        this._detached = true;
    }

    clone(): VideoFrame {
        if (this._detached) {
            throw new DOMException('Cannot clone detached VideoFrame', 'InvalidStateError');
        }

        // Create new frame with copied data
        return new VideoFrame(this._resourceReference!.slice(0), {
            format: this.format,
            codedWidth: this.codedWidth,
            codedHeight: this.codedHeight,
            timestamp: this.timestamp,
            duration: this.duration,
            colorSpace: this.colorSpace
        });
    }
}
```

### 4.2 Transfer Semantics

The `transfer` option in constructors enables zero-copy buffer transfer:

```typescript
// Without transfer (copy)
const frame1 = new VideoFrame(buffer, { /* init */ });
// buffer is still usable

// With transfer (move)
const frame2 = new VideoFrame(buffer, {
    /* init */
    transfer: [buffer]
});
// buffer is now detached (unusable)
```

### 4.3 Detachment Checking

```typescript
function checkDetached(data: VideoFrame | AudioData): void {
    if (data._detached) {
        throw new TypeError('Data is detached');
    }
}

// Before any operation on VideoFrame/AudioData:
encode(frame: VideoFrame): void {
    checkDetached(frame);
    // ... encoding logic
}
```

---

## 5. Codec String Parsing

### 5.1 Format Specification

```
codec-string := codec-name [ "." profile [ "." level [ "." additional ]* ]* ]

Examples:
- "vp8"           - VP8, no profile/level
- "vp09.00.10.08" - VP9 profile 0, level 1.0, 8-bit
- "avc1.42001E"   - H.264 Baseline Profile Level 3.0
- "av01.0.00M.08" - AV1 Main Profile, Level 0, Main tier, 8-bit
- "opus"          - Opus audio
- "mp4a.40.2"     - AAC-LC
```

### 5.2 H.264/AVC Parsing

```typescript
function parseAVCCodecString(codec: string): AVCConfig | null {
    // Format: avc1.PPCCLL or avc1.PP.CC.LL
    const match = codec.match(/^avc[13]\.([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);
    if (!match) return null;

    const profile = parseInt(match[1], 16);
    const constraints = parseInt(match[2], 16);
    const level = parseInt(match[3], 16);

    return {
        profile: mapAVCProfile(profile),      // 66=Baseline, 77=Main, 100=High
        constraintSet: constraints,
        level: level / 10                      // 30 → 3.0, 31 → 3.1, etc.
    };
}

// Profile mapping
function mapAVCProfile(profileIdc: number): string {
    switch (profileIdc) {
        case 66: return 'baseline';
        case 77: return 'main';
        case 88: return 'extended';
        case 100: return 'high';
        case 110: return 'high10';
        case 122: return 'high422';
        case 244: return 'high444';
        default: return 'unknown';
    }
}
```

### 5.3 VP9 Parsing

```typescript
function parseVP9CodecString(codec: string): VP9Config | null {
    // Format: vp09.PP.LL.DD[.CR.CP.TC.FV]
    const match = codec.match(/^vp09\.(\d{2})\.(\d{2})\.(\d{2})(?:\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2}))?$/);
    if (!match) return null;

    return {
        profile: parseInt(match[1]),         // 00, 01, 02, 03
        level: parseInt(match[2]) / 10,      // 10 → 1.0, 21 → 2.1
        bitDepth: parseInt(match[3]),        // 08, 10, 12
        chromaSubsampling: match[4] ? parseInt(match[4]) : undefined,
        colorPrimaries: match[5] ? parseInt(match[5]) : undefined,
        transferCharacteristics: match[6] ? parseInt(match[6]) : undefined,
        matrixCoefficients: match[7] ? parseInt(match[7]) : undefined
    };
}
```

### 5.4 AV1 Parsing

```typescript
function parseAV1CodecString(codec: string): AV1Config | null {
    // Format: av01.P.LLT.DD[.M.CCC.CP.TC.MC.F]
    const match = codec.match(/^av01\.(\d)\.(\d{2})([MH])\.(\d{2})(?:\.(\d)\.(\d{3})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d))?$/);
    if (!match) return null;

    return {
        profile: parseInt(match[1]),         // 0=Main, 1=High, 2=Pro
        level: parseInt(match[2].substring(0, 1)) + parseInt(match[2].substring(1)) * 0.1,
        tier: match[3],                      // M=Main, H=High
        bitDepth: parseInt(match[4])         // 08, 10, 12
    };
}
```

### 5.5 Audio Codec Parsing

```typescript
function parseAudioCodecString(codec: string): AudioCodecConfig | null {
    if (codec === 'opus') {
        return { codec: 'opus' };
    }

    if (codec === 'mp3') {
        return { codec: 'mp3' };
    }

    if (codec === 'flac') {
        return { codec: 'flac' };
    }

    // AAC: mp4a.40.N
    const aacMatch = codec.match(/^mp4a\.40\.(\d+)$/);
    if (aacMatch) {
        const objectType = parseInt(aacMatch[1]);
        return {
            codec: 'aac',
            objectType: mapAACObjectType(objectType)
        };
    }

    return null;
}

function mapAACObjectType(objectType: number): string {
    switch (objectType) {
        case 2: return 'aac-lc';
        case 5: return 'he-aac';   // SBR
        case 29: return 'he-aac-v2'; // SBR + PS
        default: return 'unknown';
    }
}
```

---

## 6. isConfigSupported() Behavior

### 6.1 Return Value Structure

```typescript
interface VideoEncoderSupport {
    supported: boolean;
    config: VideoEncoderConfig;  // Only recognized properties
}

// Example implementation
static async isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> {
    // Clone and normalize config (remove unrecognized properties)
    const normalizedConfig: VideoEncoderConfig = {
        codec: config.codec,
        width: config.width,
        height: config.height
    };

    // Copy only recognized optional properties
    if (config.bitrate !== undefined) normalizedConfig.bitrate = config.bitrate;
    if (config.framerate !== undefined) normalizedConfig.framerate = config.framerate;
    if (config.hardwareAcceleration !== undefined) {
        normalizedConfig.hardwareAcceleration = config.hardwareAcceleration;
    }
    // ... other recognized properties

    // Check actual support
    const supported = await checkCodecSupport(normalizedConfig);

    return {
        supported,
        config: normalizedConfig
    };
}
```

### 6.2 Feature Detection Pattern

```typescript
// Check for specific feature support
async function supportsScalabilityMode(codec: string, mode: string): Promise<boolean> {
    const result = await VideoEncoder.isConfigSupported({
        codec,
        width: 640,
        height: 480,
        scalabilityMode: mode
    });

    // If scalabilityMode is in returned config, it's recognized
    return result.supported && 'scalabilityMode' in result.config;
}
```

---

## 7. Encoded Chunk Metadata

### 7.1 EncodedVideoChunkMetadata

```typescript
interface EncodedVideoChunkMetadata {
    decoderConfig?: VideoDecoderConfig;  // For keyframes with config data
    svc?: SvcOutputMetadata;
    alphaSideData?: BufferSource;
}

interface SvcOutputMetadata {
    temporalLayerId: number;
}
```

### 7.2 EncodedAudioChunkMetadata

```typescript
interface EncodedAudioChunkMetadata {
    decoderConfig?: AudioDecoderConfig;  // For frames with config data
}
```

### 7.3 When Metadata is Provided

```typescript
// Output callback receives metadata on keyframes
function handleOutput(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void {
    if (chunk.type === 'key' && metadata?.decoderConfig) {
        // First keyframe or configuration change
        console.log('New decoder config:', metadata.decoderConfig);

        // decoderConfig.description contains codec-specific data:
        // - H.264: SPS/PPS NAL units
        // - VP9: Codec features
        // - AV1: OBU sequence header
    }

    if (metadata?.svc) {
        console.log('Temporal layer:', metadata.svc.temporalLayerId);
    }
}
```

---

## 8. VideoEncoderEncodeOptions

### 8.1 Structure

```typescript
interface VideoEncoderEncodeOptions {
    keyFrame?: boolean;  // Request keyframe at this position
}
```

### 8.2 Usage

```typescript
// Normal encode
encoder.encode(frame);

// Force keyframe (e.g., for seeking, scene change)
encoder.encode(frame, { keyFrame: true });

// Example: Keyframe every 2 seconds at 30fps
for (let i = 0; i < totalFrames; i++) {
    const isKeyFrame = i % 60 === 0;  // Every 60 frames at 30fps
    encoder.encode(frames[i], { keyFrame: isKeyFrame });
}
```

---

## 9. Flush Behavior

### 9.1 Specification Requirements

- **MUST** emit all pending output before resolving
- **MUST** process in order (no output reordering)
- **MUST** call output callback for each pending chunk

### 9.2 Implementation Pattern

```typescript
async flush(): Promise<void> {
    if (this._state !== 'configured') {
        throw new DOMException('Encoder not configured', 'InvalidStateError');
    }

    return new Promise<void>((resolve, reject) => {
        // Queue flush message
        this._queue.push({
            type: 'flush',
            resolve,
            reject
        });

        // Process queue (will eventually reach flush)
        this._processQueue();
    });
}

// Internal processing
async _processFlush(resolve: () => void, reject: (e: Error) => void): Promise<void> {
    try {
        // Signal end of input to codec
        await this._codec.flush();

        // All remaining outputs have been emitted via callbacks
        resolve();
    } catch (e) {
        reject(e);
    }
}
```

---

## 10. Security Considerations

### 10.1 Secure Context Requirement

```typescript
// Check secure context before exposing API
if (!window.isSecureContext) {
    // WebCodecs APIs should not be available
    throw new Error('WebCodecs requires secure context (HTTPS)');
}
```

### 10.2 Node.js Considerations

In Node.js (non-browser environment):
- No secure context concept applies
- Memory isolation through process boundaries
- No cross-origin concerns
- Hardware acceleration may expose device capabilities

---

## 11. Implementation Checklist

### 11.1 Error Handling Checklist

- [ ] Throw TypeError for invalid config structure
- [ ] Throw TypeError for detached VideoFrame/AudioData
- [ ] Throw InvalidStateError for wrong state operations
- [ ] Throw NotSupportedError for unsupported codecs
- [ ] Throw DataError for corrupt encoded data
- [ ] Call error callback instead of throwing for async errors
- [ ] Include meaningful error messages

### 11.2 State Machine Checklist

- [ ] Initialize state to "unconfigured"
- [ ] Transition to "configured" on successful configure()
- [ ] Transition to "unconfigured" on reset()
- [ ] Transition to "closed" on close()
- [ ] close() is idempotent
- [ ] Prevent operations on closed codec

### 11.3 Queue Processing Checklist

- [ ] Implement encodeQueueSize/decodeQueueSize property
- [ ] Fire 'dequeue' event when work completes
- [ ] Process operations in FIFO order
- [ ] Handle codec saturation gracefully

### 11.4 Memory Management Checklist

- [ ] Track detached state for VideoFrame/AudioData
- [ ] Support transfer option in constructors
- [ ] Release resources on close()
- [ ] Implement clone() method
- [ ] Warn on GC of unclosed resources (debug mode)

### 11.5 Metadata Checklist

- [ ] Include decoderConfig in first keyframe metadata
- [ ] Include decoderConfig when config changes
- [ ] Support SVC metadata for temporal layers
- [ ] Handle alphaSideData for alpha-capable codecs
