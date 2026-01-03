# 8.2. EncodedVideoChunk Interface

```webidl
[Exposed=(Window,DedicatedWorker), Serializable]
interface EncodedVideoChunk {
  constructor(EncodedVideoChunkInit init);
  readonly attribute EncodedVideoChunkType type;
  readonly attribute long long timestamp;             // microseconds
  readonly attribute unsigned long long? duration;    // microseconds
  readonly attribute unsigned long byteLength;

  undefined copyTo(AllowSharedBufferSource destination);
};

dictionary EncodedVideoChunkInit {
  required EncodedVideoChunkType type;
  [EnforceRange] required long long timestamp;        // microseconds
  [EnforceRange] unsigned long long duration;         // microseconds
  required AllowSharedBufferSource data;
  sequence<ArrayBuffer> transfer = [];
};

enum EncodedVideoChunkType {
    "key",
    "delta",
};
```
## Subsections

- [8.2.1. Internal Slots](./8.2.1-internal-slots.md)
- [8.2.2. Constructors](./8.2.2-constructors.md)
- [8.2.3. Attributes](./8.2.3-attributes.md)
- [8.2.4. Methods](./8.2.4-methods.md)
- [8.2.5. Serialization](./8.2.5-serialization.md)


---

[← Back to 8. Encoded Media Interfaces (Chunks)](../../8-encoded-media-interfaces-chunks/TOC.md)
