## ADDED Requirements

### Requirement: RAII Resource Management

All FFmpeg resources allocated in C++ code SHALL use RAII wrappers from `src/ffmpeg_raii.h`.

Raw FFmpeg allocation calls (`av_frame_alloc`, `av_packet_alloc`, `avcodec_alloc_context3`, etc.) SHALL NOT be used directly outside of RAII wrapper implementations.

#### Scenario: RAII wrapper prevents leak

- **WHEN** an async encode operation fails mid-execution
- **THEN** all allocated AVFrame and AVPacket resources are automatically freed
- **AND** no memory leak occurs

#### Scenario: Lint enforces RAII usage

- **WHEN** `npm run lint:cpp` is executed
- **THEN** any raw `av_*_alloc` call outside `ffmpeg_raii.h` is flagged as an error

### Requirement: Error Path Resource Cleanup

All async workers SHALL properly release resources on all error paths, including:
- FFmpeg operation failures
- JavaScript callback exceptions
- Thread cancellation

#### Scenario: Encoder error releases resources

- **WHEN** an encode operation fails due to invalid frame data
- **THEN** the input frame reference is released
- **AND** any partially allocated output is freed
- **AND** the worker completes without leak

#### Scenario: Decoder error releases resources

- **WHEN** a decode operation fails due to corrupt input
- **THEN** the input chunk data is released
- **AND** any partially decoded frame is freed
- **AND** the error callback is invoked with DOMException

### Requirement: No Use-After-Free

The implementation SHALL prevent use-after-free conditions through:
- Reference counting for shared resources
- Clear ownership semantics (unique_ptr for owned, raw pointer for borrowed)
- Explicit lifetime documentation in RAII wrapper comments

#### Scenario: Closed frame not usable

- **WHEN** `frame.close()` is called on a VideoFrame
- **THEN** subsequent operations on the frame throw a DOMException with name "InvalidStateError"
- **AND** the underlying native memory is freed

#### Scenario: Encoder close releases pending frames

- **WHEN** `encoder.close()` is called with pending encode operations
- **THEN** all pending frame references are released
- **AND** no callbacks are invoked after close

### Requirement: Thread Safety for Shared Resources

Resources shared between the main thread and async workers SHALL be protected against data races through:
- Mutex protection for mutable shared state
- Copy-on-write for large buffers passed to workers
- No raw pointer sharing without explicit synchronization

#### Scenario: Concurrent encode operations safe

- **WHEN** multiple `encode()` calls are queued rapidly
- **THEN** each operation processes its own frame copy
- **AND** no data race occurs between worker threads

### Requirement: Memory Leak Detection Tests

Native tests SHALL include memory leak detection using Address Sanitizer (ASan).

#### Scenario: ASan detects no leaks

- **WHEN** `npm run test:native:sanitize` is executed
- **THEN** all tests pass without ASan leak reports
- **AND** the exit code is 0

#### Scenario: Stress test under ASan

- **WHEN** 1000+ encode/decode cycles are run under ASan
- **THEN** memory usage remains bounded
- **AND** no leak is reported at process exit
