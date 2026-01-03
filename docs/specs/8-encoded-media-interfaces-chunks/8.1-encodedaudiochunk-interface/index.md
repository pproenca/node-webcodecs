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

---

[← Back to 8. Encoded Media Interfaces (Chunks)](../../8-encoded-media-interfaces-chunks/index.md)
