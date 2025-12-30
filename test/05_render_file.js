const {VideoEncoder, VideoFrame} = require('../dist');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, 'output.h264');
const chunks = [];

console.log('[TEST] Starting H.264 File Render Test...');

const encoder = new VideoEncoder({
  output: chunk => {
    chunks.push(chunk.data);
  },
  error: e => console.error(`[ERR] ${e.message}`),
});

encoder.configure({
  codec: 'avc1.42001E',
  width: 640,
  height: 480,
  bitrate: 1_000_000,
  framerate: 30,
});

const width = 640;
const height = 480;
const redBuf = Buffer.alloc(width * height * 4);
const blueBuf = Buffer.alloc(width * height * 4);

for (let i = 0; i < redBuf.length; i += 4) {
  redBuf[i] = 255;
  redBuf[i + 1] = 0;
  redBuf[i + 2] = 0;
  redBuf[i + 3] = 255;
}

for (let i = 0; i < blueBuf.length; i += 4) {
  blueBuf[i] = 0;
  blueBuf[i + 1] = 0;
  blueBuf[i + 2] = 255;
  blueBuf[i + 3] = 255;
}

console.log('[TEST] Encoding 60 frames (Red/Blue alternating)...');

for (let i = 0; i < 60; i++) {
  const buf = i % 2 === 0 ? redBuf : blueBuf;
  const frame = new VideoFrame(buf, {
    codedWidth: width,
    codedHeight: height,
    timestamp: i * 33333,
  });

  encoder.encode(frame, {keyFrame: i === 0});
  frame.close();
}

encoder.flush().then(() => {
  const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
  const output = Buffer.concat(chunks, totalSize);

  fs.writeFileSync(OUTPUT_PATH, output);

  console.log(`[INFO] Wrote ${output.length} bytes to ${OUTPUT_PATH}`);
  console.log(`[INFO] Verify with: ffprobe -show_streams ${OUTPUT_PATH}`);
  console.log('[PASS] H.264 file generated.');
});
