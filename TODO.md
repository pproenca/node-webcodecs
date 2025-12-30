# WebCodecs API Implementation TODO

Complete WebCodecs API specification extracted from W3C/MDN documentation.

---

## Interfaces

### 1. VideoEncoder

**Constructor:**
- `VideoEncoder(init)` - Creates a new VideoEncoder

**VideoEncoderInit:**
- `output` (VideoFrameOutputCallback) - required
- `error` (WebCodecsErrorCallback) - required

**Instance Properties (read-only):**
- [x] `encodeQueueSize` - Number of pending encode requests
- [x] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [x] `dequeue` - Fires when encodeQueueSize decreases

**Static Methods:**
- [x] `isConfigSupported(config)` - Returns Promise<VideoEncoderSupport>

**Instance Methods:**
- [x] `configure(config)` - Configure encoder for encoding
- [x] `encode(frame, options?)` - Encode a VideoFrame
- [x] `flush()` - Returns Promise, resolves when pending encodes complete
- [x] `reset()` - Cancels pending encodes and callbacks
- [x] `close()` - Ends pending work, releases resources

**VideoEncoderConfig:**
- `codec` (string) - required, e.g. "avc1.42001E", "vp8", "vp09.00.10.08"
- `width` (integer) - required, frame width in pixels
- `height` (integer) - required, frame height in pixels
- `displayWidth` (integer) - optional, display width
- `displayHeight` (integer) - optional, display height
- `bitrate` (integer) - optional, target bitrate in bits/second
- `framerate` (number) - optional, target frame rate
- `hardwareAcceleration` (HardwareAcceleration) - optional
- `alpha` (AlphaOption) - optional, "discard" | "keep"
- `scalabilityMode` (string) - optional, e.g. "L1T2"
- `bitrateMode` (VideoEncoderBitrateMode) - optional
- `latencyMode` (LatencyMode) - optional
- `contentHint` (string) - optional

**VideoEncoderEncodeOptions:**
- `keyFrame` (boolean) - optional, force key frame

**Codec-Specific Encode Options:**
- `vp9.quantizer` (number) - 0-63
- `av1.quantizer` (number) - 0-63
- `avc.quantizer` (number) - 0-51
- `hevc.quantizer` (number) - 0-51

---

### 2. VideoDecoder

**Constructor:**
- `VideoDecoder(init)` - Creates a new VideoDecoder

**VideoDecoderInit:**
- `output` (VideoFrameOutputCallback) - required
- `error` (WebCodecsErrorCallback) - required

**Instance Properties (read-only):**
- [x] `decodeQueueSize` - Number of pending decode requests
- [x] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [x] `dequeue` - Fires when decodeQueueSize decreases

**Static Methods:**
- [x] `isConfigSupported(config)` - Returns Promise<VideoDecoderSupport>

**Instance Methods:**
- [x] `configure(config)` - Configure decoder for decoding
- [x] `decode(chunk)` - Decode an EncodedVideoChunk
- [x] `flush()` - Returns Promise, resolves when pending decodes complete
- [x] `reset()` - Resets all states and pending callbacks
- [x] `close()` - Ends pending work, releases resources

**VideoDecoderConfig:**
- `codec` (string) - required
- `description` (BufferSource) - optional, codec-specific extradata
- `codedWidth` (integer) - optional, coded width including padding
- `codedHeight` (integer) - optional, coded height including padding
- `displayAspectWidth` (integer) - optional
- `displayAspectHeight` (integer) - optional
- `colorSpace` (VideoColorSpaceInit) - optional
- `hardwareAcceleration` (HardwareAcceleration) - optional
- `optimizeForLatency` (boolean) - optional
- `flip` (boolean) - optional, horizontal mirroring
- `rotation` (integer) - optional, 0 | 90 | 180 | 270

---

### 3. AudioEncoder

**Constructor:**
- `AudioEncoder(init)` - Creates a new AudioEncoder

**AudioEncoderInit:**
- `output` (EncodedAudioChunkOutputCallback) - required
- `error` (WebCodecsErrorCallback) - required

**Instance Properties (read-only):**
- [x] `encodeQueueSize` - Number of pending encode requests
- [x] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [x] `dequeue` - Fires when encodeQueueSize decreases

**Static Methods:**
- [x] `isConfigSupported(config)` - Returns Promise<AudioEncoderSupport>

**Instance Methods:**
- [x] `configure(config)` - Configure encoder
- [x] `encode(data)` - Encode an AudioData
- [x] `flush()` - Returns Promise
- [x] `reset()` - Resets all states
- [x] `close()` - Ends pending work, releases resources

**AudioEncoderConfig:**
- `codec` (string) - required, e.g. "opus", "mp3", "aac"
- `sampleRate` (integer) - required, samples per second
- `numberOfChannels` (integer) - required
- `bitrate` (integer) - optional
- `bitrateMode` (BitrateMode) - optional, "constant" | "variable"
- `opus` (OpusEncoderConfig) - optional, Opus-specific options

**OpusEncoderConfig:**
- `application` (string) - "audio" | "lowdelay" | "voip"
- `complexity` (number) - 0-10
- `format` (string) - "opus" | "ogg"
- `frameDuration` (number) - microseconds
- `packetlossperc` (number) - 0-100
- `signal` (string) - "auto" | "music" | "voice"
- `usedtx` (boolean) - Discontinuous Transmission
- `useinbandfec` (boolean) - Forward Error Correction

---

### 4. AudioDecoder

**Constructor:**
- `AudioDecoder(init)` - Creates a new AudioDecoder

**AudioDecoderInit:**
- `output` (AudioDataOutputCallback) - required
- `error` (WebCodecsErrorCallback) - required

**Instance Properties (read-only):**
- [x] `decodeQueueSize` - Number of pending decode requests
- [x] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [x] `dequeue` - Fires when decodeQueueSize decreases

**Static Methods:**
- [x] `isConfigSupported(config)` - Returns Promise<AudioDecoderSupport>

**Instance Methods:**
- [x] `configure(config)` - Configure decoder
- [x] `decode(chunk)` - Decode an EncodedAudioChunk
- [x] `flush()` - Returns Promise
- [x] `reset()` - Resets all states
- [x] `close()` - Ends pending work, releases resources

**AudioDecoderConfig:**
- `codec` (string) - required
- `sampleRate` (integer) - required
- `numberOfChannels` (integer) - required
- `description` (BufferSource) - optional, codec-specific extradata

---

### 5. VideoFrame

**Constructor Overloads:**

**From Image Source:**
```
new VideoFrame(image)
new VideoFrame(image, init)
```
- `image` - CanvasImageSource | VideoFrame

**From Buffer:**
```
new VideoFrame(data, init)
```
- `data` - BufferSource (ArrayBuffer, TypedArray, DataView)

**VideoFrameInit (from image):**
- `duration` (integer) - optional, microseconds
- `timestamp` (integer) - optional, microseconds
- `alpha` (AlphaOption) - optional, "keep" | "discard"
- `visibleRect` (DOMRectInit) - optional, {x, y, width, height}
- `displayWidth` (integer) - optional
- `displayHeight` (integer) - optional
- `flip` (boolean) - optional, horizontal mirroring
- `rotation` (integer) - optional, 0 | 90 | 180 | 270

**VideoFrameBufferInit (from buffer):**
- `format` (VideoPixelFormat) - required
- `codedWidth` (integer) - required
- `codedHeight` (integer) - required
- `timestamp` (integer) - required, microseconds
- `duration` (integer) - optional, microseconds
- `layout` (PlaneLayout[]) - optional, [{offset, stride}...]
- `visibleRect` (DOMRectInit) - optional
- `displayWidth` (integer) - optional
- `displayHeight` (integer) - optional
- `colorSpace` (VideoColorSpaceInit) - optional
- `transfer` (ArrayBuffer[]) - optional, buffers to transfer
- `flip` (boolean) - optional
- `rotation` (integer) - optional

**Instance Properties (read-only):**
- [x] `format` - VideoPixelFormat
- [x] `codedWidth` - Integer, width including padding
- [x] `codedHeight` - Integer, height including padding
- [x] `codedRect` - DOMRectReadOnly
- [x] `visibleRect` - DOMRectReadOnly
- [x] `displayWidth` - Integer
- [x] `displayHeight` - Integer
- [x] `duration` - Integer, microseconds (nullable)
- [x] `timestamp` - Integer, microseconds
- [x] `colorSpace` - VideoColorSpace
- [x] `flip` (experimental) - Boolean
- [x] `rotation` (experimental) - Integer (0, 90, 180, 270)

**Instance Methods:**
- [x] `allocationSize(options?)` - Returns byte size needed for copyTo
- [x] `copyTo(destination, options?)` - Returns Promise<PlaneLayout[]>
- [x] `clone()` - Returns new VideoFrame referencing same resource
- [x] `close()` - Clears state, releases resource reference

**VideoFrameCopyToOptions:**
- `rect` (DOMRectInit) - optional, pixels to copy
- `layout` (PlaneLayout[]) - optional, [{offset, stride}...]
- `format` (VideoPixelFormat) - optional, output format
- `colorSpace` (PredefinedColorSpace) - optional, "srgb" | "display-p3"

---

### 6. AudioData

**Constructor:**
```
new AudioData(init)
```

**AudioDataInit:**
- `format` (AudioSampleFormat) - required
- `sampleRate` (number) - required, Hz
- `numberOfFrames` (integer) - required
- `numberOfChannels` (integer) - required
- `timestamp` (integer) - required, microseconds
- `data` (BufferSource) - required
- `transfer` (ArrayBuffer[]) - optional

**Instance Properties (read-only):**
- [x] `format` - AudioSampleFormat
- [x] `sampleRate` - Number, Hz
- [x] `numberOfFrames` - Integer
- [x] `numberOfChannels` - Integer
- [x] `duration` - Integer, microseconds
- [x] `timestamp` - Integer, microseconds

**Instance Methods:**
- [x] `allocationSize(options)` - Returns byte size for plane
- [x] `copyTo(destination, options)` - Copies plane data
- [x] `clone()` - Returns new AudioData referencing same resource
- [x] `close()` - Clears state, releases resource

**AudioDataCopyToOptions:**
- `planeIndex` (integer) - required
- `frameOffset` (integer) - optional, default 0
- `frameCount` (integer) - optional, all remaining frames

---

### 7. EncodedVideoChunk

**Constructor:**
```
new EncodedVideoChunk(init)
```

**EncodedVideoChunkInit:**
- `type` (EncodedVideoChunkType) - required, "key" | "delta"
- `timestamp` (integer) - required, microseconds
- `duration` (integer) - optional, microseconds
- `data` (BufferSource) - required
- `transfer` (ArrayBuffer[]) - optional

**Instance Properties (read-only):**
- [x] `type` - "key" | "delta"
- [x] `timestamp` - Integer, microseconds
- [x] `duration` - Integer, microseconds (nullable)
- [x] `byteLength` - Integer

**Instance Methods:**
- [x] `copyTo(destination)` - Copies encoded data to buffer

---

### 8. EncodedAudioChunk

**Constructor:**
```
new EncodedAudioChunk(init)
```

**EncodedAudioChunkInit:**
- `type` (EncodedAudioChunkType) - required, "key" | "delta"
- `timestamp` (integer) - required, microseconds
- `duration` (integer) - optional, microseconds
- `data` (BufferSource) - required
- `transfer` (ArrayBuffer[]) - optional

**Instance Properties (read-only):**
- [x] `type` - "key" | "delta"
- [x] `timestamp` - Integer, microseconds
- [x] `duration` - Integer, microseconds (nullable)
- [x] `byteLength` - Integer

**Instance Methods:**
- [x] `copyTo(destination)` - Copies encoded data to buffer

---

### 9. ImageDecoder

**Constructor:**
```
new ImageDecoder(init)
```

**ImageDecoderInit:**
- `type` (string) - required, MIME type
- `data` (BufferSource | ReadableStream) - required
- `premultiplyAlpha` (PremultiplyAlpha) - optional, "none" | "premultiply" | "default"
- `colorSpaceConversion` (ColorSpaceConversion) - optional, "none" | "default"
- `desiredWidth` (integer) - optional
- `desiredHeight` (integer) - optional
- `preferAnimation` (boolean) - optional
- `transfer` (ArrayBuffer[]) - optional

**Instance Properties (read-only):**
- [x] `complete` - Boolean, true when data fully buffered
- [x] `completed` - Promise, resolves when complete is true
- [x] `tracks` - ImageTrackList
- [x] `type` - String, MIME type

**Static Methods:**
- [x] `isTypeSupported(type)` - Returns Promise<boolean>

**Instance Methods:**
- [x] `decode(options?)` - Returns Promise<ImageDecodeResult>
- [x] `reset()` - Aborts pending decode operations
- [x] `close()` - Ends pending work, releases resources

**ImageDecodeOptions:**
- `frameIndex` (integer) - optional, default 0
- `completeFramesOnly` (boolean) - optional, default true

**ImageDecodeResult:**
- `image` - VideoFrame
- `complete` - Boolean

---

### 10. ImageTrackList

**Instance Properties (read-only):**
- [x] `ready` - Promise, resolves when tracks populated
- [x] `length` - Integer, number of tracks
- [x] `selectedIndex` - Integer, index of selected track
- [x] `selectedTrack` - ImageTrack

---

### 11. ImageTrack

**Instance Properties (read-only):**
- [x] `animated` - Boolean, true if track has multiple frames
- [x] `frameCount` - Integer
- [x] `repetitionCount` - Integer, animation repeat count
- [x] `selected` - Boolean, true if selected for decoding

---

### 12. VideoColorSpace

**Constructor:**
```
new VideoColorSpace(init?)
```

**VideoColorSpaceInit:**
- `primaries` (VideoColorPrimaries) - optional
- `transfer` (VideoTransferCharacteristics) - optional
- `matrix` (VideoMatrixCoefficients) - optional
- `fullRange` (boolean) - optional

**Instance Properties (read-only):**
- [x] `primaries` - VideoColorPrimaries (nullable)
- [x] `transfer` - VideoTransferCharacteristics (nullable)
- [x] `matrix` - VideoMatrixCoefficients (nullable)
- [x] `fullRange` - Boolean (nullable)

**Instance Methods:**
- [x] `toJSON()` - Returns VideoColorSpaceInit

---

## Enumerations

### CodecState
- [x] `"unconfigured"` - Not yet configured
- [x] `"configured"` - Ready for encode/decode
- [x] `"closed"` - Permanently closed

### HardwareAcceleration
- [x] `"no-preference"`
- [x] `"prefer-hardware"`
- [x] `"prefer-software"`

### LatencyMode
- [x] `"quality"` - Optimize for output quality
- [x] `"realtime"` - Optimize for low latency

### AlphaOption
- [x] `"discard"` - Ignore alpha channel
- [x] `"keep"` - Preserve alpha channel

### VideoEncoderBitrateMode
- [x] `"constant"` - Constant bitrate
- [x] `"variable"` - Variable bitrate
- [x] `"quantizer"` - Quantizer-based

### VideoPixelFormat
- [x] `"I420"` - Planar YUV 4:2:0
- [ ] `"I420A"` - Planar YUV 4:2:0 with alpha
- [ ] `"I422"` - Planar YUV 4:2:2
- [ ] `"I444"` - Planar YUV 4:4:4
- [x] `"NV12"` - Semi-planar YUV 4:2:0
- [x] `"RGBA"` - RGB with alpha
- [ ] `"RGBX"` - RGB with padding
- [x] `"BGRA"` - BGR with alpha
- [ ] `"BGRX"` - BGR with padding

### AudioSampleFormat
- [x] `"u8"` - Unsigned 8-bit interleaved
- [x] `"s16"` - Signed 16-bit interleaved
- [x] `"s32"` - Signed 32-bit interleaved
- [x] `"f32"` - Float 32-bit interleaved
- [x] `"u8-planar"` - Unsigned 8-bit planar
- [x] `"s16-planar"` - Signed 16-bit planar
- [x] `"s32-planar"` - Signed 32-bit planar
- [x] `"f32-planar"` - Float 32-bit planar

### EncodedVideoChunkType / EncodedAudioChunkType
- [x] `"key"` - Independent frame/chunk
- [x] `"delta"` - Depends on previous data

### VideoColorPrimaries
- [x] `"bt709"`
- [x] `"bt470bg"`
- [x] `"smpte170m"`
- [x] `"bt2020"`
- [x] `"smpte432"`

### VideoTransferCharacteristics
- [x] `"bt709"`
- [x] `"smpte170m"`
- [x] `"iec61966-2-1"` (sRGB)
- [x] `"linear"`
- [x] `"pq"` (HDR10)
- [x] `"hlg"` (HLG HDR)

### VideoMatrixCoefficients
- [x] `"rgb"`
- [x] `"bt709"`
- [x] `"bt470bg"`
- [x] `"smpte170m"`
- [x] `"bt2020-ncl"`

---

## Metadata Types

### EncodedVideoChunkMetadata
- `decoderConfig` (VideoDecoderConfig) - optional
- `svc` (SvcOutputMetadata) - optional
- `alphaSideData` (BufferSource) - optional

### EncodedAudioChunkMetadata
- `decoderConfig` (AudioDecoderConfig) - optional

### SvcOutputMetadata
- `temporalLayerId` (integer)

---

## Support Types

### VideoEncoderSupport
- `supported` (boolean)
- `config` (VideoEncoderConfig)

### VideoDecoderSupport
- `supported` (boolean)
- `config` (VideoDecoderConfig)

### AudioEncoderSupport
- `supported` (boolean)
- `config` (AudioEncoderConfig)

### AudioDecoderSupport
- `supported` (boolean)
- `config` (AudioDecoderConfig)

---

## Callback Types

- `VideoFrameOutputCallback` = (frame: VideoFrame, metadata?: EncodedVideoChunkMetadata) => void
- `EncodedVideoChunkOutputCallback` = (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void
- `AudioDataOutputCallback` = (data: AudioData, metadata?: EncodedAudioChunkMetadata) => void
- `EncodedAudioChunkOutputCallback` = (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void
- `WebCodecsErrorCallback` = (error: DOMException) => void

---

## PlaneLayout

- `offset` (integer) - Byte offset where plane begins
- `stride` (integer) - Bytes per row including padding

---

## References

- [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)
- [WebCodecs Codec Registry](https://w3c.github.io/webcodecs/codec_registry.html)
- [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
