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
- [ ] `encodeQueueSize` - Number of pending encode requests
- [ ] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [ ] `dequeue` - Fires when encodeQueueSize decreases

**Static Methods:**
- [ ] `isConfigSupported(config)` - Returns Promise<VideoEncoderSupport>

**Instance Methods:**
- [ ] `configure(config)` - Configure encoder for encoding
- [ ] `encode(frame, options?)` - Encode a VideoFrame
- [ ] `flush()` - Returns Promise, resolves when pending encodes complete
- [ ] `reset()` - Cancels pending encodes and callbacks
- [ ] `close()` - Ends pending work, releases resources

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
- [ ] `decodeQueueSize` - Number of pending decode requests
- [ ] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [ ] `dequeue` - Fires when decodeQueueSize decreases

**Static Methods:**
- [ ] `isConfigSupported(config)` - Returns Promise<VideoDecoderSupport>

**Instance Methods:**
- [ ] `configure(config)` - Configure decoder for decoding
- [ ] `decode(chunk)` - Decode an EncodedVideoChunk
- [ ] `flush()` - Returns Promise, resolves when pending decodes complete
- [ ] `reset()` - Resets all states and pending callbacks
- [ ] `close()` - Ends pending work, releases resources

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
- [ ] `encodeQueueSize` - Number of pending encode requests
- [ ] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [ ] `dequeue` - Fires when encodeQueueSize decreases

**Static Methods:**
- [ ] `isConfigSupported(config)` - Returns Promise<AudioEncoderSupport>

**Instance Methods:**
- [ ] `configure(config)` - Configure encoder
- [ ] `encode(data)` - Encode an AudioData
- [ ] `flush()` - Returns Promise
- [ ] `reset()` - Resets all states
- [ ] `close()` - Ends pending work, releases resources

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
- [ ] `decodeQueueSize` - Number of pending decode requests
- [ ] `state` - CodecState: "unconfigured" | "configured" | "closed"

**Events:**
- [ ] `dequeue` - Fires when decodeQueueSize decreases

**Static Methods:**
- [ ] `isConfigSupported(config)` - Returns Promise<AudioDecoderSupport>

**Instance Methods:**
- [ ] `configure(config)` - Configure decoder
- [ ] `decode(chunk)` - Decode an EncodedAudioChunk
- [ ] `flush()` - Returns Promise
- [ ] `reset()` - Resets all states
- [ ] `close()` - Ends pending work, releases resources

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
- [ ] `format` - VideoPixelFormat
- [ ] `codedWidth` - Integer, width including padding
- [ ] `codedHeight` - Integer, height including padding
- [ ] `codedRect` - DOMRectReadOnly
- [ ] `visibleRect` - DOMRectReadOnly
- [x] `displayWidth` - Integer
- [x] `displayHeight` - Integer
- [ ] `duration` - Integer, microseconds (nullable)
- [ ] `timestamp` - Integer, microseconds
- [ ] `colorSpace` - VideoColorSpace
- [ ] `flip` (experimental) - Boolean
- [ ] `rotation` (experimental) - Integer (0, 90, 180, 270)

**Instance Methods:**
- [ ] `allocationSize(options?)` - Returns byte size needed for copyTo
- [ ] `copyTo(destination, options?)` - Returns Promise<PlaneLayout[]>
- [ ] `clone()` - Returns new VideoFrame referencing same resource
- [ ] `close()` - Clears state, releases resource reference

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
- [ ] `format` - AudioSampleFormat
- [ ] `sampleRate` - Number, Hz
- [ ] `numberOfFrames` - Integer
- [ ] `numberOfChannels` - Integer
- [ ] `duration` - Integer, microseconds
- [ ] `timestamp` - Integer, microseconds

**Instance Methods:**
- [ ] `allocationSize(options)` - Returns byte size for plane
- [ ] `copyTo(destination, options)` - Copies plane data
- [ ] `clone()` - Returns new AudioData referencing same resource
- [ ] `close()` - Clears state, releases resource

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
- [ ] `type` - "key" | "delta"
- [ ] `timestamp` - Integer, microseconds
- [ ] `duration` - Integer, microseconds (nullable)
- [ ] `byteLength` - Integer

**Instance Methods:**
- [ ] `copyTo(destination)` - Copies encoded data to buffer

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
- [ ] `type` - "key" | "delta"
- [ ] `timestamp` - Integer, microseconds
- [ ] `duration` - Integer, microseconds (nullable)
- [ ] `byteLength` - Integer

**Instance Methods:**
- [ ] `copyTo(destination)` - Copies encoded data to buffer

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
- [ ] `complete` - Boolean, true when data fully buffered
- [ ] `completed` - Promise, resolves when complete is true
- [ ] `tracks` - ImageTrackList
- [ ] `type` - String, MIME type

**Static Methods:**
- [ ] `isTypeSupported(type)` - Returns Promise<boolean>

**Instance Methods:**
- [ ] `decode(options?)` - Returns Promise<ImageDecodeResult>
- [ ] `reset()` - Aborts pending decode operations
- [ ] `close()` - Ends pending work, releases resources

**ImageDecodeOptions:**
- `frameIndex` (integer) - optional, default 0
- `completeFramesOnly` (boolean) - optional, default true

**ImageDecodeResult:**
- `image` - VideoFrame
- `complete` - Boolean

---

### 10. ImageTrackList

**Instance Properties (read-only):**
- [ ] `ready` - Promise, resolves when tracks populated
- [ ] `length` - Integer, number of tracks
- [ ] `selectedIndex` - Integer, index of selected track
- [ ] `selectedTrack` - ImageTrack

---

### 11. ImageTrack

**Instance Properties (read-only):**
- [ ] `animated` - Boolean, true if track has multiple frames
- [ ] `frameCount` - Integer
- [ ] `repetitionCount` - Integer, animation repeat count
- [ ] `selected` - Boolean, true if selected for decoding

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
- [ ] `primaries` - VideoColorPrimaries (nullable)
- [ ] `transfer` - VideoTransferCharacteristics (nullable)
- [ ] `matrix` - VideoMatrixCoefficients (nullable)
- [ ] `fullRange` - Boolean (nullable)

**Instance Methods:**
- [ ] `toJSON()` - Returns VideoColorSpaceInit

---

## Enumerations

### CodecState
- [ ] `"unconfigured"` - Not yet configured
- [ ] `"configured"` - Ready for encode/decode
- [ ] `"closed"` - Permanently closed

### HardwareAcceleration
- [ ] `"no-preference"`
- [ ] `"prefer-hardware"`
- [ ] `"prefer-software"`

### LatencyMode
- [ ] `"quality"` - Optimize for output quality
- [ ] `"realtime"` - Optimize for low latency

### AlphaOption
- [ ] `"discard"` - Ignore alpha channel
- [ ] `"keep"` - Preserve alpha channel

### VideoEncoderBitrateMode
- [ ] `"constant"` - Constant bitrate
- [ ] `"variable"` - Variable bitrate
- [ ] `"quantizer"` - Quantizer-based

### VideoPixelFormat
- [ ] `"I420"` - Planar YUV 4:2:0
- [ ] `"I420A"` - Planar YUV 4:2:0 with alpha
- [ ] `"I422"` - Planar YUV 4:2:2
- [ ] `"I444"` - Planar YUV 4:4:4
- [ ] `"NV12"` - Semi-planar YUV 4:2:0
- [ ] `"RGBA"` - RGB with alpha
- [ ] `"RGBX"` - RGB with padding
- [ ] `"BGRA"` - BGR with alpha
- [ ] `"BGRX"` - BGR with padding

### AudioSampleFormat
- [ ] `"u8"` - Unsigned 8-bit interleaved
- [ ] `"s16"` - Signed 16-bit interleaved
- [ ] `"s32"` - Signed 32-bit interleaved
- [ ] `"f32"` - Float 32-bit interleaved
- [ ] `"u8-planar"` - Unsigned 8-bit planar
- [ ] `"s16-planar"` - Signed 16-bit planar
- [ ] `"s32-planar"` - Signed 32-bit planar
- [ ] `"f32-planar"` - Float 32-bit planar

### EncodedVideoChunkType / EncodedAudioChunkType
- [ ] `"key"` - Independent frame/chunk
- [ ] `"delta"` - Depends on previous data

### VideoColorPrimaries
- [ ] `"bt709"`
- [ ] `"bt470bg"`
- [ ] `"smpte170m"`
- [ ] `"bt2020"`
- [ ] `"smpte432"`

### VideoTransferCharacteristics
- [ ] `"bt709"`
- [ ] `"smpte170m"`
- [ ] `"iec61966-2-1"` (sRGB)
- [ ] `"linear"`
- [ ] `"pq"` (HDR10)
- [ ] `"hlg"` (HLG HDR)

### VideoMatrixCoefficients
- [ ] `"rgb"`
- [ ] `"bt709"`
- [ ] `"bt470bg"`
- [ ] `"smpte170m"`
- [ ] `"bt2020-ncl"`

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
