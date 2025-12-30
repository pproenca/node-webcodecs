# node-webcodecs Project Overview

## Purpose
WebCodecs API implementation for Node.js using FFmpeg. Provides VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk, and audio equivalents that closely match the W3C WebCodecs specification.

## Tech Stack
- **Runtime**: Node.js 18+
- **Languages**: TypeScript (API layer) + C++ (native addon)
- **Build System**: cmake-js + TypeScript compiler
- **Native Bindings**: node-addon-api (NAPI v8)
- **Media Processing**: FFmpeg (libavcodec, libavutil, libswscale, libswresample)
- **C++ Standard**: C++17

## Prerequisites
- Node.js 18+
- FFmpeg libraries installed (libavcodec, libavutil, libswscale, libswresample)
- cmake and pkg-config
- C++ compiler supporting C++17

## Current Capabilities
- **Video**: H.264 encoding/decoding, RGBA pixel format
- **Audio**: AAC encoding/decoding
- Synchronous encoding/decoding (no AsyncWorker yet)

## Main API Classes
From `lib/index.ts`:
- `VideoEncoder` - Encodes VideoFrames to EncodedVideoChunks
- `VideoDecoder` - Decodes EncodedVideoChunks to VideoFrames
- `VideoFrame` - Raw video frame container
- `EncodedVideoChunk` - Encoded video data container
- `AudioEncoder` - Encodes AudioData to EncodedAudioChunks
- `AudioDecoder` - Decodes EncodedAudioChunks to AudioData
- `AudioData` - Raw audio data container
- `EncodedAudioChunk` - Encoded audio data container
