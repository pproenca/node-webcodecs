const { VideoEncoder, VideoFrame } = require('../dist');

const LOOPS = 5000;
const LOG_INTERVAL = 500;

console.log(`[TEST] Starting Memory Stress Test (${LOOPS} frames)...`);

const encoder = new VideoEncoder({
    output: (chunk) => {},
    error: (e) => console.error(e)
});

encoder.configure({ codec: 'avc1.42001E', width: 320, height: 240 });

const buf = Buffer.alloc(320 * 240 * 4);
const startMem = process.memoryUsage().rss;

for (let i = 0; i < LOOPS; i++) {
    const frame = new VideoFrame(buf, {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: i * 33000
    });

    encoder.encode(frame);
    frame.close();

    if (i % LOG_INTERVAL === 0) {
        const currentMem = process.memoryUsage().rss;
        const diff = Math.round((currentMem - startMem) / 1024 / 1024);
        console.log(`Frame ${i}: RSS Delta = ${diff} MB`);
    }
}

encoder.flush().then(() => {
    const endMem = process.memoryUsage().rss;
    const growth = (endMem - startMem) / 1024 / 1024;
    console.log(`[INFO] Total RSS Growth: ${growth.toFixed(2)} MB`);

    if (growth > 200) {
        console.error(`[WARN] Possible memory leak detected.`);
    } else {
        console.log(`[PASS] Memory stable.`);
    }
});
