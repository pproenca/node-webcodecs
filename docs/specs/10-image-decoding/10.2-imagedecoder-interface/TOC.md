# 10.2. ImageDecoder Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageDecoder {
  constructor(ImageDecoderInit init);

  readonly attribute DOMString type;
  readonly attribute boolean complete;
  readonly attribute Promise<undefined> completed;
  readonly attribute ImageTrackList tracks;

  Promise<ImageDecodeResult> decode(optional ImageDecodeOptions options = {});
  undefined reset();
  undefined close();

  static Promise<boolean> isTypeSupported(DOMString type);
};
```
## Subsections

- [10.2.1. Internal Slots](./10.2.1-internal-slots.md)
- [10.2.2. Constructor](./10.2.2-constructor.md)
- [10.2.3. Attributes](./10.2.3-attributes.md)
- [10.2.4. Methods](./10.2.4-methods.md)
- [10.2.5. Algorithms](./10.2.5-algorithms.md)


---

[← Back to 10. Image Decoding](../../10-image-decoding/TOC.md)
