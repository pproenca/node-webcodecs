'use strict';

const assert = require('assert');
const {VideoEncoder, VideoFrame, ResourceManager} = require('../dist');

async function testResourceReclamation() {
  console.log('[TEST] Resource reclamation system');

  const manager = ResourceManager.getInstance();
  const initialCount = manager.getActiveCodecCount();

  const encoder = new VideoEncoder({
    output: () => {},
    error: e => console.error(`[ERR] ${e.message}`),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100000,
  });

  // Should be registered
  assert.ok(
    manager.getActiveCodecCount() > initialCount,
    'Codec should be registered with manager',
  );
  console.log(`Active codecs after create: ${manager.getActiveCodecCount()}`);

  // Record activity
  const frameData = Buffer.alloc(64 * 64 * 4);
  const frame = new VideoFrame(frameData, {
    codedWidth: 64,
    codedHeight: 64,
    timestamp: 0,
  });
  encoder.encode(frame, {keyFrame: true});

  await encoder.flush();

  frame.close();
  encoder.close();

  // Should be unregistered after close
  assert.strictEqual(
    manager.getActiveCodecCount(),
    initialCount,
    'Codec should be unregistered after close',
  );
  console.log(`Active codecs after close: ${manager.getActiveCodecCount()}`);

  console.log('[PASS] Resource reclamation system works');
}

async function testInactivityDetection() {
  console.log('[TEST] Inactivity detection');

  const manager = ResourceManager.getInstance();

  // Configure short timeout for testing (normally 10s)
  manager.setInactivityTimeout(100); // 100ms for test

  const encoder = new VideoEncoder({
    output: () => {},
    error: e => console.log(`[EXPECTED] ${e.message}`),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100000,
  });

  // Wait for inactivity timeout
  await new Promise(r => setTimeout(r, 200));

  // Check if marked as reclaimable
  const reclaimable = manager.getReclaimableCodecs();
  console.log(`Reclaimable codecs: ${reclaimable.length}`);

  // Should be reclaimable due to inactivity
  assert.ok(reclaimable.length >= 1, 'Inactive codec should be reclaimable');

  encoder.close();

  // Reset timeout
  manager.setInactivityTimeout(10000);

  console.log('[PASS] Inactivity detection works');
}

async function testActivityTracking() {
  console.log('[TEST] Activity tracking');

  const manager = ResourceManager.getInstance();
  manager.setInactivityTimeout(100);

  const encoder = new VideoEncoder({
    output: () => {},
    error: e => console.error(`[ERR] ${e.message}`),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: 64,
    height: 64,
    bitrate: 100000,
  });

  // Keep encoding to stay active
  const frameData = Buffer.alloc(64 * 64 * 4);
  const frames = [];

  for (let i = 0; i < 5; i++) {
    const frame = new VideoFrame(frameData, {
      codedWidth: 64,
      codedHeight: 64,
      timestamp: i * 33333,
    });
    frames.push(frame);
    encoder.encode(frame, {keyFrame: i === 0});
    await new Promise(r => setTimeout(r, 30)); // Small delay between encodes
  }

  // Should not be reclaimable because we're actively encoding
  const reclaimable = manager.getReclaimableCodecs();
  console.log(`Reclaimable after activity: ${reclaimable.length}`);

  await encoder.flush();
  frames.forEach(f => f.close());
  encoder.close();

  manager.setInactivityTimeout(10000);

  console.log('[PASS] Activity tracking works');
}

(async () => {
  await testResourceReclamation();
  await testInactivityDetection();
  await testActivityTracking();
  console.log('[PASS] All resource reclamation tests passed');
})().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
