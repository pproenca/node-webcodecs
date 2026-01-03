const {VideoEncoder, VideoFrame} = require('@pproenca/node-webcodecs');

const TARGET_FPS = 30;
const FRAMES = 100;

async function run() {
  console.log(`Performance Benchmark (Target: ${TARGET_FPS} FPS at 720p)`);

  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: e => {
      throw e;
    },
  });
  encoder.configure({codec: 'avc1.42001E', width: 1280, height: 720});

  const buf = Buffer.alloc(1280 * 720 * 4);

  console.log(`  Encoding ${FRAMES} frames...`);
  const start = Date.now();

  for (let i = 0; i < FRAMES; i++) {
    const frame = new VideoFrame(buf, {
      codedWidth: 1280,
      codedHeight: 720,
      timestamp: i * 33000, // ~30fps
    });
    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  const durationSec = (Date.now() - start) / 1000;
  const fps = FRAMES / durationSec;

  console.log(
    `Result: ${fps.toFixed(2)} FPS (${durationSec.toFixed(2)}s for ${FRAMES} frames)`,
  );

  if (fps < TARGET_FPS) {
    console.error(
      `FAILURE: Too slow (${fps.toFixed(2)} FPS < ${TARGET_FPS} FPS target)`,
    );
    process.exit(1);
  }
  console.log('SUCCESS: Performance target met.');
}

run().catch(e => {
  console.error('FAILURE:', e.message);
  process.exit(1);
});
