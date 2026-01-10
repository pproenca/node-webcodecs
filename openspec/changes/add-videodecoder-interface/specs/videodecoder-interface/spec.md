# VideoDecoder Interface

W3C WebCodecs VideoDecoder interface specification requirements.

Reference: `docs/specs/4-videodecoder-interface/TOC.md`

## ADDED Requirements

### Requirement: VideoDecoder Constructor Initialization

The `VideoDecoder` constructor SHALL initialize all internal slots as specified by the W3C WebCodecs specification when invoked with a valid `VideoDecoderInit` dictionary.

#### Scenario: Constructor creates new VideoDecoder with required callbacks

- **WHEN** the VideoDecoder constructor is called with a valid `VideoDecoderInit` containing `output` and `error` callbacks
- **THEN** a new VideoDecoder instance MUST be created
- **AND** `[[control message queue]]` MUST be assigned a new empty queue
- **AND** `[[message queue blocked]]` MUST be assigned `false`
- **AND** `[[codec implementation]]` MUST be assigned `null`
- **AND** `[[codec work queue]]` MUST be assigned a new parallel queue
- **AND** `[[codec saturated]]` MUST be assigned `false`
- **AND** `[[output callback]]` MUST be assigned the provided `output` callback
- **AND** `[[error callback]]` MUST be assigned the provided `error` callback
- **AND** `[[active decoder config]]` MUST be assigned `null`
- **AND** `[[key chunk required]]` MUST be assigned `true`
- **AND** `[[state]]` MUST be assigned `"unconfigured"`
- **AND** `[[decodeQueueSize]]` MUST be assigned `0`
- **AND** `[[pending flush promises]]` MUST be assigned a new empty list
- **AND** `[[dequeue event scheduled]]` MUST be assigned `false`

#### Scenario: Constructor rejects missing output callback

- **WHEN** the VideoDecoder constructor is called without an `output` callback
- **THEN** a TypeError MUST be thrown

#### Scenario: Constructor rejects missing error callback

- **WHEN** the VideoDecoder constructor is called without an `error` callback
- **THEN** a TypeError MUST be thrown

---

### Requirement: VideoDecoder State Attribute

The `state` attribute SHALL return the current `CodecState` of the VideoDecoder instance.

#### Scenario: State returns current codec state

- **WHEN** the `state` attribute is accessed
- **THEN** it MUST return the value of `[[state]]` internal slot
- **AND** the value MUST be one of: `"unconfigured"`, `"configured"`, or `"closed"`

---

### Requirement: VideoDecoder DecodeQueueSize Attribute

The `decodeQueueSize` attribute SHALL return the number of pending decode requests.

#### Scenario: DecodeQueueSize reflects pending work

- **WHEN** the `decodeQueueSize` attribute is accessed
- **THEN** it MUST return the value of `[[decodeQueueSize]]` internal slot
- **AND** the value MUST decrease as the underlying codec accepts new input

---

### Requirement: VideoDecoder Dequeue Event

The VideoDecoder SHALL fire a `dequeue` event when `decodeQueueSize` has decreased.

#### Scenario: Dequeue event fires after queue size decreases

- **WHEN** `[[decodeQueueSize]]` decreases
- **THEN** the Schedule Dequeue Event algorithm MUST be run

#### Scenario: Dequeue event coalescing prevents spam

- **WHEN** `[[dequeue event scheduled]]` equals `true`
- **AND** the Schedule Dequeue Event algorithm is invoked
- **THEN** no additional event MUST be scheduled

---

### Requirement: VideoDecoder Configure Method

The `configure()` method SHALL enqueue a control message to configure the decoder for decoding chunks as described by the provided config.

#### Scenario: Configure with valid config transitions to configured state

- **WHEN** `configure()` is called with a valid `VideoDecoderConfig`
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"configured"`
- **AND** `[[key chunk required]]` MUST be set to `true`
- **AND** a control message to configure the decoder MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Configure rejects invalid config

- **WHEN** `configure()` is called with an invalid `VideoDecoderConfig`
- **THEN** a TypeError MUST be thrown

#### Scenario: Configure throws when closed

- **WHEN** `configure()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Configure rejects unsupported codec asynchronously

- **WHEN** a control message to configure the decoder is run
- **AND** the codec configuration is not supported
- **THEN** the Close VideoDecoder algorithm MUST be run with NotSupportedError

#### Scenario: Configure blocks message queue during configuration

- **WHEN** a control message to configure the decoder is run
- **THEN** `[[message queue blocked]]` MUST be assigned `true`
- **AND** the Check Configuration Support algorithm MUST be run on the codec work queue
- **AND** upon completion, `[[message queue blocked]]` MUST be assigned `false`

---

### Requirement: VideoDecoder Decode Method

The `decode()` method SHALL enqueue a control message to decode the given EncodedVideoChunk.

#### Scenario: Decode enqueues chunk for processing

- **WHEN** `decode()` is called with a valid EncodedVideoChunk
- **AND** `[[state]]` is `"configured"`
- **THEN** `[[decodeQueueSize]]` MUST be incremented
- **AND** a control message to decode the chunk MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Decode throws when not configured

- **WHEN** `decode()` is called
- **AND** `[[state]]` is not `"configured"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Decode requires key chunk after configure

- **WHEN** `decode()` is called
- **AND** `[[key chunk required]]` is `true`
- **AND** the chunk `type` is not `"key"`
- **THEN** a DataError DOMException MUST be thrown

#### Scenario: Decode validates key chunk internal data

- **WHEN** `decode()` is called
- **AND** `[[key chunk required]]` is `true`
- **AND** the chunk `type` is `"key"`
- **THEN** the implementation SHOULD inspect the chunk's internal data to verify it is truly a key chunk
- **AND** if a mismatch is detected, a DataError DOMException MUST be thrown

#### Scenario: Decode clears key chunk requirement after key chunk

- **WHEN** `decode()` is called
- **AND** `[[key chunk required]]` is `true`
- **AND** the chunk `type` is `"key"`
- **AND** the chunk is verified to be a valid key chunk
- **THEN** `[[key chunk required]]` MUST be set to `false`

---

### Requirement: VideoDecoder Flush Method

The `flush()` method SHALL complete all control messages in the queue and emit all outputs, returning a Promise.

#### Scenario: Flush returns promise when configured

- **WHEN** `flush()` is called
- **AND** `[[state]]` is `"configured"`
- **THEN** `[[key chunk required]]` MUST be set to `true`
- **AND** a new Promise MUST be created and appended to `[[pending flush promises]]`
- **AND** a control message to flush MUST be enqueued
- **AND** the Promise MUST be returned

#### Scenario: Flush rejects when not configured

- **WHEN** `flush()` is called
- **AND** `[[state]]` is not `"configured"`
- **THEN** a rejected Promise with InvalidStateError DOMException MUST be returned

#### Scenario: Flush emits all pending outputs

- **WHEN** a control message to flush is run
- **THEN** `[[codec implementation]]` MUST be signaled to emit all internal pending outputs
- **AND** the Output VideoFrames algorithm MUST be run with any decoded outputs
- **AND** the flush promise MUST be removed from `[[pending flush promises]]`
- **AND** the flush promise MUST be resolved

---

### Requirement: VideoDecoder Reset Method

The `reset()` method SHALL immediately reset all state including configuration, control messages, and pending callbacks.

#### Scenario: Reset clears state when not closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"unconfigured"`
- **AND** `[[codec implementation]]` MUST be signaled to cease producing output
- **AND** all control messages MUST be removed from `[[control message queue]]`
- **AND** if `[[decodeQueueSize]]` is greater than zero, it MUST be set to `0`
- **AND** the Schedule Dequeue Event algorithm MUST be run if queue size was reduced
- **AND** all promises in `[[pending flush promises]]` MUST be rejected with AbortError

#### Scenario: Reset throws when closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

---

### Requirement: VideoDecoder Close Method

The `close()` method SHALL immediately abort all pending work and release system resources. Close is final.

#### Scenario: Close releases resources

- **WHEN** `close()` is called
- **THEN** the Reset VideoDecoder algorithm MUST be run with AbortError
- **AND** `[[state]]` MUST be set to `"closed"`
- **AND** `[[codec implementation]]` MUST be cleared and system resources released

#### Scenario: Close does not invoke error callback for AbortError

- **WHEN** the Close VideoDecoder algorithm runs with AbortError
- **THEN** `[[error callback]]` MUST NOT be invoked

#### Scenario: Close invokes error callback for other errors

- **WHEN** the Close VideoDecoder algorithm runs with an error that is not AbortError
- **THEN** `[[error callback]]` MUST be invoked with the error

---

### Requirement: VideoDecoder isConfigSupported Static Method

The `isConfigSupported()` static method SHALL return a Promise indicating whether the provided config is supported.

#### Scenario: isConfigSupported resolves with support information

- **WHEN** `isConfigSupported()` is called with a valid `VideoDecoderConfig`
- **THEN** a Promise MUST be returned
- **AND** the Promise MUST resolve with a `VideoDecoderSupport` dictionary
- **AND** `VideoDecoderSupport.supported` MUST be `true` if the config is supported, `false` otherwise
- **AND** `VideoDecoderSupport.config` MUST contain only recognized dictionary members

#### Scenario: isConfigSupported rejects invalid config

- **WHEN** `isConfigSupported()` is called with an invalid `VideoDecoderConfig`
- **THEN** a rejected Promise with TypeError MUST be returned

#### Scenario: isConfigSupported runs asynchronously

- **WHEN** `isConfigSupported()` is called
- **THEN** a new parallel queue MUST be created
- **AND** the Check Configuration Support algorithm MUST be run on that queue
- **AND** the result MUST be returned via the Promise

---

### Requirement: VideoDecoder Output VideoFrames Algorithm

The Output VideoFrames algorithm SHALL create VideoFrame instances from decoded outputs and invoke the output callback.

#### Scenario: Output VideoFrames creates valid VideoFrame

- **WHEN** the Output VideoFrames algorithm runs with decoded outputs
- **THEN** for each output, a VideoFrame instance MUST be created
- **AND** `timestamp` MUST match the associated EncodedVideoChunk timestamp
- **AND** `duration` MUST match the associated EncodedVideoChunk duration
- **AND** `[[output callback]]` MUST be invoked with the VideoFrame

#### Scenario: Output VideoFrames applies display aspect ratio

- **WHEN** the Output VideoFrames algorithm runs
- **AND** `displayAspectWidth` and `displayAspectHeight` exist in `[[active decoder config]]`
- **THEN** the VideoFrame MUST be created with those display aspect ratio values

#### Scenario: Output VideoFrames applies color space from config

- **WHEN** the Output VideoFrames algorithm runs
- **AND** `colorSpace` exists in `[[active decoder config]]`
- **THEN** the VideoFrame MUST be created with the colorSpace from config
- **AND** this MUST override any colorSpace detected by the codec implementation

#### Scenario: Output VideoFrames detects color space from bitstream

- **WHEN** the Output VideoFrames algorithm runs
- **AND** `colorSpace` does not exist in `[[active decoder config]]`
- **AND** the codec implementation detects a VideoColorSpace from the bitstream
- **THEN** the VideoFrame MUST be created with the detected colorSpace

#### Scenario: Output VideoFrames applies rotation and flip

- **WHEN** the Output VideoFrames algorithm runs
- **AND** `rotation` or `flip` exist in `[[active decoder config]]`
- **THEN** the VideoFrame MUST be created with those transformation values

---

### Requirement: VideoDecoder Schedule Dequeue Event Algorithm

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

### Requirement: Valid VideoDecoderConfig

A `VideoDecoderConfig` SHALL be considered valid only if it contains all required members with valid values.

#### Scenario: Valid config has required codec member

- **WHEN** validating a VideoDecoderConfig
- **THEN** `codec` MUST be defined and a non-empty string

#### Scenario: Empty codec string is invalid

- **WHEN** validating a VideoDecoderConfig
- **AND** `codec` is an empty string or contains only whitespace
- **THEN** the config MUST be considered invalid

---

### Requirement: VideoDecoder Codec Saturation Handling

The VideoDecoder SHALL handle codec saturation by pausing queue processing until the codec is ready.

#### Scenario: Decode respects codec saturation

- **WHEN** a control message to decode is run
- **AND** `[[codec saturated]]` equals `true`
- **THEN** the message MUST return `"not processed"` and remain in queue

#### Scenario: Decode sets saturation flag

- **WHEN** a control message to decode is run
- **AND** decoding will cause `[[codec implementation]]` to become saturated
- **THEN** `[[codec saturated]]` MUST be set to `true`

#### Scenario: Decode clears saturation when codec is ready

- **WHEN** decoding completes
- **AND** `[[codec saturated]]` equals `true`
- **AND** `[[codec implementation]]` is no longer saturated
- **THEN** `[[codec saturated]]` MUST be set to `false`
- **AND** the control message queue MUST be processed

---

### Requirement: VideoDecoder Decode Error Handling

The VideoDecoder SHALL close with an EncodingError if decoding fails.

#### Scenario: Decode error closes decoder

- **WHEN** a control message to decode is run
- **AND** decoding results in an error
- **THEN** the Close VideoDecoder algorithm MUST be run with EncodingError

---

### Requirement: VideoDecoder Presentation Order Output

The VideoDecoder SHALL output frames in presentation order.

#### Scenario: Frames output in presentation order

- **WHEN** the VideoDecoder decodes frames
- **THEN** output VideoFrames MUST be delivered to `[[output callback]]` in presentation order
- **AND** if the codec implementation outputs frames in decode order, the User Agent MUST reorder them

---

### Requirement: VideoDecoder Resource Ownership

The VideoDecoder SHALL retain ownership of underlying media resources until output VideoFrames are closed.

#### Scenario: Resources remain owned until frame close

- **WHEN** the VideoDecoder outputs a VideoFrame
- **THEN** the underlying media resources MUST remain owned by the VideoDecoder
- **AND** the resources MUST be released only when the VideoFrame is closed

#### Scenario: Resource exhaustion blocks decoding

- **WHEN** output VideoFrames are not closed
- **AND** the VideoDecoder's resource pool is exhausted
- **THEN** decoding MUST stall until resources are released
