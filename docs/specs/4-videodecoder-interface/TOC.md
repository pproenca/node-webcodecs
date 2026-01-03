# 4. VideoDecoder Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface VideoDecoder : EventTarget {
  constructor(VideoDecoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long decodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(VideoDecoderConfig config);
  undefined decode(EncodedVideoChunk chunk);
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<VideoDecoderSupport> isConfigSupported(VideoDecoderConfig config);
};

dictionary VideoDecoderInit {
  required VideoFrameOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback VideoFrameOutputCallback = undefined(VideoFrame output);
```
## Subsections

- [4.1. Internal Slots](./4.1-internal-slots.md)
- [4.2. Constructors](./4.2-constructors.md)
- [4.3. Attributes](./4.3-attributes.md)
- [4.4. Event Summary](./4.4-event-summary.md)
- [4.5. Methods](./4.5-methods.md)
- [4.6. Algorithms](./4.6-algorithms.md)


---

[← Back to Table of Contents](../TOC.md)
