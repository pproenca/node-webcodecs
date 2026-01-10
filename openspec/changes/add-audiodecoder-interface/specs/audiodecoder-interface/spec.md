# AudioDecoder Interface

W3C WebCodecs AudioDecoder interface specification requirements.

Reference: `docs/specs/3-audiodecoder-interface/TOC.md`

## ADDED Requirements

### Requirement: AudioDecoder Constructor Initialization

The `AudioDecoder` constructor SHALL initialize all internal slots as specified by the W3C WebCodecs specification when invoked with a valid `AudioDecoderInit` dictionary.

#### Scenario: Constructor creates new AudioDecoder with required callbacks

- **WHEN** the AudioDecoder constructor is called with a valid `AudioDecoderInit` containing `output` and `error` callbacks
- **THEN** a new AudioDecoder instance MUST be created
- **AND** `[[control message queue]]` MUST be assigned a new empty queue
- **AND** `[[message queue blocked]]` MUST be assigned `false`
- **AND** `[[codec implementation]]` MUST be assigned `null`
- **AND** `[[codec work queue]]` MUST be assigned a new parallel queue
- **AND** `[[codec saturated]]` MUST be assigned `false`
- **AND** `[[output callback]]` MUST be assigned the provided `output` callback
- **AND** `[[error callback]]` MUST be assigned the provided `error` callback
- **AND** `[[key chunk required]]` MUST be assigned `true`
- **AND** `[[state]]` MUST be assigned `"unconfigured"`
- **AND** `[[decodeQueueSize]]` MUST be assigned `0`
- **AND** `[[pending flush promises]]` MUST be assigned a new empty list
- **AND** `[[dequeue event scheduled]]` MUST be assigned `false`

#### Scenario: Constructor rejects missing output callback

- **WHEN** the AudioDecoder constructor is called without an `output` callback
- **THEN** a TypeError MUST be thrown

#### Scenario: Constructor rejects missing error callback

- **WHEN** the AudioDecoder constructor is called without an `error` callback
- **THEN** a TypeError MUST be thrown

---

### Requirement: AudioDecoder State Attribute

The `state` attribute SHALL return the current `CodecState` of the AudioDecoder instance.

#### Scenario: State returns current codec state

- **WHEN** the `state` attribute is accessed
- **THEN** it MUST return the value of `[[state]]` internal slot
- **AND** the value MUST be one of: `"unconfigured"`, `"configured"`, or `"closed"`

---

### Requirement: AudioDecoder DecodeQueueSize Attribute

The `decodeQueueSize` attribute SHALL return the number of pending decode requests.

#### Scenario: DecodeQueueSize reflects pending work

- **WHEN** the `decodeQueueSize` attribute is accessed
- **THEN** it MUST return the value of `[[decodeQueueSize]]` internal slot
- **AND** the value MUST decrease as the underlying codec accepts new input

---

### Requirement: AudioDecoder Dequeue Event

The AudioDecoder SHALL fire a `dequeue` event when `decodeQueueSize` has decreased.

#### Scenario: Dequeue event fires after queue size decreases

- **WHEN** `[[decodeQueueSize]]` decreases
- **THEN** the Schedule Dequeue Event algorithm MUST be run

#### Scenario: Dequeue event coalescing prevents spam

- **WHEN** `[[dequeue event scheduled]]` equals `true`
- **AND** the Schedule Dequeue Event algorithm is invoked
- **THEN** no additional event MUST be scheduled

---

### Requirement: AudioDecoder Configure Method

The `configure()` method SHALL enqueue a control message to configure the decoder for decoding chunks as described by the provided config.

#### Scenario: Configure with valid config transitions to configured state

- **WHEN** `configure()` is called with a valid `AudioDecoderConfig`
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"configured"`
- **AND** `[[key chunk required]]` MUST be set to `true`
- **AND** a control message to configure the decoder MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Configure rejects invalid config

- **WHEN** `configure()` is called with an invalid `AudioDecoderConfig`
- **THEN** a TypeError MUST be thrown

#### Scenario: Configure throws when closed

- **WHEN** `configure()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Configure rejects unsupported codec asynchronously

- **WHEN** a control message to configure the decoder is run
- **AND** the codec configuration is not supported
- **THEN** the Close AudioDecoder algorithm MUST be run with NotSupportedError

---

### Requirement: AudioDecoder Decode Method

The `decode()` method SHALL enqueue a control message to decode the given EncodedAudioChunk.

#### Scenario: Decode enqueues chunk for processing

- **WHEN** `decode()` is called with a valid EncodedAudioChunk
- **AND** `[[state]]` is `"configured"`
- **THEN** `[[decodeQueueSize]]` MUST be incremented
- **AND** a control message to decode the chunk MUST be enqueued
- **AND** the control message queue MUST be processed

#### Scenario: Decode throws when unconfigured

- **WHEN** `decode()` is called
- **AND** `[[state]]` is `"unconfigured"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Decode throws when closed

- **WHEN** `decode()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** an InvalidStateError DOMException MUST be thrown

#### Scenario: Decode requires key chunk after configure

- **WHEN** `decode()` is called
- **AND** `[[key chunk required]]` is `true`
- **AND** the chunk `[[type]]` is not `"key"`
- **THEN** a DataError DOMException MUST be thrown

#### Scenario: Decode clears key chunk requirement after key chunk

- **WHEN** `decode()` is called
- **AND** `[[key chunk required]]` is `true`
- **AND** the chunk `[[type]]` is `"key"`
- **THEN** `[[key chunk required]]` MUST be set to `false`

---

### Requirement: AudioDecoder Flush Method

The `flush()` method SHALL complete all control messages in the queue and emit all outputs, returning a Promise.

#### Scenario: Flush returns promise when configured

- **WHEN** `flush()` is called
- **AND** `[[state]]` is `"configured"`
- **THEN** `[[key chunk required]]` MUST be set to `true`
- **AND** a new Promise MUST be created and appended to `[[pending flush promises]]`
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
- **AND** the Output AudioData algorithm MUST be run with any decoded outputs
- **AND** the flush promise MUST be resolved

---

### Requirement: AudioDecoder Reset Method

The `reset()` method SHALL immediately reset all state including configuration, control messages, and pending callbacks.

#### Scenario: Reset clears state when configured

- **WHEN** `reset()` is called
- **AND** `[[state]]` is not `"closed"`
- **THEN** `[[state]]` MUST be set to `"unconfigured"`
- **AND** `[[codec implementation]]` MUST be signaled to cease producing output
- **AND** all control messages MUST be removed from `[[control message queue]]`
- **AND** `[[decodeQueueSize]]` MUST be set to `0` if greater than zero
- **AND** the Schedule Dequeue Event algorithm MUST be run if queue size was reduced
- **AND** all promises in `[[pending flush promises]]` MUST be rejected with AbortError

#### Scenario: Reset is no-op when closed

- **WHEN** `reset()` is called
- **AND** `[[state]]` is `"closed"`
- **THEN** the method MUST return without error (no-op)

---

### Requirement: AudioDecoder Close Method

The `close()` method SHALL immediately abort all pending work and release system resources. Close is final.

#### Scenario: Close releases resources

- **WHEN** `close()` is called
- **THEN** the Reset AudioDecoder algorithm MUST be run with AbortError
- **AND** `[[state]]` MUST be set to `"closed"`
- **AND** `[[codec implementation]]` MUST be cleared and system resources released

#### Scenario: Close does not invoke error callback for AbortError

- **WHEN** the Close AudioDecoder algorithm runs with AbortError
- **THEN** `[[error callback]]` MUST NOT be invoked

#### Scenario: Close invokes error callback for other errors

- **WHEN** the Close AudioDecoder algorithm runs with an error that is not AbortError
- **THEN** `[[error callback]]` MUST be invoked with the error

---

### Requirement: AudioDecoder isConfigSupported Static Method

The `isConfigSupported()` static method SHALL return a Promise indicating whether the provided config is supported.

#### Scenario: isConfigSupported resolves with support information

- **WHEN** `isConfigSupported()` is called with a valid `AudioDecoderConfig`
- **THEN** a Promise MUST be returned
- **AND** the Promise MUST resolve with an `AudioDecoderSupport` dictionary
- **AND** `AudioDecoderSupport.supported` MUST be `true` if the config is supported, `false` otherwise
- **AND** `AudioDecoderSupport.config` MUST contain only recognized dictionary members

#### Scenario: isConfigSupported rejects invalid config

- **WHEN** `isConfigSupported()` is called with an invalid `AudioDecoderConfig`
- **THEN** a rejected Promise with TypeError MUST be returned

---

### Requirement: AudioDecoder Output AudioData Algorithm

The Output AudioData algorithm SHALL create AudioData instances from decoded outputs and invoke the output callback.

#### Scenario: Output AudioData creates valid AudioData

- **WHEN** the Output AudioData algorithm runs with decoded outputs
- **THEN** for each output, an AudioData instance MUST be created
- **AND** `[[Detached]]` MUST be `false`
- **AND** `[[timestamp]]` MUST match the associated EncodedAudioChunk timestamp
- **AND** `[[format]]` MUST be set to the recognized AudioSampleFormat or `null`
- **AND** `[[sample rate]]`, `[[number of frames]]`, and `[[number of channels]]` MUST be set from output
- **AND** `[[output callback]]` MUST be invoked with the AudioData

---

### Requirement: AudioDecoder Schedule Dequeue Event Algorithm

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

### Requirement: Valid AudioDecoderConfig

An `AudioDecoderConfig` SHALL be considered valid only if it contains all required members with valid values.

#### Scenario: Valid config has required members

- **WHEN** validating an AudioDecoderConfig
- **THEN** `codec` MUST be defined and non-empty
- **AND** `sampleRate` MUST be defined and a positive integer
- **AND** `numberOfChannels` MUST be defined and a positive integer

#### Scenario: Empty codec string is invalid

- **WHEN** validating an AudioDecoderConfig
- **AND** `codec` is an empty string
- **THEN** the config MUST be considered invalid

---

### Requirement: AudioDecoder Codec Saturation Handling

The AudioDecoder SHALL handle codec saturation by pausing queue processing until the codec is ready.

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

### Requirement: AudioDecoder Decode Error Handling

The AudioDecoder SHALL close with an EncodingError if decoding fails.

#### Scenario: Decode error closes decoder

- **WHEN** a control message to decode is run
- **AND** decoding results in an error
- **THEN** the Close AudioDecoder algorithm MUST be run with EncodingError
