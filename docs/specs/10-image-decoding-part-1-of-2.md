---
title: '10. Image Decoding (Part 1 of 2)'
---

> Section 10 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 1 of 2**

---

## [10. Image Decoding](https://www.w3.org/TR/webcodecs/#image-decoding)

### [10.1. Background](https://www.w3.org/TR/webcodecs/#image-decoding-background)

This section is non-normative.

Image codec definitions are typically accompanied by a definition for a corresponding file format. Hence image decoders often perform both duties of unpacking (demuxing) as well as decoding the encoded image data. The WebCodecs [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) follows this pattern, which motivates an interface design that is notably different from that of [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder) and [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder).

In spite of these differences, [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) uses the same [codec processing model](https://www.w3.org/TR/webcodecs/#codec-processing-model) as the other codec interfaces. Additionally, [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) uses the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) interface to describe decoded outputs.

### [10.2. ImageDecoder Interface](https://www.w3.org/TR/webcodecs/#imagedecoder-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageDecoder {
  constructor(ImageDecoderInit init);

  readonly attribute DOMString type;
  readonly attribute boolean complete;
  readonly attribute Promise<undefined> completed;
  readonly attribute ImageTrackList tracks;

  Promise<ImageDecodeResult> decode(optional ImageDecodeOptions options = {});
  undefined reset();
  undefined close();

  static Promise<boolean> isTypeSupported(DOMString type);
};
```

#### [10.2.1. Internal Slots](https://www.w3.org/TR/webcodecs/#imagedecoder-internal-slots)

**`[[control message queue]]`**

A [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message) to be performed upon this [codec](https://www.w3.org/TR/webcodecs/#codec) instance. See [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
**`[[message queue blocked]]`**

A boolean indicating when processing the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-control-message-queue-slot) is blocked by a pending [control message](https://www.w3.org/TR/webcodecs/#control-message). See [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked).
**`[[codec work queue]]`**

A [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) used for running parallel steps that reference the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot). See [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).
**`[[ImageTrackList]]`**

An [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist) describing the tracks found in [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot)
**`[[type]]`**

A string reflecting the value of the MIME [type](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-type) given at construction.
**`[[complete]]`**

A boolean indicating whether [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is completely buffered.
**`[[completed promise]]`**

The promise used to signal when [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot) becomes `true`.
**`[[codec implementation]]`**

An underlying image decoder implementation provided by the User Agent. See [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation).
**`[[encoded data]]`**

A [byte sequence](https://infra.spec.whatwg.org/#byte-sequence) containing the encoded image data to be decoded.
**`[[prefer animation]]`**

A boolean reflecting the value of [preferAnimation](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-preferanimation) given at construction.
**`[[pending decode promises]]`**

A list of unresolved promises returned by calls to decode().
**`[[internal selected track index]]`**

Identifies the image track within [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) that is used by decoding algorithms.
**`[[tracks established]]`**

A boolean indicating whether the track list has been established in [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot).
**`[[closed]]`**

A boolean indicating that the [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) is in a permanent closed state and can no longer be used.
**`[[progressive frame generations]]`**

A mapping of frame indices to [Progressive Image Frame Generations](https://www.w3.org/TR/webcodecs/#progressive-image-frame-generation). The values represent the Progressive Image Frame Generation for the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) which was most recently output by a call to [decode()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-decode) with the given frame index.

#### [10.2.2. Constructor](https://www.w3.org/TR/webcodecs/#imagedecoder-constructor)

**`ImageDecoder(init)`**

NOTE: Calling [decode()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-decode) on the constructed [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) will trigger a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if the User Agent does not support type. Authors are encouraged to first check support by calling [isTypeSupported()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-istypesupported) with type. User Agents don’t have to support any particular type.

When invoked, run these steps:

1.  If init is not [valid ImageDecoderInit](https://www.w3.org/TR/webcodecs/#valid-imagedecoderinit), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-transfer) contains more than one reference to the same [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer), then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-transfer):
    1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

4.  Let d be a new [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) object. In the steps below, all mentions of [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) members apply to d unless stated otherwise.
5.  Assign a new [queue](https://infra.spec.whatwg.org/#queue) to [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-control-message-queue-slot).
6.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-message-queue-blocked-slot).
7.  Assign the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-work-queue-slot).
8.  Assign [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot) a new [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist) initialized as follows:
    1.  Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot).
    2.  Assign `-1` to [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).

9.  Assign [type](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-type) to [[[type]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-type-slot).
10. Assign `null` to [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot).
11. If `init.preferAnimation` [exists](https://infra.spec.whatwg.org/#map-exists), assign `init.preferAnimation` to the [[[prefer animation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-prefer-animation-slot) internal slot. Otherwise, assign 'null' to [[[prefer animation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-prefer-animation-slot) internal slot.
12. Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
13. Assign `-1` to [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot).
14. Assign `false` to [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot).
15. Assign `false` to [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot).
16. Assign a new [map](https://infra.spec.whatwg.org/#ordered-map) to [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot).
17. If init’s [data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data) member is of type [ReadableStream](https://streams.spec.whatwg.org/#readablestream):
    1.  Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot).
    2.  Assign `false` to [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot)
    3.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to [configure the image decoder](https://www.w3.org/TR/webcodecs/#configure-the-image-decoder) with init.
    4.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
    5.  Let reader be the result of [getting a reader](https://streams.spec.whatwg.org/#readablestream-get-a-reader) for [data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data).
    6.  In parallel, perform the [Fetch Stream Data Loop](https://www.w3.org/TR/webcodecs/#imagedecoder-fetch-stream-data-loop) on d with reader.

18. Otherwise:
    1.  Assert that `init.data` is of type [BufferSource](https://webidl.spec.whatwg.org/#BufferSource).
    2.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-transfer) contains an [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer) referenced by init.[data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data) the User Agent _MAY_ choose to:
        1.  Let [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) reference bytes in data representing an encoded image.

    3.  Otherwise:
        1.  Assign a copy of `init.data` to [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot).

    4.  Assign `true` to [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot).
    5.  Resolve [[[completed promise]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-completed-promise-slot).
    6.  Queue a control message to [configure the image decoder](https://www.w3.org/TR/webcodecs/#configure-the-image-decoder) with init.
    7.  Queue a control message to [decode track metadata](https://www.w3.org/TR/webcodecs/#decode-track-metadata).
    8.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

19. For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-transfer):
    1.  Perform [DetachArrayBuffer](https://tc39.es/ecma262/#sec-detacharraybuffer) on transferable

20. return d.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to configure the image decoder means running these steps:

1.  Let supported be the result of running the [Check Type Support](https://www.w3.org/TR/webcodecs/#imagedecoder-check-type-support) algorithm with `init.type`.
2.  If supported is `false`, run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException) and return `"processed"`.
3.  Otherwise, assign the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) internal slot with an implementation supporting `init.type`
4.  Assign `true` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-message-queue-blocked-slot).
5.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-work-queue-slot):
    1.  Configure [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) in accordance with the values given for [colorSpaceConversion](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-colorspaceconversion), [desiredWidth](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredwidth), and [desiredHeight](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredheight).
    2.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-message-queue-blocked-slot).
    3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

6.  Return `"processed"`.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to decode track metadata means running these steps:

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-work-queue-slot):
    1.  Run the [Establish Tracks](https://www.w3.org/TR/webcodecs/#imagedecoder-establish-tracks) algorithm.

#### [10.2.3. Attributes](https://www.w3.org/TR/webcodecs/#imagedecoder-attributes)

**`type`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString), readonly**

A string reflecting the value of the MIME [type](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-type) given at construction.

The [type](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-type) getter steps are to return [[[type]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-type-slot).
**`complete`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), readonly**

Indicates whether [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is completely buffered.

The [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) getter steps are to return [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot).
**`completed`, of type Promise<[undefined](https://webidl.spec.whatwg.org/#idl-undefined)\>, readonly**

The promise used to signal when [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) becomes `true`.

The [completed](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-completed) getter steps are to return [[[completed promise]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-completed-promise-slot).
**`tracks`, of type [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist), readonly**

Returns a [live](https://html.spec.whatwg.org/multipage/infrastructure.html#live) [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist), which provides metadata for the available tracks and a mechanism for selecting a track to decode.

The [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks) getter steps are to return [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot).

#### [10.2.4. Methods](https://www.w3.org/TR/webcodecs/#imagedecoder-methods)

**`decode(options)`**

Enqueues a control message to decode the frame according to options.

When invoked, run these steps:

1.  If [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) is `true`, return a [Promise](https://webidl.spec.whatwg.org/#idl-promise) rejected with an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  If [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot)’s [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot) is '-1', return a [Promise](https://webidl.spec.whatwg.org/#idl-promise) rejected with an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  If options is `undefined`, assign a new [ImageDecodeOptions](https://www.w3.org/TR/webcodecs/#dictdef-imagedecodeoptions) to options.
4.  Let promise be a new [Promise](https://webidl.spec.whatwg.org/#idl-promise).
5.  Append promise to [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
6.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to decode the image with options, and promise.
7.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
8.  Return promise.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to decode the image means running these steps:

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-work-queue-slot): 1. Wait for [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) to become `true`.

        2.  If options.[completeFramesOnly](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-completeframesonly) is `false` and the image is a [Progressive Image](https://www.w3.org/TR/webcodecs/#progressive-image) for which the User Agent supports progressive decoding, run the [Decode Progressive Frame](https://www.w3.org/TR/webcodecs/#imagedecoder-decode-progressive-frame) algorithm with options.[frameIndex](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-frameindex) and promise.

        3.  Otherwise, run the [Decode Complete Frame](https://www.w3.org/TR/webcodecs/#imagedecoder-decode-complete-frame) algorithm with options.[frameIndex](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-frameindex) and promise.

    **`reset()`**

Immediately aborts all pending work.

When invoked, run the [Reset ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-reset-imagedecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`close()`**

Immediately aborts all pending work and releases system resources. Close is final.

When invoked, run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`isTypeSupported(type)`**

Returns a promise indicating whether the provided config is supported by the User Agent.

When invoked, run these steps:

1.  If type is not a [valid image MIME type](https://www.w3.org/TR/webcodecs/#valid-image-mime-type), return a [Promise](https://webidl.spec.whatwg.org/#idl-promise) rejected with [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let p be a new [Promise](https://webidl.spec.whatwg.org/#idl-promise).
3.  In parallel, resolve p with the result of running the [Check Type Support](https://www.w3.org/TR/webcodecs/#imagedecoder-check-type-support) algorithm with type.
4.  Return p.

#### [10.2.5. Algorithms](https://www.w3.org/TR/webcodecs/#imagedecoder-algorithms)

#### Fetch Stream Data Loop (with reader)

Run these steps:

1.  Let readRequest be the following [read request](https://streams.spec.whatwg.org/#read-request).

    **[chunk steps](https://streams.spec.whatwg.org/#read-request-chunk-steps), given chunk**
    1.  If [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) is `true`, abort these steps.
    2.  If chunk is not a Uint8Array object, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with a [DataError](https://webidl.spec.whatwg.org/#dataerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException) and abort these steps.
    3.  Let bytes be the byte sequence represented by the Uint8Array object.
    4.  Append bytes to the [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) internal slot.
    5.  If [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) is `false`, run the [Establish Tracks](https://www.w3.org/TR/webcodecs/#imagedecoder-establish-tracks) algorithm.
    6.  Otherwise, run the [Update Tracks](https://www.w3.org/TR/webcodecs/#imagedecoder-update-tracks) algorithm.
    7.  Run the [Fetch Stream Data Loop](https://www.w3.org/TR/webcodecs/#imagedecoder-fetch-stream-data-loop) algorithm with reader.
        **[close steps](https://streams.spec.whatwg.org/#read-request-close-steps)**
    8.  Assign `true` to [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot)
    9.  Resolve [[[completed promise]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-completed-promise-slot).
        **[error steps](https://streams.spec.whatwg.org/#read-request-error-steps)**
    10. [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with a [NotReadableError](https://webidl.spec.whatwg.org/#notreadableerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)

2.  Read a chunk from reader given readRequest.

#### Establish Tracks

Run these steps:

1.  Assert [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) is `false`.
2.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) does not contain enough data to determine the number of tracks:
    1.  If [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with a [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
    2.  Abort these steps.

3.  If the number of tracks is found to be `0`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm and abort these steps.
4.  Let newTrackList be a new [list](https://infra.spec.whatwg.org/#list).
5.  For each image track found in [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot):
    1.  Let newTrack be a new [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack), initialized as follows:
        1.  Assign [this](https://webidl.spec.whatwg.org/#this) to [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot).
        2.  Assign [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks) to [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagetracklist-slot).
        3.  If image track is found to be animated, assign `true` to newTrack’s [[[animated]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-animated-slot) internal slot. Otherwise, assign `false`.
        4.  If image track is found to describe a frame count, assign that count to newTrack’s [[[frame count]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-frame-count-slot) internal slot. Otherwise, assign `0`.

            NOTE: If [this](https://webidl.spec.whatwg.org/#this) was constructed with [data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data) as a [ReadableStream](https://streams.spec.whatwg.org/#readablestream), the [frameCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-framecount) can change as additional bytes are appended to [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot). See the [Update Tracks](https://www.w3.org/TR/webcodecs/#imagedecoder-update-tracks) algorithm.

        5.  If image track is found to describe a repetition count, assign that count to [[[repetition count]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-repetition-count-slot) internal slot. Otherwise, assign `0`.

            NOTE: A value of `Infinity` indicates infinite repetitions.

        6.  Assign `false` to newTrack’s [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot) internal slot.

    2.  Append newTrack to newTrackList.

6.  Let selectedTrackIndex be the result of running the [Get Default Selected Track Index](https://www.w3.org/TR/webcodecs/#imagedecoder-get-default-selected-track-index) algorithm with newTrackList.
7.  Let selectedTrack be the track at position selectedTrackIndex within newTrackList.
8.  Assign `true` to selectedTrack’s [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot) internal slot.
9.  Assign selectedTrackIndex to [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot).
10. Assign `true` to [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot).
11. [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
    1.  Assign newTrackList to the [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks) [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot) internal slot.
    2.  Assign selectedTrackIndex to [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks) [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).
    3.  Resolve [[[ready promise]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-ready-promise-slot).

#### Get Default Selected Track Index (with trackList)

Run these steps:

1.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) identifies a [Primary Image Track](https://www.w3.org/TR/webcodecs/#primary-image-track):
    1.  Let primaryTrack be the [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack) from trackList that describes the [Primary Image Track](https://www.w3.org/TR/webcodecs/#primary-image-track).
    2.  Let primaryTrackIndex be position of primaryTrack within trackList.
    3.  If [[[prefer animation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-prefer-animation-slot) is `null`, return primaryTrackIndex.
    4.  If primaryTrack.[animated](https://www.w3.org/TR/webcodecs/#dom-imagetrack-animated) equals [[[prefer animation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-prefer-animation-slot), return primaryTrackIndex.

2.  If any [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack)s in trackList have [animated](https://www.w3.org/TR/webcodecs/#dom-imagetrack-animated) equal to [[[prefer animation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-prefer-animation-slot), return the position of the earliest such track in trackList.
3.  Return `0`.

#### Update Tracks

A track update struct is a [struct](https://infra.spec.whatwg.org/#struct) that consists of a track index ([unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)) and a frame count ([unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)).

Run these steps:

1.  Assert [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) is `true`.
2.  Let trackChanges be a new [list](https://infra.spec.whatwg.org/#list).
3.  Let trackList be a copy of [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks)' [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot).
4.  For each track in trackList:
    1.  Let trackIndex be the position of track in trackList.
    2.  Let latestFrameCount be the frame count as indicated by [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) for the track corresponding to track.
    3.  Assert that latestFrameCount is greater than or equal to `track.frameCount`.
    4.  If latestFrameCount is greater than `track.frameCount`:
        1.  Let change be a [track update struct](https://www.w3.org/TR/webcodecs/#track-update-struct) whose [track index](https://www.w3.org/TR/webcodecs/#track-update-struct-track-index) is trackIndex and [frame count](https://www.w3.org/TR/webcodecs/#track-update-struct-frame-count) is latestFrameCount.
        2.  Append change to tracksChanges.

5.  If tracksChanges [is empty](https://infra.spec.whatwg.org/#list-is-empty), abort these steps.
6.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
    1.  For each update in trackChanges:
        1.  Let updateTrack be the [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack) at position `update.trackIndex` within [tracks](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks)' [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot).
        2.  Assign `update.frameCount` to updateTrack’s [[[frame count]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-frame-count-slot).

#### Decode Complete Frame (with frameIndex and promise)

1.  Assert that [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) is `true`.
2.  Assert that [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot) is not `-1`.
3.  Let encodedFrame be the encoded frame identified by frameIndex and [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot).
4.  Wait for any of the following conditions to be true (whichever happens first):
    1.  [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) contains enough bytes to completely decode encodedFrame.
    2.  [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is found to be malformed.
    3.  [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true`.
    4.  [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) is `true`.

5.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is found to be malformed, run the [Fatally Reject Bad Data](https://www.w3.org/TR/webcodecs/#imagedecoder-fatally-reject-bad-data) algorithm and abort these steps.
6.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) does not contain enough bytes to completely decode encodedFrame, run the [Reject Infeasible Decode](https://www.w3.org/TR/webcodecs/#imagedecoder-reject-infeasible-decode) algorithm with promise and abort these steps.
7.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) to decode encodedFrame.
8.  If decoding produces an error, run the [Fatally Reject Bad Data](https://www.w3.org/TR/webcodecs/#imagedecoder-fatally-reject-bad-data) algorithm and abort these steps.
9.  If [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot) contains an entry keyed by frameIndex, remove the entry from the map.
10. Let output be the decoded image data emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) corresponding to encodedFrame.
11. Let decodeResult be a new [ImageDecodeResult](https://www.w3.org/TR/webcodecs/#dictdef-imagedecoderesult) initialized as follows:
    1.  Assign 'true' to [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-complete).
    2.  Let duration be the presentation duration for output as described by encodedFrame. If encodedFrame does not have a duration, assign `null` to duration.
    3.  Let timestamp be the presentation timestamp for output as described by encodedFrame. If encodedFrame does not have a timestamp:
        1.  If encodedFrame is a still image assign `0` to timestamp.
        2.  If encodedFrame is a constant rate animated image and duration is not `null`, assign `|frameIndex| * |duration|` to timestamp.
        3.  If a timestamp can otherwise be trivially generated from metadata without further decoding, assign that to timestamp.
        4.  Otherwise, assign `0` to timestamp.

    4.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) contains orientation metadata describe it as rotation and flip, otherwise set rotation to 0 and flip to false.
    5.  Assign [image](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-image) with the result of running the [Create a VideoFrame](https://www.w3.org/TR/webcodecs/#create-a-videoframe) algorithm with output, timestamp, duration, rotation, and flip.

12. Run the [Resolve Decode](https://www.w3.org/TR/webcodecs/#imagedecoder-resolve-decode) algorithm with promise and decodeResult.

#### Decode Progressive Frame (with frameIndex and promise)

1.  Assert that [[[tracks established]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-tracks-established-slot) is `true`.
2.  Assert that [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot) is not `-1`.
3.  Let encodedFrame be the encoded frame identified by frameIndex and [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot).
4.  Let lastFrameGeneration be `null`.
5.  If [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot) contains a map entry with the key frameIndex, assign the value of the map entry to lastFrameGeneration.
6.  Wait for any of the following conditions to be true (whichever happens first):
    1.  [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) contains enough bytes to decode encodedFrame to produce an output whose [Progressive Image Frame Generation](https://www.w3.org/TR/webcodecs/#progressive-image-frame-generation) exceeds lastFrameGeneration.
    2.  [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is found to be malformed.
    3.  [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true`.
    4.  [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) is `true`.

7.  If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) is found to be malformed, run the [Fatally Reject Bad Data](https://www.w3.org/TR/webcodecs/#imagedecoder-fatally-reject-bad-data) algorithm and abort these steps.
8.  Otherwise, if [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) does not contain enough bytes to decode encodedFrame to produce an output whose [Progressive Image Frame Generation](https://www.w3.org/TR/webcodecs/#progressive-image-frame-generation) exceeds lastFrameGeneration, run the [Reject Infeasible Decode](https://www.w3.org/TR/webcodecs/#imagedecoder-reject-infeasible-decode) algorithm with promise and abort these steps.
9.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) to decode encodedFrame.
10. If decoding produces an error, run the [Fatally Reject Bad Data](https://www.w3.org/TR/webcodecs/#imagedecoder-fatally-reject-bad-data) algorithm and abort these steps.
11. Let output be the decoded image data emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) corresponding to encodedFrame.
12. Let decodeResult be a new [ImageDecodeResult](https://www.w3.org/TR/webcodecs/#dictdef-imagedecoderesult).
13. If output is the final full-detail progressive output corresponding to encodedFrame:
    1.  Assign `true` to decodeResult’s [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-complete).
    2.  If [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot) contains an entry keyed by frameIndex, remove the entry from the map.

14. Otherwise:
    1.  Assign `false` to decodeResult’s [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-complete).
    2.  Let frameGeneration be the [Progressive Image Frame Generation](https://www.w3.org/TR/webcodecs/#progressive-image-frame-generation) for output.
    3.  Add a new entry to [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot) with key frameIndex and value frameGeneration.

15. Let duration be the presentation duration for output as described by encodedFrame. If encodedFrame does not describe a duration, assign `null` to duration.
16. Let timestamp be the presentation timestamp for output as described by encodedFrame. If encodedFrame does not have a timestamp:
    1.  If encodedFrame is a still image assign `0` to timestamp.
    2.  If encodedFrame is a constant rate animated image and duration is not `null`, assign `|frameIndex| * |duration|` to timestamp.
    3.  If a timestamp can otherwise be trivially generated from metadata without further decoding, assign that to timestamp.
    4.  Otherwise, assign `0` to timestamp.

17. If [[[encoded data]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-encoded-data-slot) contains orientation metadata describe it as rotation and flip, otherwise set rotation to 0 and flip to false.
18. Assign [image](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-image) with the result of running the [Create a VideoFrame](https://www.w3.org/TR/webcodecs/#create-a-videoframe) algorithm with output, timestamp, duration, rotation, and flip.
19. Remove promise from [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
20. Resolve promise with decodeResult.

#### Resolve Decode (with promise and result)

1.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
    1.  If [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot), abort these steps.
    2.  Assert that promise is an element of [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
    3.  Remove promise from [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
    4.  Resolve promise with result.

#### Reject Infeasible Decode (with promise)

1.  Assert that [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true` or [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) is `true`.
2.  If [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true`, let exception be a [RangeError](https://webidl.spec.whatwg.org/#exceptiondef-rangeerror). Otherwise, let exception be an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
    1.  If [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot), abort these steps.
    2.  Assert that promise is an element of [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
    3.  Remove promise from [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).
    4.  Reject promise with exception.

#### Fatally Reject Bad Data

1.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
    1.  If [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot), abort these steps.
    2.  Run the [Close ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-close-imagedecoder) algorithm with an [EncodingError](https://webidl.spec.whatwg.org/#encodingerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

#### Check Type Support (with type)

1.  If the User Agent can provide a codec to support decoding type, return `true`.
2.  Otherwise, return `false`.

#### Reset ImageDecoder (with exception)

1.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) to abort any active decoding operation.
2.  For each decodePromise in [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot):
    1.  Reject decodePromise with exception.
    2.  Remove decodePromise from [[[pending decode promises]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-pending-decode-promises-slot).

#### Close ImageDecoder (with exception)

1.  Run the [Reset ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-reset-imagedecoder) algorithm with exception.
2.  Assign `true` to [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot).
3.  Clear [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-implementation-slot) and release associated [system resources](https://www.w3.org/TR/webcodecs/#system-resources).
4.  If [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot) is empty, reject [[[ready promise]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-ready-promise-slot) with exception. Otherwise perform these steps,
    1.  Remove all entries from [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot).
    2.  Assign `-1` to [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-imagetracklist-slot)’s [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).

5.  If [[[complete]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete-slot) is false resolve [[[completed promise]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-completed-promise-slot) with exception.

### [10.3. ImageDecoderInit Interface](https://www.w3.org/TR/webcodecs/#imagedecoderinit-interface)

```webidl
typedef (AllowSharedBufferSource or ReadableStream) ImageBufferSource;
dictionary ImageDecoderInit {
  required DOMString type;
  required ImageBufferSource data;
  ColorSpaceConversion colorSpaceConversion = "default";
  [EnforceRange] unsigned long desiredWidth;
  [EnforceRange] unsigned long desiredHeight;
  boolean preferAnimation;
  sequence<ArrayBuffer> transfer = [];
};
```

To determine if an [ImageDecoderInit](https://www.w3.org/TR/webcodecs/#dictdef-imagedecoderinit) is a valid ImageDecoderInit, run these steps:

1.  If type is not a [valid image MIME type](https://www.w3.org/TR/webcodecs/#valid-image-mime-type), return `false`.
2.  If data is of type [ReadableStream](https://streams.spec.whatwg.org/#readablestream) and the ReadableStream is [disturbed](https://streams.spec.whatwg.org/#is-readable-stream-disturbed) or [locked](https://streams.spec.whatwg.org/#readablestream-locked), return `false`.
3.  If data is of type [BufferSource](https://webidl.spec.whatwg.org/#BufferSource):
    1.  If data is \[[detached](https://webidl.spec.whatwg.org/#buffersource-detached)\], return false.
    2.  If data [is empty](https://infra.spec.whatwg.org/#list-is-empty), return `false`.

4.  If [desiredWidth](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredwidth) [exists](https://infra.spec.whatwg.org/#map-exists) and [desiredHeight](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredheight) does not exist, return `false`.
5.  If [desiredHeight](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredheight) [exists](https://infra.spec.whatwg.org/#map-exists) and [desiredWidth](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-desiredwidth) does not exist, return `false`.
6.  Return `true`.

A valid image MIME type is a string that is a [valid MIME type string](https://mimesniff.spec.whatwg.org/#valid-mime-type) and for which the `type`, per Section 8.3.1 of [\[RFC9110\]](https://www.w3.org/TR/webcodecs/#biblio-rfc9110), is `image`.

**`type`, of type [DOMString](https://webidl.spec.whatwg.org/#idl-DOMString)**

String containing the MIME type of the image file to be decoded.
**`data`, of type [ImageBufferSource](https://www.w3.org/TR/webcodecs/#typedefdef-imagebuffersource)**

[BufferSource](https://webidl.spec.whatwg.org/#BufferSource) or [ReadableStream](https://streams.spec.whatwg.org/#readablestream) of bytes representing an encoded image file as described by [type](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-type).
**`colorSpaceConversion`, of type [ColorSpaceConversion](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#colorspaceconversion), defaulting to `"default"`**

Controls whether decoded outputs' color space is converted or ignored, as defined by [colorSpaceConversion](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-imagebitmapoptions-colorspaceconversion) in [ImageBitmapOptions](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmapoptions).
**`desiredWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Indicates a desired width for decoded outputs. Implementation is best effort; decoding to a desired width _MAY_ not be supported by all formats/ decoders.
**`desiredHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Indicates a desired height for decoded outputs. Implementation is best effort; decoding to a desired height _MAY_ not be supported by all formats/decoders.
**`preferAnimation`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

For images with multiple tracks, this indicates whether the initial track selection _SHOULD_ prefer an animated track.

NOTE: See the [Get Default Selected Track Index](https://www.w3.org/TR/webcodecs/#imagedecoder-get-default-selected-track-index) algorithm.

### [10.4. ImageDecodeOptions Interface](https://www.w3.org/TR/webcodecs/#imagedecodeoptions-interface)

```webidl
dictionary ImageDecodeOptions {
  [EnforceRange] unsigned long frameIndex = 0;
  boolean completeFramesOnly = true;
};
```

**`frameIndex`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), defaulting to `0`**

The index of the frame to decode.
**`completeFramesOnly`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), defaulting to `true`**

For [Progressive Images](https://www.w3.org/TR/webcodecs/#progressive-image), a value of `false` indicates that the decoder _MAY_ output an [image](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-image) with reduced detail. Each subsequent call to [decode()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-decode) for the same [frameIndex](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-frameindex) will resolve to produce an image with a higher [Progressive Image Frame Generation](https://www.w3.org/TR/webcodecs/#progressive-image-frame-generation) (more image detail) than the previous call, until finally the full-detail image is produced.

If [completeFramesOnly](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-completeframesonly) is assigned `true`, or if the image is not a [Progressive Image](https://www.w3.org/TR/webcodecs/#progressive-image), or if the User Agent does not support progressive decoding for the given image type, calls to [decode()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-decode) will only resolve once the full detail image is decoded.

NOTE: For [Progressive Images](https://www.w3.org/TR/webcodecs/#progressive-image), setting [completeFramesOnly](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-completeframesonly) to `false` can be used to offer users a preview an image that is still being buffered from the network (via the [data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data) [ReadableStream](https://streams.spec.whatwg.org/#readablestream)).

Upon decoding the full detail image, the [ImageDecodeResult](https://www.w3.org/TR/webcodecs/#dictdef-imagedecoderesult)’s [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-complete) will be set to true.

### [10.5. ImageDecodeResult Interface](https://www.w3.org/TR/webcodecs/#imagedecoderesult-interface)

```webidl
dictionary ImageDecodeResult {
  required VideoFrame image;
  required boolean complete;
};
```

**`image`, of type [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)**

The decoded image.
**`complete`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

Indicates whether [image](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-image) contains the final full-detail output.

NOTE: [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoderesult-complete) is always `true` when [decode()](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-decode) is invoked with [completeFramesOnly](https://www.w3.org/TR/webcodecs/#dom-imagedecodeoptions-completeframesonly) set to `true`.

### [10.6. ImageTrackList Interface](https://www.w3.org/TR/webcodecs/#imagetracklist-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageTrackList {
  getter ImageTrack (unsigned long index);

  readonly attribute Promise<undefined> ready;
  readonly attribute unsigned long length;
  readonly attribute long selectedIndex;
  readonly attribute ImageTrack? selectedTrack;
};
```

#### [10.6.1. Internal Slots](https://www.w3.org/TR/webcodecs/#imagetracklist-internal-slots)

**`[[ready promise]]`**

The promise used to signal when the [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist) has been populated with [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack)s.

NOTE: [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack) [frameCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-framecount) can receive subsequent updates until [complete](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-complete) is `true`.
**`[[track list]]`**

The list of [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack)s describe by this [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist).
**`[[selected index]]`**

The index of the selected track in [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot). A value of `-1` indicates that no track is selected. The initial value is `-1`.

#### [10.6.2. Attributes](https://www.w3.org/TR/webcodecs/#imagetracklist-attributes)

**`ready`, of type Promise<[undefined](https://webidl.spec.whatwg.org/#idl-undefined)\>, readonly**

The [ready](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-ready) getter steps are to return the [[[ready promise]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-ready-promise-slot).
**`length`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

The [length](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-length) getter steps are to return the length of [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot).
**`selectedIndex`, of type [long](https://webidl.spec.whatwg.org/#idl-long), readonly**

The [selectedIndex](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selectedindex) getter steps are to return [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot);
**`selectedTrack`, of type [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack), readonly, nullable**

The [selectedTrack](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selectedtrack) getter steps are:

1.  If [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot) is `-1`, return `null`.
2.  Otherwise, return the ImageTrack from [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot) at the position indicated by [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).

### [10.7. ImageTrack Interface](https://www.w3.org/TR/webcodecs/#imagetrack-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageTrack {
  readonly attribute boolean animated;
  readonly attribute unsigned long frameCount;
  readonly attribute unrestricted float repetitionCount;
  attribute boolean selected;
};
```

#### [10.7.1. Internal Slots](https://www.w3.org/TR/webcodecs/#imagetrack-internal-slots)

**`[[ImageDecoder]]`**

The [ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder) instance that constructed this [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack).
**`[[ImageTrackList]]`**

The [ImageTrackList](https://www.w3.org/TR/webcodecs/#imagetracklist) instance that lists this [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack).
**`[[animated]]`**

Indicates whether this track contains an animated image with multiple frames.
**`[[frame count]]`**

The number of frames in this track.
**`[[repetition count]]`**

The number of times the animation is intended to repeat.
**`[[selected]]`**

Indicates whether this track is selected for decoding.

#### [10.7.2. Attributes](https://www.w3.org/TR/webcodecs/#imagetrack-attributes)

**`animated`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), readonly**

The [animated](https://www.w3.org/TR/webcodecs/#dom-imagetrack-animated) getter steps are to return the value of [[[animated]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-animated-slot).

NOTE: This attribute provides an early indication that [frameCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-framecount) will ultimately exceed 0 for images where the [frameCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-framecount) starts at `0` and later increments as new chunks of the [ReadableStream](https://streams.spec.whatwg.org/#readablestream) [data](https://www.w3.org/TR/webcodecs/#dom-imagedecoderinit-data) arrive.
**`frameCount`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

The [frameCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-framecount) getter steps are to return the value of [[[frame count]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-frame-count-slot).
**`repetitionCount`, of type [unrestricted float](https://webidl.spec.whatwg.org/#idl-unrestricted-float), readonly**

The [repetitionCount](https://www.w3.org/TR/webcodecs/#dom-imagetrack-repetitioncount) getter steps are to return the value of [[[repetition count]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-repetition-count-slot).
**`selected`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean)**

The [selected](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected) getter steps are to return the value of [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot).

The [selected](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected) setter steps are:
