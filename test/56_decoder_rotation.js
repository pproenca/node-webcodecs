const assert = require('assert');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  EncodedVideoChunk,
} = require('../dist/index.js');

console.log('Testing VideoDecoder rotation/flip handling...');

const width = 320;
const height = 240;
const encodedChunks = [];
let decodedFrame = null;

// First, encode a frame
const encoder = new VideoEncoder({
  output: chunk => {
    encodedChunks.push(chunk);
  },
  error: e => console.error('Encoder error:', e),
});

encoder.configure({
  codec: 'avc1.42001f',
  width: width,
  height: height,
  bitrate: 1000000,
});

const frameData = Buffer.alloc(width * height * 4);
const frame = new VideoFrame(frameData, {
  format: 'RGBA',
  codedWidth: width,
  codedHeight: height,
  timestamp: 0,
});

encoder.encode(frame, {keyFrame: true});
frame.close();

encoder
  .flush()
  .then(() => {
    encoder.close();

    // Test 1: Decode with rotation config
    console.log('Test 1: Rotation 90 degrees');
    const decoder1 = new VideoDecoder({
      output: frame => {
        decodedFrame = frame;
      },
      error: e => console.error('Decoder error:', e),
    });

    decoder1.configure({
      codec: 'avc1.42001f',
      codedWidth: width,
      codedHeight: height,
      rotation: 90, // Rotate 90 degrees
    });

    for (const chunk of encodedChunks) {
      decoder1.decode(chunk);
    }

    return decoder1.flush().then(() => {
      assert(decodedFrame !== null, 'Should have decoded a frame');
      assert.strictEqual(
        decodedFrame.rotation,
        90,
        'Frame should have rotation=90',
      );
      assert.strictEqual(
        decodedFrame.flip,
        false,
        'Frame should have flip=false',
      );
      decodedFrame.close();
      decoder1.close();
      console.log('Test 1 passed!');
    });
  })
  .then(() => {
    // Test 2: Decode with flip config
    console.log('Test 2: Flip enabled');
    decodedFrame = null;
    const decoder2 = new VideoDecoder({
      output: frame => {
        decodedFrame = frame;
      },
      error: e => console.error('Decoder error:', e),
    });

    decoder2.configure({
      codec: 'avc1.42001f',
      codedWidth: width,
      codedHeight: height,
      flip: true,
    });

    for (const chunk of encodedChunks) {
      decoder2.decode(chunk);
    }

    return decoder2.flush().then(() => {
      assert(decodedFrame !== null, 'Should have decoded a frame');
      assert.strictEqual(
        decodedFrame.rotation,
        0,
        'Frame should have rotation=0',
      );
      assert.strictEqual(
        decodedFrame.flip,
        true,
        'Frame should have flip=true',
      );
      decodedFrame.close();
      decoder2.close();
      console.log('Test 2 passed!');
    });
  })
  .then(() => {
    // Test 3: Decode with both rotation and flip
    console.log('Test 3: Rotation 180 + flip');
    decodedFrame = null;
    const decoder3 = new VideoDecoder({
      output: frame => {
        decodedFrame = frame;
      },
      error: e => console.error('Decoder error:', e),
    });

    decoder3.configure({
      codec: 'avc1.42001f',
      codedWidth: width,
      codedHeight: height,
      rotation: 180,
      flip: true,
    });

    for (const chunk of encodedChunks) {
      decoder3.decode(chunk);
    }

    return decoder3.flush().then(() => {
      assert(decodedFrame !== null, 'Should have decoded a frame');
      assert.strictEqual(
        decodedFrame.rotation,
        180,
        'Frame should have rotation=180',
      );
      assert.strictEqual(
        decodedFrame.flip,
        true,
        'Frame should have flip=true',
      );
      decodedFrame.close();
      decoder3.close();
      console.log('Test 3 passed!');
    });
  })
  .then(() => {
    // Test 4: Invalid rotation value should throw
    console.log('Test 4: Invalid rotation value');
    const decoder4 = new VideoDecoder({
      output: () => {},
      error: () => {},
    });

    try {
      decoder4.configure({
        codec: 'avc1.42001f',
        codedWidth: width,
        codedHeight: height,
        rotation: 45, // Invalid: must be 0, 90, 180, or 270
      });
      assert.fail('Should have thrown for invalid rotation');
    } catch (e) {
      assert(
        e.message.includes('rotation must be 0, 90, 180, or 270'),
        'Should throw error about invalid rotation',
      );
      console.log('Test 4 passed!');
    }
  })
  .then(() => {
    // Test 5: Default values (no rotation/flip specified)
    console.log('Test 5: Default values');
    decodedFrame = null;
    const decoder5 = new VideoDecoder({
      output: frame => {
        decodedFrame = frame;
      },
      error: e => console.error('Decoder error:', e),
    });

    decoder5.configure({
      codec: 'avc1.42001f',
      codedWidth: width,
      codedHeight: height,
      // No rotation or flip specified
    });

    for (const chunk of encodedChunks) {
      decoder5.decode(chunk);
    }

    return decoder5.flush().then(() => {
      assert(decodedFrame !== null, 'Should have decoded a frame');
      assert.strictEqual(
        decodedFrame.rotation,
        0,
        'Default rotation should be 0',
      );
      assert.strictEqual(
        decodedFrame.flip,
        false,
        'Default flip should be false',
      );
      decodedFrame.close();
      decoder5.close();
      console.log('Test 5 passed!');
    });
  })
  .then(() => {
    console.log('All decoder rotation/flip tests passed!');
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
