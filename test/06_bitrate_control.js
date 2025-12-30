const {VideoEncoder, VideoFrame} = require('../dist');
const assert = require('assert');

console.log('[TEST] Starting Bitrate Control Test...');

function encodeSequence(bitrate) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const encoder = new VideoEncoder({
      output: chunk => {
        totalBytes += chunk.byteLength;
      },
      error: e => reject(e),
    });

    encoder.configure({
      codec: 'avc1.42001E',
      width: 640,
      height: 480,
      framerate: 30,
      bitrate: bitrate,
    });

    const buf = Buffer.alloc(640 * 480 * 4);
    for (let i = 0; i < 60; i++) {
      for (let j = 0; j < buf.length; j += 4) {
        buf.writeUInt32BE(Math.floor(Math.random() * 0xffffffff), j);
      }

      const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: i * 33333,
      });
      encoder.encode(frame);
      frame.close();
    }

    encoder.flush().then(() => {
      encoder.close();
      resolve(totalBytes);
    });
  });
}

Promise.all([encodeSequence(100_000), encodeSequence(5_000_000)])
  .then(([lowSize, highSize]) => {
    console.log(`[INFO] Low Bitrate Size: ${(lowSize / 1024).toFixed(2)} KB`);
    console.log(`[INFO] High Bitrate Size: ${(highSize / 1024).toFixed(2)} KB`);

    const ratio = highSize / lowSize;
    console.log(`[INFO] Ratio: ${ratio.toFixed(2)}x`);

    if (ratio < 2.0) {
      console.error('[FAIL] Encoder ignored bitrate settings!');
      process.exit(1);
    } else {
      console.log('[PASS] Bitrate control validated.');
    }
  })
  .catch(e => {
    console.error('[FAIL]', e);
    process.exit(1);
  });
