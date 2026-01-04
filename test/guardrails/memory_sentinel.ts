import {VideoEncoder, VideoFrame} from '@pproenca/node-webcodecs';

async function run(): Promise<void> {
  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: error => {
      throw error;
    },
  });

  encoder.configure({codec: 'avc1.42001E', width: 128, height: 128});
  const buffer = Buffer.alloc(128 * 128 * 4);

  for (let i = 0; i < 10; i++) {
    const frame = new VideoFrame(buffer, {
      codedWidth: 128,
      codedHeight: 128,
      timestamp: i * 1000,
    });
    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();
}

run().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('FAILURE:', message);
  process.exit(1);
});
