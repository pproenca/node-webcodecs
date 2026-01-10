# AudioEncoder Interface

W3C WebCodecs AudioEncoder interface specification requirements.

Reference: `docs/specs/5-audioencoder-interface/TOC.md`

## ADDED Requirements

### Requirement: AudioEncoder Constructor Initialization

The `AudioEncoder` constructor SHALL initialize all internal slots as specified by the W3C WebCodecs specification when invoked with a valid `AudioEncoderInit` dictionary.

#### Scenario: Constructor creates new AudioEncoder with required callbacks

- **WHEN** the AudioEncoder constructor is called with a valid `AudioEncoderInit` containing `output` and `error` callbacks
- **THEN** a new AudioEncoder instance MUST be created
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

#### Scenario: Constructor rejects missing output callback

- **WHEN** the AudioEncoder constructor is called without an `output` callback
- **THEN** a TypeError MUST be thrown

#### Scenario: Constructor rejects missing error callback

- **WHEN** the AudioEncoder constructor is called without an `error` callback
- **THEN** a TypeError MUST be thrown

---

### Requirement: AudioEncoder State Attribute

The `state` attribute SHALL return the current `CodecState` of the AudioEncoder instance.

#### Scenario: State returns current codec state

- **WHEN** the `state` attribute is accessed
- **THEN** it MUST return the value of `[[state]]` internal slot
- **AND** the value MUST be one of: `"unconfigured"`, `"configured"`, or `"closed"`

---

### Requirement: AudioEncoder EncodeQueueSize Attribute

The `encodeQueueSize` attribute SHALL return the number of pending encode requests.

#### Scenario: EncodeQueueSize reflects pending work

- **WHEN** the `encodeQueueSize` attribute is accessed
- **THEN** it MUST return the value of `[[encodeQueueSize]]` internal slot
- **AND** the value MUST decrease as the underlying codec accepts new input

---

### Requirement: AudioEncoder Dequeue Event

The AudioEncoder SHALL fire a `dequeue` event when `encodeQueueSize` has decreased.

#### Scenario: Dequeue event fires after queue size decreases

- **WHEN** `[[encodeQueueSize]]` decreases
- **THEN** the Schedule Dequeue Event algorithm MUST be run

#### Scenario: Dequeue event coalescing prevents spam

- **WHEN** `[[dequeue event scheduled]]` equals `true`
- **AND** the Schedule Dequeue Event algorithm is invoked
- **THEN** no additional event MUST be scheduled

---

### Requirement: AudioEncoder Configure Method

The `configure()` method SHALL enqueue a control message to configure the encoder for encoding audio data as described by the provided config.

#### Scenario: Configure with valid config transitions to configured state

- **WHEN** `configure()` is called with a valid `AudioEncoderConfig`
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"configured"`
- **AND** a control message to configure the encoder MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Configure rejects invalid config

- **WHEN** `configure()` is called with an invalid `AudioEncoderConfig`
- **THEN** a TypeError MUST be thrown

#### Scenario: Configure throws when closed

- **WHEN** `configure()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Configure rejects unsupported codec asynchronously

- **WHEN** a control message to configure the encoder is run
- **AND** the codec configuration is not supported
- **THEN** the Close AudioEncoder algorithm MUST be run with NotSupportedError

---

### Requirement: AudioEncoder Encode Method

The `encode()` method SHALL enqueue a control message to encode the given AudioData.

#### Scenario: Encode enqueues data for processing

- **WHEN** `encode()` is called with a valid AudioData
- **AND** `[[state]]` is `"configured"`
- **THEN** the AudioData MUST be cloned
- **AND** `[[encodeQueueSize]]` MUST be incremented
- **AND** a control message to encode the cloned data MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Encode throws when unconfigured

- **WHEN** `encode()` is called
- **AND** `[[state]]` is `"unconfigured"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Encode throws when closed

- **WHEN** `encode()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Encode throws when AudioData is detached

- **WHEN** `encode()` is called
- **AND** the AudioData's `[[Detached]]` internal slot is `true`
- **THEN** a TypeError MUST be thrown

---

### Requirement: AudioEncoder Flush Method

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
- **AND** the Output EncodedAudioChunks algorithm MUST be run with any encoded outputs
- **AND** the flush promise MUST be resolved

---

### Requirement: AudioEncoder Reset Method

The `reset()` method SHALL immediately reset all state including configuration, control messages, and pending callbacks.

#### Scenario: Reset clears state when configured

- **WHEN** `reset()` is called
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"unconfigured"`
- **AND** `[[active encoder config]]` MUST be set to `null`
- **AND** `[[active output config]]` MUST be set to `null`
- **AND** `[[codec implementation]]` MUST be signaled to cease producing output
- **AND** all control messages MUST be removed from `[[control message queue]]`
- **AND** `[[encodeQueueSize]]` MUST be set to `0` if greater than zero
- **AND** the Schedule Dequeue Event algorithm MUST be run if queue size was reduced
- **AND** all promises in `[[pending flush promises]]` MUST be rejected with AbortError

#### Scenario: Reset throws when closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

---

### Requirement: AudioEncoder Close Method

The `close()` method SHALL immediately abort all pending work and release system resources. Close is final.

#### Scenario: Close releases resources

- **WHEN** `close()` is called
- **THEN** the Reset AudioEncoder algorithm MUST be run with AbortError
- **AND** `[[state]]` MUST be set to `"closed"`
- **AND** `[[codec implementation]]` MUST be cleared and system resources released

#### Scenario: Close does not invoke error callback for AbortError

- **WHEN** the Close AudioEncoder algorithm runs with AbortError
- **THEN** `[[error callback]]` MUST NOT be invoked

#### Scenario: Close invokes error callback for other errors

- **WHEN** the Close AudioEncoder algorithm runs with an error that is not AbortError
- **THEN** `[[error callback]]` MUST be invoked with the error

---

### Requirement: AudioEncoder isConfigSupported Static Method

The `isConfigSupported()` static method SHALL return a Promise indicating whether the provided config is supported.

#### Scenario: isConfigSupported resolves with support information

- **WHEN** `isConfigSupported()` is called with a valid `AudioEncoderConfig`
- **THEN** a Promise MUST be returned
- **AND** the Promise MUST resolve with an `AudioEncoderSupport` dictionary
- **AND** `AudioEncoderSupport.supported` MUST be `true` if the config is supported, `false` otherwise
- **AND** `AudioEncoderSupport.config` MUST contain only recognized dictionary members

#### Scenario: isConfigSupported rejects invalid config

- **WHEN** `isConfigSupported()` is called with an invalid `AudioEncoderConfig`
- **THEN** a rejected Promise with TypeError MUST be returned

---

### Requirement: AudioEncoder Output EncodedAudioChunks Algorithm

The Output EncodedAudioChunks algorithm SHALL create EncodedAudioChunk instances from encoded outputs and invoke the output callback with appropriate metadata.

#### Scenario: Output EncodedAudioChunks creates valid chunks

- **WHEN** the Output EncodedAudioChunks algorithm runs with encoded outputs
- **THEN** for each output, an EncodedAudioChunk instance MUST be created
- **AND** `[[data]]` MUST contain the encoded audio data
- **AND** `[[type]]` MUST be set to the EncodedAudioChunkType of the output
- **AND** `[[timestamp]]` MUST match the associated AudioData timestamp
- **AND** `[[duration]]` MUST match the associated AudioData duration

#### Scenario: Output EncodedAudioChunks provides decoder config on change

- **WHEN** the Output EncodedAudioChunks algorithm runs
- **AND** the output config differs from `[[active output config]]`
- **THEN** `EncodedAudioChunkMetadata.decoderConfig` MUST be set to the new AudioDecoderConfig
- **AND** `[[active output config]]` MUST be updated to the new config

#### Scenario: Output EncodedAudioChunks invokes callback

- **WHEN** the Output EncodedAudioChunks algorithm runs
- **THEN** `[[output callback]]` MUST be invoked with the EncodedAudioChunk and EncodedAudioChunkMetadata

---

### Requirement: AudioEncoder Schedule Dequeue Event Algorithm

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

### Requirement: Valid AudioEncoderConfig

An `AudioEncoderConfig` SHALL be considered valid only if it contains all required members with valid values.

#### Scenario: Valid config has required members

- **WHEN** validating an AudioEncoderConfig
- **THEN** `codec` MUST be defined and non-empty
- **AND** `sampleRate` MUST be defined and a positive integer
- **AND** `numberOfChannels` MUST be defined and a positive integer

#### Scenario: Empty codec string is invalid

- **WHEN** validating an AudioEncoderConfig
- **AND** `codec` is an empty string
- **THEN** the config MUST be considered invalid

---

### Requirement: AudioEncoder Codec Saturation Handling

The AudioEncoder SHALL handle codec saturation by pausing queue processing until the codec is ready.

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

### Requirement: AudioEncoder Encode Error Handling

The AudioEncoder SHALL close with an EncodingError if encoding fails.

#### Scenario: Encode error closes encoder

- **WHEN** a control message to encode is run
- **AND** encoding results in an error
- **THEN** the Close AudioEncoder algorithm MUST be run with EncodingError

---

### Requirement: EncodedAudioChunkMetadata Dictionary

The `EncodedAudioChunkMetadata` dictionary SHALL provide optional decoder configuration for encoded audio chunks.

#### Scenario: decoderConfig contains valid AudioDecoderConfig

- **WHEN** `EncodedAudioChunkMetadata.decoderConfig` is present
- **THEN** it MUST be a valid `AudioDecoderConfig` that can decode the associated `EncodedAudioChunk`
- **AND** `decoderConfig.codec` MUST match the encoder's configured codec
- **AND** `decoderConfig.sampleRate` MUST match the encoder's configured sample rate
- **AND** `decoderConfig.numberOfChannels` MUST match the encoder's configured number of channels
- **AND** `decoderConfig.description` MUST contain codec-specific bytes from the encoder implementation
