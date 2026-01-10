# Codec Configurations

W3C WebCodecs configuration dictionaries, enums, and validation algorithms.

Reference: `docs/specs/7-configurations/TOC.md`

## ADDED Requirements

### Requirement: Codec String Validity

A codec string SHALL be valid only if it meets the W3C WebCodecs specification requirements for unambiguous codec identification.

#### Scenario: Valid codec string describes single codec

- **WHEN** validating a codec string
- **THEN** the string MUST be valid per the relevant codec specification
- **AND** the string MUST describe exactly one codec
- **AND** the string MUST be unambiguous about codec profile, level, and constraint bits for codecs that define these concepts

#### Scenario: Empty codec string is invalid

- **WHEN** validating a codec string
- **AND** the string is empty after stripping leading and trailing ASCII whitespace
- **THEN** the codec string MUST be considered invalid

---

### Requirement: Check Configuration Support Algorithm

The Check Configuration Support algorithm SHALL determine whether the User Agent can provide a codec supporting the given configuration.

#### Scenario: Unrecognized codec string fails support check

- **WHEN** running the Check Configuration Support algorithm
- **AND** the codec string is not valid or is unrecognized by the User Agent
- **THEN** the algorithm MUST return `false`

#### Scenario: Decoder config requires exact profile/level match

- **WHEN** running the Check Configuration Support algorithm with AudioDecoderConfig or VideoDecoderConfig
- **AND** the User Agent cannot provide a codec that can decode the exact profile, level, and constraint bits indicated by the codec string
- **THEN** the algorithm MUST return `false`

#### Scenario: Encoder config allows flexible level matching

- **WHEN** running the Check Configuration Support algorithm with AudioEncoderConfig or VideoEncoderConfig
- **AND** the codec string contains a profile
- **AND** the User Agent cannot provide a codec that can encode the exact profile
- **THEN** the algorithm MUST return `false`

#### Scenario: Encoder level must be less than or equal to requested

- **WHEN** running the Check Configuration Support algorithm with AudioEncoderConfig or VideoEncoderConfig
- **AND** the codec string contains a level
- **AND** the User Agent cannot provide a codec that can encode to a level less than or equal to the requested level
- **THEN** the algorithm MUST return `false`

#### Scenario: Supported config returns true

- **WHEN** running the Check Configuration Support algorithm
- **AND** the User Agent can provide a codec to support all entries of the config including default values
- **THEN** the algorithm MUST return `true`

---

### Requirement: Clone Configuration Algorithm

The Clone Configuration algorithm SHALL create a deep copy of a configuration dictionary.

#### Scenario: Clone copies all recognized members

- **WHEN** running the Clone Configuration algorithm
- **THEN** a new empty instance of the dictionary type MUST be created
- **AND** for each dictionary member that exists in the source config
- **THEN** the member MUST be copied to the clone

#### Scenario: Clone performs deep copy of nested dictionaries

- **WHEN** running the Clone Configuration algorithm
- **AND** a dictionary member is itself a nested dictionary
- **THEN** the Clone Configuration algorithm MUST be run recursively on that member

#### Scenario: Clone ignores unrecognized members

- **WHEN** running the Clone Configuration algorithm
- **THEN** only dictionary members that the User Agent recognizes MUST be copied

---

### Requirement: Valid AudioDecoderConfig

An `AudioDecoderConfig` SHALL be valid only if it contains a non-empty codec string and a non-detached description buffer.

#### Scenario: Valid AudioDecoderConfig has non-empty codec

- **WHEN** validating an AudioDecoderConfig
- **AND** `codec` is empty after stripping ASCII whitespace
- **THEN** the config MUST be considered invalid

#### Scenario: Valid AudioDecoderConfig rejects detached description

- **WHEN** validating an AudioDecoderConfig
- **AND** `description` buffer is detached
- **THEN** the config MUST be considered invalid

#### Scenario: Valid AudioDecoderConfig with all requirements met

- **WHEN** validating an AudioDecoderConfig
- **AND** `codec` is non-empty after stripping ASCII whitespace
- **AND** `description` is not detached (if present)
- **THEN** the config MUST be considered valid

---

### Requirement: AudioDecoderConfig Members

The `AudioDecoderConfig` dictionary SHALL contain required codec identification and audio stream metadata.

#### Scenario: codec member contains codec string

- **WHEN** accessing `AudioDecoderConfig.codec`
- **THEN** it MUST be a DOMString containing a codec string describing the codec

#### Scenario: sampleRate specifies frame sample rate

- **WHEN** accessing `AudioDecoderConfig.sampleRate`
- **THEN** it MUST be an unsigned long specifying the number of frame samples per second

#### Scenario: numberOfChannels specifies channel count

- **WHEN** accessing `AudioDecoderConfig.numberOfChannels`
- **THEN** it MUST be an unsigned long specifying the number of audio channels

#### Scenario: description contains extradata

- **WHEN** accessing `AudioDecoderConfig.description`
- **AND** the member is present
- **THEN** it MUST be an AllowSharedBufferSource containing codec-specific bytes (extradata)

---

### Requirement: Valid VideoDecoderConfig

A `VideoDecoderConfig` SHALL be valid only if it meets all structural requirements for video decoder initialization.

#### Scenario: Valid VideoDecoderConfig has non-empty codec

- **WHEN** validating a VideoDecoderConfig
- **AND** `codec` is empty after stripping ASCII whitespace
- **THEN** the config MUST be considered invalid

#### Scenario: Coded dimensions must both be present or absent

- **WHEN** validating a VideoDecoderConfig
- **AND** only one of `codedWidth` or `codedHeight` is provided
- **THEN** the config MUST be considered invalid

#### Scenario: Coded dimensions must be non-zero

- **WHEN** validating a VideoDecoderConfig
- **AND** `codedWidth` is 0 or `codedHeight` is 0
- **THEN** the config MUST be considered invalid

#### Scenario: Display aspect dimensions must both be present or absent

- **WHEN** validating a VideoDecoderConfig
- **AND** only one of `displayAspectWidth` or `displayAspectHeight` is provided
- **THEN** the config MUST be considered invalid

#### Scenario: Display aspect dimensions must be non-zero

- **WHEN** validating a VideoDecoderConfig
- **AND** `displayAspectWidth` is 0 or `displayAspectHeight` is 0
- **THEN** the config MUST be considered invalid

#### Scenario: Valid VideoDecoderConfig rejects detached description

- **WHEN** validating a VideoDecoderConfig
- **AND** `description` buffer is detached
- **THEN** the config MUST be considered invalid

---

### Requirement: VideoDecoderConfig Members

The `VideoDecoderConfig` dictionary SHALL contain required codec identification and optional video stream metadata.

#### Scenario: codec member contains codec string

- **WHEN** accessing `VideoDecoderConfig.codec`
- **THEN** it MUST be a DOMString containing a codec string describing the codec

#### Scenario: description contains extradata

- **WHEN** accessing `VideoDecoderConfig.description`
- **AND** the member is present
- **THEN** it MUST be an AllowSharedBufferSource containing codec-specific bytes (extradata)

#### Scenario: codedWidth and codedHeight specify frame dimensions

- **WHEN** accessing `VideoDecoderConfig.codedWidth` and `VideoDecoderConfig.codedHeight`
- **THEN** they MUST specify the width and height of the VideoFrame in pixels including non-visible padding

#### Scenario: displayAspectWidth and displayAspectHeight specify display ratio

- **WHEN** accessing `VideoDecoderConfig.displayAspectWidth` and `VideoDecoderConfig.displayAspectHeight`
- **THEN** they MUST specify the aspect ratio dimensions when displayed

#### Scenario: colorSpace overrides in-band values

- **WHEN** `VideoDecoderConfig.colorSpace` exists
- **THEN** the provided values MUST override any in-band values from the bitstream

#### Scenario: hardwareAcceleration defaults to no-preference

- **WHEN** `VideoDecoderConfig.hardwareAcceleration` is not specified
- **THEN** it MUST default to `"no-preference"`

#### Scenario: optimizeForLatency minimizes decode delay

- **WHEN** `VideoDecoderConfig.optimizeForLatency` is `true`
- **THEN** the decoder SHOULD be configured to minimize EncodedVideoChunks decoded before output

#### Scenario: rotation and flip set decoded frame attributes

- **WHEN** `VideoDecoderConfig.rotation` or `VideoDecoderConfig.flip` is specified
- **THEN** the values MUST be set on decoded VideoFrames

---

### Requirement: Valid AudioEncoderConfig

An `AudioEncoderConfig` SHALL be valid only if it contains valid codec and audio stream parameters.

#### Scenario: Valid AudioEncoderConfig has non-empty codec

- **WHEN** validating an AudioEncoderConfig
- **AND** `codec` is empty after stripping ASCII whitespace
- **THEN** the config MUST be considered invalid

#### Scenario: Valid AudioEncoderConfig rejects zero sampleRate

- **WHEN** validating an AudioEncoderConfig
- **AND** `sampleRate` is zero
- **THEN** the config MUST be considered invalid

#### Scenario: Valid AudioEncoderConfig rejects zero numberOfChannels

- **WHEN** validating an AudioEncoderConfig
- **AND** `numberOfChannels` is zero
- **THEN** the config MUST be considered invalid

#### Scenario: Codec-specific extension validation

- **WHEN** validating an AudioEncoderConfig
- **AND** the config has a codec-specific extension
- **AND** the Codec Registry defines extension validation steps
- **THEN** those steps MUST be run to determine validity

---

### Requirement: AudioEncoderConfig Members

The `AudioEncoderConfig` dictionary SHALL contain required codec identification and audio encoding parameters.

#### Scenario: codec member contains codec string

- **WHEN** accessing `AudioEncoderConfig.codec`
- **THEN** it MUST be a DOMString containing a codec string describing the codec

#### Scenario: sampleRate specifies frame sample rate

- **WHEN** accessing `AudioEncoderConfig.sampleRate`
- **THEN** it MUST be an unsigned long specifying the number of frame samples per second

#### Scenario: numberOfChannels specifies channel count

- **WHEN** accessing `AudioEncoderConfig.numberOfChannels`
- **THEN** it MUST be an unsigned long specifying the number of audio channels

#### Scenario: bitrate specifies average encoded bitrate

- **WHEN** accessing `AudioEncoderConfig.bitrate`
- **AND** the member is present
- **THEN** it MUST be an unsigned long long specifying the average bitrate in bits per second

#### Scenario: bitrateMode defaults to variable

- **WHEN** `AudioEncoderConfig.bitrateMode` is not specified
- **THEN** it MUST default to `"variable"`

---

### Requirement: Valid VideoEncoderConfig

A `VideoEncoderConfig` SHALL be valid only if it contains valid codec and video encoding parameters.

#### Scenario: Valid VideoEncoderConfig has non-empty codec

- **WHEN** validating a VideoEncoderConfig
- **AND** `codec` is empty after stripping ASCII whitespace
- **THEN** the config MUST be considered invalid

#### Scenario: Valid VideoEncoderConfig rejects zero width

- **WHEN** validating a VideoEncoderConfig
- **AND** `width` is zero
- **THEN** the config MUST be considered invalid

#### Scenario: Valid VideoEncoderConfig rejects zero height

- **WHEN** validating a VideoEncoderConfig
- **AND** `height` is zero
- **THEN** the config MUST be considered invalid

#### Scenario: Valid VideoEncoderConfig rejects zero displayWidth

- **WHEN** validating a VideoEncoderConfig
- **AND** `displayWidth` is provided and equals zero
- **THEN** the config MUST be considered invalid

#### Scenario: Valid VideoEncoderConfig rejects zero displayHeight

- **WHEN** validating a VideoEncoderConfig
- **AND** `displayHeight` is provided and equals zero
- **THEN** the config MUST be considered invalid

---

### Requirement: VideoEncoderConfig Members

The `VideoEncoderConfig` dictionary SHALL contain required codec identification and video encoding parameters.

#### Scenario: codec member contains codec string

- **WHEN** accessing `VideoEncoderConfig.codec`
- **THEN** it MUST be a DOMString containing a codec string describing the codec

#### Scenario: width specifies encoded width

- **WHEN** accessing `VideoEncoderConfig.width`
- **THEN** it MUST be an unsigned long specifying the encoded width of output EncodedVideoChunks in pixels

#### Scenario: height specifies encoded height

- **WHEN** accessing `VideoEncoderConfig.height`
- **THEN** it MUST be an unsigned long specifying the encoded height of output EncodedVideoChunks in pixels

#### Scenario: encoder scales frames to match dimensions

- **WHEN** a VideoFrame has visible dimensions different from `width` and `height`
- **THEN** the encoder MUST scale the frame to match the configured dimensions

#### Scenario: displayWidth and displayHeight specify intended display size

- **WHEN** accessing `VideoEncoderConfig.displayWidth` and `VideoEncoderConfig.displayHeight`
- **AND** the members are present
- **THEN** they MUST specify the intended display dimensions
- **AND** they MUST default to `width` and `height` if not present

#### Scenario: bitrate specifies average encoded bitrate

- **WHEN** accessing `VideoEncoderConfig.bitrate`
- **AND** the member is present
- **THEN** it MUST be an unsigned long long specifying the average bitrate in bits per second

#### Scenario: framerate informs rate control

- **WHEN** accessing `VideoEncoderConfig.framerate`
- **AND** the member is present
- **THEN** it MUST be a double specifying the expected frame rate
- **AND** it SHOULD be used for optimal byte length calculation per frame

#### Scenario: hardwareAcceleration defaults to no-preference

- **WHEN** `VideoEncoderConfig.hardwareAcceleration` is not specified
- **THEN** it MUST default to `"no-preference"`

#### Scenario: alpha defaults to discard

- **WHEN** `VideoEncoderConfig.alpha` is not specified
- **THEN** it MUST default to `"discard"`

#### Scenario: bitrateMode defaults to variable

- **WHEN** `VideoEncoderConfig.bitrateMode` is not specified
- **THEN** it MUST default to `"variable"`

#### Scenario: latencyMode defaults to quality

- **WHEN** `VideoEncoderConfig.latencyMode` is not specified
- **THEN** it MUST default to `"quality"`

---

### Requirement: HardwareAcceleration Enum

The `HardwareAcceleration` enum SHALL specify hints for codec hardware acceleration preference.

#### Scenario: no-preference allows any acceleration

- **WHEN** `HardwareAcceleration` is `"no-preference"`
- **THEN** the User Agent MAY use hardware acceleration if available and compatible

#### Scenario: prefer-hardware requests hardware codec

- **WHEN** `HardwareAcceleration` is `"prefer-hardware"`
- **THEN** the User Agent SHOULD prefer hardware acceleration
- **AND** the User Agent MAY ignore this hint

#### Scenario: prefer-software requests software codec

- **WHEN** `HardwareAcceleration` is `"prefer-software"`
- **THEN** the User Agent SHOULD prefer a software codec implementation
- **AND** the User Agent MAY ignore this hint

#### Scenario: Hardware preference may cause unsupported config

- **WHEN** `HardwareAcceleration` is `"prefer-hardware"` or `"prefer-software"`
- **THEN** the configuration MAY be unsupported on platforms where the preferred codec is unavailable

---

### Requirement: AlphaOption Enum

The `AlphaOption` enum SHALL specify how alpha channel data should be handled.

#### Scenario: keep preserves alpha channel

- **WHEN** `AlphaOption` is `"keep"`
- **THEN** the User Agent SHOULD preserve alpha channel data for VideoFrames if present

#### Scenario: discard removes alpha channel

- **WHEN** `AlphaOption` is `"discard"`
- **THEN** the User Agent SHOULD ignore or remove VideoFrame alpha channel data

---

### Requirement: LatencyMode Enum

The `LatencyMode` enum SHALL specify encoding latency versus quality trade-offs.

#### Scenario: quality mode optimizes encoding quality

- **WHEN** `LatencyMode` is `"quality"`
- **THEN** the User Agent SHOULD optimize for encoding quality
- **AND** the User Agent MAY increase encoding latency to improve quality
- **AND** the User Agent MUST NOT drop frames to achieve target bitrate or framerate
- **AND** framerate SHOULD NOT be used as a target deadline for emitting chunks

#### Scenario: realtime mode optimizes low latency

- **WHEN** `LatencyMode` is `"realtime"`
- **THEN** the User Agent SHOULD optimize for low latency
- **AND** the User Agent MAY sacrifice quality to improve latency
- **AND** the User Agent MAY drop frames to achieve target bitrate or framerate
- **AND** framerate SHOULD be used as a target deadline for emitting chunks

---

### Requirement: VideoEncoderBitrateMode Enum

The `VideoEncoderBitrateMode` enum SHALL specify encoding rate control modes.

#### Scenario: constant mode encodes at fixed bitrate

- **WHEN** `VideoEncoderBitrateMode` is `"constant"`
- **THEN** the encoder MUST encode at a constant bitrate as specified by `bitrate`

#### Scenario: variable mode allows flexible bitrate

- **WHEN** `VideoEncoderBitrateMode` is `"variable"`
- **THEN** the encoder MUST use a variable bitrate
- **AND** more space MAY be used for complex signals
- **AND** less space MAY be used for less complex signals

#### Scenario: quantizer mode uses per-frame quantizer

- **WHEN** `VideoEncoderBitrateMode` is `"quantizer"`
- **THEN** the encoder MUST use a quantizer specified per frame in VideoEncoderEncodeOptions extensions

---

### Requirement: CodecState Enum

The `CodecState` enum SHALL represent the lifecycle state of a codec instance.

#### Scenario: unconfigured state means not ready

- **WHEN** `CodecState` is `"unconfigured"`
- **THEN** the codec is NOT configured for encoding or decoding

#### Scenario: configured state means ready for work

- **WHEN** `CodecState` is `"configured"`
- **THEN** a valid configuration has been provided
- **AND** the codec is ready for encoding or decoding

#### Scenario: closed state means permanently unusable

- **WHEN** `CodecState` is `"closed"`
- **THEN** the codec is no longer usable
- **AND** underlying system resources have been released

---

### Requirement: VideoEncoderEncodeOptions Dictionary

The `VideoEncoderEncodeOptions` dictionary SHALL provide per-frame encoding options.

#### Scenario: keyFrame defaults to false

- **WHEN** `VideoEncoderEncodeOptions.keyFrame` is not specified
- **THEN** it MUST default to `false`

#### Scenario: keyFrame true forces key chunk

- **WHEN** `VideoEncoderEncodeOptions.keyFrame` is `true`
- **THEN** the given frame MUST be encoded as a key frame

#### Scenario: keyFrame false allows delta chunks

- **WHEN** `VideoEncoderEncodeOptions.keyFrame` is `false`
- **THEN** the User Agent has flexibility to decide whether the frame is encoded as a key frame

---

### Requirement: WebCodecsErrorCallback

The `WebCodecsErrorCallback` callback type SHALL define the signature for codec error handlers.

#### Scenario: Error callback receives DOMException

- **WHEN** a codec error occurs
- **AND** the error callback is invoked
- **THEN** it MUST receive a DOMException describing the error
- **AND** the callback MUST return undefined

---

### Requirement: AudioDecoderSupport Dictionary

The `AudioDecoderSupport` dictionary SHALL provide configuration support information for AudioDecoder.

#### Scenario: supported indicates config support status

- **WHEN** accessing `AudioDecoderSupport.supported`
- **THEN** it MUST be a boolean indicating whether the corresponding config is supported

#### Scenario: config contains the tested configuration

- **WHEN** accessing `AudioDecoderSupport.config`
- **THEN** it MUST be an AudioDecoderConfig used to determine the supported value

---

### Requirement: VideoDecoderSupport Dictionary

The `VideoDecoderSupport` dictionary SHALL provide configuration support information for VideoDecoder.

#### Scenario: supported indicates config support status

- **WHEN** accessing `VideoDecoderSupport.supported`
- **THEN** it MUST be a boolean indicating whether the corresponding config is supported

#### Scenario: config contains the tested configuration

- **WHEN** accessing `VideoDecoderSupport.config`
- **THEN** it MUST be a VideoDecoderConfig used to determine the supported value

---

### Requirement: AudioEncoderSupport Dictionary

The `AudioEncoderSupport` dictionary SHALL provide configuration support information for AudioEncoder.

#### Scenario: supported indicates config support status

- **WHEN** accessing `AudioEncoderSupport.supported`
- **THEN** it MUST be a boolean indicating whether the corresponding config is supported

#### Scenario: config contains the tested configuration

- **WHEN** accessing `AudioEncoderSupport.config`
- **THEN** it MUST be an AudioEncoderConfig used to determine the supported value

---

### Requirement: VideoEncoderSupport Dictionary

The `VideoEncoderSupport` dictionary SHALL provide configuration support information for VideoEncoder.

#### Scenario: supported indicates config support status

- **WHEN** accessing `VideoEncoderSupport.supported`
- **THEN** it MUST be a boolean indicating whether the corresponding config is supported

#### Scenario: config contains the tested configuration

- **WHEN** accessing `VideoEncoderSupport.config`
- **THEN** it MUST be a VideoEncoderConfig used to determine the supported value
