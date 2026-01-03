---
title: '2. Codec Processing Model'
---

> Section 2 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [2. Codec Processing Model](https://www.w3.org/TR/webcodecs/#codec-processing-model-section)

### [2.1. Background](https://www.w3.org/TR/webcodecs/#processing-model-background)

This section is non-normative.

The codec interfaces defined by the specification are designed such that new codec tasks can be scheduled while previous tasks are still pending. For example, web authors can call `decode()` without waiting for a previous `decode()` to complete. This is achieved by offloading underlying codec tasks to a separate [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue) for parallel execution.

This section describes threading behaviors as they are visible from the perspective of web authors. Implementers can choose to use more threads, as long as the externally visible behaviors of blocking and sequencing are maintained as follows.

### [2.2. Control Messages](https://www.w3.org/TR/webcodecs/#control-messages)

A control message defines a sequence of steps corresponding to a method invocation on a [codec](https://www.w3.org/TR/webcodecs/#codec) instance (e.g. `encode()`).

A control message queue is a [queue](https://infra.spec.whatwg.org/#queue) of [control messages](https://www.w3.org/TR/webcodecs/#control-message). Each [codec](https://www.w3.org/TR/webcodecs/#codec) instance has a control message queue stored in an internal slot named \[\[control message queue\]\].

Queuing a control message means [enqueuing](https://infra.spec.whatwg.org/#queue-enqueue) the message to a [codec](https://www.w3.org/TR/webcodecs/#codec)’s [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot). Invoking codec methods will generally queue a control message to schedule work.

Running a control message means performing a sequence of steps specified by the method that enqueued the message.

The steps of a given control message can block processing later messages in the control message queue. Each [codec](https://www.w3.org/TR/webcodecs/#codec) instance has a boolean internal slot named \[\[message queue blocked\]\] that is set to `true` when this occurs. A blocking message will conclude by setting [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked) to `false` and rerunning the [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue) steps.

All control messages will return either `"processed"` or `"not processed"`. Returning `"processed"` indicates the message steps are being (or have been) executed and the message may be removed from the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue). `"not processed"` indicates the message must not be processed at this time and should remain in the [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) to be retried later.

To Process the control message queue, run these steps:

1.  While [\[\[message queue blocked\]\]](https://www.w3.org/TR/webcodecs/#message-queue-blocked) is `false` and [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot) is not empty:
    1.  Let front message be the first message in [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).
    2.  Let outcome be the result of running the [control message steps](https://www.w3.org/TR/webcodecs/#running-a-control-message) described by front message.
    3.  If outcome equals `"not processed"`, break.
    4.  Otherwise, dequeue front message from the [\[\[control message queue\]\]](https://www.w3.org/TR/webcodecs/#control-message-queue-slot).

### [2.3. Codec Work Parallel Queue](https://www.w3.org/TR/webcodecs/#codec-work-parallel-queue)

Each [codec](https://www.w3.org/TR/webcodecs/#codec) instance has an internal slot named \[\[codec work queue\]\] that is a [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).

Each [codec](https://www.w3.org/TR/webcodecs/#codec) instance has an internal slot named \[\[codec implementation\]\] that refers to the underlying platform encoder or decoder. Except for the initial assignment, any steps that reference [\[\[codec implementation\]\]](https://www.w3.org/TR/webcodecs/#codec-implementation) will be enqueued to the [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue).

Each [codec](https://www.w3.org/TR/webcodecs/#codec) instance has a unique codec task source. Tasks [queued](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) from the [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue) to the [event loop](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop) will use the [codec task source](https://www.w3.org/TR/webcodecs/#codec-task-source).
