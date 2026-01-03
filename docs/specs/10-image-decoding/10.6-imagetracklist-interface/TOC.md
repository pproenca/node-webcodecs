# 10.6. ImageTrackList Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface ImageTrackList {
  getter ImageTrack (unsigned long index);

  readonly attribute Promise<undefined> ready;
  readonly attribute unsigned long length;
  readonly attribute long selectedIndex;
  readonly attribute ImageTrack? selectedTrack;
};
```
## Subsections

- [10.6.1. Internal Slots](./10.6.1-internal-slots.md)
- [10.6.2. Attributes](./10.6.2-attributes.md)


---

[← Back to 10. Image Decoding](../../10-image-decoding/TOC.md)
