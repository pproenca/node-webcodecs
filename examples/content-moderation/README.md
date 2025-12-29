# Content Moderation Example

Demonstrates using node-webcodecs for video content moderation with selective frame blurring.

## Overview

This example shows a complete frame-by-frame processing pipeline:

1. **Decode** - Extract frames from video (simulated with generated frames)
2. **Detect** - Run AI detection on each frame (mocked in this example)
3. **Blur** - Apply blur to detected regions using `VideoFilter`
4. **Encode** - Re-encode processed frames to H.264

## Usage

```bash
# From project root
npm run build
node examples/content-moderation/moderate.js
```

## Expected Output

```
=== Content Moderation Pipeline Demo ===

[1/4] Generating 10 test frames (320x240)...
    Created 10 frames

[2/4] Initializing VideoFilter and VideoEncoder...
    Filter and encoder ready

[3/4] Processing frames (detect -> blur -> encode)...
    Frame 0: clean
    Frame 1: clean
    Frame 2: DETECTED 1 region(s) -> BLURRED
    Frame 3: DETECTED 1 region(s) -> BLURRED
    Frame 4: DETECTED 1 region(s) -> BLURRED
    Frame 5: clean
    ...

[4/4] Moderation Summary:
──────────────────────────────────────────────────
    Total frames processed: 10
    Frames with detections: 3
    ...

=== Demo Complete ===
```

## Integrating Real AI Detection

Replace `mockDetectContent()` with your AI model:

```javascript
const ort = require('onnxruntime-node');

async function detectContent(frame) {
    const session = await ort.InferenceSession.create('model.onnx');
    const tensor = preprocessFrame(frame);
    const results = await session.run({ input: tensor });
    return parseDetections(results);
}
```

## API Reference

### VideoFilter

```javascript
const filter = new VideoFilter();
filter.configure({ width: 1920, height: 1080 });

const blurred = filter.applyBlur(frame, [
    { x: 100, y: 100, width: 200, height: 150 }
], 30);  // strength: 1-100

filter.close();
```
