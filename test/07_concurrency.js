const {VideoEncoder, VideoFrame} = require('../dist');

console.log('[TEST] Starting Concurrency/Isolation Test...');

const runEncoder = (colorName, colorVal, width, height) => {
  return new Promise((resolve, reject) => {
    let chunkCount = 0;
    const encoder = new VideoEncoder({
      output: chunk => chunkCount++,
      error: reject,
    });

    encoder.configure({codec: 'avc1.42001E', width, height});

    const buf = Buffer.alloc(width * height * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf.writeUInt32BE(colorVal, i);
    }

    for (let i = 0; i < 30; i++) {
      const frame = new VideoFrame(buf, {
        codedWidth: width,
        codedHeight: height,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    encoder.flush().then(() => {
      console.log(
        `[INFO] Encoder ${colorName} finished with ${chunkCount} chunks.`,
      );
      encoder.close();
      resolve(chunkCount);
    });
  });
};

Promise.all([
  runEncoder('RED', 0xff0000ff, 640, 480),
  runEncoder('BLUE', 0x0000ffff, 320, 240),
])
  .then(() => {
    console.log('[PASS] Concurrent encoders ran without crashing.');
  })
  .catch(e => {
    console.error('[FAIL] Concurrency crash:', e);
    process.exit(1);
  });
