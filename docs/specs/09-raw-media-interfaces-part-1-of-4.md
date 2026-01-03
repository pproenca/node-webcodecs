---
title: '9. Raw Media Interfaces (Part 1 of 4)'
---

> Section 9 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 1 of 4**

---

## [9. Raw Media Interfaces](https://www.w3.org/TR/webcodecs/#raw-media-interfaces)

### [9.1. Memory Model](https://www.w3.org/TR/webcodecs/#raw-media-memory-model)

#### [9.1.1. Background](https://www.w3.org/TR/webcodecs/#raw-media-memory-model-background)

This section is non-normative.

Decoded media data _MAY_ occupy a large amount of system memory. To minimize the need for expensive copies, this specification defines a scheme for reference counting (`clone()` and `close()`).

NOTE: Authors are encouraged to call `close()` immediately when frames are no longer needed.

#### [9.1.2. Reference Counting](https://www.w3.org/TR/webcodecs/#raw-media-memory-model-reference-counting)

A media resource is storage for the actual pixel data or the audio sample data described by a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) or [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot) and [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot) internal slots hold a reference to a [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

[VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).[clone()](https://www.w3.org/TR/webcodecs/#dom-videoframe-clone) and [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).[clone()](https://www.w3.org/TR/webcodecs/#dom-audiodata-clone) return new objects whose `[[resource reference]]` points to the same [media resource](https://www.w3.org/TR/webcodecs/#media-resource) as the original object.

[VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).[close()](https://www.w3.org/TR/webcodecs/#dom-videoframe-close) and [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).[close()](https://www.w3.org/TR/webcodecs/#dom-audiodata-close) will clear their `[[resource reference]]` slot, releasing the reference their [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

A [media resource](https://www.w3.org/TR/webcodecs/#media-resource) _MUST_ remain alive at least as long as it continues to be referenced by a `[[resource reference]]`.

NOTE: When a [media resource](https://www.w3.org/TR/webcodecs/#media-resource) is no longer referenced by a `[[resource reference]]`, the resource can be destroyed. User Agents are encouraged to destroy such resources quickly to reduce memory pressure and facilitate resource reuse.

#### [9.1.3. Transfer and Serialization](https://www.w3.org/TR/webcodecs/#raw-media-serialization-and-transfer)

This section is non-normative.

[AudioData](https://www.w3.org/TR/webcodecs/#audiodata) and [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) are both [transferable](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects) and [serializable](https://html.spec.whatwg.org/multipage/structured-data.html#serializable-objects) objects. Their transfer and serialization steps are defined in [§ 9.2.6 Transfer and Serialization](https://www.w3.org/TR/webcodecs/#audiodata-transfer-serialization) and [§ 9.4.7 Transfer and Serialization](https://www.w3.org/TR/webcodecs/#videoframe-transfer-serialization) respectively.

Transferring an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) or [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) moves its `[[resource reference]]` to the destination object and closes (as in [close()](https://www.w3.org/TR/webcodecs/#dom-audiodata-close)) the source object. Authors _MAY_ use this facility to move an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) or [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) between realms without copying the underlying [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

Serializing an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) or [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) effectively clones (as in [clone()](https://www.w3.org/TR/webcodecs/#dom-videoframe-clone)) the source object, resulting in two objects that reference the same [media resource](https://www.w3.org/TR/webcodecs/#media-resource). Authors _MAY_ use this facility to clone an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) or [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) to another realm without copying the underlying [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

### [9.2. AudioData Interface](https://www.w3.org/TR/webcodecs/#audiodata-interface)

```webidl
[Exposed=(Window,DedicatedWorker), Serializable, Transferable]
interface AudioData {
  constructor(AudioDataInit init);

  readonly attribute AudioSampleFormat? format;
  readonly attribute float sampleRate;
  readonly attribute unsigned long numberOfFrames;
  readonly attribute unsigned long numberOfChannels;
  readonly attribute unsigned long long duration;  // microseconds
  readonly attribute long long timestamp;          // microseconds

  unsigned long allocationSize(AudioDataCopyToOptions options);
  undefined copyTo(AllowSharedBufferSource destination, AudioDataCopyToOptions options);
  AudioData clone();
  undefined close();
};

dictionary AudioDataInit {
  required AudioSampleFormat format;
  required float sampleRate;
  [EnforceRange] required unsigned long numberOfFrames;
  [EnforceRange] required unsigned long numberOfChannels;
  [EnforceRange] required long long timestamp;  // microseconds
  required BufferSource data;
  sequence<ArrayBuffer> transfer = [];
};
```

#### [9.2.1. Internal Slots](https://www.w3.org/TR/webcodecs/#audiodata-internal-slots)

**`[[resource reference]]`**

A reference to a [media resource](https://www.w3.org/TR/webcodecs/#media-resource) that stores the audio sample data for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).
**`[[format]]`**

The [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) used by this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata). Will be `null` whenever the underlying format does not map to an [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) or when [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`.
**`[[sample rate]]`**

The sample-rate, in Hz, for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).
**`[[number of frames]]`**

The number of [frames](https://www.w3.org/TR/webcodecs/#frame) for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).
**`[[number of channels]]`**

The number of audio channels for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).
**`[[timestamp]]`**

The presentation timestamp, in microseconds, for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

#### [9.2.2. Constructors](https://www.w3.org/TR/webcodecs/#audiodata-constructors)

`AudioData(init)`

1.  If init is not a [valid AudioDataInit](https://www.w3.org/TR/webcodecs/#valid-audiodatainit), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-transfer) contains more than one reference to the same [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer), then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-transfer):
    1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

4.  Let frame be a new [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) object, initialized as follows:
    1.  Assign `false` to [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached).
    2.  Assign init.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-format) to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
    3.  Assign init.[sampleRate](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-samplerate) to [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot).
    4.  Assign init.[numberOfFrames](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofframes) to [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot).
    5.  Assign init.[numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofchannels) to [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot).
    6.  Assign init.[timestamp](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-timestamp) to [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-timestamp-slot).
    7.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-transfer) contains an [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer) referenced by init.[data](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-data) the User Agent _MAY_ choose to:
        1.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referencing sample data in data.

    8.  Otherwise:
        1.  Let resource be a [media resource](https://www.w3.org/TR/webcodecs/#media-resource) containing a copy of init.[data](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-data).

    9.  Let resourceReference be a reference to resource.
    10. Assign resourceReference to [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).

5.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-transfer):
    1.  Perform [DetachArrayBuffer](https://tc39.es/ecma262/#sec-detacharraybuffer) on transferable

6.  Return frame.

#### [9.2.3. Attributes](https://www.w3.org/TR/webcodecs/#audiodata-attributes)

**`format`, of type [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat), readonly, nullable**

The [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) used by this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata). Will be `null` whenever the underlying format does not map to a [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) or when [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`.

The [format](https://www.w3.org/TR/webcodecs/#dom-audiodata-format) getter steps are to return [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
**`sampleRate`, of type [float](https://webidl.spec.whatwg.org/#idl-float), readonly**

The sample-rate, in Hz, for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [sampleRate](https://www.w3.org/TR/webcodecs/#dom-audiodata-samplerate) getter steps are to return [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot).
**`numberOfFrames`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

The number of [frames](https://www.w3.org/TR/webcodecs/#frame) for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [numberOfFrames](https://www.w3.org/TR/webcodecs/#dom-audiodata-numberofframes) getter steps are to return [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot).
**`numberOfChannels`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

The number of audio channels for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodata-numberofchannels) getter steps are to return [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot).
**`timestamp`, of type [long long](https://webidl.spec.whatwg.org/#idl-long-long), readonly**

The presentation timestamp, in microseconds, for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodata-numberofchannels) getter steps are to return [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-timestamp-slot).
**`duration`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long), readonly**

The duration, in microseconds, for this [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

The [duration](https://www.w3.org/TR/webcodecs/#dom-audiodata-duration) getter steps are to:

1.  Let microsecondsPerSecond be `1,000,000`.
2.  Let durationInSeconds be the result of dividing [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot) by [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot).
3.  Return the product of durationInSeconds and microsecondsPerSecond.

#### [9.2.4. Methods](https://www.w3.org/TR/webcodecs/#audiodata-methods)

**`allocationSize(options)`**

Returns the number of bytes required to hold the samples as described by options.

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Let copyElementCount be the result of running the [Compute Copy Element Count](https://www.w3.org/TR/webcodecs/#compute-copy-element-count) algorithm with options.
3.  Let destFormat be the value of [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
4.  If options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) [exists](https://infra.spec.whatwg.org/#map-exists), assign options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) to destFormat.
5.  Let bytesPerSample be the number of bytes per sample, as defined by the destFormat.
6.  Return the product of multiplying bytesPerSample by copyElementCount.
    **`copyTo(destination, options)`**

Copies the samples from the specified plane of the [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) to the destination buffer.

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Let copyElementCount be the result of running the [Compute Copy Element Count](https://www.w3.org/TR/webcodecs/#compute-copy-element-count) algorithm with options.
3.  Let destFormat be the value of [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
4.  If options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) [exists](https://infra.spec.whatwg.org/#map-exists), assign options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) to destFormat.
5.  Let bytesPerSample be the number of bytes per sample, as defined by the destFormat.
6.  If the product of multiplying bytesPerSample by copyElementCount is greater than `destination.byteLength`, throw a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror).
7.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
8.  Let planeFrames be the region of resource corresponding to options.[planeIndex](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-planeindex).
9.  Copy elements of planeFrames into destination, starting with the [frame](https://www.w3.org/TR/webcodecs/#frame) positioned at options.[frameOffset](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-frameoffset) and stopping after copyElementCount samples have been copied. If destFormat does not equal [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot), convert elements to the destFormat [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) while making the copy.
    **`clone()`**

Creates a new AudioData with a reference to the same [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Return the result of running the [Clone AudioData](https://www.w3.org/TR/webcodecs/#clone-audiodata) algorithm with [this](https://webidl.spec.whatwg.org/#this).
    **`close()`**

Clears all state and releases the reference to the [media resource](https://www.w3.org/TR/webcodecs/#media-resource). Close is final.

When invoked, run the [Close AudioData](https://www.w3.org/TR/webcodecs/#close-audiodata) algorithm with [this](https://webidl.spec.whatwg.org/#this).

#### [9.2.5. Algorithms](https://www.w3.org/TR/webcodecs/#audiodata-algorithms)

#### Compute Copy Element Count (with options)

Run these steps:

1.  Let destFormat be the value of [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
2.  If options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) [exists](https://infra.spec.whatwg.org/#map-exists), assign options.[format](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-format) to destFormat.
3.  If destFormat describes an [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) and options.[planeIndex](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-planeindex) is greater than `0`, throw a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror).
4.  Otherwise, if destFormat describes a [planar](https://www.w3.org/TR/webcodecs/#planar) [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) and if options.[planeIndex](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-planeindex) is greater or equal to [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot), throw a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror).
5.  If [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot) does not equal destFormat and the User Agent does not support the requested [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) conversion, throw a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException). Conversion to [f32-planar](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32-planar) _MUST_ always be supported.
6.  Let frameCount be the number of frames in the plane identified by options.[planeIndex](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-planeindex).
7.  If options.[frameOffset](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-frameoffset) is greater than or equal to frameCount, throw a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror).
8.  Let copyFrameCount be the difference of subtracting options.[frameOffset](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-frameoffset) from frameCount.
9.  If options.[frameCount](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-framecount) [exists](https://infra.spec.whatwg.org/#map-exists):
    1.  If options.[frameCount](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-framecount) is greater than copyFrameCount, throw a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror).
    2.  Otherwise, assign options.[frameCount](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-framecount) to copyFrameCount.

10. Let elementCount be copyFrameCount.
11. If destFormat describes an [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat), multiply elementCount by [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot)
12. return elementCount.

#### Clone AudioData (with data)

Run these steps:

1.  Let clone be a new [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) initialized as follows:
    1.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by data’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
    2.  Let reference be a new reference to resource.
    3.  Assign reference to [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
    4.  Assign the values of data’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached), [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot), [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot), [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot), [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot), and [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-timestamp-slot) slots to the corresponding slots in clone.

2.  Return clone.

#### Close AudioData (with data)

Run these steps:

1.  Assign `true` to data’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot.
2.  Assign `null` to data’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
3.  Assign `0` to data’s [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot).
4.  Assign `0` to data’s [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot).
5.  Assign `0` to data’s [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot).
6.  Assign `null` to data’s [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).

#### To check if a [AudioDataInit](https://www.w3.org/TR/webcodecs/#dictdef-audiodatainit) is a valid AudioDataInit, run these steps:

1.  If [sampleRate](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-samplerate) less than or equal to `0`, return `false`.
2.  If [numberOfFrames](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofframes) = `0`, return `false`.
3.  If [numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofchannels) = `0`, return `false`.
4.  Verify [data](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-data) has enough data by running the following steps:
    1.  Let totalSamples be the product of multiplying [numberOfFrames](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofframes) by [numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-numberofchannels).
    2.  Let bytesPerSample be the number of bytes per sample, as defined by the [format](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-format).
    3.  Let totalSize be the product of multiplying bytesPerSample with totalSamples.
    4.  Let dataSize be the size in bytes of [data](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-data).
    5.  If dataSize is less than totalSize, return false.

5.  Return `true`.

Note: It’s expected that [AudioDataInit](https://www.w3.org/TR/webcodecs/#dictdef-audiodatainit)’s [data](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-data)’s memory layout matches the expectations of the [planar](https://www.w3.org/TR/webcodecs/#planar) or [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [format](https://www.w3.org/TR/webcodecs/#dom-audiodatainit-format). There is no real way to verify whether the samples conform to their [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat).

#### [9.2.6. Transfer and Serialization](https://www.w3.org/TR/webcodecs/#audiodata-transfer-serialization)

**The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) [transfer steps](https://html.spec.whatwg.org/multipage/structured-data.html#transfer-steps) (with value and dataHolder) are:**

1.  If value’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  For all [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) internal slots in value, assign the value of each internal slot to a field in dataHolder with the same name as the internal slot.
3.  Run the [Close AudioData](https://www.w3.org/TR/webcodecs/#close-audiodata) algorithm with value.
    **The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) [transfer-receiving steps](https://html.spec.whatwg.org/multipage/structured-data.html#transfer-receiving-steps) (with dataHolder and value) are:**

4.  For all named fields in dataHolder, assign the value of each named field to the [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) internal slot in value with the same name as the named field.
    **The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) [serialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#serialization-steps) (with value, serialized, and forStorage) are:**

5.  If value’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
6.  If forStorage is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror).
7.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by value’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
8.  Let newReference be a new reference to resource.
9.  Assign newReference to |serialized.resource reference|.
10. For all remaining [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) internal slots (excluding [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot)) in value, assign the value of each internal slot to a field in serialized with the same name as the internal slot.
    **The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) [deserialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#deserialization-steps) (with serialized and value) are:**

11. For all named fields in serialized, assign the value of each named field to the [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) internal slot in value with the same name as the named field.

#### [9.2.7. AudioDataCopyToOptions](https://www.w3.org/TR/webcodecs/#audiodata-copy-to-options)

```webidl
dictionary AudioDataCopyToOptions {
  [EnforceRange] required unsigned long planeIndex;
  [EnforceRange] unsigned long frameOffset = 0;
  [EnforceRange] unsigned long frameCount;
  AudioSampleFormat format;
};
```

**`planeIndex`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The index identifying the plane to copy from.
**`frameOffset`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), defaulting to `0`**

An offset into the source plane data indicating which [frame](https://www.w3.org/TR/webcodecs/#frame) to begin copying from. Defaults to `0`.
**`frameCount`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of [frames](https://www.w3.org/TR/webcodecs/#frame) to copy. If not provided, the copy will include all [frames](https://www.w3.org/TR/webcodecs/#frame) in the plane beginning with [frameOffset](https://www.w3.org/TR/webcodecs/#dom-audiodatacopytooptions-frameoffset).
**`format`, of type [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat)**

The output [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) for the destination data. If not provided, the resulting copy will use [this](https://webidl.spec.whatwg.org/#this) AudioData’s [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot). Invoking [copyTo()](https://www.w3.org/TR/webcodecs/#dom-audiodata-copyto) will throw a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if conversion to the requested format is not supported. Conversion from any [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) to [f32-planar](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32-planar) _MUST_ always be supported.

NOTE: Authors seeking to integrate with [\[WEBAUDIO\]](https://www.w3.org/TR/webcodecs/#biblio-webaudio) can request [f32-planar](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32-planar) and use the resulting copy to create and [AudioBuffer](https://www.w3.org/TR/webaudio-1.1/#AudioBuffer) or render via [AudioWorklet](https://www.w3.org/TR/webaudio-1.1/#AudioWorklet).

### [9.3. Audio Sample Format](https://www.w3.org/TR/webcodecs/#audio-sample-formats)

An audio sample format describes the numeric type used to represent a single sample (e.g. 32-bit floating point) and the arrangement of samples from different channels as either [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) or [planar](https://www.w3.org/TR/webcodecs/#planar). The audio sample type refers solely to the numeric type and interval used to store the data, this is [u8](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-u8), [s16](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s16), [s32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s32), or [f32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32) for respectively unsigned 8-bits, signed 16-bits, signed 32-bits, and 32-bits floating point number. The [audio buffer arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement) refers solely to the way the samples are laid out in memory ([planar](https://www.w3.org/TR/webcodecs/#planar) or [interleaved](https://www.w3.org/TR/webcodecs/#interleaved)).

A sample refers to a single value that is the magnitude of a signal at a particular point in time in a particular channel.

A frame or (sample-frame) refers to a set of values of all channels of a multi-channel signal, that happen at the exact same time.

NOTE: Consequently, if an audio signal is mono (has only one channel), a frame and a sample refer to the same thing.

All audio [samples](https://www.w3.org/TR/webcodecs/#sample) in this specification are using linear pulse-code modulation (Linear PCM): quantization levels are uniform between values.

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

**`u8`**

[8-bit unsigned integer](https://webidl.spec.whatwg.org/#idl-octet) [samples](https://www.w3.org/TR/webcodecs/#sample) with [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`s16`**

[16-bit signed integer](https://webidl.spec.whatwg.org/#idl-short) [samples](https://www.w3.org/TR/webcodecs/#sample) with [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`s32`**

[32-bit signed integer](https://webidl.spec.whatwg.org/#idl-long) [samples](https://www.w3.org/TR/webcodecs/#sample) with [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`f32`**

[32-bit float](https://webidl.spec.whatwg.org/#idl-float) [samples](https://www.w3.org/TR/webcodecs/#sample) with [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`u8-planar`**

[8-bit unsigned integer](https://webidl.spec.whatwg.org/#idl-octet) [samples](https://www.w3.org/TR/webcodecs/#sample) with [planar](https://www.w3.org/TR/webcodecs/#planar) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`s16-planar`**

[16-bit signed integer](https://webidl.spec.whatwg.org/#idl-short) [samples](https://www.w3.org/TR/webcodecs/#sample) with [planar](https://www.w3.org/TR/webcodecs/#planar) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`s32-planar`**

[32-bit signed integer](https://webidl.spec.whatwg.org/#idl-long) [samples](https://www.w3.org/TR/webcodecs/#sample) with [planar](https://www.w3.org/TR/webcodecs/#planar) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).
**`f32-planar`**

[32-bit float](https://webidl.spec.whatwg.org/#idl-float) [samples](https://www.w3.org/TR/webcodecs/#sample) with [planar](https://www.w3.org/TR/webcodecs/#planar) [channel arrangement](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement).

#### [9.3.1. Arrangement of audio buffer](https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement)

When an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) has an [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) that is interleaved, the audio samples from different channels are laid out consecutively in the same buffer, in the order described in the section [§ 9.3.3 Audio channel ordering](https://www.w3.org/TR/webcodecs/#audio-channel-ordering). The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) has a single plane, that contains a number of elements therefore equal to [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot) \* [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot).

When an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) has an [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat) that is planar, the audio samples from different channels are laid out in different buffers, themselves arranged in an order described in the section [§ 9.3.3 Audio channel ordering](https://www.w3.org/TR/webcodecs/#audio-channel-ordering). The [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) has a number of planes equal to the [AudioData](https://www.w3.org/TR/webcodecs/#audiodata)’s [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot). Each plane contains [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot) elements.

NOTE: The [Web Audio API](https://www.w3.org/TR/webcodecs/#biblio-webaudio) currently uses [f32-planar](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32-planar) exclusively.

NOTE: The following diagram exemplifies the memory layout of [planar](https://www.w3.org/TR/webcodecs/#planar) versus [interleaved](https://www.w3.org/TR/webcodecs/#interleaved) [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat)s

![Graphical representation the memory layout of interleaved and planar
formats](images/planar_interleaved.svg)

#### [9.3.2. Magnitude of the audio samples](https://www.w3.org/TR/webcodecs/#audio-samples-magnitude)

The minimum value and maximum value of an audio sample, for a particular audio sample type, are the values below which (respectively above which) audio clipping might occur. They are otherwise regular types, that can hold values outside this interval during intermediate processing.

The bias value for an audio sample type is the value that often corresponds to the middle of the range (but often the range is not symmetrical). An audio buffer comprised only of values equal to the [bias value](https://www.w3.org/TR/webcodecs/#bias-value) is silent.

[Sample type](https://www.w3.org/TR/webcodecs/#audio-sample-type)

IDL type

[Minimum value](https://www.w3.org/TR/webcodecs/#minimum-value)

[Bias value](https://www.w3.org/TR/webcodecs/#bias-value)

[Maximum value](https://www.w3.org/TR/webcodecs/#maximum-value)

[u8](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-u8)

[octet](https://webidl.spec.whatwg.org/#idl-octet)

0

128

+255

[s16](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s16)

[short](https://webidl.spec.whatwg.org/#idl-short)

\-32768

0

+32767

[s32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s32)

[long](https://webidl.spec.whatwg.org/#idl-long)

\-2147483648

0

+2147483647

[f32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32)

[float](https://webidl.spec.whatwg.org/#idl-float)

\-1.0

0.0

+1.0

NOTE: There is no data type that can hold 24 bits of information conveniently, but audio content using 24-bit samples is common, so 32-bits integers are commonly used to hold 24-bit content.

[AudioData](https://www.w3.org/TR/webcodecs/#audiodata) containing 24-bit samples _SHOULD_ store those samples in [s32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s32) or [f32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32). When samples are stored in [s32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s32), each sample _MUST_ be left-shifted by `8` bits. By virtue of this process, samples outside of the valid 24-bit range (\[-8388608, +8388607\]) will be clipped. To avoid clipping and ensure lossless transport, samples _MAY_ be converted to [f32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32).

NOTE: While clipping is unavoidable in [u8](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-u8), [s16](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s16), and [s32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-s32) samples due to their storage types, implementations _SHOULD_ take care not to clip internally when handling [f32](https://www.w3.org/TR/webcodecs/#dom-audiosampleformat-f32) samples.

#### [9.3.3. Audio channel ordering](https://www.w3.org/TR/webcodecs/#audio-channel-ordering)

When decoding, the ordering of the audio channels in the resulting [AudioData](https://www.w3.org/TR/webcodecs/#audiodata) _MUST_ be the same as what is present in the [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk).

When encoding, the ordering of the audio channels in the resulting [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) _MUST_ be the same as what is preset in the given [AudioData](https://www.w3.org/TR/webcodecs/#audiodata).

In other terms, no channel reordering is performed when encoding and decoding.

NOTE: The container either implies or specifies the channel mapping: the channel attributed to a particular channel index.

### [9.4. VideoFrame Interface](https://www.w3.org/TR/webcodecs/#videoframe-interface)

NOTE: [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) is a [CanvasImageSource](https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource). A [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) can be passed to any method accepting a [CanvasImageSource](https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource), including [CanvasDrawImage](https://html.spec.whatwg.org/multipage/canvas.html#canvasdrawimage)’s [drawImage()](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawimage).

```webidl
[Exposed=(Window,DedicatedWorker), Serializable, Transferable]
interface VideoFrame {
  constructor(CanvasImageSource image, optional VideoFrameInit init = {});
  constructor(AllowSharedBufferSource data, VideoFrameBufferInit init);

  readonly attribute VideoPixelFormat? format;
  readonly attribute unsigned long codedWidth;
  readonly attribute unsigned long codedHeight;
  readonly attribute DOMRectReadOnly? codedRect;
  readonly attribute DOMRectReadOnly? visibleRect;
  readonly attribute double rotation;
  readonly attribute boolean flip;
  readonly attribute unsigned long displayWidth;
  readonly attribute unsigned long displayHeight;
  readonly attribute unsigned long long? duration;  // microseconds
  readonly attribute long long timestamp;           // microseconds
  readonly attribute VideoColorSpace colorSpace;

  VideoFrameMetadata metadata();

  unsigned long allocationSize(
      optional VideoFrameCopyToOptions options = {});
  Promise<sequence<PlaneLayout>> copyTo(
      AllowSharedBufferSource destination,
      optional VideoFrameCopyToOptions options = {});
  VideoFrame clone();
  undefined close();
};

dictionary VideoFrameInit {
  unsigned long long duration;  // microseconds
  long long timestamp;          // microseconds
  AlphaOption alpha = "keep";

  // Default matches image. May be used to efficiently crop. Will trigger
  // new computation of displayWidth and displayHeight using image's pixel
  // aspect ratio unless an explicit displayWidth and displayHeight are given.
  DOMRectInit visibleRect;

  double rotation = 0;
  boolean flip = false;

  // Default matches image unless visibleRect is provided.
  [EnforceRange] unsigned long displayWidth;
  [EnforceRange] unsigned long displayHeight;

  VideoFrameMetadata metadata;
};

dictionary VideoFrameBufferInit {
  required VideoPixelFormat format;
  required [EnforceRange] unsigned long codedWidth;
  required [EnforceRange] unsigned long codedHeight;
  required [EnforceRange] long long timestamp;  // microseconds
  [EnforceRange] unsigned long long duration;  // microseconds

  // Default layout is tightly-packed.
  sequence<PlaneLayout> layout;

  // Default visible rect is coded size positioned at (0,0)
  DOMRectInit visibleRect;

  double rotation = 0;
  boolean flip = false;

  // Default display dimensions match visibleRect.
  [EnforceRange] unsigned long displayWidth;
  [EnforceRange] unsigned long displayHeight;

  VideoColorSpaceInit colorSpace;

  sequence<ArrayBuffer> transfer = [];

  VideoFrameMetadata metadata;
};

dictionary VideoFrameMetadata {
  // Possible members are recorded in the VideoFrame Metadata Registry.
};
```

#### [9.4.1. Internal Slots](https://www.w3.org/TR/webcodecs/#videoframe-internal-slots)

**`[[resource reference]]`**

A reference to the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) that stores the pixel data for this frame.
**`[[format]]`**

A [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) describing the pixel format of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe). Will be `null` whenever the underlying format does not map to a [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) or when [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`.
**`[[coded width]]`**

Width of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.
**`[[coded height]]`**

Height of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.
**`[[visible left]]`**

The number of pixels defining the left offset of the visible rectangle.
**`[[visible top]]`**

The number of pixels defining the top offset of the visible rectangle.
**`[[visible width]]`**

The width of pixels to include in visible rectangle, starting from [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot).
**`[[visible height]]`**

The height of pixels to include in visible rectangle, starting from [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot).
**`[[rotation]]`**

The rotation to applied to the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) when rendered, in degrees clockwise. Rotation applies before flip.
**`[[flip]]`**

Whether a horizontal flip is applied to the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) when rendered. Flip is applied after rotation.
**`[[display width]]`**

Width of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) when displayed after applying aspect ratio adjustments.
**`[[display height]]`**

Height of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) when displayed after applying aspect ratio adjustments.
**`[[duration]]`**

The presentation duration, given in microseconds. The duration is copied from the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) corresponding to this [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).
**`[[timestamp]]`**

The presentation timestamp, given in microseconds. The timestamp is copied from the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) corresponding to this [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).
**`[[color space]]`**

The [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) associated with this frame.
**`[[metadata]]`**

The [VideoFrameMetadata](https://www.w3.org/TR/webcodecs/#dictdef-videoframemetadata) associated with this frame. Possible members are recorded in [\[webcodecs-video-frame-metadata-registry\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-video-frame-metadata-registry). By design, all [VideoFrameMetadata](https://www.w3.org/TR/webcodecs/#dictdef-videoframemetadata) properties are serializable.

#### [9.4.2. Constructors](https://www.w3.org/TR/webcodecs/#videoframe-constructors)

`VideoFrame(image, init)`

1.  [Check the usability of the image argument](https://html.spec.whatwg.org/multipage/canvas.html#check-the-usability-of-the-image-argument). If this throws an exception or returns bad, then throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  If image [is not origin-clean](https://html.spec.whatwg.org/multipage/canvas.html#the-image-argument-is-not-origin-clean), then throw a [SecurityError](https://webidl.spec.whatwg.org/#securityerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  Let frame be a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).
4.  Switch on image:

    NOTE: Authors are encouraged to provide a meaningful timestamp unless it is implicitly provided by the [CanvasImageSource](https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource) at construction. Interfaces that consume [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)s can rely on this value for timing decisions. For example, [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder) can use [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp) values to guide rate control (see [framerate](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-framerate)).
    - [HTMLImageElement](https://html.spec.whatwg.org/multipage/embedded-content.html#htmlimageelement)
    - [SVGImageElement](https://www.w3.org/TR/SVG2/embedded.html#InterfaceSVGImageElement)
      1.  If [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-timestamp) does not [exist](https://infra.spec.whatwg.org/#map-exists) in init, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
      2.  If image’s media data has no [natural dimensions](https://www.w3.org/TR/css-images-3/#natural-dimensions) (e.g., it’s a vector graphic with no specified content size), then throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
      3.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) containing a copy of image’s media data. If this is an animated image, image’s [bitmap data](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#concept-imagebitmap-bitmap-data) _MUST_ only be taken from the default image of the animation (the one that the format defines is to be used when animation is not supported or is disabled), or, if there is no such image, the first frame of the animation.
      4.  Let codedWidth and codedHeight be the width and height of resource.
      5.  Let baseRotation and baseFlip describe the rotation and flip of image relative to resource.
      6.  Let defaultDisplayWidth and defaultDisplayHeight be the [natural width](https://www.w3.org/TR/css-images-3/#natural-width) and [natural height](https://www.w3.org/TR/css-images-3/#natural-height) of image.
      7.  Run the [Initialize Frame With Resource](https://www.w3.org/TR/webcodecs/#videoframe-initialize-frame-with-resource) algorithm with init, frame, resource, codedWidth, codedHeight, baseRotation, baseFlip, defaultDisplayWidth, and defaultDisplayHeight.

    - [HTMLVideoElement](https://html.spec.whatwg.org/multipage/media.html#htmlvideoelement)
      1.  If image’s [networkState](https://html.spec.whatwg.org/multipage/media.html#dom-media-networkstate) attribute is [NETWORK_EMPTY](https://html.spec.whatwg.org/multipage/media.html#dom-media-network_empty), then throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
      2.  Let currentPlaybackFrame be the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) at the [current playback position](https://html.spec.whatwg.org/multipage/media.html#current-playback-position).
      3.  If [metadata](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-metadata) does not [exist](https://infra.spec.whatwg.org/#map-exists) in init, assign currentPlaybackFrame.[[[metadata]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-metadata-slot) to it.
      4.  Run the [Initialize Frame From Other Frame](https://www.w3.org/TR/webcodecs/#videoframe-initialize-frame-from-other-frame) algorithm with init, frame, and currentPlaybackFrame.

    - [HTMLCanvasElement](https://html.spec.whatwg.org/multipage/canvas.html#htmlcanvaselement)
    - [ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap)
    - [OffscreenCanvas](https://html.spec.whatwg.org/multipage/canvas.html#offscreencanvas)
      1.  If [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-timestamp) does not [exist](https://infra.spec.whatwg.org/#map-exists) in init, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
      2.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) containing a copy of image’s [bitmap data](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#concept-imagebitmap-bitmap-data).

          NOTE: Implementers are encouraged to avoid a deep copy by using reference counting where feasible.

      3.  Let width be `image.width` and height be `image.height`.
      4.  Run the [Initialize Frame With Resource](https://www.w3.org/TR/webcodecs/#videoframe-initialize-frame-with-resource) algorithm with init, frame, resource, width, height, `0`, `false`, width, and height.

    - [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)
      1.  Run the [Initialize Frame From Other Frame](https://www.w3.org/TR/webcodecs/#videoframe-initialize-frame-from-other-frame) algorithm with init, frame, and image.

5.  Return frame.

`VideoFrame(data, init)`
