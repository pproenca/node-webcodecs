---
title: '11. Resource Reclamation'
---

> Section 11 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [11. Resource Reclamation](https://www.w3.org/TR/webcodecs/#resource-reclamation)

When resources are constrained, a User Agent _MAY_ proactively reclaim codecs. This is particularly true in the case where hardware codecs are limited, and shared accross web pages or platform apps.

To reclaim a codec, a User Agent _MUST_ run the appropriate close algorithm (amongst [Close AudioDecoder](https://www.w3.org/TR/webcodecs/#close-audiodecoder), [Close AudioEncoder](https://www.w3.org/TR/webcodecs/#close-audioencoder), [Close VideoDecoder](https://www.w3.org/TR/webcodecs/#close-videodecoder) and [Close VideoEncoder](https://www.w3.org/TR/webcodecs/#close-videoencoder)) with a [QuotaExceededError](https://webidl.spec.whatwg.org/#quotaexceedederror).

The rules governing when a codec may be reclaimed depend on whether the codec is an [active](https://www.w3.org/TR/webcodecs/#active-codec) or [inactive](https://www.w3.org/TR/webcodecs/#inactive-codec) codec and/or a [background](https://www.w3.org/TR/webcodecs/#background-codec) codec.

An active codec is a codec that has made progress on the [\[\[codec work queue\]\]](https://www.w3.org/TR/webcodecs/#codec-work-queue) in the past `10 seconds`.

NOTE: A reliable sign of the working queue’s progress is a call to `output()` callback.

An inactive codec is any codec that does not meet the definition of an [active codec](https://www.w3.org/TR/webcodecs/#active-codec).

A background codec is a codec whose [ownerDocument](https://dom.spec.whatwg.org/#dom-node-ownerdocument) (or [owner set](https://html.spec.whatwg.org/multipage/workers.html#concept-WorkerGlobalScope-owner-set)’s [Document](https://dom.spec.whatwg.org/#document), for codecs in workers) has a [hidden](https://html.spec.whatwg.org/multipage/interaction.html#dom-document-hidden) attribute equal to `true`.

A User Agent _MUST_ only [reclaim a codec](https://www.w3.org/TR/webcodecs/#reclaim-a-codec) that is either an [inactive codec](https://www.w3.org/TR/webcodecs/#inactive-codec), a [background codec](https://www.w3.org/TR/webcodecs/#background-codec), or both. A User Agent _MUST NOT_ reclaim a codec that is both [active](https://www.w3.org/TR/webcodecs/#active-codec) and in the foreground, i.e. not a [background codec](https://www.w3.org/TR/webcodecs/#background-codec).

Additionally, User Agents _MUST NOT_ reclaim an [active](https://www.w3.org/TR/webcodecs/#active-codec) [background](https://www.w3.org/TR/webcodecs/#background-codec) codec if it is:

- An encoder, e.g. an [AudioEncoder](https://www.w3.org/TR/webcodecs/#audioencoder) or [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder).

  NOTE: This prevents long running encode tasks from being interrupted.

- An [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder) or [VideoDecoder](https://www.w3.org/TR/webcodecs/#videodecoder), when there is, respectively, an [active](https://www.w3.org/TR/webcodecs/#active-codec) [AudioEncoder](https://www.w3.org/TR/webcodecs/#audioencoder) or [VideoEncoder](https://www.w3.org/TR/webcodecs/#videoencoder) in the same [global object](https://html.spec.whatwg.org/multipage/webappapis.html#global-object).

  NOTE: This prevents prevents breaking long running transcoding tasks.

- An [AudioDecoder](https://www.w3.org/TR/webcodecs/#audiodecoder), when its tab is audibly playing audio.
