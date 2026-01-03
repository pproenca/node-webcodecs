# Supported Codecs

This project implements the WebCodecs API on top of FFmpeg. The WebCodecs
spec defines codec string formats, but it does not guarantee that any specific
codec is available on a given platform. This document defines what this project
intends to support for its prebuilt binaries.

Always use the runtime checks (`VideoEncoder.isConfigSupported`,
`VideoDecoder.isConfigSupported`, `AudioEncoder.isConfigSupported`,
`AudioDecoder.isConfigSupported`) to confirm support for a specific profile,
level, and configuration.

## Guaranteed for prebuilt binaries

These are the codecs we explicitly build and test for in prebuilt artifacts:

### Video

- VP8 (`vp8`)
- VP9 (`vp09.*`)
- AV1 (`av01.*`)
- H.264/AVC (`avc1.*`, `avc3.*`)
- H.265/HEVC (`hvc1.*`, `hev1.*`)

### Audio

- Opus (`opus`)
- MP3 (`mp3`)
- AAC-LC (`mp4a.40.2`)
- FLAC (`flac`)

## Notes and caveats

- This project bundles FFmpeg builds with GPL-enabled codecs (x264/x265). The
  resulting binaries are GPL-licensed; see `packages/node-webcodecs/package.json`
  for the current license declaration.
- To build an LGPL-only variant, set `FFMPEG_GPL=0` when building FFmpeg. This
  removes H.264/H.265 encoders from the build. Update your support expectations
  accordingly.
- Codec string details (profiles, levels, bit depth, chroma subsampling) matter.
  Use `isConfigSupported` to validate the exact configuration you plan to use.
- If you build from source or use a system FFmpeg, the available codecs may
  differ. In that case, this list does not apply.
