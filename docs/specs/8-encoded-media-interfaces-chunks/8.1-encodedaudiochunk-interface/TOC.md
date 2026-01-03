# 8.1. EncodedAudioChunk Interface

```webidl
[Exposed=(Window,DedicatedWorker), Serializable]
interface EncodedAudioChunk {
  constructor(EncodedAudioChunkInit init);
  readonly attribute EncodedAudioChunkType type;
  readonly attribute long long timestamp;          // microseconds
  readonly attribute unsigned long long? duration; // microseconds
  readonly attribute unsigned long byteLength;

  undefined copyTo(AllowSharedBufferSource destination);
};

dictionary EncodedAudioChunkInit {
  required EncodedAudioChunkType type;
  [EnforceRange] required long long timestamp;    // microseconds
  [EnforceRange] unsigned long long duration;     // microseconds
  required AllowSharedBufferSource data;
  sequence<ArrayBuffer> transfer = [];
};

enum EncodedAudioChunkType {
    "key",
    "delta",
};
```
## Subsections

- [8.1.1. Internal Slots](./8.1.1-internal-slots.md)
- [8.1.2. Constructors](./8.1.2-constructors.md)
- [8.1.3. Attributes](./8.1.3-attributes.md)
- [8.1.4. Methods](./8.1.4-methods.md)
- [8.1.5. Serialization](./8.1.5-serialization.md)


---

[← Back to 8. Encoded Media Interfaces (Chunks)](../../8-encoded-media-interfaces-chunks/TOC.md)
