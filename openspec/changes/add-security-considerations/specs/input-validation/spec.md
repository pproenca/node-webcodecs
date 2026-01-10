## ADDED Requirements

### Requirement: Dimension Validation

All codec configuration and media frame constructors SHALL validate dimension parameters before passing to native code.

The implementation SHALL reject:
- Width or height less than or equal to zero
- Width or height exceeding platform maximum (typically 16384 for software codecs)
- Dimensions that would cause integer overflow when computing buffer sizes

#### Scenario: Zero dimension rejected

- **WHEN** a VideoFrame is constructed with `codedWidth: 0` or `codedHeight: 0`
- **THEN** a TypeError is thrown synchronously
- **AND** no native code is invoked

#### Scenario: Negative dimension rejected

- **WHEN** a VideoEncoder is configured with `width: -100`
- **THEN** a TypeError is thrown synchronously
- **AND** the encoder state remains "unconfigured"

#### Scenario: Overflow dimension rejected

- **WHEN** a VideoFrame is constructed with dimensions that would overflow buffer size calculation
- **THEN** a TypeError is thrown synchronously

### Requirement: Buffer Size Validation

All media frame constructors SHALL validate that provided buffer sizes match expected sizes for the declared dimensions and format.

#### Scenario: Undersized buffer rejected

- **WHEN** a VideoFrame is constructed with a buffer smaller than `codedWidth * codedHeight * bytesPerPixel`
- **THEN** a TypeError is thrown synchronously
- **AND** no read beyond buffer bounds occurs

#### Scenario: Zero-length buffer rejected

- **WHEN** a VideoFrame is constructed with `Buffer.alloc(0)`
- **THEN** a TypeError is thrown synchronously

### Requirement: Codec String Validation

All codec configuration methods SHALL validate codec strings against known patterns before passing to native code.

The implementation SHALL:
- Validate codec string format (e.g., `avc1.PPCCLL` for H.264)
- Reject strings containing null bytes or control characters
- Reject excessively long codec strings (> 256 characters)

#### Scenario: Malformed codec string rejected

- **WHEN** a VideoEncoder is configured with `codec: "not-a-codec"`
- **THEN** a DOMException with name "NotSupportedError" is thrown
- **AND** the encoder state remains "unconfigured"

#### Scenario: Injection attempt rejected

- **WHEN** a codec string contains null bytes or shell metacharacters
- **THEN** a TypeError is thrown synchronously

### Requirement: Timestamp Validation

Media frame constructors SHALL accept timestamps within the valid range and handle edge cases gracefully.

#### Scenario: Negative timestamp accepted

- **WHEN** a VideoFrame is constructed with `timestamp: -1`
- **THEN** the frame is created successfully (negative timestamps valid per W3C spec)

#### Scenario: Large timestamp accepted

- **WHEN** a VideoFrame is constructed with `timestamp: Number.MAX_SAFE_INTEGER`
- **THEN** the frame is created successfully

### Requirement: Fuzz Test Coverage

All public codec entry points SHALL be covered by fuzz tests that verify no crashes occur on malformed input.

Fuzz tests SHALL cover:
- `VideoEncoder.encode()` with malformed frames
- `VideoDecoder.decode()` with malformed chunks
- `AudioEncoder.encode()` with malformed audio data
- `AudioDecoder.decode()` with malformed chunks
- `VideoFrame` constructor with edge-case parameters
- `AudioData` constructor with edge-case parameters
- `configure()` methods with invalid configurations

#### Scenario: Fuzzer detects no crashes

- **WHEN** 1000+ fuzz iterations are run against each codec entry point
- **THEN** all iterations complete without process crash (segfault, abort)
- **AND** each iteration either succeeds or throws a catchable exception
