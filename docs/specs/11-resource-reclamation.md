# 11. Resource Reclamation

When resources are constrained, a User Agent _MAY_ proactively reclaim codecs. This is particularly true in the case where hardware codecs are limited, and shared accross web pages or platform apps.

To reclaim a codec, a User Agent _MUST_ run the appropriate close algorithm (amongst [Close AudioDecoder](#close-audiodecoder), [Close AudioEncoder](#close-audioencoder), [Close VideoDecoder](#close-videodecoder) and [Close VideoEncoder](#close-videoencoder)) with a [`QuotaExceededError`](https://webidl.spec.whatwg.org/#quotaexceedederror).

The rules governing when a codec may be reclaimed depend on whether the codec is an [active](#active-codec) or [inactive](#inactive-codec) codec and/or a [background](#background-codec) codec.

An active codec is a codec that has made progress on the [\[\[codec work queue\]\]](#codec-work-queue) in the past `10 seconds`.

NOTE: A reliable sign of the working queue’s progress is a call to `output()` callback.

An inactive codec is any codec that does not meet the definition of an [active codec](#active-codec).

A background codec is a codec whose [`ownerDocument`](https://dom.spec.whatwg.org/#dom-node-ownerdocument) (or [owner set](https://html.spec.whatwg.org/multipage/workers.html#concept-WorkerGlobalScope-owner-set)’s [`Document`](https://dom.spec.whatwg.org/#document), for codecs in workers) has a [`hidden`](https://html.spec.whatwg.org/multipage/interaction.html#dom-document-hidden) attribute equal to `true`.

A User Agent _MUST_ only [reclaim a codec](#reclaim-a-codec) that is either an [inactive codec](#inactive-codec), a [background codec](#background-codec), or both. A User Agent _MUST NOT_ reclaim a codec that is both [active](#active-codec) and in the foreground, i.e. not a [background codec](#background-codec).

Additionally, User Agents _MUST NOT_ reclaim an [active](#active-codec) [background](#background-codec) codec if it is:

-   An encoder, e.g. an [`AudioEncoder`](#audioencoder) or [`VideoEncoder`](#videoencoder).
    
    NOTE: This prevents long running encode tasks from being interrupted.
    
-   An [`AudioDecoder`](#audiodecoder) or [`VideoDecoder`](#videodecoder), when there is, respectively, an [active](#active-codec) [`AudioEncoder`](#audioencoder) or [`VideoEncoder`](#videoencoder) in the same [global object](https://html.spec.whatwg.org/multipage/webappapis.html#global-object).
    
    NOTE: This prevents prevents breaking long running transcoding tasks.
    
-   An [`AudioDecoder`](#audiodecoder), when its tab is audibly playing audio.

---

[← Back to Table of Contents](../TOC.md)
