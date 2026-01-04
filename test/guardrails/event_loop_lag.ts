import {VideoEncoder, VideoFrame} from '@pproenca/node-webcodecs';
import {performance} from 'node:perf_hooks';

const MAX_LAG_MS = 20;
const FRAMES = 50;

async function run(): Promise<void> {
  console.log('Event Loop Latency Check');

  let maxLag = 0;
  let lastTime = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTime;
    const lag = delta - 10;
    if (lag > maxLag) maxLag = lag;
    lastTime = now;
  }, 10);

  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: error => {
      throw error;
    },
  });
  encoder.configure({codec: 'avc1.42001E', width: 1920, height: 1080});

  const buf = Buffer.alloc(1920 * 1080 * 4);

  console.log(`  Encoding ${FRAMES} frames at 1080p...`);
  for (let i = 0; i < FRAMES; i++) {
    const frame = new VideoFrame(buf, {
      codedWidth: 1920,
      codedHeight: 1080,
      timestamp: i * 33000,
    });
    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();
  clearInterval(timer);

  console.log(
    `Max Event Loop Lag: ${maxLag.toFixed(2)}ms (Limit: ${MAX_LAG_MS}ms)`,
  );

  if (maxLag > MAX_LAG_MS) {
    console.warn(
      `WARNING: Encoder blocking event loop. Lag: ${maxLag.toFixed(2)}ms.`,
    );
    console.warn(
      'ACTION REQUIRED: Move encoding to AsyncWorker for production use.',
    );
  } else {
    console.log('SUCCESS: Non-blocking execution.');
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAILURE:', message);
    process.exit(1);
  });
