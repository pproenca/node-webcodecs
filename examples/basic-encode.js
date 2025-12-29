const fs = require('fs');
const { VideoEncoder, VideoFrame } = require('../dist');

// Output file
const outFile = fs.createWriteStream('output.h264');
let totalBytes = 0;

// Create encoder
const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
        console.log(`[${chunk.type}] ts=${chunk.timestamp} size=${chunk.byteLength}`);
        outFile.write(chunk.data);
        totalBytes += chunk.byteLength;
    },
    error: (e) => {
        console.error('Encoder error:', e);
    }
});

// Configure for 720p H.264
encoder.configure({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30
});

const width = 1280;
const height = 720;
const frameSize = width * height * 4;
const fps = 30;
const duration = 5; // seconds
const totalFrames = fps * duration;

console.log(`Encoding ${totalFrames} frames (${duration}s @ ${fps}fps)...`);

for (let i = 0; i < totalFrames; i++) {
    // Generate gradient frame
    const buffer = Buffer.alloc(frameSize);
    const progress = i / totalFrames;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            buffer[idx] = Math.floor((x / width) * 255);     // R: horizontal gradient
            buffer[idx + 1] = Math.floor((y / height) * 255); // G: vertical gradient
            buffer[idx + 2] = Math.floor(progress * 255);     // B: time-based
            buffer[idx + 3] = 255;                             // A
        }
    }

    const frame = new VideoFrame(buffer, {
        codedWidth: width,
        codedHeight: height,
        timestamp: Math.floor(i * (1000000 / fps)) // microseconds
    });

    encoder.encode(frame);
    frame.close();

    if ((i + 1) % 30 === 0) {
        console.log(`Progress: ${i + 1}/${totalFrames} frames`);
    }
}

encoder.flush();
encoder.close();
outFile.end();

console.log(`\nDone! Output: output.h264 (${totalBytes} bytes)`);
console.log('Play with: ffplay output.h264');
