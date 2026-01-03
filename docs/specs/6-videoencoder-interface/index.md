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

---

[← Back to Table of Contents](../toc.md)
