# 9.2. AudioData Interface

```webidl
[Exposed=(Window,DedicatedWorker), Serializable, Transferable]
interface AudioData {
  constructor(AudioDataInit init);

  readonly attribute AudioSampleFormat? format;
  readonly attribute float sampleRate;
  readonly attribute unsigned long numberOfFrames;
  readonly attribute unsigned long numberOfChannels;
  readonly attribute unsigned long long duration;  // microseconds
  readonly attribute long long timestamp;          // microseconds

  unsigned long allocationSize(AudioDataCopyToOptions options);
  undefined copyTo(AllowSharedBufferSource destination, AudioDataCopyToOptions options);
  AudioData clone();
  undefined close();
};

dictionary AudioDataInit {
  required AudioSampleFormat format;
  required float sampleRate;
  [EnforceRange] required unsigned long numberOfFrames;
  [EnforceRange] required unsigned long numberOfChannels;
  [EnforceRange] required long long timestamp;  // microseconds
  required BufferSource data;
  sequence<ArrayBuffer> transfer = [];
};
```

---

[← Back to 9. Raw Media Interfaces](../../9-raw-media-interfaces/index.md)
