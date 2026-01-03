# 9.4. VideoFrame Interface

NOTE: [`VideoFrame`](#videoframe) is a [`CanvasImageSource`](https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource). A [`VideoFrame`](#videoframe) can be passed to any method accepting a [`CanvasImageSource`](https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource), including [`CanvasDrawImage`](https://html.spec.whatwg.org/multipage/canvas.html#canvasdrawimage)’s [`drawImage()`](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawimage).

```webidl
[Exposed=(Window,DedicatedWorker), Serializable, Transferable]
interface VideoFrame {
  constructor(CanvasImageSource image, optional VideoFrameInit init = {});
  constructor(AllowSharedBufferSource data, VideoFrameBufferInit init);

  readonly attribute VideoPixelFormat? format;
  readonly attribute unsigned long codedWidth;
  readonly attribute unsigned long codedHeight;
  readonly attribute DOMRectReadOnly? codedRect;
  readonly attribute DOMRectReadOnly? visibleRect;
  readonly attribute double rotation;
  readonly attribute boolean flip;
  readonly attribute unsigned long displayWidth;
  readonly attribute unsigned long displayHeight;
  readonly attribute unsigned long long? duration;  // microseconds
  readonly attribute long long timestamp;           // microseconds
  readonly attribute VideoColorSpace colorSpace;

  VideoFrameMetadata metadata();

  unsigned long allocationSize(
      optional VideoFrameCopyToOptions options = {});
  Promise<sequence<PlaneLayout>> copyTo(
      AllowSharedBufferSource destination,
      optional VideoFrameCopyToOptions options = {});
  VideoFrame clone();
  undefined close();
};

dictionary VideoFrameInit {
  unsigned long long duration;  // microseconds
  long long timestamp;          // microseconds
  AlphaOption alpha = "keep";

  // Default matches image. May be used to efficiently crop. Will trigger
  // new computation of displayWidth and displayHeight using image's pixel
  // aspect ratio unless an explicit displayWidth and displayHeight are given.
  DOMRectInit visibleRect;

  double rotation = 0;
  boolean flip = false;

  // Default matches image unless visibleRect is provided.
  [EnforceRange] unsigned long displayWidth;
  [EnforceRange] unsigned long displayHeight;

  VideoFrameMetadata metadata;
};

dictionary VideoFrameBufferInit {
  required VideoPixelFormat format;
  required [EnforceRange] unsigned long codedWidth;
  required [EnforceRange] unsigned long codedHeight;
  required [EnforceRange] long long timestamp;  // microseconds
  [EnforceRange] unsigned long long duration;  // microseconds

  // Default layout is tightly-packed.
  sequence<PlaneLayout> layout;

  // Default visible rect is coded size positioned at (0,0)
  DOMRectInit visibleRect;

  double rotation = 0;
  boolean flip = false;

  // Default display dimensions match visibleRect.
  [EnforceRange] unsigned long displayWidth;
  [EnforceRange] unsigned long displayHeight;

  VideoColorSpaceInit colorSpace;

  sequence<ArrayBuffer> transfer = [];

  VideoFrameMetadata metadata;
};

dictionary VideoFrameMetadata {
  // Possible members are recorded in the VideoFrame Metadata Registry.
};
```
## Subsections

- [9.4.1. Internal Slots](./9.4.1-internal-slots.md)
- [9.4.2. Constructors](./9.4.2-constructors.md)
- [9.4.3. Attributes](./9.4.3-attributes.md)
- [9.4.4. Internal Structures](./9.4.4-internal-structures.md)
- [9.4.5. Methods](./9.4.5-methods.md)
- [9.4.6. Algorithms](./9.4.6-algorithms.md)
- [9.4.7. Transfer and Serialization](./9.4.7-transfer-and-serialization.md)
- [9.4.8. Rendering](./9.4.8-rendering.md)


---

[← Back to 9. Raw Media Interfaces](../../9-raw-media-interfaces/TOC.md)
