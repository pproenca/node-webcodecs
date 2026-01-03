# 5. AudioEncoder Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioEncoder : EventTarget {
  constructor(AudioEncoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long encodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioEncoderConfig config);
  undefined encode(AudioData data);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioEncoderSupport> isConfigSupported(AudioEncoderConfig config);
};

dictionary AudioEncoderInit {
  required EncodedAudioChunkOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback EncodedAudioChunkOutputCallback =
    undefined (EncodedAudioChunk output,
               optional EncodedAudioChunkMetadata metadata = {});
```
## Subsections

- [5.1. Internal Slots](./5.1-internal-slots.md)
- [5.2. Constructors](./5.2-constructors.md)
- [5.3. Attributes](./5.3-attributes.md)
- [5.4. Event Summary](./5.4-event-summary.md)
- [5.5. Methods](./5.5-methods.md)
- [5.6. Algorithms](./5.6-algorithms.md)
- [5.7. EncodedAudioChunkMetadata](./5.7-encodedaudiochunkmetadata.md)


---

[← Back to Table of Contents](../TOC.md)
