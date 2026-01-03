---
title: '9. Raw Media Interfaces (Part 2 of 4)'
---

> Section 9 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 2 of 4**

---

1.  If init is not a [valid VideoFrameBufferInit](https://www.w3.org/TR/webcodecs/#valid-videoframebufferinit), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Let defaultRect be «\[ "x:" → `0`, "y" → `0`, "width" → init.[codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedwidth), "height" → init.[codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedwidth) \]».
3.  Let overrideRect be `undefined`.
4.  If init.[visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect) [exists](https://infra.spec.whatwg.org/#map-exists), assign its value to overrideRect.
5.  Let parsedRect be the result of running the [Parse Visible Rect](https://www.w3.org/TR/webcodecs/#videoframe-parse-visible-rect) algorithm with defaultRect, overrideRect, init.[codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedwidth), init.[codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedheight), and init.[format](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-format).
6.  If parsedRect is an exception, return parsedRect.
7.  Let optLayout be `undefined`.
8.  If init.[layout](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-layout) [exists](https://infra.spec.whatwg.org/#map-exists), assign its value to optLayout.
9.  Let combinedLayout be the result of running the [Compute Layout and Allocation Size](https://www.w3.org/TR/webcodecs/#videoframe-compute-layout-and-allocation-size) algorithm with parsedRect, init.[format](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-format), and optLayout.
10. If combinedLayout is an exception, throw combinedLayout.
11. If `data.byteLength` is less than combinedLayout’s [allocationSize](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-allocationsize), throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
12. If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-transfer) contains more than one reference to the same [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer), then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
13. For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-transfer):
    1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

14. If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-transfer) contains an [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer) referenced by data the User Agent _MAY_ choose to:
    1.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referencing pixel data in data.

15. Otherwise:
    1.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) containing a copy of data. Use [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect) and [layout](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-layout) to determine where in data the pixels for each plane reside.

        The User Agent _MAY_ choose to allocate resource with a larger coded size and plane strides to improve memory alignment. Increases will be reflected by [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) and [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight). Additionally, the User Agent _MAY_ use [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect) to copy only the visible rectangle. It _MAY_ also reposition the visible rectangle within resource. The final position will be reflected by [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).

16. For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-transfer):
    1.  Perform [DetachArrayBuffer](https://tc39.es/ecma262/#sec-detacharraybuffer) on transferable

17. Let resourceCodedWidth be the coded width of resource.
18. Let resourceCodedHeight be the coded height of resource.
19. Let resourceVisibleLeft be the left offset for the visible rectangle of resource.
20. Let resourceVisibleTop be the top offset for the visible rectangle of resource.

    [](https://www.w3.org/TR/webcodecs/#issue-4948f268)The spec _SHOULD_ provide definitions (and possibly diagrams) for coded size, visible rectangle, and display size. See [#166](https://github.com/w3c/webcodecs/issues/166).

21. Let frame be a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) object initialized as follows:
    1.  Assign resourceCodedWidth, resourceCodedHeight, resourceVisibleLeft, and resourceVisibleTop to [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot), [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot), [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), and [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot) respectively.
    2.  If init.[visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect) [exists](https://infra.spec.whatwg.org/#map-exists):
        1.  Let truncatedVisibleWidth be the value of [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) after truncating.
        2.  Assign truncatedVisibleWidth to [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot).
        3.  Let truncatedVisibleHeight be the value of [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) after truncating.
        4.  Assign truncatedVisibleHeight to [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot).

    3.  Otherwise:
        1.  Assign [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot) to [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot).
        2.  Assign [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot) to [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot).

    4.  Assign the result of running the [Parse Rotation](https://www.w3.org/TR/webcodecs/#videoframe-parse-rotation) algorithm, with init.[rotation](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-rotation), to [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot).
    5.  Assign init.[flip](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-flip) to [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot).
    6.  If [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displaywidth) and [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displayheight) [exist](https://infra.spec.whatwg.org/#map-exists) in init, assign them to [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot) and [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot) respectively.
    7.  Otherwise:
        1.  If [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) is equal to `0` or `180`:
            1.  Assign [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot) to [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot).
            2.  Assign [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) to [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).

        2.  Otherwise:
            1.  Assign [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) to [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot).
            2.  Assign [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot) to [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).

    8.  Assign init’s [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-timestamp) and [duration](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-duration) to [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot) and [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot) respectively.
    9.  Let colorSpace be `undefined`.
    10. If init.[colorSpace](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-colorspace) [exists](https://infra.spec.whatwg.org/#map-exists), assign its value to colorSpace.
    11. Assign init’s [format](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-format) to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
    12. Assign the result of running the [Pick Color Space](https://www.w3.org/TR/webcodecs/#videoframe-pick-color-space) algorithm, with colorSpace and [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot), to [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot).
    13. Assign the result of calling [Copy VideoFrame metadata](https://www.w3.org/TR/webcodecs/#videoframe-copy-videoframe-metadata) with init’s [metadata](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-metadata) to frame.[[[metadata]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-metadata-slot).

22. Return frame.

#### [9.4.3. Attributes](https://www.w3.org/TR/webcodecs/#videoframe-attributes)

**`format`, of type [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat), readonly, nullable**

Describes the arrangement of bytes in each plane as well as the number and order of the planes. Will be `null` whenever the underlying format does not map to a [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) or when [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`.

The [format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format) getter steps are to return [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
**`codedWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Width of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.

The [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) getter steps are to return [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot).
**`codedHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Height of the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments.

The [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) getter steps are to return [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot).
**`codedRect`, of type [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly), readonly, nullable**

A [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly) with [width](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-width) and [height](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-height) matching [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) and [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) and [x](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-x) and [y](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-y) at `(0,0)`. Offered for convenience for use with [allocationSize()](https://www.w3.org/TR/webcodecs/#dom-videoframe-allocationsize) and [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto).

The [codedRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedrect) getter steps are:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, return `null`.
2.  Let rect be a new [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly), initialized as follows:
    1.  Assign `0` to [x](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-x) and [y](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-y).
    2.  Assign [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot) and [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot) to [width](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-width) and [height](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-height) respectively.

3.  Return rect.
    **`visibleRect`, of type [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly), readonly, nullable**

A [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly) describing the visible rectangle of pixels for this [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).

The [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect) getter steps are:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, return `null`.
2.  Let rect be a new [DOMRectReadOnly](https://www.w3.org/TR/geometry-1/#domrectreadonly), initialized as follows:
    1.  Assign [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot), [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot), and [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) to [x](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-x), [y](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-y), [width](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-width), and [height](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-height) respectively.

3.  Return rect.
    **`rotation`, of type [double](https://webidl.spec.whatwg.org/#idl-double), readonly**

The rotation to applied to the VideoFrame when rendered, in degrees clockwise. Rotation applies before flip.

The [rotation](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation) getter steps are to return [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot).
**`flip`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), readonly**

Whether a horizontal flip is applied to the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) when rendered. Flip applies after rotation.

The [flip](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip) getter steps are to return [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot).
**`displayWidth`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Width of the VideoFrame when displayed after applying rotation and aspect ratio adjustments.

The [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-displaywidth) getter steps are to return [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot).
**`displayHeight`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Height of the VideoFrame when displayed after applying rotation and aspect ratio adjustments.

The [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-displayheight) getter steps are to return [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).
**`timestamp`, of type [long long](https://webidl.spec.whatwg.org/#idl-long-long), readonly**

The presentation timestamp, given in microseconds. For decode, timestamp is copied from the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) corresponding to this [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe). For encode, timestamp is copied to the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s corresponding to this [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe).

The [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp) getter steps are to return [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot).
**`duration`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long), readonly, nullable**

The presentation duration, given in microseconds. The duration is copied from the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) corresponding to this VideoFrame.

The [duration](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration) getter steps are to return [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot).
**`colorSpace`, of type [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace), readonly**

The [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) associated with this frame.

The [colorSpace](https://www.w3.org/TR/webcodecs/#dom-videoframe-colorspace) getter steps are to return [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot).

#### [9.4.4. Internal Structures](https://www.w3.org/TR/webcodecs/#videoframe-internal-structures)

combined buffer layout [struct](https://infra.spec.whatwg.org/#struct)

- A allocationSize (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A computedLayouts (a [list](https://infra.spec.whatwg.org/#list) of [computed plane layout](https://www.w3.org/TR/webcodecs/#computed-plane-layout) structs).

A computed plane layout is a [struct](https://infra.spec.whatwg.org/#struct) that consists of:

- A destinationOffset (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A destinationStride (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A sourceTop (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A sourceHeight (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A sourceLeftBytes (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))
- A sourceWidthBytes (an [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long))

#### [9.4.5. Methods](https://www.w3.org/TR/webcodecs/#videoframe-methods)

**`allocationSize(options)`**

Returns the minimum byte length for a valid destination [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) to be used with [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) with the given options.

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  If [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot) is `null`, throw a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  Let combinedLayout be the result of running the [Parse VideoFrameCopyToOptions](https://www.w3.org/TR/webcodecs/#videoframe-parse-videoframecopytooptions) algorithm with options.
4.  If combinedLayout is an exception, throw combinedLayout.
5.  Return combinedLayout’s [allocationSize](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-allocationsize).
    **`copyTo(destination, options)`**

Asynchronously copies the planes of this frame into destination according to options. The format of the data is options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format), if it [exists](https://infra.spec.whatwg.org/#map-exists) or [this](https://webidl.spec.whatwg.org/#this) [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)’s [format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format) otherwise.

NOTE: Promises that are returned by several calls to [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) are not guaranteed to resolve in the order they were returned.

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, return a promise rejected with a [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  If [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot) is `null`, return a promise rejected with a [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
3.  Let combinedLayout be the result of running the [Parse VideoFrameCopyToOptions](https://www.w3.org/TR/webcodecs/#videoframe-parse-videoframecopytooptions) algorithm with options.
4.  If combinedLayout is an exception, return a promise rejected with combinedLayout.
5.  If `destination.byteLength` is less than combinedLayout’s [allocationSize](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-allocationsize), return a promise rejected with a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
6.  If options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format) is equal to one of [RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba), [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx), [BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra), [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx) then:
    1.  Let newOptions be the result of running the [Clone Configuration](https://www.w3.org/TR/webcodecs/#clone-configuration) algorithm with options.
    2.  Assign `undefined` to newOptions.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format).
    3.  Let rgbFrame be the result of running the [Convert to RGB frame](https://www.w3.org/TR/webcodecs/#videoframe-convert-to-rgb-frame) algorithm with [this](https://webidl.spec.whatwg.org/#this), options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format), and options.[colorSpace](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-colorspace).
    4.  Return the result of calling [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) on rgbFrame with destination and newOptions.

7.  Let p be a new [Promise](https://webidl.spec.whatwg.org/#idl-promise).
8.  Let copyStepsQueue be the result of starting a new [parallel queue](https://html.spec.whatwg.org/multipage/infrastructure.html#parallel-queue).
9.  Let planeLayouts be a new [list](https://infra.spec.whatwg.org/#list).
10. Enqueue the following steps to copyStepsQueue:
    1.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
    2.  Let numPlanes be the number of planes as defined by [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
    3.  Let planeIndex be `0`.
    4.  While planeIndex is less than combinedLayout’s numPlanes:
        1.  Let sourceStride be the stride of the plane in resource as identified by planeIndex.
        2.  Let computedLayout be the [computed plane layout](https://www.w3.org/TR/webcodecs/#computed-plane-layout) in combinedLayout’s [computedLayouts](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-computedlayouts) at the position of planeIndex
        3.  Let sourceOffset be the product of multiplying computedLayout’s [sourceTop](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcetop) by sourceStride
        4.  Add computedLayout’s [sourceLeftBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourceleftbytes) to sourceOffset.
        5.  Let destinationOffset be computedLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset).
        6.  Let rowBytes be computedLayout’s [sourceWidthBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcewidthbytes).
        7.  Let layout be a new [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout), with [offset](https://www.w3.org/TR/webcodecs/#dom-planelayout-offset) set to destinationOffset and [stride](https://www.w3.org/TR/webcodecs/#dom-planelayout-stride) set to rowBytes.
        8.  Let row be `0`.
        9.  While row is less than computedLayout’s [sourceHeight](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourceheight):
            1.  Copy rowBytes bytes from resource starting at sourceOffset to destination starting at destinationOffset.
            2.  Increment sourceOffset by sourceStride.
            3.  Increment destinationOffset by computedLayout’s [destinationStride](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationstride).
            4.  Increment row by `1`.

        10. Increment planeIndex by `1`.
        11. Append layout to planeLayouts.

    5.  [Queue a task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task) to resolve p with planeLayouts.

11. Return p.
    **`clone()`**

Creates a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) with a reference to the same [media resource](https://www.w3.org/TR/webcodecs/#media-resource).

When invoked, run these steps:

1.  If the value of frame’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Return the result of running the [Clone VideoFrame](https://www.w3.org/TR/webcodecs/#clone-videoframe) algorithm with [this](https://webidl.spec.whatwg.org/#this).
    **`close()`**

Clears all state and releases the reference to the [media resource](https://www.w3.org/TR/webcodecs/#media-resource). Close is final.

When invoked, run the [Close VideoFrame](https://www.w3.org/TR/webcodecs/#close-videoframe) algorithm with [this](https://webidl.spec.whatwg.org/#this).
**`metadata()`**

Gets the [VideoFrameMetadata](https://www.w3.org/TR/webcodecs/#dictdef-videoframemetadata) associated with this frame.

When invoked, run these steps:

1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw an [InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  Return the result of calling [Copy VideoFrame metadata](https://www.w3.org/TR/webcodecs/#videoframe-copy-videoframe-metadata) with [[[metadata]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-metadata-slot).

#### [9.4.6. Algorithms](https://www.w3.org/TR/webcodecs/#videoframe-algorithms)

#### Create a VideoFrame (with output, timestamp, duration, displayAspectWidth, displayAspectHeight, colorSpace, rotation, and flip)

1.  Let frame be a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe), constructed as follows:
    1.  Assign `false` to [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached).
    2.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) described by output.
    3.  Let resourceReference be a reference to resource.
    4.  Assign resourceReference to [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
    5.  If output uses a recognized [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat), assign that format to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot). Otherwise, assign `null` to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
    6.  Let codedWidth and codedHeight be the coded width and height of the output in pixels.
    7.  Let visibleLeft, visibleTop, visibleWidth, and visibleHeight be the left, top, width and height for the visible rectangle of output.
    8.  Let displayWidth and displayHeight be the display size of output in pixels.
    9.  If displayAspectWidth and displayAspectHeight are provided, increase displayWidth or displayHeight until the ratio of displayWidth to displayHeight matches the ratio of displayAspectWidth to displayAspectHeight.
    10. Assign codedWidth, codedHeight, visibleLeft, visibleTop, visibleWidth, visibleHeight, displayWidth, and displayHeight to [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot), [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot), [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot), [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot), and [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) respectively.
    11. Assign duration and timestamp to [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot) and [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot) respectively.
    12. Assign [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot) with the result of running the [Pick Color Space](https://www.w3.org/TR/webcodecs/#videoframe-pick-color-space) algorithm, with colorSpace and [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
    13. Assign [rotation](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation) and [flip](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip) to rotation and flip respectively.

2.  Return frame.

#### Pick Color Space (with overrideColorSpace and format)

1.  If overrideColorSpace is provided, return a new [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) constructed with overrideColorSpace.

    User Agents _MAY_ replace `null` members of the provided overrideColorSpace with guessed values as determined by implementer defined heuristics.

2.  Otherwise, if [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot) is an [RGB format](https://www.w3.org/TR/webcodecs/#rgb-format) return a new instance of the [sRGB Color Space](https://www.w3.org/TR/webcodecs/#srgb-color-space)
3.  Otherwise, return a new instance of the [REC709 Color Space](https://www.w3.org/TR/webcodecs/#rec709-color-space).

#### Validate VideoFrameInit (with format, codedWidth, and codedHeight):

1.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect) [exists](https://infra.spec.whatwg.org/#map-exists):
    1.  Let validAlignment be the result of running the [Verify Rect Offset Alignment](https://www.w3.org/TR/webcodecs/#videoframe-verify-rect-offset-alignment) with format and visibleRect.
    2.  If validAlignment is `false`, return `false`.
    3.  If any attribute of [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect) is negative or not finite, return `false`.
    4.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) == `0` or [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) == `0` return `false`.
    5.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y) + [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) > codedHeight, return `false`.
    6.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) + [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect).[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) > codedWidth, return `false`.

2.  If codedWidth = 0 or codedHeight = 0,return `false`.
3.  If only one of [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displaywidth) or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displayheight) [exists](https://infra.spec.whatwg.org/#map-exists), return `false`.
4.  If [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displaywidth) == `0` or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displayheight) == `0`, return `false`.
5.  Return `true`.

#### To check if a [VideoFrameBufferInit](https://www.w3.org/TR/webcodecs/#dictdef-videoframebufferinit) is a valid VideoFrameBufferInit, run these steps:

1.  If [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedwidth) = 0 or [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedheight) = 0,return `false`.
2.  If any attribute of [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect) is negative or not finite, return `false`.
3.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y) + [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) > [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedheight), return `false`.
4.  If [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) + [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-visiblerect).[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) > [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-codedwidth), return `false`.
5.  If only one of [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displaywidth) or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displayheight) [exists](https://infra.spec.whatwg.org/#map-exists), return `false`.
6.  If [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displaywidth) = 0 or [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframebufferinit-displayheight) = 0, return `false`.
7.  Return `true`.

#### Initialize Frame From Other Frame (with init, frame, and otherFrame)

1.  Let format be otherFrame.[format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format).
2.  If init.[alpha](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-alpha) is [discard](https://www.w3.org/TR/webcodecs/#dom-alphaoption-discard), assign otherFrame.[format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) format.
3.  Let validInit be the result of running the [Validate VideoFrameInit](https://www.w3.org/TR/webcodecs/#validate-videoframeinit) algorithm with format and otherFrame’s [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot) and [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot).
4.  If validInit is `false`, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
5.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by otherFrame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
6.  Assign a new reference for resource to frame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
7.  Assign the following attributes from otherFrame to frame: [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth), [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight), [colorSpace](https://www.w3.org/TR/webcodecs/#dom-videoframe-colorspace).
8.  Let defaultVisibleRect be the result of performing the getter steps for [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect) on otherFrame.
9.  Let baseRotation and baseFlip be otherFrame’s [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot) and [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot), respectively.
10. Let defaultDisplayWidth and defaultDisplayHeight be otherFrame’s [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot) and [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot), respectively.
11. Run the [Initialize Visible Rect, Orientation, and Display Size](https://www.w3.org/TR/webcodecs/#videoframe-initialize-visible-rect-orientation-and-display-size) algorithm with init, frame, defaultVisibleRect, baseRotation, baseFlip, defaultDisplayWidth, and defaultDisplayHeight.
12. If [duration](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-duration) [exists](https://infra.spec.whatwg.org/#map-exists) in init, assign it to frame’s [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot). Otherwise, assign otherFrame.[duration](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration) to frame’s [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot).
13. If [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-timestamp) [exists](https://infra.spec.whatwg.org/#map-exists) in init, assign it to frame’s [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot). Otherwise, assign otherFrame’s [timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp) to frame’s [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot).
14. Assign format to frame.[[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
15. Assign the result of calling [Copy VideoFrame metadata](https://www.w3.org/TR/webcodecs/#videoframe-copy-videoframe-metadata) with init’s [metadata](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-metadata) to frame.[[[metadata]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-metadata-slot).

#### Initialize Frame With Resource (with init, frame, resource, codedWidth, codedHeight, baseRotation, baseFlip, defaultDisplayWidth, and defaultDisplayHeight)

1.  Let format be `null`.
2.  If resource uses a recognized [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat), assign the [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) of resource to format.
3.  Let validInit be the result of running the [Validate VideoFrameInit](https://www.w3.org/TR/webcodecs/#validate-videoframeinit) algorithm with format, width and height.
4.  If validInit is `false`, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
5.  Assign a new reference for resource to frame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
6.  If init.[alpha](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-alpha) is [discard](https://www.w3.org/TR/webcodecs/#dom-alphaoption-discard), assign format’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) to format.
7.  Assign format to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot)
8.  Assign codedWidth and codedHeight to frame’s [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot) and [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot) respectively.
9.  Let defaultVisibleRect be a new [DOMRect](https://www.w3.org/TR/geometry-1/#domrect) constructed with «\[ "x:" → `0`, "y" → `0`, "width" → codedWidth, "height" → codedHeight \]»
10. Run the [Initialize Visible Rect, Orientation, and Display Size](https://www.w3.org/TR/webcodecs/#videoframe-initialize-visible-rect-orientation-and-display-size) algorithm with init, frame, defaultVisibleRect, defaultDisplayWidth, and defaultDisplayHeight.
11. Assign `init`.[duration](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-duration) to frame’s [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot).
12. Assign `init`.[timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-timestamp) to frame’s [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot).
13. If resource has a known [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace), assign its value to [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot).
14. Otherwise, assign a new [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace), constructed with an empty [VideoColorSpaceInit](https://www.w3.org/TR/webcodecs/#dictdef-videocolorspaceinit), to [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot).

#### Initialize Visible Rect, Orientation, and Display Size (with init, frame, defaultVisibleRect, baseRotation, baseFlip, defaultDisplayWidth and defaultDisplayHeight)

1.  Let visibleRect be defaultVisibleRect.
2.  If init.[visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-visiblerect) [exists](https://infra.spec.whatwg.org/#map-exists), assign it to visibleRect.
3.  Assign visibleRect’s [x](https://www.w3.org/TR/geometry-1/#dom-domrect-x), [y](https://www.w3.org/TR/geometry-1/#dom-domrect-y), [width](https://www.w3.org/TR/geometry-1/#dom-domrect-width), and [height](https://www.w3.org/TR/geometry-1/#dom-domrect-height), to frame’s [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot), [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot), and [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) respectively.
4.  Let rotation be the result of running the [Parse Rotation](https://www.w3.org/TR/webcodecs/#videoframe-parse-rotation) algorithm, with init.[rotation](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-rotation).
5.  Assign the result of running the [Add Rotations](https://www.w3.org/TR/webcodecs/#videoframe-add-rotations) algorithm, with baseRotation, baseFlip, and rotation, to frame’s [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot).
6.  If baseFlip is equal to init.[flip](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-flip), assign `false` to frame’s [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot). Otherwise, assign `true` to frame’s [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot).
7.  If [displayWidth](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displaywidth) and [displayHeight](https://www.w3.org/TR/webcodecs/#dom-videoframeinit-displayheight) [exist](https://infra.spec.whatwg.org/#map-exists) in init, assign them to [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot) and [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot) respectively.
8.  Otherwise:
    1.  If baseRotation is equal to `0` or `180`:
        1.  Let widthScale be the result of dividing defaultDisplayWidth by defaultVisibleRect.[width](https://www.w3.org/TR/geometry-1/#dom-domrect-width).
        2.  Let heightScale be the result of dividing defaultDisplayHeight by defaultVisibleRect.[height](https://www.w3.org/TR/geometry-1/#dom-domrect-height).

    2.  Otherwise:
        1.  Let widthScale be the result of dividing defaultDisplayHeight by defaultVisibleRect.[width](https://www.w3.org/TR/geometry-1/#dom-domrect-width).
        2.  Let heightScale be the result of dividing defaultDisplayWidth by defaultVisibleRect.[height](https://www.w3.org/TR/geometry-1/#dom-domrect-height).

    3.  Let displayWidth be `|frame|'s {{VideoFrame/[[visible width]]}} * |widthScale|`, rounded to the nearest integer.
    4.  Let displayHeight be `|frame|'s {{VideoFrame/[[visible height]]}} * |heightScale|`, rounded to the nearest integer.
    5.  If rotation is equal to `0` or `180`:
        1.  Assign displayWidth to frame’s [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot).
        2.  Assign displayHeight to frame’s [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).

    6.  Otherwise:
        1.  Assign displayHeight to frame’s [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot).
        2.  Assign displayWidth to frame’s [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).

#### Clone VideoFrame (with frame)

1.  Let clone be a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) initialized as follows:
    1.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by frame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
    2.  Let newReference be a new reference to resource.
    3.  Assign newReference to clone’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
    4.  Assign all remaining internal slots of frame (excluding [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot)) to those of the same name in clone.

2.  Return clone.

#### Close VideoFrame (with frame)

1.  Assign `null` to frame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
2.  Assign `true` to frame’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached).
3.  Assign `null` to frame’s [format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format).
4.  Assign `0` to frame’s [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot), [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot), [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot), [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot), [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot), [[[rotation]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation-slot), [[[display width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-width-slot), and [[[display height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-display-height-slot).
5.  Assign `false` to frame’s [[[flip]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip-slot).
6.  Assign a new [VideoFrameMetadata](https://www.w3.org/TR/webcodecs/#dictdef-videoframemetadata) to frame.[[[metadata]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-metadata-slot).

#### Parse Rotation (with rotation)

1.  Let alignedRotation be the nearest multiple of `90` to rotation, rounding ties towards positive infinity.
2.  Let fullTurns be the greatest multiple of `360` less than or equal to alignedRotation.
3.  Return `|alignedRotation| - |fullTurns|`.

#### Add Rotations (with baseRotation, baseFlip, and rotation)

1.  If baseFlip is `false`, let combinedRotation be `|baseRotation| + |rotation|`. Otherwise, let combinedRotation be `|baseRotation| - |rotation|`.
2.  Let fullTurns be the greatest multiple of `360` less than or equal to combinedRotation.
3.  Return `|combinedRotation| - |fullTurns|`.

#### Parse VideoFrameCopyToOptions (with options)

1.  Let defaultRect be the result of performing the getter steps for [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).
2.  Let overrideRect be `undefined`.
3.  If options.[rect](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-rect) [exists](https://infra.spec.whatwg.org/#map-exists), assign the value of options.[rect](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-rect) to overrideRect.
4.  Let parsedRect be the result of running the [Parse Visible Rect](https://www.w3.org/TR/webcodecs/#videoframe-parse-visible-rect) algorithm with defaultRect, overrideRect, [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot), [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot), and [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
5.  If parsedRect is an exception, return parsedRect.
6.  Let optLayout be `undefined`.
7.  If options.[layout](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-layout) [exists](https://infra.spec.whatwg.org/#map-exists), assign its value to optLayout.
8.  Let format be `undefined`.
9.  If options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format) does not [exist](https://infra.spec.whatwg.org/#map-exists), assign [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot) to format.
10. Otherwise, if options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format) is equal to one of [RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba), [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx), [BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra), [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx), then assign options.[format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format) to format, otherwise return [NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror).
11. Let combinedLayout be the result of running the [Compute Layout and Allocation Size](https://www.w3.org/TR/webcodecs/#videoframe-compute-layout-and-allocation-size) algorithm with parsedRect, format, and optLayout.
12. Return combinedLayout.

#### Verify Rect Offset Alignment (with format and rect)

1.  If format is `null`, return `true`.
2.  Let planeIndex be `0`.
3.  Let numPlanes be the number of planes as defined by format.
4.  While planeIndex is less than numPlanes:
    1.  Let plane be the Plane identified by planeIndex as defined by format.
    2.  Let sampleWidth be the horizontal [sub-sampling factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of each subsample for plane.
    3.  Let sampleHeight be the vertical [sub-sampling factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of each subsample for plane.
    4.  If rect.[x](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-x) is not a multiple of sampleWidth, return `false`.
    5.  If rect.[y](https://www.w3.org/TR/geometry-1/#dom-domrectreadonly-y) is not a multiple of sampleHeight, return `false`.
    6.  Increment planeIndex by `1`.

5.  Return `true`.

#### Parse Visible Rect (with defaultRect, overrideRect, codedWidth, codedHeight, and format)

1.  Let sourceRect be defaultRect
2.  If overrideRect is not `undefined`:
    1.  If either of overrideRect.[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) or [height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) is `0`, return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
    2.  If the sum of overrideRect.[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and overrideRect.[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) is greater than codedWidth, return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
    3.  If the sum of overrideRect.[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y) and overrideRect.[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) is greater than codedHeight, return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
    4.  Assign overrideRect to sourceRect.

3.  Let validAlignment be the result of running the [Verify Rect Offset Alignment](https://www.w3.org/TR/webcodecs/#videoframe-verify-rect-offset-alignment) algorithm with format and sourceRect.
4.  If validAlignment is `false`, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
5.  Return sourceRect.

#### Compute Layout and Allocation Size (with parsedRect, format, and layout)
