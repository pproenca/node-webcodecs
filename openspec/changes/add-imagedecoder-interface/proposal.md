# Change: Add ImageDecoder Interface (W3C WebCodecs Section 10)

## Why

The W3C WebCodecs specification includes ImageDecoder (Section 10) for decoding static and animated images. While a basic implementation exists, it lacks formal specification as an OpenSpec capability and needs verification against the full W3C spec requirements including:
- Complete ImageDecoder interface with all internal slots
- ImageTrackList and ImageTrack interfaces for animated image tracks
- ImageDecoderInit, ImageDecodeOptions, and ImageDecodeResult dictionaries
- Proper control message queue integration and async decode handling
- ReadableStream support for progressive decoding

## What Changes

- **ADDED**: `imagedecoder-interface` capability spec covering:
  - ImageDecoder class with constructor, attributes (type, complete, completed, tracks), and methods (decode, reset, close, isTypeSupported)
  - ImageDecoderInit dictionary validation (type, data, colorSpaceConversion, desiredWidth/desiredHeight, preferAnimation, transfer)
  - ImageDecodeOptions dictionary (frameIndex, completeFramesOnly)
  - ImageDecodeResult dictionary (image, complete)
  - ImageTrackList interface (ready, length, selectedIndex, selectedTrack, index getter)
  - ImageTrack interface (animated, frameCount, repetitionCount, selected setter)
  - Supported formats: PNG, JPEG, GIF (animated), WebP (animated), BMP, TIFF

## Impact

- **Affected specs**: New `imagedecoder-interface` capability (no existing specs modified)
- **Affected code**:
  - `lib/image-decoder.ts` - TypeScript wrapper (exists, needs verification)
  - `lib/image-track.ts` - ImageTrack class (exists, needs verification)
  - `lib/image-track-list.ts` - ImageTrackList class (exists, needs verification)
  - `src/image_decoder.h` / `src/image_decoder.cc` - C++ native implementation (exists)
  - `lib/types.ts` - TypeScript interfaces (exists)
  - `test/golden/image-decoder.test.ts` - Integration tests (needs creation)
- **Dependencies**: VideoFrame interface (for decode result), control-message-queue model
