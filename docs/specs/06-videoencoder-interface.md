---
title: '6. VideoEncoder Interface'
---

> Section 6 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [6. VideoEncoder Interface](https://www.w3.org/TR/webcodecs/#videoencoder-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface VideoEncoder : EventTarget {
  constructor(VideoEncoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long encodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(VideoEncoderConfig config);
  undefined encode(VideoFrame frame, optional VideoEncoderEncodeOptions options = {});
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<VideoEncoderSupport> isConfigSupported(VideoEncoderConfig config);
};

dictionary VideoEncoderInit {
  required EncodedVideoChunkOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback EncodedVideoChunkOutputCallback =
    undefined (EncodedVideoChunk chunk,
               optional EncodedVideoChunkMetadata metadata = {});
```

### [6.1. Internal Slots](https://www.w3.org/TR/webcodecs/#videoencoder-internal-slots)

**`[[control message queue]]`**

A [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message) to be performed upon this [codec](https://www.w3.org/TR/webcodecs/#codec) instance. See [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
**`[[message queue blocked]]`**

A boolean indicating when processing the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-control-message-queue-slot) is blocked by a pending [control message](https://www.w3.org/TR/webcodecs/#control-message). See [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked).
**`[[codec implementation]]`**

Underlying encoder implementation provided by the User Agent. See [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation).
**`[[codec work queue]]`**

A [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) used for running parallel steps that reference the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot). See [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).
**`[[codec saturated]]`**

A boolean indicating when the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) is unable to accept additional encoding work.
**`[[output callback]]`**

Callback given at construction for encoded outputs.
**`[[error callback]]`**

Callback given at construction for encode errors.
**`[[active encoder config]]`**

The [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) that is actively applied.
**`[[active output config]]`**

The [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) that describes how to decode the most recently emitted [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk).
**`[[state]]`**

The current [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate) of this [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder).
**`[[encodeQueueSize]]`**

The number of pending encode requests. This number will decrease as the underlying codec is ready to accept new input.
**`[[pending flush promises]]`**

A list of unresolved promises returned by calls to [flush()](https://www.w3.org/TR/webcodecs/#dom-videoencoder-flush).
**`[[dequeue event scheduled]]`**

A boolean indicating whether a [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videoencoder-dequeue) event is already scheduled to fire. Used to avoid event spam.
**`[[active orientation]]`**

An integer and boolean pair indicating the [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot) and [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) of the first [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) given to [encode()](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encode) after [configure()](https://www.w3.org/TR/webcodecs/#dom-videoencoder-configure).

### [6.2. Constructors](https://www.w3.org/TR/webcodecs/#videoencoder-constructors)

`VideoEncoder(init)`

1.  Let e be a new [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder) object.
2.  Assign a new [queue](https://infra.spec.whatwg.org/#queue) to [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-control-message-queue-slot).
3.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-message-queue-blocked-slot).
4.  Assign `null` to [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot).
5.  Assign the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-work-queue-slot).
6.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-saturated-slot).
7.  Assign init.output to [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot).
8.  Assign init.error to [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-error-callback-slot).
9.  Assign `null` to [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-encoder-config-slot).
10. Assign `null` to [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-output-config-slot).
11. Assign `"unconfigured"` to [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot)
12. Assign `0` to [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot).
13. Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-pending-flush-promises-slot).
14. Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-dequeue-event-scheduled-slot).
15. Return e.

### [6.3. Attributes](https://www.w3.org/TR/webcodecs/#videoencoder-attributes)

**`state`, of type [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate), readonly**

Returns the value of [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot).
**`encodeQueueSize`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot).
**`ondequeue`, of type [EventHandler](https://html.spec.whatwg.org/multipage/webappapis.html#eventhandler)**

An [event handler IDL attribute](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes) whose [event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) is [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videoencoder-dequeue).

### [6.4. Event Summary](https://www.w3.org/TR/webcodecs/#videoencoder-event-summary)

**`dequeue`**

Fired at the [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder) when the [encodeQueueSize](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize) has decreased.

### [6.5. Methods](https://www.w3.org/TR/webcodecs/#videoencoder-methods)

**`configure(config)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the video encoder for encoding video frames as described by config.

NOTE: This method will trigger a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if the User Agent does not support config. Authors are encouraged to first check support by calling [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-videoencoder-isconfigsupported) with config. User Agents don’t have to support any particular codec type or configuration.

When invoked, run these steps:

1.  If config is not a [valid VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#valid-videoencoderconfig), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) to `"configured"`.
4.  Set [[[active orientation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-orientation-slot) to `null`.
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the encoder using config.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to configure the encoder means performing these steps:

1.  Assign `true` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-message-queue-blocked-slot).
2.  Enqueue the following steps to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-work-queue-slot):
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  If supported is `false`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close VideoEncoder](https://www.w3.org/TR/webcodecs/#close-videoencoder) algorithm with [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) and abort these steps.
    3.  If needed, assign [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) with an implementation supporting config.
    4.  Configure [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) with config.
    5.  [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-message-queue-blocked-slot).
        2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

3.  Return `"processed"`.
    **`encode(frame, options)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to encode the given frame.

When invoked, run these steps:

1.  If the value of frame’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) is not `"configured"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  If [[[active orientation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-orientation-slot) is not `null` and does not match frame’s [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) and [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot) throw a [DataError](https://webidl.spec.whatwg.org/#dataerror).
4.  If [[[active orientation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-orientation-slot) is `null`, set it to frame’s [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) and [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot).
5.  Let frameClone hold the result of running the [Clone VideoFrame](https://www.w3.org/TR/webcodecs/#clone-videoframe) algorithm with frame.
6.  Increment [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot).
7.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to encode frameClone.
8.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to encode the frame means performing these steps:

1.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-saturated-slot) equals `true`, return `"not processed"`.
2.  If encoding frame will cause the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) to become [saturated](https://www.w3.org/TR/webcodecs/#saturated), assign `true` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-saturated-slot).
3.  Decrement [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot) and run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#videoencoder-schedule-dequeue-event) algorithm.
4.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-work-queue-slot):
    1.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) to encode the frameClone according to options.
    2.  If encoding results in an error, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close VideoEncoder](https://www.w3.org/TR/webcodecs/#close-videoencoder) algorithm with [EncodingError](https://webidl.spec.whatwg.org/#encodingerror) and return.
    3.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-saturated-slot) equals `true` and [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) is no longer [saturated](https://www.w3.org/TR/webcodecs/#saturated), [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
        1.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-saturated-slot).
        2.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

    4.  Let encoded outputs be a [list](https://infra.spec.whatwg.org/#list) of encoded video data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot).
    5.  If encoded outputs is not empty, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Output EncodedVideoChunks](https://www.w3.org/TR/webcodecs/#output-encodedvideochunks) algorithm with encoded outputs.

5.  Return `"processed"`.
    **`flush()`**

Completes all [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) and emits all outputs.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) is not `"configured"`, return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Let promise be a new Promise.
3.  Append promise to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-pending-flush-promises-slot).
4.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to flush the codec with promise.
5.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
6.  Return promise.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to flush the codec means performing these steps with promise:

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-work-queue-slot):
    1.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) to emit all [internal pending outputs](https://www.w3.org/TR/webcodecs/#internal-pending-output).
    2.  Let encoded outputs be a [list](https://infra.spec.whatwg.org/#list) of encoded video data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot).
    3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
        1.  If encoded outputs is not empty, run the [Output EncodedVideoChunks](https://www.w3.org/TR/webcodecs/#output-encodedvideochunks) algorithm with encoded outputs.
        2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-pending-flush-promises-slot).
        3.  Resolve promise.

2.  Return `"processed"`.
    **`reset()`**

Immediately resets all state including configuration, [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue), and all pending callbacks.

When invoked, run the [Reset VideoEncoder](https://www.w3.org/TR/webcodecs/#reset-videoencoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`close()`**

Immediately aborts all pending work and releases [system resources](https://www.w3.org/TR/webcodecs/#system-resources). Close is final.

When invoked, run the [Close VideoEncoder](https://www.w3.org/TR/webcodecs/#close-videoencoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`isConfigSupported(config)`**

Returns a promise indicating whether the provided config is supported by the User Agent.

NOTE: The returned [VideoEncoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-videoencodersupport) [config](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-config) will contain only the dictionary members that User Agent recognized. Unrecognized dictionary members will be ignored. Authors can detect unrecognized dictionary members by comparing [config](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-config) to their provided config.

When invoked, run these steps:

1.  If config is not a [valid VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#valid-videoencoderconfig), return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let p be a new Promise.
3.  Let checkSupportQueue be the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).
4.  Enqueue the following steps to checkSupportQueue:
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Let encoderSupport be a newly constructed [VideoEncoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-videoencodersupport), initialized as follows:
            1.  Set [config](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-config) to the result of running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with config.
            2.  Set [supported](https://www.w3.org/TR/webcodecs/#dom-videoencodersupport-supported) to supported.

    3.  Resolve p with encoderSupport.

5.  Return p.

### [6.6. Algorithms](https://www.w3.org/TR/webcodecs/#videoencoder-algorithms)

#### Schedule Dequeue Event

1.  If [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-dequeue-event-scheduled-slot) equals `true`, return.
2.  Assign `true` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-dequeue-event-scheduled-slot).
3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
    1.  Fire a simple event named [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-videoencoder-dequeue) at [this](https://webidl.spec.whatwg.org/#this).
    2.  Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-dequeue-event-scheduled-slot).

#### Output EncodedVideoChunks (with outputs)

Run these steps:

1.  For each output in outputs:
    1.  Let chunkInit be an [EncodedVideoChunkInit](https://www.w3.org/TR/webcodecs/#dictdef-encodedvideochunkinit) with the following keys:
        1.  Let [data](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-data) contain the encoded video data from output.
        2.  Let [type](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-type) be the [EncodedVideoChunkType](https://www.w3.org/TR/webcodecs/#enumdef-encodedvideochunktype) of output.
        3.  Let [timestamp](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-timestamp) be the [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot) from the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) associated with output.
        4.  Let [duration](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-duration) be the [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot) from the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) associated with output.

    2.  Let chunk be a new [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) constructed with chunkInit.
    3.  Let chunkMetadata be a new [EncodedVideoChunkMetadata](https://www.w3.org/TR/webcodecs/#dictdef-encodedvideochunkmetadata).
    4.  Let encoderConfig be the [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-encoder-config-slot).
    5.  Let outputConfig be a [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) that describes output. Initialize outputConfig as follows:
        1.  Assign `encoderConfig.codec` to `outputConfig.codec`.
        2.  Assign `encoderConfig.width` to `outputConfig.codedWidth`.
        3.  Assign `encoderConfig.height` to `outputConfig.codedHeight`.
        4.  Assign `encoderConfig.displayWidth` to `outputConfig.displayAspectWidth`.
        5.  Assign `encoderConfig.displayHeight` to `outputConfig.displayAspectHeight`.
        6.  Assign [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) from the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) associated with output to `outputConfig.rotation`.
        7.  Assign [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot) from the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) associated with output to `outputConfig.flip`.
        8.  Assign the remaining keys of `outputConfig` as determined by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot). The User Agent _MUST_ ensure that the configuration is completely described such that outputConfig could be used to correctly decode output.

            NOTE: The codec specific requirements for populating the [description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) are described in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry).

    6.  If outputConfig and [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-output-config-slot) are not [equal dictionaries](https://www.w3.org/TR/webcodecs/#equal-dictionaries):
        1.  Assign outputConfig to chunkMetadata.[decoderConfig](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-decoderconfig).
        2.  Assign outputConfig to [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-output-config-slot).

    7.  If encoderConfig.[scalabilityMode](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-scalabilitymode) describes multiple [temporal layers](https://www.w3.org/TR/webcodecs/#temporal-layer):
        1.  Let svc be a new [SvcOutputMetadata](https://www.w3.org/TR/webcodecs/#dictdef-svcoutputmetadata) instance.
        2.  Let temporal_layer_id be the zero-based index describing the temporal layer for output.
        3.  Assign temporal_layer_id to svc.[temporalLayerId](https://www.w3.org/TR/webcodecs/#dom-svcoutputmetadata-temporallayerid).
        4.  Assign svc to chunkMetadata.[svc](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-svc).

    8.  If encoderConfig.[alpha](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-alpha) is set to `"keep"`:
        1.  Let alphaSideData be the encoded alpha data in output.
        2.  Assign alphaSideData to chunkMetadata.[alphaSideData](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-alphasidedata).

    9.  Invoke [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot) with chunk and chunkMetadata.

#### Reset VideoEncoder (with exception)

Run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) to `"unconfigured"`.
3.  Set [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-encoder-config-slot) to `null`.
4.  Set [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-active-output-config-slot) to `null`.
5.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) to cease producing output for the previous configuration.
6.  Remove all [control messages](https://www.w3.org/TR/webcodecs/#control-message) from the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-control-message-queue-slot).
7.  If [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot) is greater than zero:
    1.  Set [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-encodequeuesize-slot) to zero.
    2.  Run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#videoencoder-schedule-dequeue-event) algorithm.

8.  For each promise in [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-pending-flush-promises-slot):
    1.  Reject promise with exception.
    2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-pending-flush-promises-slot).

#### Close VideoEncoder (with exception)

Run these steps:

1.  Run the [Reset VideoEncoder](https://www.w3.org/TR/webcodecs/#reset-videoencoder) algorithm with exception.
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-state-slot) to `"closed"`.
3.  Clear [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-codec-implementation-slot) and release associated [system resources](https://www.w3.org/TR/webcodecs/#system-resources).
4.  If exception is not an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException), invoke the [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-error-callback-slot) with exception.

### [6.7. EncodedVideoChunkMetadata](https://www.w3.org/TR/webcodecs/#encoded-video-chunk-metadata)

[EncodedVideoChunkOutputCallback](https://www.w3.org/TR/webcodecs/#callbackdef-encodedvideochunkoutputcallback) [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)

```webidl
dictionary EncodedVideoChunkMetadata {
  VideoDecoderConfig decoderConfig;
  SvcOutputMetadata svc;
  BufferSource alphaSideData;
};

dictionary SvcOutputMetadata {
  unsigned long temporalLayerId;
};
```

**`decoderConfig`, of type [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig)**

A [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) that authors _MAY_ use to decode the associated [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk).
**`svc`, of type [SvcOutputMetadata](https://www.w3.org/TR/webcodecs/#dictdef-svcoutputmetadata)**

A collection of metadata describing this [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) with respect to the configured [scalabilityMode](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-scalabilitymode).
**`alphaSideData`, of type [BufferSource](https://webidl.spec.whatwg.org/#BufferSource)**

A [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) that contains the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)’s extra alpha channel data.
**`temporalLayerId`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

A number that identifies the [temporal layer](https://www.w3.org/TR/webcodecs/#temporal-layer) for the associated [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk).
