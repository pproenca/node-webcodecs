const { VideoEncoder, VideoFrame } = require('../dist');

let chunks = [];
const encoder = new VideoEncoder({
    output: (chunk, meta) => {
        console.log(`[CB] Chunk: ${chunk.type} | TS: ${chunk.timestamp} | Size: ${chunk.byteLength} bytes`);
        chunks.push(chunk);
    },
    error: (e) => console.error(`[ERR] ${e.message}`)
});

console.log(`[TEST] Configuring H.264 (Baseline)...`);
encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1_000_000,
    framerate: 30
});

const buf = Buffer.alloc(640 * 480 * 4);
const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: 0 });

console.log(`[TEST] Encoding KeyFrame...`);
encoder.encode(frame, { keyFrame: true });

console.log(`[TEST] Flushing...`);
encoder.flush().then(() => {
    console.log(`[TEST] Flush complete.`);

    if (chunks.length === 0) throw new Error("No chunks emitted!");
    if (chunks[0].type !== 'key') throw new Error("First chunk was not a Key Frame!");
    if (chunks[0].byteLength === 0) throw new Error("Chunk is empty!");

    console.log(`[PASS] Encoding Pipeline Verified.`);
});
