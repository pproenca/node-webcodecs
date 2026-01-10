# AudioData Interface Capability

Defines the AudioData interface for raw audio sample data per W3C WebCodecs spec section 9.2.

## ADDED Requirements

### Requirement: AudioData Constructor

The system SHALL provide an AudioData constructor that accepts an AudioDataInit dictionary with the following required members:
- format: AudioSampleFormat
- sampleRate: float (samples per second)
- numberOfFrames: unsigned long
- numberOfChannels: unsigned long
- timestamp: long long (microseconds)
- data: BufferSource

Optional member:
- transfer: sequence<ArrayBuffer> (default empty)

The constructor SHALL:
1. Validate that numberOfFrames and numberOfChannels are greater than 0
2. Validate that data contains enough bytes for the specified format, frames, and channels
3. Copy or transfer the data based on transfer list
4. Calculate duration as (numberOfFrames / sampleRate) * 1,000,000 microseconds

#### Scenario: Construct AudioData with interleaved s16

- **GIVEN** AudioDataInit with format "s16", sampleRate 48000, numberOfFrames 1024, numberOfChannels 2, timestamp 0, and 4096-byte data buffer
- **WHEN** new AudioData(init) is called
- **THEN** AudioData is created with duration 21333 microseconds (1024/48000 * 1000000)

#### Scenario: Constructor validates buffer size

- **GIVEN** AudioDataInit with format "f32", numberOfFrames 100, numberOfChannels 2, and 400-byte data buffer (requires 800 bytes)
- **WHEN** new AudioData(init) is called
- **THEN** a TypeError is thrown

### Requirement: AudioData Attributes

AudioData SHALL expose the following readonly attributes:

- format: AudioSampleFormat? - Returns [[format]] or null if closed
- sampleRate: float - Returns [[sample rate]]
- numberOfFrames: unsigned long - Returns [[number of frames]]
- numberOfChannels: unsigned long - Returns [[number of channels]]
- duration: unsigned long long - Returns [[duration]] in microseconds
- timestamp: long long - Returns [[timestamp]] in microseconds

#### Scenario: Access attributes on valid AudioData

- **GIVEN** an open AudioData with format "f32-planar", sampleRate 44100, 512 frames, 2 channels, timestamp 1000000
- **WHEN** attributes are accessed
- **THEN** format returns "f32-planar", sampleRate returns 44100, numberOfFrames returns 512, numberOfChannels returns 2, timestamp returns 1000000, duration returns 11609

#### Scenario: Access format on closed AudioData

- **GIVEN** an AudioData that has been closed
- **WHEN** format is accessed
- **THEN** null is returned

### Requirement: AudioData allocationSize Method

The system SHALL provide an allocationSize(options) method that returns the number of bytes required to hold the audio data when copied.

AudioDataCopyToOptions dictionary:
- planeIndex: unsigned long (required for planar formats, 0 for interleaved)
- frameOffset: unsigned long (default 0)
- frameCount: unsigned long (default numberOfFrames - frameOffset)
- format: AudioSampleFormat (default same as source)

#### Scenario: Calculate allocation size for full copy

- **GIVEN** an AudioData with format "s16", 1024 frames, 2 channels
- **WHEN** allocationSize({ planeIndex: 0 }) is called
- **THEN** 4096 is returned (1024 * 2 * 2 bytes)

#### Scenario: Calculate allocation size for planar format

- **GIVEN** an AudioData with format "f32-planar", 512 frames, 2 channels
- **WHEN** allocationSize({ planeIndex: 1 }) is called
- **THEN** 2048 is returned (512 * 4 bytes for one plane)

### Requirement: AudioData copyTo Method

The system SHALL provide a copyTo(destination, options) method that copies audio sample data to the provided buffer.

- The destination buffer MUST have sufficient space (at least allocationSize(options) bytes)
- For interleaved formats, planeIndex MUST be 0
- For planar formats, planeIndex selects the channel plane (0 to numberOfChannels-1)
- Format conversion SHALL be performed if options.format differs from source format
- The method SHALL throw if AudioData is closed

#### Scenario: Copy interleaved audio data

- **GIVEN** an AudioData with format "s16", 100 frames, 2 channels
- **WHEN** copyTo(buffer, { planeIndex: 0 }) is called with a 400-byte buffer
- **THEN** all interleaved samples are copied to the buffer

#### Scenario: Copy single plane from planar format

- **GIVEN** an AudioData with format "f32-planar", 256 frames, 2 channels
- **WHEN** copyTo(buffer, { planeIndex: 1 }) is called with a 1024-byte buffer
- **THEN** the right channel samples are copied to the buffer

#### Scenario: Copy with format conversion

- **GIVEN** an AudioData with format "s16"
- **WHEN** copyTo(buffer, { planeIndex: 0, format: "f32" }) is called
- **THEN** samples are converted from s16 to f32 during copy

### Requirement: AudioData clone Method

The system SHALL provide a clone() method that returns a new AudioData referencing the same media resource.

- The new AudioData SHALL have identical attribute values
- Both AudioData objects SHALL share the same underlying [[resource reference]]
- The method SHALL throw InvalidStateError if the AudioData is closed

#### Scenario: Clone creates shared reference

- **GIVEN** an open AudioData
- **WHEN** clone() is called
- **THEN** a new AudioData is returned with identical attributes
- **AND** closing one does not affect the other's access to data

### Requirement: AudioData close Method

The system SHALL provide a close() method that releases the [[resource reference]].

- After close(), format SHALL return null
- After close(), calling allocationSize(), copyTo(), or clone() SHALL throw InvalidStateError
- close() MAY be called multiple times (subsequent calls are no-op)

#### Scenario: Close releases resources

- **GIVEN** an open AudioData
- **WHEN** close() is called
- **THEN** format returns null
- **AND** clone() throws InvalidStateError
