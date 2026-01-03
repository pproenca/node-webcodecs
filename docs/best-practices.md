# Best Practices

This document provides best practices for using node-webcodecs effectively, based on the [W3C WebCodecs specification](https://www.w3.org/TR/webcodecs/#best-practices-for-authors-using-webcodecs) and server-side considerations.

## Resource Management

### Always Close Resources

VideoFrame, AudioData, and codec instances hold native resources that must be explicitly released:

```typescript
const frame = new VideoFrame(buffer, options);
try {
  encoder.encode(frame);
} finally {
  frame.close(); // Always close!
}
```

For decoders, close frames in the output callback:

```typescript
const decoder = new VideoDecoder({
  output: (frame) => {
    processFrame(frame);
    frame.close(); // Close immediately after processing
  },
  error: console.error,
});
```

Close codecs when done:

```typescript
await encoder.flush();
encoder.close();
```

### Process Output Promptly

Don't accumulate VideoFrames or AudioData. Process and close them immediately in callbacks to prevent memory buildup:

```typescript
// Good: Process and close immediately
output: (frame) => {
  writeToFile(frame);
  frame.close();
}

// Bad: Accumulating without closing
const frames = [];
output: (frame) => {
  frames.push(frame); // Memory leak!
}
```

## Error Handling

### Use Both Callbacks

Always provide both `output` and `error` callbacks:

```typescript
const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    // Handle encoded data
  },
  error: (e) => {
    console.error("Encoding error:", e);
    // Handle error: retry, fallback, or abort
  },
});
```

### Handle Promise Rejections

`flush()` can reject if encoding/decoding fails:

```typescript
try {
  await encoder.flush();
} catch (e) {
  console.error("Flush failed:", e);
}
```

## Configuration

### Check Support Before Use

Use `isConfigSupported()` before configuring to avoid runtime errors:

```typescript
const config = {
  codec: "avc1.42001e",
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
};

const support = await VideoEncoder.isConfigSupported(config);
if (!support.supported) {
  throw new Error(`Unsupported config: ${JSON.stringify(config)}`);
}

encoder.configure(support.config); // Use returned config for normalization
```

### Match Configuration to Media

Ensure your configuration matches the actual media:

```typescript
// Match dimensions to source
encoder.configure({
  codec: "avc1.42001e",
  width: sourceWidth, // Actual source dimensions
  height: sourceHeight,
  bitrate: calculateBitrate(sourceWidth, sourceHeight),
});

// Match decoder to encoded stream
decoder.configure({
  codec: track.codec,
  codedWidth: track.width,
  codedHeight: track.height,
  description: track.description, // Required for H.264/H.265
});
```

## Queue Management

### Monitor Queue Size

For high-throughput encoding, monitor the queue to avoid memory pressure:

```typescript
async function encodeFrames(frames: VideoFrame[]) {
  for (const frame of frames) {
    // Back-pressure: wait if queue is too large
    while (encoder.encodeQueueSize > 10) {
      await new Promise((resolve) => {
        encoder.ondequeue = resolve;
      });
    }

    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
}
```

### Batch Processing

For batch processing, consider chunking to manage memory:

```typescript
const BATCH_SIZE = 30;

for (let i = 0; i < totalFrames; i += BATCH_SIZE) {
  const batch = frames.slice(i, i + BATCH_SIZE);
  await encodeBatch(batch);

  // Optional: flush between batches for lower memory usage
  await encoder.flush();
}
```

## Threading

### Internal Worker Threads

node-webcodecs uses AsyncWorkers internally for encoding/decoding operations. This means:

- Encoding/decoding runs on background threads
- The Node.js event loop remains responsive
- Callbacks are invoked on the main thread

### Avoid Blocking Callbacks

Keep output callbacks fast to avoid blocking:

```typescript
// Good: Quick processing
output: (chunk) => {
  chunks.push(chunk);
}

// Less ideal: Synchronous file I/O in callback
output: (chunk) => {
  fs.writeFileSync('output.bin', chunk.data); // Blocks event loop
}

// Better: Use async file I/O
const writer = fs.createWriteStream('output.bin');
output: (chunk) => {
  const buffer = new Uint8Array(chunk.byteLength);
  chunk.copyTo(buffer);
  writer.write(buffer);
}
```

## Codec Selection

### Video Codec Guidelines

| Codec  | Use Case                    | Notes                       |
| ------ | --------------------------- | --------------------------- |
| H.264  | Maximum compatibility       | `avc1.42001e` (Baseline)    |
| H.265  | 4K/HDR content              | Better compression          |
| VP9    | Web delivery                | Good browser support        |
| AV1    | Modern applications         | Best compression, slower    |

### Audio Codec Guidelines

| Codec | Use Case                  | Notes            |
| ----- | ------------------------- | ---------------- |
| AAC   | Maximum compatibility     | `mp4a.40.2`      |
| Opus  | Low-latency, VoIP         | Best for speech  |
| FLAC  | Archival, lossless        | Decode only      |

## Common Pitfalls

### Forgetting to Close

Resources not closed will leak memory:

```typescript
// WRONG: frame never closed
const frame = new VideoFrame(buffer, options);
encoder.encode(frame);
// frame.close() missing!

// RIGHT: always close
const frame = new VideoFrame(buffer, options);
encoder.encode(frame);
frame.close();
```

### Encoding on Closed Codec

Operations on a closed codec throw `InvalidStateError`:

```typescript
encoder.close();
encoder.encode(frame); // Throws InvalidStateError!
```

### Missing Description for H.264/H.265

H.264 and H.265 decoders require the `description` field:

```typescript
// WRONG: missing description
decoder.configure({
  codec: "avc1.42001e",
  codedWidth: 1920,
  codedHeight: 1080,
  // description missing - will fail!
});

// RIGHT: include description from encoder metadata
decoder.configure({
  codec: "avc1.42001e",
  codedWidth: 1920,
  codedHeight: 1080,
  description: encoderMetadata.decoderConfig.description,
});
```

### Ignoring Queue Depth

Encoding faster than processing causes memory growth:

```typescript
// WRONG: no queue management
for (const frame of frames) {
  encoder.encode(frame); // Queue grows unbounded!
}

// RIGHT: monitor queue
for (const frame of frames) {
  while (encoder.encodeQueueSize > 10) {
    await new Promise((r) => (encoder.ondequeue = r));
  }
  encoder.encode(frame);
}
```
