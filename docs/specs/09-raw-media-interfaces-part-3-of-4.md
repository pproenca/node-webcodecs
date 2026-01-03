---
title: '9. Raw Media Interfaces (Part 3 of 4)'
---

> Section 9 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 3 of 4**

---

1.  Let numPlanes be the number of planes as defined by format.
2.  If layout is not `undefined` and its length does not equal numPlanes, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
3.  Let minAllocationSize be `0`.
4.  Let computedLayouts be a new [list](https://infra.spec.whatwg.org/#list).
5.  Let endOffsets be a new [list](https://infra.spec.whatwg.org/#list).
6.  Let planeIndex be `0`.
7.  While planeIndex < numPlanes:
    1.  Let plane be the Plane identified by planeIndex as defined by format.
    2.  Let sampleBytes be the number of bytes per sample for plane.
    3.  Let sampleWidth be the horizontal [sub-sampling factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of each subsample for plane.
    4.  Let sampleHeight be the vertical [sub-sampling factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of each subsample for plane.
    5.  Let computedLayout be a new [computed plane layout](https://www.w3.org/TR/webcodecs/#computed-plane-layout).
    6.  Set computedLayout’s [sourceTop](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcetop) to the result of the division of truncated parsedRect.[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y) by sampleHeight, rounded up to the nearest integer.
    7.  Set computedLayout’s [sourceHeight](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourceheight) to the result of the division of truncated parsedRect.[height](https://www.w3.org/TR/geometry-1/#dom-domrectinit-height) by sampleHeight, rounded up to the nearest integer.
    8.  Set computedLayout’s [sourceLeftBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourceleftbytes) to the result of the integer division of truncated parsedRect.[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) by sampleWidth, multiplied by sampleBytes.
    9.  Set computedLayout’s [sourceWidthBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcewidthbytes) to the result of the integer division of truncated parsedRect.[width](https://www.w3.org/TR/geometry-1/#dom-domrectinit-width) by sampleWidth, multiplied by sampleBytes.
    10. If layout is not `undefined`:
        1.  Let planeLayout be the [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout) in layout at position planeIndex.
        2.  If planeLayout.[stride](https://www.w3.org/TR/webcodecs/#dom-planelayout-stride) is less than computedLayout’s [sourceWidthBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcewidthbytes), return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
        3.  Assign planeLayout.[offset](https://www.w3.org/TR/webcodecs/#dom-planelayout-offset) to computedLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset).
        4.  Assign planeLayout.[stride](https://www.w3.org/TR/webcodecs/#dom-planelayout-stride) to computedLayout’s [destinationStride](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationstride).

    11. Otherwise:

        NOTE: If an explicit layout was not provided, the following steps default to tight packing.
        1.  Assign minAllocationSize to computedLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset).
        2.  Assign computedLayout’s [sourceWidthBytes](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourcewidthbytes) to computedLayout’s [destinationStride](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationstride).

    12. Let planeSize be the product of multiplying computedLayout’s [destinationStride](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationstride) and [sourceHeight](https://www.w3.org/TR/webcodecs/#computed-plane-layout-sourceheight).
    13. Let planeEnd be the sum of planeSize and computedLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset).
    14. If planeSize or planeEnd is greater than maximum range of [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
    15. Append planeEnd to endOffsets.
    16. Assign the maximum of minAllocationSize and planeEnd to minAllocationSize.

        NOTE: The above step uses a maximum to allow for the possibility that user specified plane offsets reorder planes.

    17. Let earlierPlaneIndex be `0`.
    18. While earlierPlaneIndex is less than planeIndex.
        1.  Let earlierLayout be `computedLayouts[earlierPlaneIndex]`.
        2.  If `endOffsets[planeIndex]` is less than or equal to earlierLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset) or if `endOffsets[earlierPlaneIndex]` is less than or equal to computedLayout’s [destinationOffset](https://www.w3.org/TR/webcodecs/#computed-plane-layout-destinationoffset), continue.

            NOTE: If plane A ends before plane B starts, they do not overlap.

        3.  Otherwise, return a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
        4.  Increment earlierPlaneIndex by `1`.

    19. Append computedLayout to computedLayouts.
    20. Increment planeIndex by `1`.

8.  Let combinedLayout be a new [combined buffer layout](https://www.w3.org/TR/webcodecs/#combined-buffer-layout), initialized as follows:
    1.  Assign computedLayouts to [computedLayouts](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-computedlayouts).
    2.  Assign minAllocationSize to [allocationSize](https://www.w3.org/TR/webcodecs/#combined-buffer-layout-allocationsize).

9.  Return combinedLayout.

#### Convert PredefinedColorSpace to VideoColorSpace (with colorSpace)

1.  Assert: colorSpace is equal to one of [srgb](https://html.spec.whatwg.org/multipage/canvas.html#dom-predefinedcolorspace-srgb) or [display-p3](https://html.spec.whatwg.org/multipage/canvas.html#dom-predefinedcolorspace-display-p3).
2.  If colorSpace is equal to [srgb](https://html.spec.whatwg.org/multipage/canvas.html#dom-predefinedcolorspace-srgb) return a new instance of the [sRGB Color Space](https://www.w3.org/TR/webcodecs/#srgb-color-space)
3.  If colorSpace is equal to [display-p3](https://html.spec.whatwg.org/multipage/canvas.html#dom-predefinedcolorspace-display-p3) return a new instance of the [Display P3 Color Space](https://www.w3.org/TR/webcodecs/#display-p3-color-space)

#### Convert to RGB frame (with frame, format and colorSpace)

1.  This algorithm _MUST_ be called only if format is equal to one of [RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba), [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx), [BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra), [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx).
2.  Let convertedFrame be a new [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe), constructed as follows:
    1.  Assign `false` to [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached).
    2.  Assign format to [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
    3.  Let width be frame’s [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot).
    4.  Let height be frame’s [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot).
    5.  Assign width, height, 0, 0, width, height, width, and height to [[[coded width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-width-slot), [[[coded height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-coded-height-slot), [[[visible left]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-left-slot), [[[visible top]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-top-slot), [[[visible width]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-width-slot), and [[[visible height]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-visible-height-slot) respectively.
    6.  Assign frame’s [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot) and frame’s [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot) to [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-duration-slot) and [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp-slot) respectively.
    7.  Assign the result of running the [Convert PredefinedColorSpace to VideoColorSpace](https://www.w3.org/TR/webcodecs/#convert-predefinedcolorspace-to-videocolorspace) algorithm with colorSpace to [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot).
    8.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) containing the result of conversion of [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by frame’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot) into a color space and pixel format specified by [[[color space]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-color-space-slot) and [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot) respectively.
    9.  Assign the reference to resource to [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot)

3.  Return convertedFrame.

#### Copy VideoFrame metadata (with metadata)

1.  Let metadataCopySerialized be [StructuredSerialize](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserialize)(metadata).
2.  Let metadataCopy be [StructuredDeserialize](https://html.spec.whatwg.org/multipage/structured-data.html#structureddeserialize)(metadataCopySerialized, [the current Realm](https://tc39.es/ecma262/#current-realm)).
3.  Return metadataCopy.

The goal of this algorithm is to ensure that metadata owned by a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) is immutable.

#### [9.4.7. Transfer and Serialization](https://www.w3.org/TR/webcodecs/#videoframe-transfer-serialization)

**The [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [transfer steps](https://html.spec.whatwg.org/multipage/structured-data.html#transfer-steps) (with value and dataHolder) are:**

1.  If value’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  For all [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) internal slots in value, assign the value of each internal slot to a field in dataHolder with the same name as the internal slot.
3.  Run the [Close VideoFrame](https://www.w3.org/TR/webcodecs/#close-videoframe) algorithm with value.
    **The [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [transfer-receiving steps](https://html.spec.whatwg.org/multipage/structured-data.html#transfer-receiving-steps) (with dataHolder and value) are:**

4.  For all named fields in dataHolder, assign the value of each named field to the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) internal slot in value with the same name as the named field.
    **The [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [serialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#serialization-steps) (with value, serialized, and forStorage) are:**

5.  If value’s [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
6.  If forStorage is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror).
7.  Let resource be the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referenced by value’s [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot).
8.  Let newReference be a new reference to resource.
9.  Assign newReference to |serialized.resource reference|.
10. For all remaining [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) internal slots (excluding [[[resource reference]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-resource-reference-slot)) in value, assign the value of each internal slot to a field in serialized with the same name as the internal slot.
    **The [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [deserialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#deserialization-steps) (with serialized and value) are:**

11. For all named fields in serialized, assign the value of each named field to the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) internal slot in value with the same name as the named field.

#### [9.4.8. Rendering](https://www.w3.org/TR/webcodecs/#videoframe-rendering)

When rendered, for example by [CanvasDrawImage](https://html.spec.whatwg.org/multipage/canvas.html#canvasdrawimage) [drawImage()](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawimage), a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) _MUST_ be converted to a color space compatible with the rendering target, unless color conversion is explicitly disabled.

Color space conversion during [ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap) construction is controlled by [ImageBitmapOptions](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmapoptions) [colorSpaceConversion](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-imagebitmapoptions-colorspaceconversion). Setting this value to ["none"](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-colorspaceconversion-none) disables color space conversion.

The rendering of a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) is produced from the [media resource](https://www.w3.org/TR/webcodecs/#media-resource) by applying any necessary color space conversion, cropping to the [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect), rotating clockwise by [rotation](https://www.w3.org/TR/webcodecs/#dom-videoframe-rotation) degrees, and flipping horizontally if [flip](https://www.w3.org/TR/webcodecs/#dom-videoframe-flip) is `true`.

### [9.5. VideoFrame CopyTo() Options](https://www.w3.org/TR/webcodecs/#videoframe-copyto-options)

```webidl
dictionary VideoFrameCopyToOptions {
  DOMRectInit rect;
  sequence<PlaneLayout> layout;
  VideoPixelFormat format;
  PredefinedColorSpace colorSpace;
};
```

NOTE: The steps of [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) or [allocationSize()](https://www.w3.org/TR/webcodecs/#dom-videoframe-allocationsize) will enforce the following requirements:

- The coordinates of [rect](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-rect) are sample-aligned as determined by [[[format]]](https://www.w3.org/TR/webcodecs/#dom-videoframe-format-slot).
- If [layout](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-layout) [exists](https://infra.spec.whatwg.org/#map-exists), a [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout) is provided for all planes.

**`rect`, of type [DOMRectInit](https://www.w3.org/TR/geometry-1/#dictdef-domrectinit)**

A [DOMRectInit](https://www.w3.org/TR/geometry-1/#dictdef-domrectinit) describing the rectangle of pixels to copy from the [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe). If unspecified, the [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect) will be used.

NOTE: The coded rectangle can be specified by passing [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe)’s [codedRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedrect).

NOTE: The default [rect](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-rect) does not necessarily meet the sample-alignment requirement and can result in [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) or [allocationSize()](https://www.w3.org/TR/webcodecs/#dom-videoframe-allocationsize) rejecting.
**`layout`, of type sequence<[PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout)\>**

The [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout) for each plane in [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe), affording the option to specify an offset and stride for each plane in the destination [BufferSource](https://webidl.spec.whatwg.org/#BufferSource). If unspecified, the planes will be tightly packed. It is invalid to specify planes that overlap.
**`format`, of type [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat)**

A [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) for the pixel data in the destination [BufferSource](https://webidl.spec.whatwg.org/#BufferSource). Potential values are: [RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba), [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx), [BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra), [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx). If it does not [exist](https://infra.spec.whatwg.org/#map-exists), the destination [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) will be in the same format as [format](https://www.w3.org/TR/webcodecs/#dom-videoframe-format) .
**`colorSpace`, of type [PredefinedColorSpace](https://html.spec.whatwg.org/multipage/canvas.html#predefinedcolorspace)**

A [PredefinedColorSpace](https://html.spec.whatwg.org/multipage/canvas.html#predefinedcolorspace) that _MUST_ be used as a target color space for the pixel data in the destination [BufferSource](https://webidl.spec.whatwg.org/#BufferSource), but only if [format](https://www.w3.org/TR/webcodecs/#dom-videoframecopytooptions-format) is one of [RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba), [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx), [BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra), [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx), otherwise it is ignored. If it does not [exist](https://infra.spec.whatwg.org/#map-exists), [srgb](https://html.spec.whatwg.org/multipage/canvas.html#dom-predefinedcolorspace-srgb) is used.

### [9.6. DOMRects in VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe-domrect)

[VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [DOMRect](https://www.w3.org/TR/geometry-1/#domrect) [DOMRectInit](https://www.w3.org/TR/geometry-1/#dictdef-domrectinit) [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) [allocationSize()](https://www.w3.org/TR/webcodecs/#dom-videoframe-allocationsize) [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [codedRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedrect) [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect)

NOTE: VideoFrame pixels are only addressable by integer numbers. All floating point values provided to [DOMRectInit](https://www.w3.org/TR/geometry-1/#dictdef-domrectinit) will be truncated.

### [9.7. Plane Layout](https://www.w3.org/TR/webcodecs/#plane-layout)

[PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout) [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout) _MAY_ [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) [copyTo()](https://www.w3.org/TR/webcodecs/#dom-videoframe-copyto) [PlaneLayout](https://www.w3.org/TR/webcodecs/#dictdef-planelayout)

```webidl
dictionary PlaneLayout {
  [EnforceRange] required unsigned long offset;
  [EnforceRange] required unsigned long stride;
};
```

**`offset`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The offset in bytes where the given plane begins within a [BufferSource](https://webidl.spec.whatwg.org/#BufferSource).
**`stride`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

The number of bytes, including padding, used by each row of the plane within a [BufferSource](https://webidl.spec.whatwg.org/#BufferSource).

### [9.8. Pixel Format](https://www.w3.org/TR/webcodecs/#pixel-format)

```webidl
enum VideoPixelFormat {
  // 4:2:0 Y, U, V
  "I420",
  "I420P10",
  "I420P12",
  // 4:2:0 Y, U, V, A
  "I420A",
  "I420AP10",
  "I420AP12",
  // 4:2:2 Y, U, V
  "I422",
  "I422P10",
  "I422P12",
  // 4:2:2 Y, U, V, A
  "I422A",
  "I422AP10",
  "I422AP12",
  // 4:4:4 Y, U, V
  "I444",
  "I444P10",
  "I444P12",
  // 4:4:4 Y, U, V, A
  "I444A",
  "I444AP10",
  "I444AP12",
  // 4:2:0 Y, UV
  "NV12",
  // 4:4:4 RGBA
  "RGBA",
  // 4:4:4 RGBX (opaque)
  "RGBX",
  // 4:4:4 BGRA
  "BGRA",
  // 4:4:4 BGRX (opaque)
  "BGRX",
};
```

Sub-sampling is a technique where a single sample contains information for multiple pixels in the final image. [Sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling) can be horizontal, vertical or both, and has a factor, that is the number of final pixels in the image that are derived from a [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) sample.

[](https://www.w3.org/TR/webcodecs/#example-33b7b945)If a [VideoFrame](https://www.w3.org/TR/webcodecs/#videoframe) is in [I420](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420) format, then the very first component of the second plane (the U plane) corresponds to four pixels, that are the pixels in the top-left angle of the image. Consequently, the first component of the second row corresponds to the four pixels below those initial four top-left pixels. The [sub-sampling factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) is 2 in both the horizontal and vertical direction.

If a [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) has an alpha component, the format’s equivalent opaque format is the same [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat), without an alpha component. If a [VideoPixelFormat](https://www.w3.org/TR/webcodecs/#enumdef-videopixelformat) does not have an alpha component, it is its own [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format).

Integer values are unsigned unless otherwise specified.

**`I420`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order. It is also often refered to as Planar YUV 4:2:0.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in the Y plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.
**`I420P10`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane.

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.
**`I420P12`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane.

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.
**`I420A`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order. It is also often refered to as Planar YUV 4:2:0 with an alpha channel.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.

[I420A](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420a)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I420](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420).
**`I420AP10`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes.

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.

[I420AP10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420ap10)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I420P10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420p10).
**`I420AP12`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes.

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.

[I420AP12](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420ap12)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I420P12](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420p12).
**`I422`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order. It is also often refered to as Planar YUV 4:2:2.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in the Y and plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.
**`I422P10`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.
**`I422P12`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y plane, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.
**`I422A`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order. It is also often refered to as Planar YUV 4:2:2 with an alpha channel.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.

[I422A](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i422a)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I422](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i422).
**`I422AP10`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.

[I422AP10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i422ap10)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I420P10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420p10).
**`I422AP12`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

The U and V planes are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the Y and Alpha planes, and not [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) vertically.

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in the Y and Alpha planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The U and V planes have [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows. Each row has a number of samples equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Samples are arranged starting at the top left of the image.

The visible rectangle horizontal offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x)) _MUST_ be even.

[I422AP10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i422ap10)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I420P10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i420p10).
**`I444`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order. It is also often refered to as Planar YUV 4:4:4.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in all three planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.
**`I444P10`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in all three planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.
**`I444P12`**

This format is composed of three distinct planes, one plane of Luma and two planes of Chroma, denoted Y, U and V, and present in this order.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in all three planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.
**`I444A`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in all four planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

[I444A](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444a)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I444](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444).
**`I444AP10`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 10 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in all four planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

[I444AP10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444ap10)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I444P10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444p10).
**`I444AP12`**

This format is composed of four distinct planes, one plane of Luma, two planes of Chroma, denoted Y, U and V, and one plane of Alpha values, all present in this order.

This format does not use [sub-sampling](https://www.w3.org/TR/webcodecs/#sub-sampling).

Each sample in this format is 12 bits, encoded as a 16-bit integer in little-endian byte order.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples in all four planes, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

[I444AP10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444ap10)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [I444P10](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-i444p10).
**`NV12`**

This format is composed of two distinct planes, one plane of Luma and then another plane for the two Chroma components. The two planes are present in this order, and are refered to as respectively the Y plane and the UV plane.

The U and V components are [sub-sampled](https://www.w3.org/TR/webcodecs/#sub-sampling) horizontally and vertically by a [factor](https://www.w3.org/TR/webcodecs/#sub-sampling-factor) of 2 compared to the components in the Y planes.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) samples (and therefore bytes) in the Y and plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

The UV plane is composed of interleaved U and V values, in a number of rows equal to the result of the division of [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) by 2, rounded up to the nearest integer. Each row has a number of elements equal to the result of the division of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) by 2, rounded up to the nearest integer. Each element is composed of two Chroma samples, the U and V samples, in that order. Samples are arranged starting at the top left of the image.

The visible rectangle offset ([visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[x](https://www.w3.org/TR/geometry-1/#dom-domrectinit-x) and [visibleRect](https://www.w3.org/TR/webcodecs/#dom-videoframe-visiblerect).[y](https://www.w3.org/TR/geometry-1/#dom-domrectinit-y)) _MUST_ be even.

[](https://www.w3.org/TR/webcodecs/#example-26ede914)An image in the NV12 pixel format that is 16 pixels wide and 10 pixels tall will be arranged like so in memory:

YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
YYYYYYYYYYYYYYYY
UVUVUVUVUVUVUVUV
UVUVUVUVUVUVUVUV
UVUVUVUVUVUVUVUV
UVUVUVUVUVUVUVUV
UVUVUVUVUVUVUVUV

All samples being linear in memory.
**`RGBA`**

This format is composed of a single plane, that encodes four components: Red, Green, Blue, and an alpha value, present in this order.

Each sample in this format is 8 bits, and each pixel is therefore 32 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) \* 4 samples (and therefore bytes) in the single plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

[RGBA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgba)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [RGBX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-rgbx).
**`RGBX`**

This format is composed of a single plane, that encodes four components: Red, Green, Blue, and a padding value, present in this order.

Each sample in this format is 8 bits. The fourth element in each pixel is to be ignored, the image is always fully opaque.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) \* 4 samples (and therefore bytes) in the single plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.
**`BGRA`**

This format is composed of a single plane, that encodes four components: Blue, Green, Red, and an alpha value, present in this order.

Each sample in this format is 8 bits.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) \* 4 samples (and therefore bytes) in the single plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

[BGRA](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgra)’s [equivalent opaque format](https://www.w3.org/TR/webcodecs/#equivalent-opaque-format) is [BGRX](https://www.w3.org/TR/webcodecs/#dom-videopixelformat-bgrx).
**`BGRX`**

This format is composed of a single plane, that encodes four components: Blue, Green, Red, and a padding value, present in this order.

Each sample in this format is 8 bits. The fourth element in each pixel is to be ignored, the image is always fully opaque.

There are [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) \* [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) \* 4 samples (and therefore bytes) in the single plane, arranged starting at the top left of the image, in [codedHeight](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedheight) rows of [codedWidth](https://www.w3.org/TR/webcodecs/#dom-videoframe-codedwidth) samples.

### [9.9. Video Color Space Interface](https://www.w3.org/TR/webcodecs/#video-color-space-interface)

```webidl
[Exposed=(Window,DedicatedWorker)]
interface VideoColorSpace {
  constructor(optional VideoColorSpaceInit init = {});

  readonly attribute VideoColorPrimaries? primaries;
  readonly attribute VideoTransferCharacteristics? transfer;
  readonly attribute VideoMatrixCoefficients? matrix;
  readonly attribute boolean? fullRange;

  [Default] VideoColorSpaceInit toJSON();
};

dictionary VideoColorSpaceInit {
  VideoColorPrimaries? primaries = null;
  VideoTransferCharacteristics? transfer = null;
  VideoMatrixCoefficients? matrix = null;
  boolean? fullRange = null;
};
```

#### [9.9.1. Internal Slots](https://www.w3.org/TR/webcodecs/#videocolorspace-internal-slots)

**`[[primaries]]`**

The color primaries.
**`[[transfer]]`**

The transfer characteristics.
**`[[matrix]]`**

The matrix coefficients.
**`[[full range]]`**

Indicates whether full-range color values are used.

#### [9.9.2. Constructors](https://www.w3.org/TR/webcodecs/#videocolorspace-constructors)

`VideoColorSpace(init)`

1.  Let c be a new [VideoColorSpace](https://www.w3.org/TR/webcodecs/#videocolorspace) object, initialized as follows:
    1.  Assign `init.primaries` to [[[primaries]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-primaries-slot).
    2.  Assign `init.transfer` to [[[transfer]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-transfer-slot).
    3.  Assign `init.matrix` to [[[matrix]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-matrix-slot).
    4.  Assign `init.fullRange` to [[[full range]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-full-range-slot).

2.  Return c.

#### [9.9.3. Attributes](https://www.w3.org/TR/webcodecs/#videocolorspace-attributes)

**`primaries`, of type [VideoColorPrimaries](https://www.w3.org/TR/webcodecs/#enumdef-videocolorprimaries), readonly, nullable**

The [primaries](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-primaries) getter steps are to return the value of [[[primaries]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-primaries-slot).
**`transfer`, of type [VideoTransferCharacteristics](https://www.w3.org/TR/webcodecs/#enumdef-videotransfercharacteristics), readonly, nullable**

The [transfer](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-transfer) getter steps are to return the value of [[[transfer]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-transfer-slot).
**`matrix`, of type [VideoMatrixCoefficients](https://www.w3.org/TR/webcodecs/#enumdef-videomatrixcoefficients), readonly, nullable**

The [matrix](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-matrix) getter steps are to return the value of [[[matrix]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-matrix-slot).
**`fullRange`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), readonly, nullable**

The [fullRange](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-fullrange) getter steps are to return the value of [[[full range]]](https://www.w3.org/TR/webcodecs/#dom-videocolorspace-full-range-slot).

### [9.10. Video Color Primaries](https://www.w3.org/TR/webcodecs/#videocolorprimaries)

```webidl
enum VideoColorPrimaries {
  "bt709",
  "bt470bg",
  "smpte170m",
  "bt2020",
  "smpte432",
};
```

**`bt709`**

Color primaries used by BT.709 and sRGB, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.1 table 2 value 1.
**`bt470bg`**

Color primaries used by BT.601 PAL, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.1 table 2 value 5.
**`smpte170m`**

Color primaries used by BT.601 NTSC, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.1 table 2 value 6.
**`bt2020`**

Color primaries used by BT.2020 and BT.2100, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.1 table 2 value 9.
**`smpte432`**

Color primaries used by P3 D65, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.1 table 2 value 12.

### [9.11. Video Transfer Characteristics](https://www.w3.org/TR/webcodecs/#videotransfercharacteristics)

```webidl
enum VideoTransferCharacteristics {
  "bt709",
  "smpte170m",
  "iec61966-2-1",
  "linear",
  "pq",
  "hlg",
};
```

**`bt709`**

Transfer characteristics used by BT.709, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 1.
**`smpte170m`**

Transfer characteristics used by BT.601, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 6. (Functionally the same as "bt709".)
**`iec61966-2-1`**

Transfer characteristics used by sRGB, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 13.
**`linear`**

Transfer characteristics used by linear RGB, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 8.
**`pq`**

Transfer characteristics used by BT.2100 PQ, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 16.
**`hlg`**
