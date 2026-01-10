# Tasks: Add Encoded Media Interfaces

## 1. EncodedAudioChunk Interface

- [ ] 1.1 Verify internal slots implementation matches spec (type, timestamp, duration, byte length, internal data)
- [ ] 1.2 Validate constructor handles transfer array semantics per spec (duplicate detection, detached check, DetachArrayBuffer)
- [ ] 1.3 Ensure copyTo() throws TypeError when destination is smaller than byteLength
- [ ] 1.4 Add DataCloneError for serialization with forStorage=true
- [ ] 1.5 Add unit tests for all constructor edge cases (duplicate ArrayBuffer in transfer, detached buffer)

## 2. EncodedVideoChunk Interface

- [ ] 2.1 Verify internal slots implementation matches spec (type, timestamp, duration, byte length, internal data)
- [ ] 2.2 Validate constructor handles transfer array semantics per spec (duplicate detection, detached check, DetachArrayBuffer)
- [ ] 2.3 Ensure copyTo() throws TypeError when destination is smaller than byteLength
- [ ] 2.4 Add DataCloneError for serialization with forStorage=true
- [ ] 2.5 Add unit tests for all constructor edge cases (duplicate ArrayBuffer in transfer, detached buffer)

## 3. Shared Type Definitions

- [ ] 3.1 Verify EncodedAudioChunkType and EncodedVideoChunkType enums exported correctly
- [ ] 3.2 Verify EncodedAudioChunkInit and EncodedVideoChunkInit dictionaries match WebIDL
- [ ] 3.3 Add type tests (test/types/*.test-d.ts) for chunk interfaces

## 4. Integration Validation

- [ ] 4.1 Verify chunks work correctly with VideoEncoder/VideoDecoder
- [ ] 4.2 Verify chunks work correctly with AudioEncoder/AudioDecoder
- [ ] 4.3 Verify chunks work correctly with Muxer/Demuxer
- [ ] 4.4 Run existing golden tests to confirm no regressions

## 5. Documentation

- [ ] 5.1 Update JSDoc comments with @example blocks for both chunk classes
- [ ] 5.2 Document key vs delta frame semantics for video
- [ ] 5.3 Ensure all public APIs have complete JSDoc documentation
