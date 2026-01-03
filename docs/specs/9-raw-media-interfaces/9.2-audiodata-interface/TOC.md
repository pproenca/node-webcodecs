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
## Subsections

- [9.2.1. Internal Slots](./9.2.1-internal-slots.md)
- [9.2.2. Constructors](./9.2.2-constructors.md)
- [9.2.3. Attributes](./9.2.3-attributes.md)
- [9.2.4. Methods](./9.2.4-methods.md)
- [9.2.5. Algorithms](./9.2.5-algorithms.md)
- [9.2.6. Transfer and Serialization](./9.2.6-transfer-and-serialization.md)
- [9.2.7. AudioDataCopyToOptions](./9.2.7-audiodatacopytooptions.md)


---

[← Back to 9. Raw Media Interfaces](../../9-raw-media-interfaces/TOC.md)
