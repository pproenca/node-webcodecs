# VideoEncoder Interface

W3C WebCodecs VideoEncoder interface specification requirements.

Reference: `docs/specs/6-videoencoder-interface/TOC.md`

## ADDED Requirements

### Requirement: VideoEncoder Constructor Initialization

The `VideoEncoder` constructor SHALL initialize all internal slots as specified by the W3C WebCodecs specification when invoked with a valid `VideoEncoderInit` dictionary.

#### Scenario: Constructor creates new VideoEncoder with required callbacks

- **WHEN** the VideoEncoder constructor is called with a valid `VideoEncoderInit` containing `output` and `error` callbacks
- **THEN** a new VideoEncoder instance MUST be created
- **AND** `[[control message queue]]` MUST be assigned a new empty queue
- **AND** `[[message queue blocked]]` MUST be assigned `false`
- **AND** `[[codec implementation]]` MUST be assigned `null`
- **AND** `[[codec work queue]]` MUST be assigned a new parallel queue
- **AND** `[[codec saturated]]` MUST be assigned `false`
- **AND** `[[output callback]]` MUST be assigned the provided `output` callback
- **AND** `[[error callback]]` MUST be assigned the provided `error` callback
- **AND** `[[active encoder config]]` MUST be assigned `null`
- **AND** `[[active output config]]` MUST be assigned `null`
- **AND** `[[state]]` MUST be assigned `"unconfigured"`
- **AND** `[[encodeQueueSize]]` MUST be assigned `0`
- **AND** `[[pending flush promises]]` MUST be assigned a new empty list
- **AND** `[[dequeue event scheduled]]` MUST be assigned `false`
- **AND** `[[active orientation]]` MUST be assigned `null`

#### Scenario: Constructor rejects missing output callback

- **WHEN** the VideoEncoder constructor is called without an `output` callback
- **THEN** a TypeError MUST be thrown

#### Scenario: Constructor rejects missing error callback

- **WHEN** the VideoEncoder constructor is called without an `error` callback
- **THEN** a TypeError MUST be thrown

---

### Requirement: VideoEncoder State Attribute

The `state` attribute SHALL return the current `CodecState` of the VideoEncoder instance.

#### Scenario: State returns current codec state

- **WHEN** the `state` attribute is accessed
- **THEN** it MUST return the value of `[[state]]` internal slot
- **AND** the value MUST be one of: `"unconfigured"`, `"configured"`, or `"closed"`

---

### Requirement: VideoEncoder EncodeQueueSize Attribute

The `encodeQueueSize` attribute SHALL return the number of pending encode requests.

#### Scenario: EncodeQueueSize reflects pending work

- **WHEN** the `encodeQueueSize` attribute is accessed
- **THEN** it MUST return the value of `[[encodeQueueSize]]` internal slot
- **AND** the value MUST decrease as the underlying codec accepts new input

---

### Requirement: VideoEncoder Dequeue Event

The VideoEncoder SHALL fire a `dequeue` event when `encodeQueueSize` has decreased.

#### Scenario: Dequeue event fires after queue size decreases

- **WHEN** `[[encodeQueueSize]]` decreases
- **THEN** the Schedule Dequeue Event algorithm MUST be run

#### Scenario: Dequeue event coalescing prevents spam

- **WHEN** `[[dequeue event scheduled]]` equals `true`
- **AND** the Schedule Dequeue Event algorithm is invoked
- **THEN** no additional event MUST be scheduled

---

### Requirement: VideoEncoder Configure Method

The `configure()` method SHALL enqueue a control message to configure the encoder for encoding video frames as described by the provided config.

#### Scenario: Configure with valid config transitions to configured state

- **WHEN** `configure()` is called with a valid `VideoEncoderConfig`
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"configured"`
- **AND** `[[active orientation]]` MUST be set to `null`
- **AND** a control message to configure the encoder MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Configure rejects invalid config

- **WHEN** `configure()` is called with an invalid `VideoEncoderConfig`
- **THEN** a TypeError MUST be thrown

#### Scenario: Configure throws when closed

- **WHEN** `configure()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Configure rejects unsupported codec asynchronously

- **WHEN** a control message to configure the encoder is run
- **AND** the codec configuration is not supported
- **THEN** the Close VideoEncoder algorithm MUST be run with NotSupportedError

#### Scenario: Configure blocks message queue during configuration

- **WHEN** a control message to configure the encoder is run
- **THEN** `[[message queue blocked]]` MUST be assigned `true`
- **AND** the Check Configuration Support algorithm MUST be run on the codec work queue
- **AND** upon completion, `[[message queue blocked]]` MUST be assigned `false`

---

### Requirement: VideoEncoder Encode Method

The `encode()` method SHALL enqueue a control message to encode the given VideoFrame.

#### Scenario: Encode enqueues frame for processing

- **WHEN** `encode()` is called with a valid VideoFrame
- **AND** `[[state]]` is `"configured"`
- **THEN** the VideoFrame MUST be cloned using the Clone VideoFrame algorithm
- **AND** `[[encodeQueueSize]]` MUST be incremented
- **AND** a control message to encode the cloned frame MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Encode throws when unconfigured

- **WHEN** `encode()` is called
- **AND** `[[state]]` is `"unconfigured"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Encode throws when closed

- **WHEN** `encode()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Encode throws when VideoFrame is detached

- **WHEN** `encode()` is called
- **AND** the VideoFrame's `[[Detached]]` internal slot is `true`
- **THEN** a TypeError MUST be thrown

#### Scenario: Encode validates frame orientation consistency

- **WHEN** `encode()` is called
- **AND** `[[active orientation]]` is not `null`
- **AND** the frame's `[[rotation]]` and `[[flip]]` do not match `[[active orientation]]`
- **THEN** a DataError DOMException MUST be thrown

#### Scenario: Encode captures orientation from first frame

- **WHEN** `encode()` is called
- **AND** `[[active orientation]]` is `null`
- **THEN** `[[active orientation]]` MUST be set to the frame's `[[rotation]]` and `[[flip]]` values

---

### Requirement: VideoEncoder Flush Method

The `flush()` method SHALL complete all control messages in the queue and emit all outputs, returning a Promise.

#### Scenario: Flush returns promise when configured

- **WHEN** `flush()` is called
- **AND** `[[state]]` is `"configured"`
- **THEN** a new Promise MUST be created and appended to `[[pending flush promises]]`
- **AND** a control message to flush MUST be enqueued
- **AND** the Promise MUST be returned

#### Scenario: Flush rejects when unconfigured

- **WHEN** `flush()` is called
- **AND** `[[state]]` is `"unconfigured"`
- **THEN** a rejected Promise with InvalidStateError DOMException MUST be returned

#### Scenario: Flush rejects when closed

- **WHEN** `flush()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** a rejected Promise with InvalidStateError DOMException MUST be returned

#### Scenario: Flush emits all pending outputs

- **WHEN** a control message to flush is run
- **THEN** `[[codec implementation]]` MUST be signaled to emit all internal pending outputs
- **AND** the Output EncodedVideoChunks algorithm MUST be run with any encoded outputs
- **AND** the flush promise MUST be removed from `[[pending flush promises]]`
- **AND** the flush promise MUST be resolved

---

### Requirement: VideoEncoder Reset Method

The `reset()` method SHALL immediately reset all state including configuration, control messages, and pending callbacks.

#### Scenario: Reset clears state when not closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"unconfigured"`
- **AND** `[[active encoder config]]` MUST be set to `null`
- **AND** `[[active output config]]` MUST be set to `null`
- **AND** `[[codec implementation]]` MUST be signaled to cease producing output
- **AND** all control messages MUST be removed from `[[control message queue]]`
- **AND** if `[[encodeQueueSize]]` is greater than zero, it MUST be set to `0`
- **AND** the Schedule Dequeue Event algorithm MUST be run if queue size was reduced
- **AND** all promises in `[[pending flush promises]]` MUST be rejected with AbortError

#### Scenario: Reset throws when closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

---

### Requirement: VideoEncoder Close Method

The `close()` method SHALL immediately abort all pending work and release system resources. Close is final.

#### Scenario: Close releases resources

- **WHEN** `close()` is called
- **THEN** the Reset VideoEncoder algorithm MUST be run with AbortError
- **AND** `[[state]]` MUST be set to `"closed"`
- **AND** `[[codec implementation]]` MUST be cleared and system resources released

#### Scenario: Close does not invoke error callback for AbortError

- **WHEN** the Close VideoEncoder algorithm runs with AbortError
- **THEN** `[[error callback]]` MUST NOT be invoked

#### Scenario: Close invokes error callback for other errors

- **WHEN** the Close VideoEncoder algorithm runs with an error that is not AbortError
- **THEN** `[[error callback]]` MUST be invoked with the error

---

### Requirement: VideoEncoder isConfigSupported Static Method

The `isConfigSupported()` static method SHALL return a Promise indicating whether the provided config is supported.

#### Scenario: isConfigSupported resolves with support information

- **WHEN** `isConfigSupported()` is called with a valid `VideoEncoderConfig`
- **THEN** a Promise MUST be returned
- **AND** the Promise MUST resolve with a `VideoEncoderSupport` dictionary
- **AND** `VideoEncoderSupport.supported` MUST be `true` if the config is supported, `false` otherwise
- **AND** `VideoEncoderSupport.config` MUST contain only recognized dictionary members

#### Scenario: isConfigSupported rejects invalid config

- **WHEN** `isConfigSupported()` is called with an invalid `VideoEncoderConfig`
- **THEN** a rejected Promise with TypeError MUST be returned

#### Scenario: isConfigSupported runs asynchronously

- **WHEN** `isConfigSupported()` is called
- **THEN** a new parallel queue MUST be created
- **AND** the Check Configuration Support algorithm MUST be run on that queue
- **AND** the result MUST be returned via the Promise

---

### Requirement: VideoEncoder Output EncodedVideoChunks Algorithm

The Output EncodedVideoChunks algorithm SHALL create EncodedVideoChunk instances from encoded outputs and invoke the output callback with appropriate metadata.

#### Scenario: Output EncodedVideoChunks creates valid chunks

- **WHEN** the Output EncodedVideoChunks algorithm runs with encoded outputs
- **THEN** for each output, an EncodedVideoChunk instance MUST be created
- **AND** `[[data]]` MUST contain the encoded video data
- **AND** `[[type]]` MUST be set to the EncodedVideoChunkType of the output
- **AND** `[[timestamp]]` MUST match the associated VideoFrame timestamp
- **AND** `[[duration]]` MUST match the associated VideoFrame duration

#### Scenario: Output EncodedVideoChunks provides decoder config on change

- **WHEN** the Output EncodedVideoChunks algorithm runs
- **AND** the output config differs from `[[active output config]]`
- **THEN** `EncodedVideoChunkMetadata.decoderConfig` MUST be set to the new VideoDecoderConfig
- **AND** `[[active output config]]` MUST be updated to the new config

#### Scenario: Output EncodedVideoChunks constructs valid VideoDecoderConfig

- **WHEN** the Output EncodedVideoChunks algorithm constructs a VideoDecoderConfig
- **THEN** `codec` MUST be assigned from `[[active encoder config]].codec`
- **AND** `codedWidth` MUST be assigned from `[[active encoder config]].width`
- **AND** `codedHeight` MUST be assigned from `[[active encoder config]].height`
- **AND** `displayAspectWidth` MUST be assigned from `[[active encoder config]].displayWidth`
- **AND** `displayAspectHeight` MUST be assigned from `[[active encoder config]].displayHeight`
- **AND** `rotation` MUST be assigned from the associated VideoFrame's `[[rotation]]`
- **AND** `flip` MUST be assigned from the associated VideoFrame's `[[flip]]`
- **AND** `description` MUST be populated as determined by `[[codec implementation]]` per the Codec Registry

#### Scenario: Output EncodedVideoChunks invokes callback

- **WHEN** the Output EncodedVideoChunks algorithm runs
- **THEN** `[[output callback]]` MUST be invoked with the EncodedVideoChunk and EncodedVideoChunkMetadata

---

### Requirement: VideoEncoder Schedule Dequeue Event Algorithm

The Schedule Dequeue Event algorithm SHALL fire a dequeue event, coalescing multiple invocations.

#### Scenario: Schedule Dequeue Event fires event

- **WHEN** the Schedule Dequeue Event algorithm runs
- **AND** `[[dequeue event scheduled]]` is `false`
- **THEN** `[[dequeue event scheduled]]` MUST be set to `true`
- **AND** a task MUST be queued to fire a `dequeue` event
- **AND** after firing, `[[dequeue event scheduled]]` MUST be set to `false`

#### Scenario: Schedule Dequeue Event no-op when already scheduled

- **WHEN** the Schedule Dequeue Event algorithm runs
- **AND** `[[dequeue event scheduled]]` is `true`
- **THEN** the algorithm MUST return immediately without scheduling another event

---

### Requirement: Valid VideoEncoderConfig

A `VideoEncoderConfig` SHALL be considered valid only if it contains all required members with valid values.

#### Scenario: Valid config has required members

- **WHEN** validating a VideoEncoderConfig
- **THEN** `codec` MUST be defined and non-empty
- **AND** `width` MUST be defined and a positive integer
- **AND** `height` MUST be defined and a positive integer

#### Scenario: Empty codec string is invalid

- **WHEN** validating a VideoEncoderConfig
- **AND** `codec` is an empty string or contains only whitespace
- **THEN** the config MUST be considered invalid

#### Scenario: Zero dimensions are invalid

- **WHEN** validating a VideoEncoderConfig
- **AND** `width` or `height` is zero or negative
- **THEN** the config MUST be considered invalid

---

### Requirement: VideoEncoder Codec Saturation Handling

The VideoEncoder SHALL handle codec saturation by pausing queue processing until the codec is ready.

#### Scenario: Encode respects codec saturation

- **WHEN** a control message to encode is run
- **AND** `[[codec saturated]]` equals `true`
- **THEN** the message MUST return `"not processed"` and remain in queue

#### Scenario: Encode sets saturation flag

- **WHEN** a control message to encode is run
- **AND** encoding will cause `[[codec implementation]]` to become saturated
- **THEN** `[[codec saturated]]` MUST be set to `true`

#### Scenario: Encode clears saturation when codec is ready

- **WHEN** encoding completes
- **AND** `[[codec saturated]]` equals `true`
- **AND** `[[codec implementation]]` is no longer saturated
- **THEN** `[[codec saturated]]` MUST be set to `false`
- **AND** the control message queue MUST be processed

---

### Requirement: VideoEncoder Encode Error Handling

The VideoEncoder SHALL close with an EncodingError if encoding fails.

#### Scenario: Encode error closes encoder

- **WHEN** a control message to encode is run
- **AND** encoding results in an error
- **THEN** the Close VideoEncoder algorithm MUST be run with EncodingError

---

### Requirement: EncodedVideoChunkMetadata Dictionary

The `EncodedVideoChunkMetadata` dictionary SHALL provide optional metadata for encoded video chunks.

#### Scenario: decoderConfig contains valid VideoDecoderConfig

- **WHEN** `EncodedVideoChunkMetadata.decoderConfig` is present
- **THEN** it MUST be a valid `VideoDecoderConfig` that can decode the associated `EncodedVideoChunk`
- **AND** the config MUST completely describe the output such that it could be used to correctly decode the chunk

#### Scenario: svc contains SvcOutputMetadata when scalabilityMode has multiple temporal layers

- **WHEN** `[[active encoder config]].scalabilityMode` describes multiple temporal layers
- **THEN** `EncodedVideoChunkMetadata.svc` MUST be present
- **AND** `svc.temporalLayerId` MUST be set to the zero-based index of the temporal layer for the output

#### Scenario: alphaSideData contains alpha channel data when alpha encoding is enabled

- **WHEN** `[[active encoder config]].alpha` is set to `"keep"`
- **THEN** `EncodedVideoChunkMetadata.alphaSideData` MUST be present
- **AND** it MUST contain the encoded alpha data for the chunk

---

### Requirement: SvcOutputMetadata Dictionary

The `SvcOutputMetadata` dictionary SHALL provide scalable video coding layer information.

#### Scenario: temporalLayerId identifies temporal layer

- **WHEN** `SvcOutputMetadata.temporalLayerId` is present
- **THEN** it MUST be an unsigned long identifying the temporal layer for the associated EncodedVideoChunk
- **AND** the value MUST be a zero-based index within the configured scalability mode

---

### Requirement: VideoEncoder Frame Cloning

The VideoEncoder SHALL clone VideoFrames before encoding to prevent mutation during asynchronous processing.

#### Scenario: Encode clones frame before queueing

- **WHEN** `encode()` is called with a VideoFrame
- **THEN** the Clone VideoFrame algorithm MUST be run on the frame
- **AND** the cloned frame MUST be used for encoding
- **AND** the original frame MUST remain usable by the caller

---

### Requirement: VideoEncoder Encode Options

The `encode()` method SHALL accept optional `VideoEncoderEncodeOptions` to control encoding behavior.

#### Scenario: Keyframe request forces key chunk output

- **WHEN** `encode()` is called with `options.keyFrame` set to `true`
- **THEN** the encoder MUST attempt to produce a key chunk for this frame

#### Scenario: Default encoding produces delta chunks when possible

- **WHEN** `encode()` is called without `options.keyFrame` or with it set to `false`
- **THEN** the encoder MAY produce delta chunks that depend on previous frames
