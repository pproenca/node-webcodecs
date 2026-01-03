---
title: '7. Configurations'
---

> Section 7 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [7. Configurations](https://www.w3.org/TR/webcodecs/#configurations)

### [7.1. Check Configuration Support (with config)](https://www.w3.org/TR/webcodecs/#config-support)

1.  If the [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec is not a [valid codec string](https://www.w3.org/TR/webcodecs/#valid-codec-string) or is otherwise unrecognized by the User Agent, return `false`.
2.  If config is an [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) or [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) and the User Agent can’t provide a [codec](https://www.w3.org/TR/webcodecs/#codec) that can decode the exact profile (where present), level (where present), and constraint bits (where present) indicated by the [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec, return `false`.
3.  If config is an [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) or [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig):
    1.  If the [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec contains a profile and the User Agent can’t provide a [codec](https://www.w3.org/TR/webcodecs/#codec) that can encode the exact profile indicated by config.codec, return `false`.
    2.  If the [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec contains a level and the User Agent can’t provide a [codec](https://www.w3.org/TR/webcodecs/#codec) that can encode to a level less than or equal to the level indicated by config.codec, return `false`.
    3.  If the [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec contains constraint bits and the User Agent can’t provide a [codec](https://www.w3.org/TR/webcodecs/#codec) that can produce an encoded bitstream at least as constrained as indicated by config.codec, return `false`.

4.  If the User Agent can provide a [codec](https://www.w3.org/TR/webcodecs/#codec) to support all entries of the config, including applicable default values for keys that are not included, return `true`.

    NOTE: The types [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig), [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig), [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig), and [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) each define their respective configuration entries and defaults.

    NOTE: Support for a given configuration can change dynamically if the hardware is altered (e.g. external GPU unplugged) or if essential hardware resources are exhausted. User Agents describe support on a best-effort basis given the resources that are available at the time of the query.

5.  Otherwise, return false.

### [7.2. Clone Configuration (with config)](https://www.w3.org/TR/webcodecs/#clone-config)

NOTE: This algorithm will copy only the dictionary members that the User Agent recognizes as part of the dictionary type.

Run these steps:

1.  Let dictType be the type of dictionary config.
2.  Let clone be a new empty instance of dictType.
3.  For each dictionary member m defined on dictType:
    1.  If m does not [exist](https://infra.spec.whatwg.org/#map-exists) in config, then [continue](https://infra.spec.whatwg.org/#iteration-continue).
    2.  If `config[m]` is a nested dictionary, set `clone[m]` to the result of recursively running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with `config[m]`.
    3.  Otherwise, assign a copy of `config[m]` to `clone[m]`.

Note: This implements a "deep-copy". These configuration objects are frequently used as the input of asynchronous operations. Copying means that modifying the original object while the operation is in flight won’t change the operation’s outcome.

### [7.3. Signalling Configuration Support](https://www.w3.org/TR/webcodecs/#config-support-info)

#### [7.3.1. AudioDecoderSupport](https://www.w3.org/TR/webcodecs/#audio-decoder-support)

```webidl
dictionary AudioDecoderSupport {
  boolean supported;
  AudioDecoderConfig config;
};
```

**`supported`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

A boolean indicating the whether the corresponding [config](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-config) is supported by the User Agent.
**`config`, of type [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig)**

An [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) used by the User Agent in determining the value of [supported](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-supported).

#### [7.3.2. VideoDecoderSupport](https://www.w3.org/TR/webcodecs/#video-decoder-support)

```webidl
dictionary VideoDecoderSupport {
  boolean supported;
  VideoDecoderConfig config;
};
```

**`supported`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

A boolean indicating the whether the corresponding [config](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-config) is supported by the User Agent.
**`config`, of type [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig)**

A [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) used by the User Agent in determining the value of [supported](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-supported).

#### [7.3.3. AudioEncoderSupport](https://www.w3.org/TR/webcodecs/#audio-encoder-support)

```webidl
dictionary AudioEncoderSupport {
  boolean supported;
  AudioEncoderConfig config;
};
```

**`supported`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

A boolean indicating the whether the corresponding [config](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-config) is supported by the User Agent.
**`config`, of type [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig)**

An [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) used by the User Agent in determining the value of [supported](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-supported).

#### [7.3.4. VideoEncoderSupport](https://www.w3.org/TR/webcodecs/#video-encoder-support)

```webidl
dictionary VideoEncoderSupport {
  boolean supported;
  VideoEncoderConfig config;
};
```

**`supported`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

A boolean indicating the whether the corresponding [config](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-config) is supported by the User Agent.
**`config`, of type [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig)**

A [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) used by the User Agent in determining the value of [supported](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-supported).

### [7.4. Codec String](https://www.w3.org/TR/webcodecs/#config-codec-string)

A valid codec string _MUST_ meet the following conditions.

1.  Is valid per the relevant codec specification (see examples below).
2.  It describes a single codec.
3.  It is unambiguous about codec profile, level, and constraint bits for codecs that define these concepts.

NOTE: In other media specifications, codec strings historically accompanied a [MIME type](https://mimesniff.spec.whatwg.org/#mime-type) as the "codecs=" parameter ([isTypeSupported()](https://www.w3.org/TR/media-source-2/#dom-mediasource-istypesupported), [canPlayType()](https://html.spec.whatwg.org/multipage/media.html#dom-navigator-canplaytype)) [\[RFC6381\]](https://www.w3.org/TR/webcodecs/#biblio-rfc6381). In this specification, encoded media is not containerized; hence, only the value of the codecs parameter is accepted.

NOTE: Encoders for codecs that define level and constraint bits have flexibility around these parameters, but won’t produce bitstreams that have a higher level or are less constrained than requested.

The format and semantics for codec strings are defined by codec registrations listed in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry). A compliant implementation _MAY_ support any combination of codec registrations or none at all.

### [7.5. AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#audio-decoder-config)

```webidl
dictionary AudioDecoderConfig {
  required DOMString codec;
  [EnforceRange] required unsigned long sampleRate;
  [EnforceRange] required unsigned long numberOfChannels;
  AllowSharedBufferSource description;
};
```

To check if an [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) is a valid AudioDecoderConfig, run these steps:

1.  If [codec](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-codec) is empty after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace), return `false`.
2.  If [description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) is \[[detached](https://webidl.spec.whatwg.org/#buffersource-detached)\], return false.
3.  Return `true`.

**`codec`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

Contains a [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec describing the codec.
**`sampleRate`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of frame samples per second.
**`numberOfChannels`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of audio channels.
**`description`, of type [AllowSharedBufferSource](https://webidl.spec.whatwg.org/#AllowSharedBufferSource)**

A sequence of codec specific bytes, commonly known as extradata.

NOTE: The registrations in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry) describe whether/how to populate this sequence, corresponding to the provided [codec](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-codec).

### [7.6. VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#video-decoder-config)

```webidl
dictionary VideoDecoderConfig {
  required DOMString codec;
  AllowSharedBufferSource description;
  [EnforceRange] unsigned long codedWidth;
  [EnforceRange] unsigned long codedHeight;
  [EnforceRange] unsigned long displayAspectWidth;
  [EnforceRange] unsigned long displayAspectHeight;
  VideoColorSpaceInit colorSpace;
  HardwareAcceleration hardwareAcceleration = "no-preference";
  boolean optimizeForLatency;
  double rotation = 0;
  boolean flip = false;
};
```

To check if a [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) is a valid VideoDecoderConfig, run these steps:

1.  If [codec](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codec) is empty after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace), return `false`.
2.  If one of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedwidth) or [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedheight) is provided but the other isn’t, return `false`.
3.  If [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedwidth) = 0 or [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedheight) = 0, return `false`.
4.  If one of [displayAspectWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectwidth) or [displayAspectHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectheight) is provided but the other isn’t, return `false`.
5.  If [displayAspectWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectwidth) = 0 or [displayAspectHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectheight) = 0, return `false`.
6.  If [description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) is \[[detached](https://webidl.spec.whatwg.org/#buffersource-detached)\], return false.
7.  Return `true`.

**`codec`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

Contains a [codec string](https://www.w3.org/TR/webcodecs/#codec-string) describing the codec.
**`description`, of type [AllowSharedBufferSource](https://webidl.spec.whatwg.org/#AllowSharedBufferSource)**

A sequence of codec specific bytes, commonly known as extradata.

NOTE: The registrations in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry) describes whether/how to populate this sequence, corresponding to the provided [codec](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codec).
**`codedWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Width of the VideoFrame in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.
**`codedHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Height of the VideoFrame in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.

NOTE: [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedwidth) and [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-codedheight) are used when selecting a [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot).
**`displayAspectWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Horizontal dimension of the VideoFrame’s aspect ratio when displayed.
**`displayAspectHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Vertical dimension of the VideoFrame’s aspect ratio when displayed.

NOTE: [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-displaywidth) and [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-displayheight) can both be different from [displayAspectWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectwidth) and [displayAspectHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectheight), but have identical ratios, after scaling is applied when [creating the video frame](https://www.w3.org/TR/webcodecs/#create-a-videoframe).
**`colorSpace`, of type [VideoColorSpaceInit](https://www.w3.org/TR/webcodecs/#dictdef-videocolorspaceinit)**

Configures the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).[colorSpace](https://www.w3.org/TR/webcodecs/#dom-videoframe-colorspace) for [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)s associated with this [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig). If [colorSpace](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-colorspace) [exists](https://infra.spec.whatwg.org/#map-exists), the provided values will override any in-band values from the bitsream.
**`hardwareAcceleration`, of type [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration), defaulting to `"no-preference"`**

Hint that configures hardware acceleration for this codec. See [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration).
**`optimizeForLatency`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

Hint that the selected decoder _SHOULD_ be configured to minimize the number of [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s that have to be decoded before a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) is output.

NOTE: In addition to User Agent and hardware limitations, some codec bitstreams require a minimum number of inputs before any output can be produced.
**`rotation`, of type [double](https://webidl.spec.whatwg.org/#idl-double), defaulting to `0`**

Sets the [rotation](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation) attribute on decoded frames.
**`flip`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), defaulting to `false`**

Sets the [flip](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip) attribute on decoded frames.

### [7.7. AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#audio-encoder-config)

```webidl
dictionary AudioEncoderConfig {
  required DOMString codec;
  [EnforceRange] required unsigned long sampleRate;
  [EnforceRange] required unsigned long numberOfChannels;
  [EnforceRange] unsigned long long bitrate;
  BitrateMode bitrateMode = "variable";
};
```

NOTE: Codec-specific extensions to [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) are described in their registrations in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry).

To check if an [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) is a valid AudioEncoderConfig, run these steps:

1.  If [codec](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-codec) is empty after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace), return `false`.
2.  If the [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) has a codec-specific extension and the corresponding registration in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry) defines steps to check whether the extension is a valid extension, return the result of running those steps.
3.  If [sampleRate](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-samplerate) or [numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-numberofchannels) are equal to zero, return `false`.
4.  Return `true`.

**`codec`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

Contains a [codec string](https://www.w3.org/TR/webcodecs/#codec-string) describing the codec.
**`sampleRate`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of frame samples per second.
**`numberOfChannels`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of audio channels.
**`bitrate`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long)**

The average bitrate of the encoded audio given in units of bits per second.
**`bitrateMode`, of type [BitrateMode](https://www.w3.org/TR/mediastream-recording/#enumdef-bitratemode), defaulting to `"variable"`**

Configures the encoder to use a [constant](https://www.w3.org/TR/mediastream-recording/#dom-bitratemode-constant) or [variable](https://www.w3.org/TR/mediastream-recording/#dom-bitratemode-variable) bitrate as defined by [\[MEDIASTREAM-RECORDING\]](https://www.w3.org/TR/webcodecs/#biblio-mediastream-recording).

NOTE: Not all audio codecs support specific [BitrateMode](https://www.w3.org/TR/mediastream-recording/#enumdef-bitratemode)s, Authors are encouraged to check by calling [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-audioencoder-isconfigsupported) with config.

### [7.8. VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#video-encoder-config)

```webidl
dictionary VideoEncoderConfig {
  required DOMString codec;
  [EnforceRange] required unsigned long width;
  [EnforceRange] required unsigned long height;
  [EnforceRange] unsigned long displayWidth;
  [EnforceRange] unsigned long displayHeight;
  [EnforceRange] unsigned long long bitrate;
  double framerate;
  HardwareAcceleration hardwareAcceleration = "no-preference";
  AlphaOption alpha = "discard";
  DOMString scalabilityMode;
  VideoEncoderBitrateMode bitrateMode = "variable";
  LatencyMode latencyMode = "quality";
  DOMString contentHint;
};
```

NOTE: Codec-specific extensions to [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) are described in their registrations in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry).

To check if a [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) is a valid VideoEncoderConfig, run these steps:

1.  If [codec](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-codec) is empty after [stripping leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace), return `false`.
2.  If [width](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-width) = 0 or [height](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-height) = 0, return `false`.
3.  If [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-displaywidth) = 0 or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-displayheight) = 0, return `false`.
4.  Return `true`.

**`codec`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

Contains a [codec string](https://www.w3.org/TR/webcodecs/#codec-string) in config.codec describing the codec.
**`width`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The encoded width of output [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s in pixels, prior to any display aspect ratio adjustments.

The encoder _MUST_ scale any [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) whose [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot) differs from this value.
**`height`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The encoded height of output [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s in pixels, prior to any display aspect ratio adjustments.

The encoder _MUST_ scale any [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) whose [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) differs from this value.

**`displayWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The intended display width of output [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s in pixels. Defaults to [width](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-width) if not present.
**`displayHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The intended display height of output [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s in pixels. Defaults to [width](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-width) if not present.

NOTE: Providing a [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-displaywidth) or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-displayheight) that differs from [width](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-width) and [height](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-height) signals that chunks are to be scaled after decoding to arrive at the final display aspect ratio.

For many codecs this is merely pass-through information, but some codecs can sometimes include display sizing in the bitstream.

**`bitrate`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long)**

The average bitrate of the encoded video given in units of bits per second.

NOTE: Authors are encouraged to additionally provide a [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate) to inform rate control.
**`framerate`, of type [double](https://webidl.spec.whatwg.org/#idl-double)**

The expected frame rate in frames per second, if known. This value, along with the frame [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp), _SHOULD_ be used by the video encoder to calculate the optimal byte length for each encoded frame. Additionally, the value _SHOULD_ be considered a target deadline for outputting encoding chunks when [latencyMode](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-latencymode) is set to [realtime](https://www.w3.org/TR/webcodecs/#dom-latencymode-realtime).
**`hardwareAcceleration`, of type [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration), defaulting to `"no-preference"`**

Hint that configures hardware acceleration for this codec. See [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration).
**`alpha`, of type [AlphaOption](https://www.w3.org/TR/webcodecs/#enumdef-alphaoption), defaulting to `"discard"`**

Whether the alpha component of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) inputs _SHOULD_ be kept or discarded prior to encoding. If [alpha](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-alpha) is equal to [discard](https://www.w3.org/TR/webcodecs/#dom-alphaoption-discard), alpha data is always discarded, regardless of a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)’s [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
**`scalabilityMode`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

An encoding [scalability mode identifier](https://www.w3.org/TR/webrtc-svc/#scalabilitymodes*) as defined by [\[WebRTC-SVC\]](https://www.w3.org/TR/webcodecs/#biblio-webrtc-svc).
**`bitrateMode`, of type [VideoEncoderBitrateMode](https://www.w3.org/TR/webcodecs/#enumdef-videoencoderbitratemode), defaulting to `"variable"`**

Configures encoding to use one of the rate control modes specified by [VideoEncoderBitrateMode](https://www.w3.org/TR/webcodecs/#enumdef-videoencoderbitratemode).

NOTE: The precise degree of bitrate fluctuation in either mode is implementation defined.
**`latencyMode`, of type [LatencyMode](https://www.w3.org/TR/webcodecs/#enumdef-latencymode), defaulting to `"quality"`**

Configures latency related behaviors for this codec. See [LatencyMode](https://www.w3.org/TR/webcodecs/#enumdef-latencymode).
**`contentHint`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

An encoding [video content hint](https://www.w3.org/TR/mst-content-hint/#video-content-hints) as defined by [\[mst-content-hint\]](https://www.w3.org/TR/webcodecs/#biblio-mst-content-hint).

The User Agent _MAY_ use this hint to set expectations about incoming [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)s and to improve encoding quality. If using this hint:

- The User Agent _MUST_ respect other explicitly set encoding options when configuring the encoder, whether they are codec-specific encoding options or not.
- The User Agent _SHOULD_ make a best-effort attempt to use additional configuration options to improve encoding quality, according to the goals defined by the corresponding [video content hint](https://www.w3.org/TR/mst-content-hint/#video-content-hints).

NOTE: Some encoder options are implementation specific, and mappings between [contentHint](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-contenthint) and those options cannot be prescribed.

The User Agent _MUST NOT_ refuse the configuration if it doesn’t support this content hint. See [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-videoencoder-isconfigsupported).

### [7.9. Hardware Acceleration](https://www.w3.org/TR/webcodecs/#hardware-acceleration)

```webidl
enum HardwareAcceleration {
  "no-preference",
  "prefer-hardware",
  "prefer-software",
};
```

When supported, hardware acceleration offloads encoding or decoding to specialized hardware. [prefer-hardware](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-hardware) and [prefer-software](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-software) are hints. While User Agents _SHOULD_ respect these values when possible, User Agents may ignore these values in some or all circumstances for any reason.

To prevent fingerprinting, if a User Agent implements [\[media-capabilities\]](https://www.w3.org/TR/webcodecs/#biblio-media-capabilities), the User Agent _MUST_ ensure rejection or acceptance of a given [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration) preference reveals no additional information on top of what is inherent to the User Agent and revealed by [\[media-capabilities\]](https://www.w3.org/TR/webcodecs/#biblio-media-capabilities). If a User Agent does not implement [\[media-capabilities\]](https://www.w3.org/TR/webcodecs/#biblio-media-capabilities) for reasons of fingerprinting, they _SHOULD_ ignore the [HardwareAcceleration](https://www.w3.org/TR/webcodecs/#enumdef-hardwareacceleration) preference.

NOTE: Good examples of when a User Agent can ignore [prefer-hardware](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-hardware) or [prefer-software](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-software) are for reasons of user privacy or circumstances where the User Agent determines an alternative setting would better serve the end user.

Most authors will be best served by using the default of [no-preference](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-no-preference). This gives the User Agent flexibility to optimize based on its knowledge of the system and configuration. A common strategy will be to prioritize hardware acceleration at higher resolutions with a fallback to software codecs if hardware acceleration fails.

Authors are encouraged to carefully weigh the tradeoffs when setting a hardware acceleration preference. The precise tradeoffs will be device-specific, but authors can generally expect the following:

- Setting a value of [prefer-hardware](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-hardware) or [prefer-software](https://www.w3.org/TR/webcodecs/#dom-hardwareacceleration-prefer-software) can significantly restrict what configurations are supported. It can occur that the user’s device does not offer acceleration for any codec, or only for the most common profiles of older codecs. It can also occur that a given User Agent lacks a software based codec implementation.
- Hardware acceleration does not simply imply faster encoding / decoding. Hardware acceleration often has higher startup latency but more consistent throughput performance. Acceleration will generally reduce CPU load.
- For decoding, hardware acceleration is often less robust to inputs that are mislabeled or violate the relevant codec specification.
- Hardware acceleration will often be more power efficient than purely software based codecs.
- For lower resolution content, the overhead added by hardware acceleration can yield decreased performance and power efficiency compared to purely software based codecs.

Given these tradeoffs, a good example of using "prefer-hardware" would be if an author intends to provide their own software based fallback via WebAssembly.

Alternatively, a good example of using "prefer-software" would be if an author is especially sensitive to the higher startup latency or decreased robustness generally associated with hardware acceleration.

**`no-preference`**

Indicates that the User Agent _MAY_ use hardware acceleration if it is available and compatible with other aspects of the codec configuration.
**`prefer-software`**

Indicates that the User Agent _SHOULD_ prefer a software codec implementation. User Agents may ignore this value for any reason.

NOTE: This can cause the configuration to be unsupported on platforms where an unaccelerated codec is unavailable or is incompatible with other aspects of the codec configuration.
**`prefer-hardware`**

Indicates that the User Agent _SHOULD_ prefer hardware acceleration. User Agents may ignore this value for any reason.

NOTE: This can cause the configuration to be unsupported on platforms where an accelerated codec is unavailable or is incompatible with other aspects of the codec configuration.

### [7.10. Alpha Option](https://www.w3.org/TR/webcodecs/#alpha-option)

```webidl
enum AlphaOption {
  "keep",
  "discard",
};
```

Describes how the user agent _SHOULD_ behave when dealing with alpha channels, for a variety of different operations.

**`keep`**

Indicates that the user agent _SHOULD_ preserve alpha channel data for [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)s, if it is present.
**`discard`**

Indicates that the user agent _SHOULD_ ignore or remove [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)’s alpha channel data.

### [7.11. Latency Mode](https://www.w3.org/TR/webcodecs/#latency-mode)

```webidl
enum LatencyMode {
  "quality",
  "realtime"
};
```

**`quality`**

Indicates that the User Agent _SHOULD_ optimize for encoding quality. In this mode:

- User Agents _MAY_ increase encoding latency to improve quality.
- User Agents _MUST_ not drop frames to achieve the target [bitrate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-bitrate) and/or [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate).
- [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate) _SHOULD_ not be used as a target deadline for emitting encoded chunks.
  **`realtime`**

Indicates that the User Agent _SHOULD_ optimize for low latency. In this mode:

- User Agents _MAY_ sacrifice quality to improve latency.
- User Agents _MAY_ drop frames to achieve the target [bitrate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-bitrate) and/or [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate).
- [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate) _SHOULD_ be used as a target deadline for emitting encoded chunks.

### [7.12. Configuration Equivalence](https://www.w3.org/TR/webcodecs/#config-equivalence)

equal dictionaries

### [7.13. VideoEncoderEncodeOptions](https://www.w3.org/TR/webcodecs/#video-encoder-options)

```webidl
dictionary VideoEncoderEncodeOptions {
  boolean keyFrame = false;
};
```

NOTE: Codec-specific extensions to [VideoEncoderEncodeOptions](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions) are described in their registrations in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry).

**`keyFrame`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), defaulting to `false`**

A value of `true` indicates that the given frame _MUST_ be encoded as a key frame. A value of `false` indicates that the User Agent has flexibility to decide whether the frame will be encoded as a [key frame](https://www.w3.org/TR/webcodecs/#key-chunk).

### [7.14. VideoEncoderBitrateMode](https://www.w3.org/TR/webcodecs/#video-encoder-bitrate-mode)

```webidl
enum VideoEncoderBitrateMode {
  "constant",
  "variable",
  "quantizer"
};
```

**`constant`**

Encode at a constant bitrate. See [bitrate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-bitrate).
**`variable`**

Encode using a variable bitrate, allowing more space to be used for complex signals and less space for less complex signals. See [bitrate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-bitrate).
**`quantizer`**

Encode using a quantizer, that is specified for each video frame in codec specific extensions of [VideoEncoderEncodeOptions](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions).

### [7.15. CodecState](https://www.w3.org/TR/webcodecs/#codec-state)

```webidl
enum CodecState {
  "unconfigured",
  "configured",
  "closed"
};
```

**`unconfigured`**

The codec is not configured for encoding or decoding.
**`configured`**

A valid configuration has been provided. The codec is ready for encoding or decoding.
**`closed`**

The codec is no longer usable and underlying [system resources](https://www.w3.org/TR/webcodecs/#system-resources) have been released.

### [7.16. WebCodecsErrorCallback](https://www.w3.org/TR/webcodecs/#error-callback)

```webidl
callback WebCodecsErrorCallback = undefined(DOMException error);
```
