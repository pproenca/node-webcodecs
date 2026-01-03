# 6. VideoEncoder Interface

```webidl
[Exposed=(Window,DedicatedWorker), SecureContext]
interface VideoEncoder : EventTarget {
  constructor(VideoEncoderInit init);

  readonly attribute CodecState state;
  readonly attribute unsigned long encodeQueueSize;
  attribute EventHandler ondequeue;

  undefined configure(VideoEncoderConfig config);
  undefined encode(VideoFrame frame, optional VideoEncoderEncodeOptions options = {});
  Promise<undefined> flush();
  undefined reset();
  undefined close();

  static Promise<VideoEncoderSupport> isConfigSupported(VideoEncoderConfig config);
};

dictionary VideoEncoderInit {
  required EncodedVideoChunkOutputCallback output;
  required WebCodecsErrorCallback error;
};

callback EncodedVideoChunkOutputCallback =
    undefined (EncodedVideoChunk chunk,
               optional EncodedVideoChunkMetadata metadata = {});
```
## Subsections

- [6.1. Internal Slots](./6.1-internal-slots.md)
- [6.2. Constructors](./6.2-constructors.md)
- [6.3. Attributes](./6.3-attributes.md)
- [6.4. Event Summary](./6.4-event-summary.md)
- [6.5. Methods](./6.5-methods.md)
- [6.6. Algorithms](./6.6-algorithms.md)
- [6.7. EncodedVideoChunkMetadata](./6.7-encodedvideochunkmetadata.md)


---

[← Back to Table of Contents](../TOC.md)
