# WebCodecs Definitions

Core terminology and definitions for the W3C WebCodecs API implementation.

Source: [W3C WebCodecs - Section 1: Definitions](https://www.w3.org/TR/webcodecs/#definitions)

## ADDED Requirements

### Requirement: Codec Definition

The term "Codec" SHALL refer generically to an instance of `AudioDecoder`, `AudioEncoder`, `VideoDecoder`, or `VideoEncoder`.

#### Scenario: Codec type identification

- **WHEN** referring to a codec in documentation or code
- **THEN** it MUST be one of the four defined codec types: AudioDecoder, AudioEncoder, VideoDecoder, or VideoEncoder

---

### Requirement: Key Chunk Definition

A "Key Chunk" SHALL be defined as an encoded chunk that does not depend on any other frames for decoding. This is also commonly referred to as a "key frame" or "I-frame".

#### Scenario: Independent decoding verification

- **WHEN** an encoded chunk is classified as a key chunk
- **THEN** it MUST be decodable without reference to any other chunks

---

### Requirement: Internal Pending Output Definition

"Internal Pending Output" SHALL refer to codec outputs such as `VideoFrame`s that currently reside in the internal pipeline of the underlying codec implementation.

#### Scenario: Output emission on new input

- **WHEN** no new inputs are provided to the codec
- **THEN** the underlying codec implementation MAY retain outputs in the internal pipeline

#### Scenario: Output emission on flush

- **WHEN** a flush operation is requested
- **THEN** the underlying codec implementation MUST emit all pending outputs

---

### Requirement: Codec System Resources Definition

"Codec System Resources" SHALL include CPU memory, GPU memory, and exclusive handles to specific decoding/encoding hardware that MAY be allocated by the User Agent as part of codec configuration or generation of `AudioData` and `VideoFrame` objects.

#### Scenario: Resource exhaustion awareness

- **WHEN** codec system resources are allocated
- **THEN** the implementation SHOULD document that such resources MAY be quickly exhausted

#### Scenario: Resource release requirement

- **WHEN** codec system resources are no longer in use
- **THEN** they SHOULD be released immediately

---

### Requirement: Temporal Layer Definition

A "Temporal Layer" SHALL be defined as a grouping of `EncodedVideoChunk`s whose timestamp cadence produces a particular framerate.

#### Scenario: Scalability mode relationship

- **WHEN** temporal layers are referenced
- **THEN** the relationship to `scalabilityMode` configuration MUST be documented

---

### Requirement: Progressive Image Definition

A "Progressive Image" SHALL be defined as an image that supports decoding to multiple levels of detail, with lower levels becoming available while the encoded data is not yet fully buffered.

#### Scenario: Partial decode support

- **WHEN** decoding a progressive image
- **THEN** lower detail levels MUST become available before full data is buffered

---

### Requirement: Progressive Image Frame Generation Definition

"Progressive Image Frame Generation" SHALL be defined as a generational identifier for a given Progressive Image decoded output. Each successive generation adds additional detail to the decoded output.

#### Scenario: Implementation-defined generation mechanism

- **WHEN** computing a frame's generation
- **THEN** the mechanism is implementer-defined

---

### Requirement: Primary Image Track Definition

A "Primary Image Track" SHALL be defined as an image track that is marked by the given image file as being the default track. The mechanism for indicating a primary track is format-defined.

#### Scenario: Format-specific primary track indication

- **WHEN** determining the primary image track
- **THEN** the mechanism MUST follow the format-specific specification

---

### Requirement: RGB Format Definition

An "RGB Format" SHALL be defined as a `VideoPixelFormat` containing red, green, and blue color channels in any order or layout (interleaved or planar), irrespective of whether an alpha channel is present.

#### Scenario: Channel presence verification

- **WHEN** a pixel format is classified as RGB
- **THEN** it MUST contain red, green, and blue channels regardless of layout or alpha presence

---

### Requirement: sRGB Color Space Definition

The "sRGB Color Space" SHALL be defined as a `VideoColorSpace` object initialized with:
- `primaries` set to `bt709`
- `transfer` set to `iec61966-2-1`
- `matrix` set to `rgb`
- `fullRange` set to `true`

#### Scenario: sRGB initialization verification

- **WHEN** an sRGB color space is created
- **THEN** all four properties MUST match the specified values

---

### Requirement: Display P3 Color Space Definition

The "Display P3 Color Space" SHALL be defined as a `VideoColorSpace` object initialized with:
- `primaries` set to `smpte432`
- `transfer` set to `iec61966-2-1`
- `matrix` set to `rgb`
- `fullRange` set to `true`

#### Scenario: Display P3 initialization verification

- **WHEN** a Display P3 color space is created
- **THEN** all four properties MUST match the specified values

---

### Requirement: REC709 Color Space Definition

The "REC709 Color Space" SHALL be defined as a `VideoColorSpace` object initialized with:
- `primaries` set to `bt709`
- `transfer` set to `bt709`
- `matrix` set to `bt709`
- `fullRange` set to `false`

#### Scenario: REC709 initialization verification

- **WHEN** a REC709 color space is created
- **THEN** all four properties MUST match the specified values

---

### Requirement: Codec Saturation Definition

"Codec Saturation" SHALL be defined as the state of an underlying codec implementation where the number of active decoding or encoding requests has reached an implementation-specific maximum such that it is temporarily unable to accept more work.

#### Scenario: Queue size increment on saturation

- **WHEN** the codec is saturated and additional `decode()` or `encode()` calls are made
- **THEN** the calls MUST be buffered in the control message queue and the respective `decodeQueueSize` or `encodeQueueSize` attributes MUST increment

#### Scenario: Saturation maximum flexibility

- **WHEN** defining the saturation maximum
- **THEN** the maximum MAY be any value greater than 1, including infinity (no maximum)

#### Scenario: Unsaturation condition

- **WHEN** the codec has made sufficient progress on the current workload
- **THEN** the codec implementation MUST become unsaturated
