# 10.7. ImageTrack Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageTrack {
  readonly attribute boolean animated;
  readonly attribute unsigned long frameCount;
  readonly attribute unrestricted float repetitionCount;
  attribute boolean selected;
};
```
## Subsections

- [10.7.1. Internal Slots](./10.7.1-internal-slots.md)
- [10.7.2. Attributes](./10.7.2-attributes.md)


---

[← Back to 10. Image Decoding](../../10-image-decoding/TOC.md)
