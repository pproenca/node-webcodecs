# TODO

## Native Layer - Audio (`src/audio_data.cc`)

- [x] Handle options for partial copy or format conversion (line 224) - DONE
- [x] Handle options for planeIndex, frameOffset, frameCount, format (line 243) - DONE

## Native Layer - Video (`src/video_decoder.cc`)

- [x] Implement proper queue size tracking (line 266) - DONE (also AudioEncoder, AudioDecoder)

## TypeScript (`src/index.ts`)

- [ ] Add more examples (line 26)

## Library (`lib/index.ts`)

- [ ] W3C spec requires VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder (line 5)
- [ ] VideoFrame constructor from CanvasImageSource not supported - Node.js limitation (line 7)
- [x] visibleRect cropping not fully implemented in native layer (line 8) - DONE
- [x] ArrayBuffer transfer semantics not implemented (line 9) - DONE
- [ ] High bit-depth pixel formats (P10/P12 variants) not supported in native layer (line 10)

## Types (`lib/types.ts`)

- [x] EventTarget inheritance not implemented for VideoEncoder (line 805) - DONE
- [x] EventTarget inheritance not implemented for VideoDecoder (line 830) - DONE
- [x] EventTarget inheritance not implemented for AudioEncoder (line 855) - DONE
- [x] EventTarget inheritance not implemented for AudioDecoder (line 880) - DONE
- [ ] CanvasImageSource constructor not supported in Node.js (line 933)
