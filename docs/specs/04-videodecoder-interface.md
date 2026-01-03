---
title: '4. VideoDecoder Interface'
---

> Section 4 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [4. VideoDecoder Interface](https://www.w3.org/TR/webcodecs/#videodecoder-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface VideoDecoder : EventTarget {
  constructor(VideoDecoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long decodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(VideoDecoderConfig config);
  undefined decode(EncodedVideoChunk chunk);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<VideoDecoderSupport> isConfigSupported(VideoDecoderConfig config);
};

dictionary VideoDecoderInit {
  required VideoFrameOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback VideoFrameOutputCallback = undefined(VideoFrame output);
```

### [4.1. Internal Slots](https://www.w3.org/TR/webcodecs/#videodecoder-internal-slots)

**`[[control message queue]]`**

A [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message) to be performed upon this [codec](https://www.w3.org/TR/webcodecs/#codec) instance. See [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
**`[[message queue blocked]]`**

A boolean indicating when processing the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-control-message-queue-slot) is blocked by a pending [control message](https://www.w3.org/TR/webcodecs/#control-message). See [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked).
**`[[codec implementation]]`**

Underlying decoder implementation provided by the User Agent. See [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation).
**`[[codec work queue]]`**

A [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) used for running parallel steps that reference the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot). See [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).
**`[[codec saturated]]`**

A boolean indicating when the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) is unable to accept additional decoding work.
**`[[output callback]]`**

Callback given at construction for decoded outputs.
**`[[error callback]]`**

Callback given at construction for decode errors.
**`[[active decoder config]]`**

The [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) that is actively applied.
**`[[key chunk required]]`**

A boolean indicating that the next chunk passed to [decode()](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decode) _MUST_ describe a [key chunk](https://www.w3.org/TR/webcodecs/#key-chunk) as indicated by [type](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type).
**`[[state]]`**

The current [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate) of this [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder).
**`[[decodeQueueSize]]`**

The number of pending decode requests. This number will decrease as the underlying codec is ready to accept new input.
**`[[pending flush promises]]`**

A list of unresolved promises returned by calls to [flush()](https://www.w3.org/TR/webcodecs/#dom-videodecoder-flush).
**`[[dequeue event scheduled]]`**

A boolean indicating whether a [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videodecoder-dequeue) event is already scheduled to fire. Used to avoid event spam.

### [4.2. Constructors](https://www.w3.org/TR/webcodecs/#videodecoder-constructors)

`VideoDecoder(init)`

1.  Let d be a new [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder) object.
2.  Assign a new [queue](https://infra.spec.whatwg.org/#queue) to [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-control-message-queue-slot).
3.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-message-queue-blocked-slot).
4.  Assign `null` to [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot).
5.  Assign the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-work-queue-slot).
6.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-saturated-slot).
7.  Assign init.output to [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-output-callback-slot).
8.  Assign init.error to [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-error-callback-slot).
9.  Assign `null` to [[[active decoder config]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-active-decoder-config-slot).
10. Assign `true` to [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot).
11. Assign `"unconfigured"` to [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot)
12. Assign `0` to [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot).
13. Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-pending-flush-promises-slot).
14. Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-dequeue-event-scheduled-slot).
15. Return d.

### [4.3. Attributes](https://www.w3.org/TR/webcodecs/#videodecoder-attributes)

**`state`, of type [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate), readonly**

Returns the value of [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot).
**`decodeQueueSize`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot).
**`ondequeue`, of type [EventHandler](https://html.spec.whatwg.org/multipage/webappapis.html#eventhandler)**

An [event handler IDL attribute](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes) whose [event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) is [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videodecoder-dequeue).

### [4.4. Event Summary](https://www.w3.org/TR/webcodecs/#videodecoder-event-summary)

**`dequeue`**

Fired at the [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder) when the [decodeQueueSize](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize) has decreased.

### [4.5. Methods](https://www.w3.org/TR/webcodecs/#videodecoder-methods)

**`configure(config)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the video decoder for decoding chunks as described by config.

NOTE: This method will trigger a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if the User Agent does not support config. Authors are encouraged to first check support by calling [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-videodecoder-isconfigsupported) with config. User Agents don’t have to support any particular codec type or configuration.

When invoked, run these steps:

1.  If config is not a [valid VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#valid-videodecoderconfig), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot) is `“closed”`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot) to `"configured"`.
4.  Set [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot) to `true`.
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the decoder with config.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to configure the decoder means running these steps:

1.  Assign `true` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-message-queue-blocked-slot).
2.  Enqueue the following steps to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-work-queue-slot):
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  If supported is `false`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close VideoDecoder](https://www.w3.org/TR/webcodecs/#close-videodecoder) algorithm with [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) and abort these steps.
    3.  If needed, assign [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) with an implementation supporting config.
    4.  Configure [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) with config.
    5.  [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-message-queue-blocked-slot).
        2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

3.  Return `"processed"`.
    **`decode(chunk)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to decode the given chunk.

NOTE: Authors are encouraged to call [close()](https://www.w3.org/TR/webcodecs/#dom-videoframe-close) on output [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)s immediately when frames are no longer needed. The underlying [media resource](https://www.w3.org/TR/webcodecs/#media-resource)s are owned by the [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder) and failing to release them (or waiting for garbage collection) can cause decoding to stall.

NOTE: [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder) requires that frames are output in the order they expect to be presented, commonly known as presentation order. When using some [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot)s the User Agent will have to reorder outputs into presentation order.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot) is not `"configured"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  If [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot) is `true`:
    1.  If chunk.[type](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type) is not [key](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key), throw a [DataError](https://webidl.spec.whatwg.org/#dataerror).
    2.  Implementers _SHOULD_ inspect the chunk’s [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) to verify that it is truly a [key chunk](https://www.w3.org/TR/webcodecs/#key-chunk). If a mismatch is detected, throw a [DataError](https://webidl.spec.whatwg.org/#dataerror).
    3.  Otherwise, assign `false` to [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot).

3.  Increment [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot).
4.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to decode the chunk.
5.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to decode the chunk means performing these steps:

1.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-saturated-slot) equals `true`, return `"not processed"`.
2.  If decoding chunk will cause the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) to become [saturated](https://www.w3.org/TR/webcodecs/#saturated), assign `true` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-saturated-slot).
3.  Decrement [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot) and run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#videodecoder-schedule-dequeue-event) algorithm.
4.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-work-queue-slot):
    1.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) to decode the chunk.
    2.  If decoding results in an error, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close VideoDecoder](https://www.w3.org/TR/webcodecs/#close-videodecoder) algorithm with [EncodingError](https://webidl.spec.whatwg.org/#encodingerror) and return.
    3.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-saturated-slot) equals `true` and [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) is no longer [saturated](https://www.w3.org/TR/webcodecs/#saturated), [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
        1.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-saturated-slot).
        2.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

    4.  Let decoded outputs be a [list](https://infra.spec.whatwg.org/#list) of decoded video data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) in presentation order.
    5.  If decoded outputs is not empty, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Output VideoFrame](https://www.w3.org/TR/webcodecs/#output-videoframes) algorithm with decoded outputs.

5.  Return `"processed"`.
    **`flush()`**

Completes all [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) and emits all outputs.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state-slot) is not `"configured"`, return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Set [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot) to `true`.
3.  Let promise be a new Promise.
4.  Append promise to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-pending-flush-promises-slot).
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to flush the codec with promise.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
7.  Return promise.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to flush the codec means performing these steps with promise.

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-work-queue-slot):
    1.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) to emit all [internal pending outputs](https://www.w3.org/TR/webcodecs/#internal-pending-output).
    2.  Let decoded outputs be a [list](https://infra.spec.whatwg.org/#list) of decoded video data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot).
    3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
        1.  If decoded outputs is not empty, run the [Output VideoFrame](https://www.w3.org/TR/webcodecs/#output-videoframes) algorithm with decoded outputs.
        2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-pending-flush-promises-slot).
        3.  Resolve promise.

2.  Return `"processed"`.
    **`reset()`**

Immediately resets all state including configuration, [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue), and all pending callbacks.

When invoked, run the [Reset VideoDecoder](https://www.w3.org/TR/webcodecs/#reset-videodecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`close()`**

Immediately aborts all pending work and releases [system resources](https://www.w3.org/TR/webcodecs/#system-resources). Close is final.

When invoked, run the [Close VideoDecoder](https://www.w3.org/TR/webcodecs/#close-videodecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`isConfigSupported(config)`**

Returns a promise indicating whether the provided config is supported by the User Agent.

NOTE: The returned [VideoDecoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-videodecodersupport) [config](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-config) will contain only the dictionary members that User Agent recognized. Unrecognized dictionary members will be ignored. Authors can detect unrecognized dictionary members by comparing [config](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-config) to their provided config.

When invoked, run these steps:

1.  If config is not a [valid VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#valid-videodecoderconfig), return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let p be a new Promise.
3.  Let checkSupportQueue be the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).
4.  Enqueue the following steps to checkSupportQueue:
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Let decoderSupport be a newly constructed [VideoDecoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-videodecodersupport), initialized as follows:
            1.  Set [config](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-config) to the result of running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with config.
            2.  Set [supported](https://www.w3.org/TR/webcodecs/#dom-videodecodersupport-supported) to supported.

        2.  Resolve p with decoderSupport.

5.  Return p.

### [4.6. Algorithms](https://www.w3.org/TR/webcodecs/#videodecoder-algorithms)

#### Schedule Dequeue Event

1.  If [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-dequeue-event-scheduled-slot) equals `true`, return.
2.  Assign `true` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-dequeue-event-scheduled-slot).
3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
    1.  Fire a simple event named [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videodecoder-dequeue) at [this](https://webidl.spec.whatwg.org/#this).
    2.  Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-dequeue-event-scheduled-slot).

#### Output VideoFrames (with outputs)

Run these steps:

1.  For each output in outputs:
    1.  Let timestamp and duration be the [timestamp](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-timestamp) and [duration](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-duration) from the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) associated with output.
    2.  Let displayAspectWidth and displayAspectHeight be undefined.
    3.  If [displayAspectWidth](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectwidth) and [displayAspectHeight](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-displayaspectheight) [exist](https://infra.spec.whatwg.org/#map-exists) in the [[[active decoder config]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-active-decoder-config-slot), assign their values to displayAspectWidth and displayAspectHeight respectively.
    4.  Let colorSpace be the [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) for output as detected by the codec implementation. If no [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) is detected, let colorSpace be `undefined`.

        NOTE: The codec implementation can detect a [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) by analyzing the bitstream. Detection is made on a best-effort basis. The exact method of detection is implementer defined and codec-specific. Authors can override the detected [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) by providing a [colorSpace](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-colorspace) in the [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig).

    5.  If [colorSpace](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-colorspace) [exists](https://infra.spec.whatwg.org/#map-exists) in the [[[active decoder config]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-active-decoder-config-slot), assign its value to colorSpace.
    6.  Assign the values of [rotation](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-rotation) and [flip](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-flip) to rotation and flip respectively.
    7.  Let frame be the result of running the [Create a VideoFrame](https://www.w3.org/TR/webcodecs/#create-a-videoframe) algorithm with output, timestamp, duration, displayAspectWidth, displayAspectHeight, colorSpace, rotation, and flip.
    8.  Invoke [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-output-callback-slot) with frame.

#### Reset VideoDecoder (with exception)

Run these steps:

1.  If [state](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  Set [state](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state) to `"unconfigured"`.
3.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) to cease producing output for the previous configuration.
4.  Remove all [control messages](https://www.w3.org/TR/webcodecs/#control-message) from the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-control-message-queue-slot).
5.  If [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot) is greater than zero:
    1.  Set [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-decodequeuesize-slot) to zero.
    2.  Run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#videodecoder-schedule-dequeue-event) algorithm.

6.  For each promise in [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-pending-flush-promises-slot):
    1.  Reject promise with exception.
    2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-pending-flush-promises-slot).

#### Close VideoDecoder (with exception)

Run these steps:

1.  Run the [Reset VideoDecoder](https://www.w3.org/TR/webcodecs/#reset-videodecoder) algorithm with exception.
2.  Set [state](https://www.w3.org/TR/webcodecs/#dom-videodecoder-state) to `"closed"`.
3.  Clear [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-codec-implementation-slot) and release associated [system resources](https://www.w3.org/TR/webcodecs/#system-resources).
4.  If exception is not an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException), invoke the [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-videodecoder-error-callback-slot) with exception.
