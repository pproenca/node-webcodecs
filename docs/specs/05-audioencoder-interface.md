---
title: '5. AudioEncoder Interface'
---

> Section 5 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [5. AudioEncoder Interface](https://www.w3.org/TR/webcodecs/#audioencoder-interface)

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioEncoder : EventTarget {
  constructor(AudioEncoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long encodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioEncoderConfig config);
  undefined encode(AudioData data);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioEncoderSupport> isConfigSupported(AudioEncoderConfig config);
};

dictionary AudioEncoderInit {
  required EncodedAudioChunkOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback EncodedAudioChunkOutputCallback =
    undefined (EncodedAudioChunk output,
               optional EncodedAudioChunkMetadata metadata = {});
```

### [5.1. Internal Slots](https://www.w3.org/TR/webcodecs/#audioencoder-internal-slots)

**`[[control message queue]]`**

A [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message) to be performed upon this [codec](https://www.w3.org/TR/webcodecs/#codec) instance. See [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
**`[[message queue blocked]]`**

A boolean indicating when processing the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-control-message-queue-slot) is blocked by a pending [control message](https://www.w3.org/TR/webcodecs/#control-message). See [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked).
**`[[codec implementation]]`**

Underlying encoder implementation provided by the User Agent. See [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation).
**`[[codec work queue]]`**

A [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) used for running parallel steps that reference the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot). See [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).
**`[[codec saturated]]`**

A boolean indicating when the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) is unable to accept additional encoding work.
**`[[output callback]]`**

Callback given at construction for encoded outputs.
**`[[error callback]]`**

Callback given at construction for encode errors.
**`[[active encoder config]]`**

The [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) that is actively applied.
**`[[active output config]]`**

The [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) that describes how to decode the most recently emitted [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk).
**`[[state]]`**

The current [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate) of this [AudioEncoder](https://www.w3.org/TR/webcodecs/#audioencoder).
**`[[encodeQueueSize]]`**

The number of pending encode requests. This number will decrease as the underlying codec is ready to accept new input.
**`[[pending flush promises]]`**

A list of unresolved promises returned by calls to [flush()](https://www.w3.org/TR/webcodecs/#dom-audioencoder-flush).
**`[[dequeue event scheduled]]`**

A boolean indicating whether a [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audioencoder-dequeue) event is already scheduled to fire. Used to avoid event spam.

### [5.2. Constructors](https://www.w3.org/TR/webcodecs/#audioencoder-constructors)

`AudioEncoder(init)`

1.  Let e be a new [AudioEncoder](https://www.w3.org/TR/webcodecs/#audioencoder) object.
2.  Assign a new [queue](https://infra.spec.whatwg.org/#queue) to [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-control-message-queue-slot).
3.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-message-queue-blocked-slot).
4.  Assign `null` to [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot).
5.  Assign the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-work-queue-slot).
6.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-saturated-slot).
7.  Assign init.output to [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-output-callback-slot).
8.  Assign init.error to [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-error-callback-slot).
9.  Assign `null` to [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-encoder-config-slot).
10. Assign `null` to [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-output-config-slot).
11. Assign `"unconfigured"` to [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot)
12. Assign `0` to [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot).
13. Assign a new [list](https://infra.spec.whatwg.org/#list) to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-pending-flush-promises-slot).
14. Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-dequeue-event-scheduled-slot).
15. Return e.

### [5.3. Attributes](https://www.w3.org/TR/webcodecs/#audioencoder-attributes)

**`state`, of type [CodecState](https://www.w3.org/TR/webcodecs/#enumdef-codecstate), readonly**

Returns the value of [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot).
**`encodeQueueSize`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot).
**`ondequeue`, of type [EventHandler](https://html.spec.whatwg.org/multipage/webappapis.html#eventhandler)**

An [event handler IDL attribute](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes) whose [event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) is [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audioencoder-dequeue).

### [5.4. Event Summary](https://www.w3.org/TR/webcodecs/#audioencoder-event-summary)

**`dequeue`**

Fired at the [AudioEncoder](https://www.w3.org/TR/webcodecs/#audioencoder) when the [encodeQueueSize](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize) has decreased.

### [5.5. Methods](https://www.w3.org/TR/webcodecs/#audioencoder-methods)

**`configure(config)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the audio encoder for encoding audio data as described by config.

NOTE: This method will trigger a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) if the User Agent does not support config. Authors are encouraged to first check support by calling [isConfigSupported()](https://www.w3.org/TR/webcodecs/#dom-audioencoder-isconfigsupported) with config. User Agents don’t have to support any particular codec type or configuration.

When invoked, run these steps:

1.  If config is not a [valid AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#valid-audioencoderconfig), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) to `"configured"`.
4.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to configure the encoder using config.
5.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to configure the encoder means performing these steps:

1.  Assign `true` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-message-queue-blocked-slot).
2.  Enqueue the following steps to [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-work-queue-slot):
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  If supported is `false`, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close AudioEncoder](https://www.w3.org/TR/webcodecs/#close-audioencoder) algorithm with [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) and abort these steps.
    3.  If needed, assign [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) with an implementation supporting config.
    4.  Configure [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) with config.
    5.  [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Assign `false` to [[[message queue blocked]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-message-queue-blocked-slot).
        2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

3.  Return `"processed"`.
    **`encode(data)`**

[Enqueues a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to encode the given data.

When invoked, run these steps:

1.  If the value of data’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) is not `"configured"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
3.  Let dataClone hold the result of running the [Clone AudioData](https://www.w3.org/TR/webcodecs/#clone-audiodata) algorithm with data.
4.  Increment [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot).
5.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to encode dataClone.
6.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to encode the data means performing these steps:

1.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-saturated-slot) equals `true`, return `"not processed"`.
2.  If encoding data will cause the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) to become [saturated](https://www.w3.org/TR/webcodecs/#saturated), assign `true` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-saturated-slot).
3.  Decrement [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot) and run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#audioencoder-schedule-dequeue-event) algorithm.
4.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-work-queue-slot):
    1.  Attempt to use [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) to encode the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) described by dataClone.
    2.  If encoding results in an error, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Close AudioEncoder](https://www.w3.org/TR/webcodecs/#close-audioencoder) algorithm with [EncodingError](https://webidl.spec.whatwg.org/#encodingerror) and return.
    3.  If [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-saturated-slot) equals `true` and [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) is no longer [saturated](https://www.w3.org/TR/webcodecs/#saturated), [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform the following steps:
        1.  Assign `false` to [[[codec saturated]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-saturated-slot).
        2.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).

    4.  Let encoded outputs be a [list](https://infra.spec.whatwg.org/#list) of encoded audio data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot).
    5.  If encoded outputs is not empty, [queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the [Output EncodedAudioChunks](https://www.w3.org/TR/webcodecs/#output-encodedaudiochunks) algorithm with encoded outputs.

5.  Return `"processed"`.
    **`flush()`**

Completes all [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) and emits all outputs.

When invoked, run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) is not `"configured"`, return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Let promise be a new Promise.
3.  Append promise to [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-pending-flush-promises-slot).
4.  [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to flush the codec with promise.
5.  [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue).
6.  Return promise.

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to flush the codec means performing these steps with promise.

1.  Enqueue the following steps to the [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-work-queue-slot):
    1.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) to emit all [internal pending outputs](https://www.w3.org/TR/webcodecs/#internal-pending-output).
    2.  Let encoded outputs be a [list](https://infra.spec.whatwg.org/#list) of encoded audio data outputs emitted by [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot).
    3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to perform these steps:
        1.  If encoded outputs is not empty, run the [Output EncodedAudioChunks](https://www.w3.org/TR/webcodecs/#output-encodedaudiochunks) algorithm with encoded outputs.
        2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-pending-flush-promises-slot).
        3.  Resolve promise.

2.  Return `"processed"`.
    **`reset()`**

Immediately resets all state including configuration, [control messages](https://www.w3.org/TR/webcodecs/#control-message) in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue), and all pending callbacks.

When invoked, run the [Reset AudioEncoder](https://www.w3.org/TR/webcodecs/#reset-audioencoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`close()`**

Immediately aborts all pending work and releases [system resources](https://www.w3.org/TR/webcodecs/#system-resources). Close is final.

When invoked, run the [Close AudioEncoder](https://www.w3.org/TR/webcodecs/#close-audioencoder) algorithm with an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
**`isConfigSupported(config)`**

Returns a promise indicating whether the provided config is supported by the User Agent.

NOTE: The returned [AudioEncoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-audioencodersupport) [config](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-config) will contain only the dictionary members that User Agent recognized. Unrecognized dictionary members will be ignored. Authors can detect unrecognized dictionary members by comparing [config](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-config) to their provided config.

When invoked, run these steps:

1.  If config is not a [valid AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#valid-audioencoderconfig), return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let p be a new Promise.
3.  Let checkSupportQueue be the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).
4.  Enqueue the following steps to checkSupportQueue:
    1.  Let supported be the result of running the [Check Configuration Support](https://www.w3.org/TR/webcodecs/#check-configuration-support) algorithm with config.
    2.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
        1.  Let encoderSupport be a newly constructed [AudioEncoderSupport](https://www.w3.org/TR/webcodecs/#dictdef-audioencodersupport), initialized as follows:
            1.  Set [config](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-config) to the result of running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with config.
            2.  Set [supported](https://www.w3.org/TR/webcodecs/#dom-audioencodersupport-supported) to supported.

        2.  Resolve p with encoderSupport.

5.  Return p.

### [5.6. Algorithms](https://www.w3.org/TR/webcodecs/#audioencoder-algorithms)

#### Schedule Dequeue Event

1.  If [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-dequeue-event-scheduled-slot) equals `true`, return.
2.  Assign `true` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-dequeue-event-scheduled-slot).
3.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to run the following steps:
    1.  Fire a simple event named [dequeue](https://www.w3.org/TR/webcodecs/#eventdef-audioencoder-dequeue) at [this](https://webidl.spec.whatwg.org/#this).
    2.  Assign `false` to [[[dequeue event scheduled]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-dequeue-event-scheduled-slot).

#### Output EncodedAudioChunks (with outputs)

Run these steps:

1.  For each output in outputs:
    1.  Let chunkInit be an [EncodedAudioChunkInit](https://www.w3.org/TR/webcodecs/#dictdef-encodedaudiochunkinit) with the following keys:
        1.  Let [data](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-data) contain the encoded audio data from output.
        2.  Let [type](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-type) be the [EncodedAudioChunkType](https://www.w3.org/TR/webcodecs/#enumdef-encodedaudiochunktype) of output.
        3.  Let [timestamp](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-timestamp) be the [timestamp](https://www.w3.org/TR/webcodecs/#dom-audiodata-timestamp) from the AudioData associated with output.
        4.  Let [duration](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-duration) be the [duration](https://www.w3.org/TR/webcodecs/#dom-audiodata-duration) from the AudioData associated with output.

    2.  Let chunk be a new [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) constructed with chunkInit.
    3.  Let chunkMetadata be a new [EncodedAudioChunkMetadata](https://www.w3.org/TR/webcodecs/#dictdef-encodedaudiochunkmetadata).
    4.  Let encoderConfig be the [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-encoder-config-slot).
    5.  Let outputConfig be a new [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) that describes output. Initialize outputConfig as follows:
        1.  Assign encoderConfig.[codec](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-codec) to outputConfig.[codec](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-codec).
        2.  Assign encoderConfig.[sampleRate](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-samplerate) to outputConfig.[sampleRate](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-samplerate).
        3.  Assign to encoderConfig.[numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audioencoderconfig-numberofchannels) to outputConfig.[numberOfChannels](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-numberofchannels).
        4.  Assign outputConfig.[description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) with a sequence of codec specific bytes as determined by the [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot). The User Agent _MUST_ ensure that the provided description could be used to correctly decode output.

            NOTE: The codec specific requirements for populating the [description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) are described in the [\[WEBCODECS-CODEC-REGISTRY\]](https://www.w3.org/TR/webcodecs/#biblio-webcodecs-codec-registry).

    6.  If outputConfig and [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-output-config-slot) are not [equal dictionaries](https://www.w3.org/TR/webcodecs/#equal-dictionaries):
        1.  Assign outputConfig to chunkMetadata.[decoderConfig](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkmetadata-decoderconfig).
        2.  Assign outputConfig to [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-output-config-slot).

    7.  Invoke [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-output-callback-slot) with chunk and chunkMetadata.

#### Reset AudioEncoder (with exception)

Run these steps:

1.  If [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) is `"closed"`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror).
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) to `"unconfigured"`.
3.  Set [[[active encoder config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-encoder-config-slot) to `null`.
4.  Set [[[active output config]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-active-output-config-slot) to `null`.
5.  Signal [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) to cease producing output for the previous configuration.
6.  Remove all [control messages](https://www.w3.org/TR/webcodecs/#control-message) from the [[[control message queue]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-control-message-queue-slot).
7.  If [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot) is greater than zero:
    1.  Set [[[encodeQueueSize]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-encodequeuesize-slot) to zero.
    2.  Run the [Schedule Dequeue Event](https://www.w3.org/TR/webcodecs/#audioencoder-schedule-dequeue-event) algorithm.

8.  For each promise in [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-pending-flush-promises-slot):
    1.  Reject promise with exception.
    2.  Remove promise from [[[pending flush promises]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-pending-flush-promises-slot).

#### Close AudioEncoder (with exception)

Run these steps:

1.  Run the [Reset AudioEncoder](https://www.w3.org/TR/webcodecs/#reset-audioencoder) algorithm with exception.
2.  Set [[[state]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-state-slot) to `"closed"`.
3.  Clear [[[codec implementation]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-codec-implementation-slot) and release associated [system resources](https://www.w3.org/TR/webcodecs/#system-resources).
4.  If exception is not an [AbortError](https://webidl.spec.whatwg.org/#aborterror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException), invoke the [[[error callback]]](https://www.w3.org/TR/webcodecs/#dom-audioencoder-error-callback-slot) with exception.

### [5.7. EncodedAudioChunkMetadata](https://www.w3.org/TR/webcodecs/#encoded-audio-chunk-metadata)

[EncodedAudioChunkOutputCallback](https://www.w3.org/TR/webcodecs/#callbackdef-encodedaudiochunkoutputcallback) [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk)

```webidl
dictionary EncodedAudioChunkMetadata {
  AudioDecoderConfig decoderConfig;
};
```

**`decoderConfig`, of type [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig)**

A [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) that authors _MAY_ use to decode the associated [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk).
