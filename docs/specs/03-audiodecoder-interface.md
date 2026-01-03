---
title: '3. AudioDecoder Interface'
---

> Section 3 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [3. AudioDecoder Interface](https://www.w3.org/TR/webcodecs/#audiodecoder-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioDecoder : EventTarget {
  constructor(AudioDecoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long decodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioDecoderConfig config);
  undefined decode(EncodedAudioChunk chunk);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioDecoderSupport> isConfigSupported(AudioDecoderConfig config);
};

dictionary AudioDecoderInit {
  required AudioDataOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback AudioDataOutputCallback = undefined(AudioData output);
```

### [3.1. Internal Slots](https://www.w3.org/TR/webcodecs/#audiodecoder-internal-slots)

**`[[control message queue]]`**

A [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message) to be performed upon this [codec](https://www.w3.org/TR/webcodecs/#codec) instance. See [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
**`[[message queue blocked]]`**

A boolean indicating when processing the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-control-message-queue-slot) is blocked by a pending [control message](https://www.w3.org/TR/webcodecs/#control-message). See [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked).
**`[[codec implementation]]`**

Underlying decoder implementation provided by the User Agent. See [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation).
**`[[codec work queue]]`**

A [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) used for running parallel steps that reference the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot). See [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).
**`[[codec saturated]]`**

A boolean indicating when the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) is unable to accept additional decoding work.
**`[[output callback]]`**

Callback given at construction for decoded outputs.
**`[[error callback]]`**

Callback given at construction for decode errors.
**`[[key chunk required]]`**

A boolean indicating that the next chunk passed to [decode()](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decode) _MUST_ describe a [key chunk](https://www.w3.org/TR/webcodecs/#key-chunk) as indicated by [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot).
**`[[state]]`**

The current [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate) of this [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder).
**`[[decodeQueueSize]]`**

The number of pending decode requests. This number will decrease as the underlying codec is ready to accept new input.
**`[[pending flush promises]]`**

A list of unresolved promises returned by calls to [flush()](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-flush).
**`[[dequeue event scheduled]]`**

A boolean indicating whether a [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audiodecoder-dequeue) event is already scheduled to fire. Used to avoid event spam.

### [3.2. Constructors](https://www.w3.org/TR/webcodecs/#audiodecoder-constructors)

`AudioDecoder(init)`

1.  Let d be a new [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder) object.
2.  Assign a new [queue](https://infra.spec.whatwg.org/#queue) to [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-control-message-queue-slot).
3.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-message-queue-blocked-slot).
4.  Assign `null` to [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot).
5.  Assign the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-work-queue-slot).
6.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-saturated-slot).
7.  Assign init.output to [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-output-callback-slot).
8.  Assign init.error to [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-error-callback-slot).
9.  Assign `true` to [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-key-chunk-required-slot).
10. Assign `"unconfigured"` to [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot)
11. Assign `0` to [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot).
12. Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-pending-flush-promises-slot).
13. Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-dequeue-event-scheduled-slot).
14. Return d.

### [3.3. Attributes](https://www.w3.org/TR/webcodecs/#audiodecoder-attributes)

**`state`, of type [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate), readonly**

Returns the value of [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot).
**`decodeQueueSize`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot).
**`ondequeue`, of type [EventHandler](https://html.spec.whatwg.org/multipage/webappapis.html#eventhandler)**

An [event handler IDL attribute](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes) whose [event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) is [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audiodecoder-dequeue).

### [3.4. Event Summary](https://www.w3.org/TR/webcodecs/#audiodecoder-event-summary)

**`dequeue`**

Fired at the [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder) when the [decodeQueueSize](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize) has decreased.

### [3.5. Methods](https://www.w3.org/TR/webcodecs/#audiodecoder-methods)

**`configure(config)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the audio decoder for decoding chunks as described by config.

NOTE: This method will trigger a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if the User Agent does not support config. Authors are encouraged to first check support by calling [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-isconfigsupported) with config. User Agents don’t have to support any particular codec type or configuration.

When invoked, run these steps:

1.  If config is not a [valid AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#valid-audiodecoderconfig), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) is `“closed”`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) to `"configured"`.
4.  Set [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-key-chunk-required-slot) to `true`.
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the decoder with config.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to configure the decoder means running these steps:

1.  Assign `true` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-message-queue-blocked-slot).
2.  Enqueue the following steps to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-work-queue-slot):
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  If supported is `false`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close AudioDecoder](https://www.w3.org/TR/webcodecs/#close-audiodecoder) algorithm with [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) and abort these steps.
    3.  If needed, assign [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) with an implementation supporting config.
    4.  Configure [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) with config.
    5.  [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-message-queue-blocked-slot).
        2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

3.  Return `"processed"`.
    **`decode(chunk)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to decode the given chunk.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) is not `"configured"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  If [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-key-chunk-required-slot) is `true`:
    1.  If chunk.[[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot) is not [key](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunktype-key), throw a [DataError](https://webidl.spec.whatwg.org/#dataerror).
    2.  Implementers _SHOULD_ inspect the chunk’s [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot) to verify that it is truly a [key chunk](https://www.w3.org/TR/webcodecs/#key-chunk). If a mismatch is detected, throw a [DataError](https://webidl.spec.whatwg.org/#dataerror).
    3.  Otherwise, assign `false` to [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-key-chunk-required-slot).

3.  Increment [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot).
4.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to decode the chunk.
5.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to decode the chunk means performing these steps:

1.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-saturated-slot) equals `true`, return `"not processed"`.
2.  If decoding chunk will cause the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) to become [saturated](https://www.w3.org/TR/webcodecs/#saturated), assign `true` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-saturated-slot).
3.  Decrement [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot) and run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#audiodecoder-schedule-dequeue-event) algorithm.
4.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-work-queue-slot):
    1.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) to decode the chunk.
    2.  If decoding results in an error, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close AudioDecoder](https://www.w3.org/TR/webcodecs/#close-audiodecoder) algorithm with [EncodingError](https://webidl.spec.whatwg.org/#encodingerror) and return.
    3.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-saturated-slot) equals `true` and [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) is no longer [saturated](https://www.w3.org/TR/webcodecs/#saturated), [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
        1.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-saturated-slot).
        2.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

    4.  Let decoded outputs be a [list](https://infra.spec.whatwg.org/#list) of decoded audio data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot).
    5.  If decoded outputs is not empty, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Output AudioData](https://www.w3.org/TR/webcodecs/#output-audiodata) algorithm with decoded outputs.

5.  Return `"processed"`.
    **`flush()`**

Completes all [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) and emits all outputs.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) is not `"configured"`, return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Set [[[key chunk required]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-key-chunk-required-slot) to `true`.
3.  Let promise be a new Promise.
4.  Append promise to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-pending-flush-promises-slot).
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to flush the codec with promise.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
7.  Return promise.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to flush the codec means performing these steps with promise.

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-work-queue-slot):
    1.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) to emit all [internal pending outputs](https://www.w3.org/TR/webcodecs/#internal-pending-output).
    2.  Let decoded outputs be a [list](https://infra.spec.whatwg.org/#list) of decoded audio data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot).
    3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
        1.  If decoded outputs is not empty, run the [Output AudioData](https://www.w3.org/TR/webcodecs/#output-audiodata) algorithm with decoded outputs.
        2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-pending-flush-promises-slot).
        3.  Resolve promise.

2.  Return `"processed"`.
    **`reset()`**

Immediately resets all state including configuration, [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue), and all pending callbacks.

When invoked, run the [Reset AudioDecoder](https://www.w3.org/TR/webcodecs/#reset-audiodecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`close()`**

Immediately aborts all pending work and releases [system resources](https://www.w3.org/TR/webcodecs/#system-resources). Close is final.

When invoked, run the [Close AudioDecoder](https://www.w3.org/TR/webcodecs/#close-audiodecoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`isConfigSupported(config)`**

Returns a promise indicating whether the provided config is supported by the User Agent.

NOTE: The returned [AudioDecoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-audiodecodersupport) [config](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-config) will contain only the dictionary members that User Agent recognized. Unrecognized dictionary members will be ignored. Authors can detect unrecognized dictionary members by comparing [config](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-config) to their provided config.

When invoked, run these steps:

1.  If config is not a [valid AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#valid-audiodecoderconfig), return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let p be a new Promise.
3.  Let checkSupportQueue be the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).
4.  Enqueue the following steps to checkSupportQueue:
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Let decoderSupport be a newly constructed [AudioDecoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-audiodecodersupport), initialized as follows:
            1.  Set [config](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-config) to the result of running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with config.
            2.  Set [supported](https://www.w3.org/TR/webcodecs/#dom-audiodecodersupport-supported) to supported.

        2.  Resolve p with decoderSupport.

5.  Return p.

### [3.6. Algorithms](https://www.w3.org/TR/webcodecs/#audiodecoder-algorithms)

#### Schedule Dequeue Event

1.  If [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-dequeue-event-scheduled-slot) equals `true`, return.
2.  Assign `true` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-dequeue-event-scheduled-slot).
3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
    1.  Fire a simple event named [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audiodecoder-dequeue) at [this](https://webidl.spec.whatwg.org/#this).
    2.  Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-dequeue-event-scheduled-slot).

#### Output AudioData (with outputs)

Run these steps:

1.  For each output in outputs:
    1.  Let data be an [AudioData](https://www.w3.org/TR/webcodecs/#audiodata), initialized as follows:
        1.  Assign `false` to [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached).
        2.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) described by output.
        3.  Let resourceReference be a reference to resource.
        4.  Assign resourceReference to [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-resource-reference-slot).
        5.  Let timestamp be the [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-timestamp-slot) of the [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) associated with output.
        6.  Assign timestamp to [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-timestamp-slot).
        7.  If output uses a recognized [AudioSampleFormat](https://www.w3.org/TR/webcodecs/#enumdef-audiosampleformat), assign that format to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot). Otherwise, assign `null` to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-format-slot).
        8.  Assign values to [[[sample rate]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-sample-rate-slot), [[[number of frames]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-frames-slot), and [[[number of channels]]](https://www.w3.org/TR/webcodecs/#dom-audiodata-number-of-channels-slot) as determined by output.

    2.  Invoke [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-output-callback-slot) with data.

#### Reset AudioDecoder (with exception)

Run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) to `"unconfigured"`.
3.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) to cease producing output for the previous configuration.
4.  Remove all [control messages](https://www.w3.org/TR/webcodecs/#control-message) from the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-control-message-queue-slot).
5.  If [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot) is greater than zero:
    1.  Set [[[decodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-decodequeuesize-slot) to zero.
    2.  Run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#audiodecoder-schedule-dequeue-event) algorithm.

6.  For each promise in [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-pending-flush-promises-slot):
    1.  Reject promise with exception.
    2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-pending-flush-promises-slot).

#### Close AudioDecoder (with exception)

Run these steps:

1.  Run the [Reset AudioDecoder](https://www.w3.org/TR/webcodecs/#reset-audiodecoder) algorithm with exception.
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-state-slot) to `"closed"`.
3.  Clear [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-codec-implementation-slot) and release associated [system resources](https://www.w3.org/TR/webcodecs/#system-resources).
4.  If exception is not an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException), invoke the [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-audiodecoder-error-callback-slot) with exception.
