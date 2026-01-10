# Tasks: Add Raw Media Interfaces

## 1. Foundation Types

- [ ] 1.1 Add VideoPixelFormat enum to lib/types.ts (24 pixel formats per W3C spec 9.8)
- [ ] 1.2 Add AudioSampleFormat enum to lib/types.ts (8 sample formats per W3C spec 9.3)
- [ ] 1.3 Add PlaneLayout dictionary to lib/types.ts (offset, stride)
- [ ] 1.4 Add VideoColorPrimaries enum (bt709, bt470bg, smpte170m, bt2020, smpte432)
- [ ] 1.5 Add VideoTransferCharacteristics enum (bt709, smpte170m, iec61966-2-1, linear, pq, hlg)
- [ ] 1.6 Add VideoMatrixCoefficients enum (rgb, bt709, bt470bg, smpte170m, bt2020-ncl)
- [ ] 1.7 Add VideoColorSpaceInit dictionary type
- [ ] 1.8 Write type tests for all enums in test/types/raw-media-types.test-d.ts

## 2. VideoColorSpace Interface

- [ ] 2.1 Implement VideoColorSpace class with constructor accepting VideoColorSpaceInit
- [ ] 2.2 Add internal slots: [[primaries]], [[transfer]], [[matrix]], [[full range]]
- [ ] 2.3 Implement readonly attributes: primaries, transfer, matrix, fullRange
- [ ] 2.4 Implement toJSON() method returning VideoColorSpaceInit
- [ ] 2.5 Write unit tests for VideoColorSpace construction and attribute access
- [ ] 2.6 Write unit tests for toJSON() serialization

## 3. AudioData Interface

- [ ] 3.1 Review existing lib/audio-data.ts implementation against W3C spec 9.2
- [ ] 3.2 Verify AudioDataInit dictionary matches spec (format, sampleRate, numberOfFrames, numberOfChannels, timestamp, data, transfer)
- [ ] 3.3 Verify internal slots match spec ([[format]], [[sample rate]], [[number of frames]], [[number of channels]], [[timestamp]], [[duration]], [[resource reference]])
- [ ] 3.4 Verify readonly attributes: format, sampleRate, numberOfFrames, numberOfChannels, duration, timestamp
- [ ] 3.5 Verify allocationSize(options) method with AudioDataCopyToOptions
- [ ] 3.6 Verify copyTo(destination, options) method
- [ ] 3.7 Verify clone() method returns new AudioData referencing same media resource
- [ ] 3.8 Verify close() method clears [[resource reference]]
- [ ] 3.9 Add AudioDataCopyToOptions dictionary (planeIndex, frameOffset, frameCount, format)
- [ ] 3.10 Write unit tests for AudioData construction with various sample formats
- [ ] 3.11 Write unit tests for copyTo() with interleaved and planar formats
- [ ] 3.12 Write golden tests for AudioData memory lifecycle (clone/close)

## 4. VideoFrame Interface

- [ ] 4.1 Review existing lib/video-frame.ts implementation against W3C spec 9.4
- [ ] 4.2 Verify constructor overloads: (CanvasImageSource, VideoFrameInit?) and (AllowSharedBufferSource, VideoFrameBufferInit)
- [ ] 4.3 Verify VideoFrameInit dictionary (duration, timestamp, alpha, visibleRect, rotation, flip, displayWidth, displayHeight, metadata)
- [ ] 4.4 Verify VideoFrameBufferInit dictionary (format, codedWidth, codedHeight, timestamp, duration, layout, visibleRect, rotation, flip, displayWidth, displayHeight, colorSpace, transfer, metadata)
- [ ] 4.5 Verify internal slots match spec ([[format]], [[coded width]], [[coded height]], [[visible rect]], [[rotation]], [[flip]], [[display width]], [[display height]], [[duration]], [[timestamp]], [[color space]], [[resource reference]])
- [ ] 4.6 Verify readonly attributes: format, codedWidth, codedHeight, codedRect, visibleRect, rotation, flip, displayWidth, displayHeight, duration, timestamp, colorSpace
- [ ] 4.7 Verify metadata() method returns VideoFrameMetadata
- [ ] 4.8 Verify allocationSize(options?) method with VideoFrameCopyToOptions
- [ ] 4.9 Verify copyTo(destination, options?) returns Promise<PlaneLayout[]>
- [ ] 4.10 Verify clone() method returns new VideoFrame referencing same media resource
- [ ] 4.11 Verify close() method clears [[resource reference]]
- [ ] 4.12 Add VideoFrameCopyToOptions dictionary (rect, layout, format, colorSpace)
- [ ] 4.13 Write unit tests for VideoFrame construction with all pixel formats
- [ ] 4.14 Write unit tests for copyTo() with various layouts and formats
- [ ] 4.15 Write golden tests for VideoFrame memory lifecycle (clone/close)
- [ ] 4.16 Write tests for rotation and flip attribute handling

## 5. Memory Model Implementation

- [ ] 5.1 Verify resource reference counting in C++ layer (src/video_frame.cc, src/audio_data.cc)
- [ ] 5.2 Verify clone() creates shared reference to media resource
- [ ] 5.3 Verify close() releases reference and makes object unusable
- [ ] 5.4 Implement transfer semantics for cross-worker operations (if not present)
- [ ] 5.5 Implement serialization semantics (clone-like behavior)
- [ ] 5.6 Write stress tests for memory management under high load

## 6. Integration and Validation

- [ ] 6.1 Update exports in lib/index.ts for new types and classes
- [ ] 6.2 Run npm run lint to verify code style
- [ ] 6.3 Run npm test to verify all tests pass
- [ ] 6.4 Run npm run build to verify TypeScript compilation
- [ ] 6.5 Update JSDoc documentation with @example blocks for all public APIs
