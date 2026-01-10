# Audio Sample Format Capability

Defines the AudioSampleFormat enum and related concepts for audio buffer arrangements per W3C WebCodecs spec section 9.3.

## ADDED Requirements

### Requirement: Audio Sample Format Enum

The system SHALL provide an AudioSampleFormat enum that describes the numeric type and arrangement of audio samples.

The enum SHALL include interleaved formats:
- "u8" - 8-bit unsigned integer samples, interleaved
- "s16" - 16-bit signed integer samples, interleaved
- "s32" - 32-bit signed integer samples, interleaved
- "f32" - 32-bit floating point samples, interleaved

The enum SHALL include planar formats:
- "u8-planar" - 8-bit unsigned integer samples, planar
- "s16-planar" - 16-bit signed integer samples, planar
- "s32-planar" - 32-bit signed integer samples, planar
- "f32-planar" - 32-bit floating point samples, planar

#### Scenario: Valid sample format values

- **WHEN** an AudioSampleFormat value is used
- **THEN** it MUST be one of: "u8", "s16", "s32", "f32", "u8-planar", "s16-planar", "s32-planar", "f32-planar"

### Requirement: Interleaved Buffer Arrangement

For interleaved AudioSampleFormat values (without "-planar" suffix), the system SHALL arrange audio samples such that samples from all channels for a given frame are stored consecutively.

- For N channels and F frames, samples SHALL be arranged as: [C0F0, C1F0, ..., CN-1F0, C0F1, C1F1, ..., CN-1F1, ..., CN-1FF-1]
- The total buffer size SHALL be numberOfFrames * numberOfChannels * bytesPerSample

#### Scenario: Interleaved stereo audio

- **GIVEN** an AudioData with format "s16", 2 channels, and 3 frames
- **WHEN** the buffer is examined
- **THEN** samples are arranged as [L0, R0, L1, R1, L2, R2] (6 samples, 12 bytes)

### Requirement: Planar Buffer Arrangement

For planar AudioSampleFormat values (with "-planar" suffix), the system SHALL arrange audio samples such that all samples for a single channel are stored consecutively in a plane, with planes stored sequentially.

- For N channels and F frames, samples SHALL be arranged as: [C0F0, C0F1, ..., C0FF-1, C1F0, ..., C1FF-1, ..., CN-1F0, ..., CN-1FF-1]
- Each plane has size numberOfFrames * bytesPerSample
- The total buffer size SHALL be numberOfFrames * numberOfChannels * bytesPerSample

#### Scenario: Planar stereo audio

- **GIVEN** an AudioData with format "f32-planar", 2 channels, and 3 frames
- **WHEN** the buffer is examined
- **THEN** samples are arranged as [L0, L1, L2, R0, R1, R2] (6 samples, 24 bytes)

### Requirement: Linear PCM Sample Magnitude

All audio samples SHALL use linear pulse-code modulation (Linear PCM) with uniform quantization levels.

- "u8" samples: 0 to 255, silence at 128
- "s16" samples: -32768 to 32767, silence at 0
- "s32" samples: -2147483648 to 2147483647, silence at 0
- "f32" samples: typically -1.0 to 1.0, silence at 0.0

#### Scenario: Sample value ranges

- **WHEN** audio samples are read or written
- **THEN** they SHALL conform to their format's value range and magnitude conventions
