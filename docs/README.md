# WebCodecs Implementation Documentation

This directory contains comprehensive documentation for implementing the W3C WebCodecs API in Node.js through three different approaches.

## Quick Start

**Start here**: [WEBCODECS_MASTER_TODO.md](./WEBCODECS_MASTER_TODO.md) - Consolidated TODO list organized by Capabilities → User Stories → Tasks

## Documents

### [WEBCODECS_MASTER_TODO.md](./WEBCODECS_MASTER_TODO.md) ⭐

**~700 lines** - **THE MASTER TODO LIST**

Consolidates all documentation into one actionable checklist organized by:
- **10 Capabilities** (Video Encoding, Decoding, Audio, etc.)
- **18 User Stories** (A1-A8, B1-B2, C1-C3, D1-D5)
- **Checkboxed implementation tasks** for each story
- **Progress tracking** with status summary
- **Priority order** for implementation

### [WEBCODECS_IMPLEMENTATION_TODO.md](./WEBCODECS_IMPLEMENTATION_TODO.md)

**~1170 lines** - Complete specification-based TODO list

Contains:
- **Part 1**: Full WebCodecs API specification reference
  - All 10 core interfaces (VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder, VideoFrame, AudioData, EncodedVideoChunk, EncodedAudioChunk, VideoColorSpace, ImageDecoder)
  - All dictionary types with member definitions
  - All enum types with values
  - All callback type signatures

- **Part 2**: FFmpeg Native Bindings Implementation (~250 tasks)
  - Project setup and CMake configuration
  - Each class with constructor, properties, methods
  - Codec string parsing for all video/audio codecs
  - Pixel format and audio sample format conversion
  - Async/threading implementation
  - Hardware acceleration support

- **Part 3**: Browser Extraction Implementation
  - Chromium source analysis and extraction
  - Firefox source analysis and extraction
  - Dependency resolution and build system
  - Node.js integration

- **Part 4**: Pure JavaScript Implementation
  - WASM codec integration (OpenH264, libvpx, libaom, opus, AAC)
  - Pure JS pixel/audio format conversion
  - Full class implementations
  - Optimization strategies

### [WEBCODECS_SPEC_DETAILS.md](./WEBCODECS_SPEC_DETAILS.md)

**~500 lines** - Normative implementation details

Contains critical spec details for correct implementation:
- Error handling (DOMException types and when to throw)
- State machine transitions and valid operations
- Queue processing model and codec saturation
- Memory management and transfer semantics
- Codec string parsing (H.264, VP9, AV1, AAC, etc.)
- isConfigSupported() behavior
- Encoded chunk metadata structures
- VideoEncoderEncodeOptions
- Flush behavior requirements
- Security considerations
- Implementation checklists

### [WEBCODECS_USER_STORIES.md](./WEBCODECS_USER_STORIES.md)

**~716 lines** - End-to-end user stories with acceptance tests

Contains:
- **Section A**: FFmpeg Native User Stories (8 stories)
  - A1: Encode video frames to H.264 (P1)
  - A2: Decode H.264 video to raw frames (P2)
  - A3: Transcode between formats (P3)
  - A4: Encode audio to AAC (P4)
  - A5: Decode audio formats (P5)
  - A6: Check codec support (P6)
  - A7: Process images with ImageDecoder (P7)
  - A8: Hardware acceleration (P8)

- **Section B**: Browser Extraction User Stories (2 stories)
  - B1: Use extracted Chromium WebCodecs (P1)
  - B2: Cross-platform build (P2)

- **Section C**: Pure JavaScript User Stories (3 stories)
  - C1: Encode video in pure JS (P1)
  - C2: Decode video in pure JS (P2)
  - C3: Zero native dependency installation (P3)

- **Section D**: Cross-Cutting Stories (5 stories)
  - D1: Complete encoding/decoding pipeline
  - D2: Error handling and recovery
  - D3: Memory management
  - D4: TypeScript type definitions
  - D5: Performance benchmarking

Each user story includes:
- Clear user persona and goal
- Priority level with justification
- Independent testability explanation
- Given/When/Then acceptance scenarios
- Example test code implementations

### [plans/](./plans/)

Implementation plans directory containing:
- `2025-12-29-webcodecs-node-mvp.md` - MVP implementation plan for initial VideoEncoder

## Quick Reference

### Implementation Priority Order

1. **FFmpeg Native** - Primary implementation for production use
2. **Pure JavaScript** - Fallback for environments without native compilation
3. **Browser Extraction** - For exact browser parity

### Core Classes by Priority

| Priority | Class | FFmpeg | Pure JS | Browser |
|----------|-------|--------|---------|---------|
| P1 | VideoEncoder | 🔄 | ⬜ | ⬜ |
| P1 | VideoFrame | 🔄 | ⬜ | ⬜ |
| P1 | EncodedVideoChunk | ✅ | ⬜ | ⬜ |
| P2 | VideoDecoder | ⬜ | ⬜ | ⬜ |
| P3 | AudioEncoder | ⬜ | ⬜ | ⬜ |
| P3 | AudioDecoder | ⬜ | ⬜ | ⬜ |
| P3 | AudioData | ⬜ | ⬜ | ⬜ |
| P3 | EncodedAudioChunk | ⬜ | ⬜ | ⬜ |
| P4 | VideoColorSpace | ⬜ | ⬜ | ⬜ |
| P5 | ImageDecoder | ⬜ | ⬜ | ⬜ |

### Supported Codecs Target

**Video:**
- H.264/AVC (avc1.*)
- VP8 (vp8)
- VP9 (vp09.*)
- AV1 (av01.*)
- HEVC/H.265 (hev1.*, hvc1.*)

**Audio:**
- AAC (mp4a.40.*)
- Opus (opus)
- MP3 (mp3) - decode only
- FLAC (flac) - decode only

### Pixel Formats

- I420 (YUV 4:2:0 planar)
- NV12 (YUV 4:2:0 semi-planar)
- I422 (YUV 4:2:2 planar)
- I444 (YUV 4:4:4 planar)
- RGBA, RGBX, BGRA, BGRX (packed RGB)

### Audio Sample Formats

- u8, s16, s32, f32 (interleaved)
- u8-planar, s16-planar, s32-planar, f32-planar (planar)

## Source Reference

All documentation is based on the official W3C WebCodecs specification:
https://www.w3.org/TR/webcodecs/
