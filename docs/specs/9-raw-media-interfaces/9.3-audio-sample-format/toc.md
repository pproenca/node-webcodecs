# 9.3. Audio Sample Format

An audio sample format describes the numeric type used to represent a single sample (e.g. 32-bit floating point) and the arrangement of samples from different channels as either [interleaved](#interleaved) or [planar](#planar). The audio sample type refers solely to the numeric type and interval used to store the data, this is [`u8`](#dom-audiosampleformat-u8), [`s16`](#dom-audiosampleformat-s16), [`s32`](#dom-audiosampleformat-s32), or [`f32`](#dom-audiosampleformat-f32) for respectively unsigned 8-bits, signed 16-bits, signed 32-bits, and 32-bits floating point number. The [audio buffer arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md) refers solely to the way the samples are laid out in memory ([planar](#planar) or [interleaved](#interleaved)).

A sample refers to a single value that is the magnitude of a signal at a particular point in time in a particular channel.

A frame or (sample-frame) refers to a set of values of all channels of a multi-channel signal, that happen at the exact same time.

NOTE: Consequently, if an audio signal is mono (has only one channel), a frame and a sample refer to the same thing.

All audio [samples](#sample) in this specification are using linear pulse-code modulation (Linear PCM): quantization levels are uniform between values.

NOTE: The Web Audio API, that is expected to be used with this specification, also uses Linear PCM.

```webidl
enum AudioSampleFormat {
  "u8",
  "s16",
  "s32",
  "f32",
  "u8-planar",
  "s16-planar",
  "s32-planar",
  "f32-planar",
};
```
**u8**
: [8-bit unsigned integer](https://webidl.spec.whatwg.org/#idl-octet) [samples](#sample) with [interleaved](#interleaved) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**s16**
: [16-bit signed integer](https://webidl.spec.whatwg.org/#idl-short) [samples](#sample) with [interleaved](#interleaved) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**s32**
: [32-bit signed integer](https://webidl.spec.whatwg.org/#idl-long) [samples](#sample) with [interleaved](#interleaved) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**f32**
: [32-bit float](https://webidl.spec.whatwg.org/#idl-float) [samples](#sample) with [interleaved](#interleaved) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**u8-planar**
: [8-bit unsigned integer](https://webidl.spec.whatwg.org/#idl-octet) [samples](#sample) with [planar](#planar) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**s16-planar**
: [16-bit signed integer](https://webidl.spec.whatwg.org/#idl-short) [samples](#sample) with [planar](#planar) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**s32-planar**
: [32-bit signed integer](https://webidl.spec.whatwg.org/#idl-long) [samples](#sample) with [planar](#planar) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).

**f32-planar**
: [32-bit float](https://webidl.spec.whatwg.org/#idl-float) [samples](#sample) with [planar](#planar) [channel arrangement](../../9-raw-media-interfaces/9.3-audio-sample-format/9.3.1-arrangement-of-audio-buffer.md).
## Subsections

- [9.3.1. Arrangement of audio buffer](./9.3.1-arrangement-of-audio-buffer.md)
- [9.3.2. Magnitude of the audio samples](./9.3.2-magnitude-of-the-audio-samples.md)
- [9.3.3. Audio channel ordering](./9.3.3-audio-channel-ordering.md)


---

[← Back to 9. Raw Media Interfaces](../../9-raw-media-interfaces/TOC.md)
