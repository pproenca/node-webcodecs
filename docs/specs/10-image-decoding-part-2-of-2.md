---
title: '10. Image Decoding (Part 2 of 2)'
---

> Section 10 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 2 of 2**

---

1.  If [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot)’s [[[closed]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-closed-slot) slot is `true`, abort these steps.
2.  Let newValue be [the given value](https://webidl.spec.whatwg.org/#the-given-value).
3.  If newValue equals [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot), abort these steps.
4.  Assign newValue to [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot).
5.  Let parentTrackList be [[[ImageTrackList]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagetracklist-slot)
6.  Let oldSelectedIndex be the value of parentTrackList [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).
7.  If oldSelectedIndex is not `-1`:
    1.  Let oldSelectedTrack be the [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack) in parentTrackList [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot) at the position of oldSelectedIndex.
    2.  Assign `false` to oldSelectedTrack [[[selected]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-selected-slot)

8.  If newValue is `true`, let selectedIndex be the index of [this](https://webidl.spec.whatwg.org/#this) [ImageTrack](https://www.w3.org/TR/webcodecs/#imagetrack) within parentTrackList’s [[[track list]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-track-list-slot). Otherwise, let selectedIndex be `-1`.
9.  Assign selectedIndex to parentTrackList [[[selected index]]](https://www.w3.org/TR/webcodecs/#dom-imagetracklist-selected-index-slot).
10. Run the [Reset ImageDecoder](https://www.w3.org/TR/webcodecs/#imagedecoder-reset-imagedecoder) algorithm on [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot).
11. [Queue a control message](https://www.w3.org/TR/webcodecs/#enqueues-a-control-message) to [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot)’s [control message queue](https://www.w3.org/TR/webcodecs/#control-message-queue) to update the internal selected track index with selectedIndex.
12. [Process the control message queue](https://www.w3.org/TR/webcodecs/#process-the-control-message-queue) belonging to [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot).

[Running a control message](https://www.w3.org/TR/webcodecs/#running-a-control-message) to update the internal selected track index means running these steps:

1.  Enqueue the following steps to [[[ImageDecoder]]](https://www.w3.org/TR/webcodecs/#dom-imagetrack-imagedecoder-slot)’s [[[codec work queue]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-codec-work-queue-slot):
    1.  Assign selectedIndex to [[[internal selected track index]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-internal-selected-track-index-slot).
    2.  Remove all entries from [[[progressive frame generations]]](https://www.w3.org/TR/webcodecs/#dom-imagedecoder-progressive-frame-generations-slot).
