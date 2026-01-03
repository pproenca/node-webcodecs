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

---

[← Back to 8. Encoded Media Interfaces (Chunks)](../../8-encoded-media-interfaces-chunks/index.md)
