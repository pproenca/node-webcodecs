# 3. AudioDecoder Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface AudioDecoder : EventTarget {
  constructor(AudioDecoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long decodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(AudioDecoderConfig config);
  undefined decode(EncodedAudioChunk chunk);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<AudioDecoderSupport> isConfigSupported(AudioDecoderConfig config);
};

dictionary AudioDecoderInit {
  required AudioDataOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback AudioDataOutputCallback = undefined(AudioData output);
```
## Subsections

- [3.1. Internal Slots](./3.1-internal-slots.md)
- [3.2. Constructors](./3.2-constructors.md)
- [3.3. Attributes](./3.3-attributes.md)
- [3.4. Event Summary](./3.4-event-summary.md)
- [3.5. Methods](./3.5-methods.md)
- [3.6. Algorithms](./3.6-algorithms.md)


---

[← Back to Table of Contents](../TOC.md)
