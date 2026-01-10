# Tasks: Add ImageDecoder Interface

## 1. Specification

- [ ] 1.1 Define ImageDecoder constructor requirements and validation
- [ ] 1.2 Define ImageDecoder attributes (type, complete, completed, tracks)
- [ ] 1.3 Define ImageDecoder methods (decode, reset, close, isTypeSupported)
- [ ] 1.4 Define ImageDecoderInit dictionary validation
- [ ] 1.5 Define ImageDecodeOptions and ImageDecodeResult dictionaries
- [ ] 1.6 Define ImageTrackList interface and attributes
- [ ] 1.7 Define ImageTrack interface and selected setter behavior

## 2. TypeScript Layer Verification

- [ ] 2.1 Verify ImageDecoder class implements all W3C spec requirements
- [ ] 2.2 Verify ImageTrackList implements index getter and iteration
- [ ] 2.3 Verify ImageTrack selected setter follows spec steps 1-12
- [ ] 2.4 Verify desiredWidth/desiredHeight pair validation
- [ ] 2.5 Add JSDoc with @example blocks for all public APIs
- [ ] 2.6 Add type tests in test/types/image-decoder.test-d.ts

## 3. C++ Native Layer Verification

- [ ] 3.1 Verify native ImageDecoder supports all MIME types from spec
- [ ] 3.2 Verify decode() returns proper VideoFrame with timestamp/duration
- [ ] 3.3 Verify animated image frame counting and repetition count
- [ ] 3.4 Verify RAII wrappers used throughout (no raw av_*_alloc/free)
- [ ] 3.5 Verify error handling returns correct DOMException types

## 4. Testing

- [ ] 4.1 Create test/golden/image-decoder.test.ts with static image tests
- [ ] 4.2 Add animated GIF decoding tests (frame count, repetition)
- [ ] 4.3 Add animated WebP decoding tests
- [ ] 4.4 Add ImageDecodeOptions.frameIndex tests
- [ ] 4.5 Add ImageDecoder.isTypeSupported tests
- [ ] 4.6 Add error path tests (invalid type, closed decoder, invalid frameIndex)
- [ ] 4.7 Add ImageTrackList iteration and selectedTrack tests
- [ ] 4.8 Add ReadableStream data input tests

## 5. Documentation

- [ ] 5.1 Update lib/image-decoder.ts JSDoc with W3C spec references
- [ ] 5.2 Update lib/types.ts ImageDecoder interface documentation
