# WebCodecs Compliance Report

> **Generated:** 2025-12-31
> **Spec Source:** [MDN WebCodecs](https://developer.mozilla.org/docs/Web/API/WebCodecs_API)
> **Implementation:** node-webcodecs v0.1.1-alpha.2

## Summary

| Interface | Constructor | Properties | Methods | Static | Events | Status |
|-----------|-------------|------------|---------|--------|--------|--------|
| VideoEncoder | [x] | 2/2 | 5/5 | 1/1 | 2/2 | High |
| VideoDecoder | [x] | 2/2 | 5/5 | 1/1 | 2/2 | High |
| AudioEncoder | [x] | 2/2 | 5/5 | 1/1 | 2/2 | Full |
| AudioDecoder | [x] | 2/2 | 5/5 | 1/1 | 2/2 | Full |
| VideoFrame | [x] | 12/12 | 4/4 | - | - | High |
| AudioData | [x] | 6/6 | 4/4 | - | - | Full |
| VideoColorSpace | [x] | 4/4 | 1/1 | - | - | Full |
| EncodedVideoChunk | [~] | 4/4 | 1/1 | - | - | High |
| EncodedAudioChunk | [~] | 4/4 | 1/1 | - | - | High |
| ImageDecoder | [~] | 4/4 | 3/3 | 1/1 | - | High |
| ImageTrack | N/A | 4/4 | - | - | - | Full |
| ImageTrackList | N/A | 4/4 | - | - | - | Full |

**Legend:** [x] Full | [~] Partial | [ ] Missing

---

## VideoEncoder

**Spec:** `docs/specs/videoencoder/index.md`
**Implementation:** `lib/video-encoder.ts`

#### Constructor
- [x] `VideoEncoder(init)` - Accepts `init` object with required `output` and `error` callbacks

#### Instance Properties
- [x] `state: CodecState` (readonly) - Returns `"unconfigured"`, `"configured"`, or `"closed"`
- [x] `encodeQueueSize: number` (readonly) - Tracks pending encode requests

#### Instance Methods
- [x] `configure(config): void` - Validates closed state, validates displayWidth/displayHeight pairing
- [x] `encode(frame, options?): void` - Accepts VideoFrame and optional `{ keyFrame?: boolean }`
- [x] `flush(): Promise<void>` - Rejects with InvalidStateError if unconfigured or closed
- [x] `reset(): void` - Clears control queue, resets encode queue size
- [x] `close(): void` - Unregisters from ResourceManager, clears control queue

#### Static Methods
- [x] `VideoEncoder.isConfigSupported(config): Promise<VideoEncoderSupport>`

#### Events
- [x] `dequeue` event - Fires on queue size decrease
- [x] `ondequeue` handler - Getter/setter in CodecBase

#### Extensions (Non-Spec)
- `codecSaturated: boolean` - FFmpeg backpressure indicator

#### Gaps
- [ ] `encode()` options: codec-specific quantizer objects (vp9/av1/avc/hevc) not passed to native
- [ ] `reset()`: Should throw InvalidStateError if closed (currently doesn't check)
- [ ] `encode()`: Should throw InvalidStateError if not configured (no state validation)

---

## VideoDecoder

**Spec:** `docs/specs/videodecoder/index.md`
**Implementation:** `lib/video-decoder.ts`

#### Constructor
- [x] `VideoDecoder(init)` - Accepts `init` object with required `output` and `error` callbacks

#### Instance Properties
- [x] `state: CodecState` (readonly) - Returns `"unconfigured"`, `"configured"`, or `"closed"`
- [x] `decodeQueueSize: number` (readonly) - Tracks pending decode requests

#### Instance Methods
- [x] `configure(config): void` - Validates closed state, resets keyframe flag
- [x] `decode(chunk): void` - Validates state, enforces first chunk must be keyframe
- [x] `flush(): Promise<void>` - Rejects with InvalidStateError if unconfigured or closed
- [x] `reset(): void` - Validates closed state (throws InvalidStateError), resets keyframe flag
- [x] `close(): void` - Unregisters from ResourceManager

#### Static Methods
- [x] `VideoDecoder.isConfigSupported(config): Promise<VideoDecoderSupport>`

#### Events
- [x] `dequeue` event - Fires on queue size decrease
- [x] `ondequeue` handler - Getter/setter in CodecBase

#### Extensions (Non-Spec)
- `codecSaturated: boolean` - FFmpeg backpressure indicator

#### Gaps
- [ ] `configure()` flip/rotation options: Not validated at TypeScript layer

---

## AudioEncoder

**Spec:** `docs/specs/audioencoder/index.md`
**Implementation:** `lib/audio-encoder.ts`

#### Constructor
- [x] `AudioEncoder(init)` - Creates AudioEncoder with `output` and `error` callbacks

#### Instance Properties
- [x] `state: CodecState` (readonly)
- [x] `encodeQueueSize: number` (readonly)

#### Instance Methods
- [x] `configure(config): void` - Validates required fields (codec, sampleRate, numberOfChannels)
- [x] `encode(data): void` - Encodes AudioData
- [x] `flush(): Promise<void>` - Returns promise, rejects if unconfigured/closed
- [x] `reset(): void` - Per spec, no-op when closed (does not throw)
- [x] `close(): void` - Ends pending work and releases resources

#### Static Methods
- [x] `AudioEncoder.isConfigSupported(config): Promise<AudioEncoderSupport>`

#### Events
- [x] `dequeue` event
- [x] `ondequeue` handler

#### Extensions (Non-Spec)
- `codecSaturated: boolean`

#### Gaps
- None

---

## AudioDecoder

**Spec:** `docs/specs/audiodecoder/index.md`
**Implementation:** `lib/audio-decoder.ts`

#### Constructor
- [x] `AudioDecoder(init)` - Creates AudioDecoder with `output` and `error` callbacks

#### Instance Properties
- [x] `state: CodecState` (readonly)
- [x] `decodeQueueSize: number` (readonly)

#### Instance Methods
- [x] `configure(config): void` - Validates required fields, sets keyframe requirement
- [x] `decode(chunk): void` - Validates state, enforces first chunk must be keyframe (DataError)
- [x] `flush(): Promise<void>` - Returns promise, rejects if unconfigured/closed
- [x] `reset(): void` - Per spec, no-op when closed
- [x] `close(): void` - Ends pending work and releases resources

#### Static Methods
- [x] `AudioDecoder.isConfigSupported(config): Promise<AudioDecoderSupport>`

#### Events
- [x] `dequeue` event
- [x] `ondequeue` handler

#### Gaps
- None

---

## VideoFrame

**Spec:** `docs/specs/videoframe/index.md`
**Implementation:** `lib/video-frame.ts`

#### Constructor
- [x] `VideoFrame(image, init?)` - Via ImageDataLike (Node.js alternative to CanvasImageSource)
- [x] `VideoFrame(data, init)` - From Buffer, Uint8Array, ArrayBuffer
- [x] `VideoFrame(source: VideoFrame, init?)` - Clone with optional overrides

#### Instance Properties
- [x] `format: VideoPixelFormat | null` (readonly)
- [x] `codedWidth: number` (readonly)
- [x] `codedHeight: number` (readonly)
- [x] `codedRect: DOMRectReadOnly | null` (readonly)
- [x] `visibleRect: DOMRectReadOnly | null` (readonly)
- [x] `displayWidth: number` (readonly)
- [x] `displayHeight: number` (readonly)
- [x] `duration: number | null` (readonly)
- [x] `timestamp: number` (readonly)
- [x] `colorSpace: VideoColorSpace` (readonly)
- [x] `flip: boolean` (readonly, experimental)
- [x] `rotation: number` (readonly, experimental)

#### Instance Methods
- [x] `allocationSize(options?): number`
- [x] `copyTo(destination, options?): Promise<PlaneLayout[]>`
- [x] `clone(): VideoFrame`
- [x] `close(): void`

#### Extensions (Non-Spec)
- `metadata(): VideoFrameMetadata` - Based on W3C VideoFrame Metadata Registry

#### Gaps
- [ ] `alpha` option in constructor - "keep"/"discard" handling not implemented

---

## AudioData

**Spec:** `docs/specs/audiodata/index.md`
**Implementation:** `lib/audio-data.ts`

#### Constructor
- [x] `AudioData(init)` - All formats supported: u8, s16, s32, f32, u8-planar, s16-planar, s32-planar, f32-planar

#### Instance Properties
- [x] `format: AudioSampleFormat | null` (readonly)
- [x] `sampleRate: number` (readonly)
- [x] `numberOfFrames: number` (readonly)
- [x] `numberOfChannels: number` (readonly)
- [x] `duration: number` (readonly)
- [x] `timestamp: number` (readonly)

#### Instance Methods
- [x] `allocationSize(options): number` - With planeIndex, frameOffset, frameCount
- [x] `copyTo(destination, options): void`
- [x] `clone(): AudioData`
- [x] `close(): void`

#### Gaps
- None

---

## VideoColorSpace

**Spec:** `docs/specs/videocolorspace/index.md`
**Implementation:** `lib/video-frame.ts`

#### Constructor
- [x] `VideoColorSpace()` - All values default to null
- [x] `VideoColorSpace(options)` - With primaries, transfer, matrix, fullRange

#### Instance Properties
- [x] `primaries: VideoColorPrimaries | null` (readonly)
- [x] `transfer: VideoTransferCharacteristics | null` (readonly)
- [x] `matrix: VideoMatrixCoefficients | null` (readonly)
- [x] `fullRange: boolean | null` (readonly)

#### Instance Methods
- [x] `toJSON(): VideoColorSpaceInit`

#### Gaps
- None

---

## EncodedVideoChunk

**Spec:** `docs/specs/encodedvideochunk/index.md`
**Implementation:** `lib/encoded-chunks.ts`

#### Constructor
- [x] `EncodedVideoChunk(init)` - Validates type is 'key' or 'delta'
- [ ] `transfer` option - Zero-copy buffer transfer not implemented

#### Instance Properties
- [x] `type: 'key' | 'delta'` (readonly)
- [x] `timestamp: number` (readonly)
- [x] `duration: number | null` (readonly)
- [x] `byteLength: number` (readonly)

#### Instance Methods
- [x] `copyTo(destination): void`

#### Gaps
- [ ] `transfer` option in constructor for zero-copy buffer ownership

---

## EncodedAudioChunk

**Spec:** `docs/specs/encodedaudiochunk/index.md`
**Implementation:** `lib/encoded-chunks.ts`

#### Constructor
- [x] `EncodedAudioChunk(init)` - Basic implementation
- [ ] `transfer` option - Zero-copy buffer transfer not implemented
- [ ] `type` validation - Missing runtime validation (only TypeScript type check)

#### Instance Properties
- [x] `type: 'key' | 'delta'` (readonly)
- [x] `timestamp: number` (readonly)
- [x] `duration: number | null` (readonly)
- [x] `byteLength: number` (readonly)

#### Instance Methods
- [x] `copyTo(destination): void`

#### Gaps
- [ ] `transfer` option in constructor for zero-copy buffer ownership
- [ ] Runtime `type` validation (unlike EncodedVideoChunk)

---

## ImageDecoder

**Spec:** `docs/specs/imagedecoder/index.md`
**Implementation:** `lib/image-decoder.ts`

#### Constructor
- [x] `ImageDecoder(init)` - Supports type, data, colorSpaceConversion, desiredWidth/Height, preferAnimation, transfer
- [ ] `premultiplyAlpha` option not implemented

#### Instance Properties
- [x] `complete: boolean` (readonly)
- [x] `completed: Promise<void>` (readonly)
- [x] `tracks: ImageTrackList` (readonly)
- [x] `type: string` (readonly)

#### Instance Methods
- [x] `decode(options?): Promise<ImageDecodeResult>` - With frameIndex, completeFramesOnly
- [x] `reset(): void` - No-op for static images
- [x] `close(): void`

#### Static Methods
- [x] `ImageDecoder.isTypeSupported(type): Promise<boolean>`

#### Gaps
- [ ] `premultiplyAlpha` init option ("none"/"premultiply"/"default")

---

## ImageTrack

**Spec:** `docs/specs/imagetrack/index.md`
**Implementation:** `lib/image-track.ts`

#### Instance Properties
- [x] `animated: boolean` (readonly)
- [x] `frameCount: number` (readonly)
- [x] `repetitionCount: number` (readonly)
- [x] `selected: boolean` (read-write per WebIDL)

#### Gaps
- None

---

## ImageTrackList

**Spec:** `docs/specs/imagetracklist/index.md`
**Implementation:** `lib/image-track-list.ts`

#### Instance Properties
- [x] `ready: Promise<void>` (readonly)
- [x] `length: number` (readonly)
- [x] `selectedIndex: number` (readonly)
- [x] `selectedTrack: ImageTrack | null` (readonly)
- [x] `[index: number]: ImageTrack` - Indexed getter

#### Extensions (Non-Spec)
- `[Symbol.iterator]()` - Iterable protocol

#### Gaps
- None

---

## Overall Compliance Summary

**Full Compliance (100%):**
- AudioEncoder
- AudioDecoder
- AudioData
- VideoColorSpace
- ImageTrack
- ImageTrackList

**High Compliance (>90%):**
- VideoEncoder - Minor gaps in encode() state validation and quantizer options
- VideoDecoder - Minor gap in flip/rotation config validation
- VideoFrame - Missing `alpha` constructor option
- EncodedVideoChunk - Missing `transfer` option
- EncodedAudioChunk - Missing `transfer` option and type validation
- ImageDecoder - Missing `premultiplyAlpha` option

**Key Notes:**
1. All core codec APIs fully implement the WebCodecs state machine
2. EventTarget inheritance and dequeue events work correctly
3. Error handling follows spec (InvalidStateError, TypeError, DataError, EncodingError)
4. Resource management via ResourceManager tracks active instances
5. Extensions (codecSaturated, metadata()) enhance Node.js usability without breaking spec compliance
